"""Focused checks for the Meta Muse Voice Transcribe integration.

These tests never call Meta. They cover the pure model-selection, audio-format,
redaction, and discovery-shape logic so the integration can be verified without
a Model API key. Live verification is documented in the task report.
"""

import asyncio
import io
import json
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

import meta_asr  # noqa: E402


def _wav_bytes(*, rate: int = 24000, channels: int = 1, width: int = 2, seconds: float = 0.2) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(width)
        writer.setframerate(rate)
        writer.writeframes(b"\x00\x00" * channels * int(rate * seconds))
    return buffer.getvalue()


def test_documented_model_id_is_the_expected_catalogue_value():
    assert meta_asr.DOCUMENTED_ASR_MODEL_ID == "muse-voice-transcribe-1.0"


def test_selects_documented_model_when_present():
    models = [
        {"id": "muse-spark-1.3", "created": 100},
        {"id": "muse-voice-transcribe-1.0", "created": 90},
    ]
    assert meta_asr.select_meta_asr_model(models) == "muse-voice-transcribe-1.0"


def test_selects_newest_voice_transcribe_model():
    models = [
        {"id": "muse-voice-transcribe-1.0", "created": 10},
        {"id": "muse-voice-transcribe-1.1", "created": 20},
        {"id": "muse-spark-1.3", "created": 30},
    ]
    assert meta_asr.select_meta_asr_model(models) == "muse-voice-transcribe-1.1"


def test_honours_override_only_when_catalogue_contains_it():
    models = [{"id": "muse-voice-transcribe-1.0", "created": 10}]
    assert (
        meta_asr.select_meta_asr_model(models, "muse-voice-transcribe-1.0")
        == "muse-voice-transcribe-1.0"
    )
    with pytest.raises(meta_asr.MetaASRError) as excinfo:
        meta_asr.select_meta_asr_model(models, "muse-voice-transcribe-9.9")
    assert excinfo.value.code == "model_unavailable"
    assert "muse-voice-transcribe-1.0" in excinfo.value.public_message


def test_no_asr_model_is_an_error_not_a_guess():
    with pytest.raises(meta_asr.MetaASRError) as excinfo:
        meta_asr.select_meta_asr_model([{"id": "muse-spark-1.3", "created": 1}])
    assert excinfo.value.code == "model_unavailable"


def test_meta_compatible_wav_accepts_24khz_mono_pcm():
    assert meta_asr.is_meta_compatible_wav(_wav_bytes(rate=24000))
    assert meta_asr.is_meta_compatible_wav(_wav_bytes(rate=16000))


def test_meta_compatible_wav_rejects_wrong_rate_and_channels():
    assert not meta_asr.is_meta_compatible_wav(_wav_bytes(rate=44100))
    assert not meta_asr.is_meta_compatible_wav(_wav_bytes(channels=2))
    assert not meta_asr.is_meta_compatible_wav(b"not a wav file")


def test_turn_segments_do_not_invent_speaker_identity():
    segments = meta_asr.turn_segments(
        [
            {"turnId": 1, "startMs": 10, "endMs": 20, "transcript": "Hello", "speaker": "A"},
            {"turnId": 2, "startMs": 30, "endMs": 40, "transcript": "Hi", "speaker": "B"},
        ]
    )
    assert [segment["text"] for segment in segments] == ["Hello", "Hi"]
    assert {segment["speaker"] for segment in segments} == {"UNKNOWN"}
    assert segments[0]["startTime"] == 0.01


def test_language_bias_maps_iso_codes_and_names():
    assert meta_asr.language_bias("en") == ["English"]
    assert meta_asr.language_bias("Spanish") == ["Spanish"]
    assert meta_asr.language_bias("xx") == []


def test_api_key_ignores_placeholders_and_reads_model_api_key(monkeypatch):
    monkeypatch.delenv("META_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_API_KEY", "replace_with_your_key")
    assert meta_asr.meta_api_key() is None

    monkeypatch.setenv("MODEL_API_KEY", "real-test-key")
    assert meta_asr.meta_api_key() == "real-test-key"

    monkeypatch.setenv("META_API_KEY", "preferred-test-key")
    assert meta_asr.meta_api_key() == "preferred-test-key"

    monkeypatch.setenv("META_API_KEY", "replace_with_your_meta_model_api_key")
    assert meta_asr.meta_api_key() == "real-test-key"


def test_auth_error_message_never_contains_the_key(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "super-secret-test-key")
    response = httpx.Response(
        401,
        json={"error": {"message": "bad key super-secret-test-key", "code": "invalid_api_key"}},
    )
    error = meta_asr._error_from_response(response)
    assert error.code == "authentication_error"
    assert "super-secret-test-key" not in error.public_message
    assert "super-secret-test-key" not in str(error)


def test_model_discovery_uses_bearer_auth_and_returns_catalogue(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "discovery-test-key")
    seen = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "object": "list",
                "data": [
                    {"id": "muse-voice-transcribe-1.0", "created": 123},
                    {"id": "muse-spark-1.3", "created": 456},
                ],
            }

    class FakeClient:
        def __init__(self, **kwargs):
            seen["timeout"] = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, headers=None):
            seen["url"] = url
            seen["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(meta_asr.httpx, "AsyncClient", FakeClient)
    models = asyncio.run(meta_asr.list_meta_models(force=True))

    assert seen["url"] == "https://api.meta.ai/v1/models"
    assert seen["headers"]["Authorization"] == "Bearer discovery-test-key"
    assert [model["id"] for model in models] == [
        "muse-voice-transcribe-1.0",
        "muse-spark-1.3",
    ]
    assert meta_asr.select_meta_asr_model(models) == "muse-voice-transcribe-1.0"


def test_model_discovery_without_a_key_is_reported_without_network(monkeypatch):
    monkeypatch.delenv("META_API_KEY", raising=False)
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    with pytest.raises(meta_asr.MetaASRError) as excinfo:
        asyncio.run(meta_asr.list_meta_models(force=True))
    assert excinfo.value.code == "not_configured"


def test_language_bias_covers_every_documented_language():
    documented = {
        "Arabic",
        "Bengali",
        "Dutch",
        "English",
        "French",
        "German",
        "Hebrew",
        "Hindi",
        "Indonesian",
        "Italian",
        "Japanese",
        "Kannada",
        "Korean",
        "Malay",
        "Mandarin Chinese",
        "Marathi",
        "Polish",
        "Portuguese",
        "Spanish",
        "Tagalog",
        "Tamil",
        "Telugu",
        "Thai",
        "Turkish",
        "Vietnamese",
    }
    assert set(meta_asr.LANGUAGE_NAMES.values()) == documented
    assert meta_asr.language_bias("nl") == ["Dutch"]


def test_ffmpeg_conversion_returns_seekable_24khz_mono_wav():
    """Catches pipe-written WAV headers and non-seekable MP4 stdin regressions."""

    ffmpeg = meta_asr._ffmpeg_path()
    if not ffmpeg:
        pytest.skip("ffmpeg is not installed")

    source = _wav_bytes(rate=44100, channels=2, seconds=0.4)
    converted = asyncio.run(meta_asr.convert_to_meta_wav(source, ".wav"))
    assert meta_asr.is_meta_compatible_wav(converted)
    assert abs(meta_asr._wav_duration_seconds(converted) - 0.4) < 0.05

    workdir = tempfile.mkdtemp(prefix="meta-asr-test-")
    try:
        source_wav = Path(workdir) / "source.wav"
        source_m4a = Path(workdir) / "source.m4a"
        source_wav.write_bytes(source)
        subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source_wav),
                "-ac",
                "2",
                "-ar",
                "44100",
                "-c:a",
                "aac",
                str(source_m4a),
            ],
            check=True,
        )
        converted_m4a = asyncio.run(
            meta_asr.convert_to_meta_wav(source_m4a.read_bytes(), ".m4a")
        )
        assert meta_asr.is_meta_compatible_wav(converted_m4a)
        assert abs(meta_asr._wav_duration_seconds(converted_m4a) - 0.4) < 0.1
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def test_file_transcription_uses_documented_multipart_shape(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "unit-test-key")
    seen = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "sessionId": "meta-session-1",
                "transcript": "Hello there. Hi.",
                "audioDurationMs": 1200,
                "turns": [
                    {
                        "turnId": 1,
                        "startMs": 0,
                        "endMs": 500,
                        "transcript": "Hello there.",
                        "speaker": "A",
                    },
                    {
                        "turnId": 2,
                        "startMs": 600,
                        "endMs": 1200,
                        "transcript": "Hi.",
                        "speaker": "B",
                    },
                ],
            }

    class FakeClient:
        def __init__(self, **kwargs):
            seen["timeout"] = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, files=None):
            seen["url"] = url
            seen["headers"] = headers
            seen["files"] = files
            return FakeResponse()

    async def fake_model():
        return "muse-voice-transcribe-1.0"

    monkeypatch.setattr(meta_asr.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(meta_asr, "resolve_meta_asr_model", fake_model)

    wav = _wav_bytes(rate=24000, seconds=0.2)
    result = asyncio.run(
        meta_asr.transcribe_with_meta(
            wav,
            filename="recording.wav",
            mode="DIARIZATION",
            language="en",
            keywords=["RecordioAI"],
        )
    )

    assert seen["url"] == "https://api.meta.ai/v1/asr/transcribe"
    assert seen["headers"]["Authorization"] == "Bearer unit-test-key"
    request_part = seen["files"]["request"]
    settings = json.loads(request_part[1])
    assert settings == {
        "model": "muse-voice-transcribe-1.0",
        "audioEncoding": "WAV",
        "mode": "DIARIZATION",
        "languageBias": ["English"],
        "keywords": ["RecordioAI"],
    }
    audio_part = seen["files"]["audio"]
    assert audio_part[0] == "recording.wav"
    assert audio_part[2] == "audio/wav"
    assert audio_part[1] == wav

    assert result.transcript == "Hello there. Hi."
    assert result.model == "muse-voice-transcribe-1.0"
    assert result.session_id == "meta-session-1"
    assert [segment["text"] for segment in result.segments] == [
        "Hello there.",
        "Hi.",
    ]
    assert {segment["speaker"] for segment in result.segments} == {"UNKNOWN"}


class _FakeWebSocket:
    def __init__(self, incoming):
        self.incoming = list(incoming)
        self.sent = []
        self.close_code = None
        self.close_reason = ""

    async def send(self, data):
        self.sent.append(data)

    async def recv(self):
        return self.incoming.pop(0)

    async def close(self, code=1000):
        self.close_code = code

    def __aiter__(self):
        return self

    async def __anext__(self):
        # Let the concurrent sender task run before each event, matching a real
        # network event loop.
        await asyncio.sleep(0)
        if not self.incoming:
            raise StopAsyncIteration
        return self.incoming.pop(0)


def test_realtime_handshake_authenticates_in_the_first_frame(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "unit-test-key")
    seen = {}
    fake = _FakeWebSocket([json.dumps({"sessionId": "realtime-session-1"})])

    async def fake_model():
        return "muse-voice-transcribe-1.0"

    async def fake_connect(uri, **kwargs):
        seen["uri"] = uri
        seen["kwargs"] = kwargs
        return fake

    monkeypatch.setattr(meta_asr, "resolve_meta_asr_model", fake_model)
    monkeypatch.setattr(meta_asr.websockets, "connect", fake_connect)

    session = asyncio.run(
        meta_asr.MetaRealtimeSession.connect(
            mode="PUSH_TO_TALK",
            language="English",
            session_id="recordioai-test",
        )
    )

    assert seen["uri"] == (
        "wss://api.meta.ai/v1/asr/realtime?sessionId=recordioai-test"
    )
    handshake = json.loads(fake.sent[0])
    assert handshake["authorization"] == {"accessToken": "Bearer unit-test-key"}
    assert handshake["model"] == "muse-voice-transcribe-1.0"
    assert handshake["mode"] == "PUSH_TO_TALK"
    assert handshake["audioEncoding"] == "PCM_24KHZ"
    assert handshake["languageBias"] == ["English"]
    assert session.session_id == "realtime-session-1"


def test_realtime_collects_the_final_push_to_talk_transcript(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "unit-test-key")
    fake = _FakeWebSocket(
        [
            json.dumps({"sessionId": "realtime-session-2"}),
            json.dumps(
                {
                    "type": "transcript",
                    "transcript": "Hello",
                    "final": False,
                }
            ),
            json.dumps(
                {
                    "type": "transcript",
                    "transcript": "Hello world.",
                    "final": True,
                }
            ),
        ]
    )

    async def fake_model():
        return "muse-voice-transcribe-1.0"

    async def fake_connect(uri, **kwargs):
        return fake

    monkeypatch.setattr(meta_asr, "resolve_meta_asr_model", fake_model)
    monkeypatch.setattr(meta_asr.websockets, "connect", fake_connect)

    async def frames():
        yield b"\x00\x00" * 1024

    result = asyncio.run(meta_asr.transcribe_realtime(frames()))

    assert result.transcript == "Hello world."
    assert result.session_id == "realtime-session-2"
    assert json.loads(fake.sent[-1]) == {"type": "endStream"}
