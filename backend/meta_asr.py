"""Server-side Meta Muse Voice Transcribe integration.

Official docs:
  https://dev.meta.ai/docs/speech-to-text
  https://dev.meta.ai/docs/api-reference/voice/transcribe
  https://dev.meta.ai/docs/api-reference/voice/realtime

The Model API key must only ever live on the backend (``META_API_KEY`` or the
``MODEL_API_KEY`` name used by Meta's examples). Nothing in this module returns
the key to a caller or writes it to logs.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import shutil
import tempfile
import time
import uuid
import wave
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional
from urllib.parse import quote

import httpx
import websockets

logger = logging.getLogger(__name__)

META_API_BASE = "https://api.meta.ai/v1"
META_MODELS_URL = f"{META_API_BASE}/models"
META_FILE_TRANSCRIBE_URL = f"{META_API_BASE}/asr/transcribe"
META_REALTIME_URL = "wss://api.meta.ai/v1/asr/realtime"

# Confirmed by Meta's public model catalogue (docs/models). The value is also
# checked against GET /v1/models before it is used, unless an explicit override
# is supplied and found in that list.
DOCUMENTED_ASR_MODEL_ID = "muse-voice-transcribe-1.0"

MAX_AUDIO_BYTES = 32 * 1024 * 1024
MAX_AUDIO_SECONDS = 10 * 60
MODEL_CACHE_TTL_SECONDS = 10 * 60

# Meta expects language names, not ISO codes. Keep the mapping small and
# explicit; unknown codes are omitted so the model auto-detects the language.
LANGUAGE_NAMES = {
    "ar": "Arabic",
    "bn": "Bengali",
    "de": "German",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "he": "Hebrew",
    "hi": "Hindi",
    "id": "Indonesian",
    "it": "Italian",
    "ja": "Japanese",
    "kn": "Kannada",
    "ko": "Korean",
    "ms": "Malay",
    "mr": "Marathi",
    "nl": "Dutch",
    "pl": "Polish",
    "pt": "Portuguese",
    "ta": "Tamil",
    "te": "Telugu",
    "th": "Thai",
    "tl": "Tagalog",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "zh": "Mandarin Chinese",
}

VALID_MODES = ("PUSH_TO_TALK", "ENDPOINTING", "DIARIZATION")
VALID_ENCODINGS = ("PCM_24KHZ", "PCM_16KHZ")

_models_cache: list[dict[str, Any]] = []
_models_cache_at = 0.0
_model_cache: Optional[str] = None
_model_cache_at = 0.0


class MetaASRError(RuntimeError):
    """A safe, user-facing Meta transcription failure."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "meta_asr_error",
        status: Optional[int] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.public_message = message
        self.code = code
        self.status = status
        self.retryable = retryable


@dataclass
class MetaTranscription:
    transcript: str
    model: str
    session_id: str = ""
    language: Optional[str] = None
    segments: list[dict[str, Any]] = field(default_factory=list)
    audio_duration_ms: int = 0


def meta_api_key() -> Optional[str]:
    """Return the server-side Meta key, or None when it is not configured."""

    for name in ("META_API_KEY", "MODEL_API_KEY"):
        value = os.getenv(name)
        if value and value.strip():
            value = value.strip()
            lowered = value.lower()
            if lowered.startswith(("replace_with", "your_", "<your")):
                # Keep looking: a copied .env.example placeholder must not mask
                # a real MODEL_API_KEY.
                continue
            return value
    return None


def meta_configured() -> bool:
    return bool(meta_api_key())


def _redact(value: Any) -> str:
    text = " ".join(str(value or "").split())
    key = meta_api_key()
    if key:
        text = text.replace(key, "[redacted]")
    return text[:300]


def _error_from_response(response: httpx.Response) -> MetaASRError:
    """Translate a Meta HTTP error without leaking credentials or audio."""

    message = ""
    code = ""
    try:
        body = response.json()
        if isinstance(body, dict):
            error = body.get("error")
            if isinstance(error, dict):
                message = _redact(error.get("message", ""))
                code = _redact(error.get("code", ""))
            else:
                message = _redact(body.get("message") or body.get("detail") or "")
    except Exception:
        message = ""

    status = response.status_code
    if status in (401, 403):
        return MetaASRError(
            "Meta rejected the backend API key. Update META_API_KEY on the server.",
            code="authentication_error",
            status=status,
        )
    if status == 413:
        return MetaASRError(
            "Audio exceeds Meta's 32 MB upload limit.",
            code="audio_too_large",
            status=status,
        )
    if status == 429:
        return MetaASRError(
            "Meta transcription is rate limited. Please retry shortly.",
            code="rate_limited",
            status=status,
            retryable=True,
        )
    if status == 400:
        detail = f" ({message})" if message else ""
        return MetaASRError(
            f"Meta rejected the recording or transcription settings{detail}.",
            code=code or "invalid_request",
            status=status,
        )
    if status >= 500:
        return MetaASRError(
            "Meta transcription is temporarily unavailable.",
            code=code or "provider_error",
            status=status,
            retryable=True,
        )
    detail = f": {message}" if message else ""
    return MetaASRError(
        f"Meta transcription failed with status {status}{detail}.",
        code=code or "meta_asr_error",
        status=status,
    )


async def list_meta_models(*, force: bool = False) -> list[dict[str, Any]]:
    """Call GET https://api.meta.ai/v1/models with the server-side key."""

    global _models_cache, _models_cache_at
    now = time.monotonic()
    if not force and _models_cache and now - _models_cache_at < MODEL_CACHE_TTL_SECONDS:
        return list(_models_cache)

    key = meta_api_key()
    if not key:
        raise MetaASRError(
            "META_API_KEY is not configured on the backend.",
            code="not_configured",
        )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            response = await client.get(
                META_MODELS_URL,
                headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise MetaASRError(
            "Could not reach the Meta model catalogue.",
            code="connection_failed",
            retryable=True,
        ) from exc

    if response.status_code != 200:
        raise _error_from_response(response)

    try:
        payload = response.json()
    except ValueError as exc:
        raise MetaASRError(
            "Meta returned an unreadable model catalogue.",
            code="malformed_response",
        ) from exc

    raw_models = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(raw_models, list):
        raise MetaASRError(
            "Meta returned an unexpected model catalogue.",
            code="malformed_response",
        )

    models: list[dict[str, Any]] = []
    for item in raw_models:
        if isinstance(item, str):
            models.append({"id": item, "created": 0})
            continue
        if not isinstance(item, dict) or not item.get("id"):
            continue
        created = item.get("created", 0)
        try:
            created = int(created)
        except (TypeError, ValueError):
            created = 0
        models.append({"id": str(item["id"]), "created": created})

    _models_cache = models
    _models_cache_at = now
    return list(models)


def select_meta_asr_model(
    models: list[dict[str, Any]],
    override: Optional[str] = None,
) -> str:
    """Pick the ASR model id from a catalogue response.

    An explicit override is honoured only when it is present in the catalogue;
    otherwise the newest ``muse-voice-transcribe`` entry is used.
    """

    catalogue = {
        str(item.get("id")): int(item.get("created") or 0)
        for item in models
        if isinstance(item, dict) and item.get("id")
    }
    if not catalogue:
        raise MetaASRError(
            "The Meta model catalogue is empty.",
            code="model_unavailable",
        )

    wanted = (override or "").strip()
    if wanted:
        if wanted not in catalogue:
            available = sorted(
                model_id
                for model_id in catalogue
                if "voice-transcribe" in model_id.lower() or "asr" in model_id.lower()
            )
            suffix = f" Available ASR models: {', '.join(available)}." if available else ""
            raise MetaASRError(
                f"Configured Meta ASR model '{wanted}' is not available to this key.{suffix}",
                code="model_unavailable",
            )
        return wanted

    candidates = [
        (created, model_id)
        for model_id, created in catalogue.items()
        if "voice-transcribe" in model_id.lower()
    ]
    if not candidates:
        raise MetaASRError(
            "This Meta key has no Muse Voice Transcribe model available.",
            code="model_unavailable",
        )
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][1]


async def resolve_meta_asr_model(*, force: bool = False) -> str:
    """Resolve and verify the ASR model id through the models endpoint."""

    global _model_cache, _model_cache_at
    now = time.monotonic()
    if not force and _model_cache and now - _model_cache_at < MODEL_CACHE_TTL_SECONDS:
        return _model_cache

    models = await list_meta_models(force=force)
    model = select_meta_asr_model(models, os.getenv("META_ASR_MODEL"))
    _model_cache = model
    _model_cache_at = now
    return model


def language_bias(language: Optional[str]) -> list[str]:
    """Convert a single ISO code or language name into Meta's languageBias list."""

    if not language:
        return []
    text = language.strip()
    if not text:
        return []
    lowered = text.lower()
    if len(lowered) <= 3:
        name = LANGUAGE_NAMES.get(lowered)
        return [name] if name else []
    # Accept a full language name from an API caller.
    for name in LANGUAGE_NAMES.values():
        if name.lower() == lowered:
            return [name]
    return []


def _clean_keywords(keywords: Optional[list[str]]) -> list[str]:
    if not keywords:
        return []
    cleaned: list[str] = []
    for value in keywords[:100]:
        if not isinstance(value, str):
            continue
        term = value.strip()
        if term and len(term) <= 64:
            cleaned.append(term)
    return cleaned


def is_meta_compatible_wav(audio: bytes) -> bool:
    """True for mono 16-bit PCM WAV at 16 kHz or 24 kHz."""

    if len(audio) < 12 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
        return False
    try:
        with wave.open(io.BytesIO(audio), "rb") as reader:
            return (
                reader.getnchannels() == 1
                and reader.getsampwidth() == 2
                and reader.getframerate() in (16000, 24000)
                and reader.getcomptype() == "NONE"
                and reader.getnframes() > 0
            )
    except (wave.Error, EOFError):
        return False


def _wav_duration_seconds(audio: bytes) -> float:
    try:
        with wave.open(io.BytesIO(audio), "rb") as reader:
            rate = reader.getframerate()
            return reader.getnframes() / rate if rate else 0.0
    except (wave.Error, EOFError):
        return 0.0


def _ffmpeg_path() -> Optional[str]:
    configured = os.getenv("FFMPEG_PATH")
    if configured and os.path.isfile(configured):
        return configured
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:  # Optional portable binary used by some deployments.
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


async def convert_to_meta_wav(audio: bytes, suffix: str = ".audio") -> bytes:
    """Return mono 16-bit PCM WAV at 24 kHz, converting with ffmpeg if needed."""

    if is_meta_compatible_wav(audio):
        duration = _wav_duration_seconds(audio)
        if duration > MAX_AUDIO_SECONDS:
            raise MetaASRError(
                "Audio is longer than Meta's 10-minute limit.",
                code="audio_too_long",
            )
        return audio

    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        raise MetaASRError(
            "Meta needs WAV/PCM audio and ffmpeg is not installed on the backend.",
            code="audio_conversion_unavailable",
        )

    # Use real files on both ends. ffmpeg cannot seek a pipe, so a stdout WAV
    # gets a placeholder data size (bad for validation), and an MP4/M4A input on
    # stdin can fail when its moov atom needs seeking.
    safe_suffix = suffix.lower()
    if not (
        safe_suffix.startswith(".")
        and 2 <= len(safe_suffix) <= 9
        and safe_suffix[1:].isalnum()
    ):
        safe_suffix = ".audio"

    input_path = None
    output_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=safe_suffix) as source:
            source.write(audio)
            input_path = source.name
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as output:
            output_path = output.name

        command = [
            ffmpeg,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            input_path,
            "-vn",
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            "24000",
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            output_path,
        ]
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
        except OSError as exc:
            raise MetaASRError(
                "Could not start the audio converter on the backend.",
                code="audio_conversion_unavailable",
            ) from exc

        try:
            _stdout, _stderr = await asyncio.wait_for(
                process.communicate(input=audio),
                timeout=120,
            )
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.wait()
            raise MetaASRError(
                "Audio conversion timed out.",
                code="audio_conversion_failed",
                retryable=True,
            ) from exc

        if process.returncode != 0 or not os.path.getsize(output_path):
            logger.warning("ffmpeg audio conversion failed (exit=%s)", process.returncode)
            raise MetaASRError(
                "The recording could not be converted to Meta's WAV format.",
                code="audio_conversion_failed",
            )

        with open(output_path, "rb") as converted_file:
            converted = converted_file.read()
    finally:
        for path in (input_path, output_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    if not is_meta_compatible_wav(converted):
        raise MetaASRError(
            "The recording could not be converted to a supported WAV file.",
            code="audio_conversion_failed",
        )
    if len(converted) > MAX_AUDIO_BYTES:
        raise MetaASRError(
            "Audio exceeds Meta's 32 MB upload limit.",
            code="audio_too_large",
        )
    duration = _wav_duration_seconds(converted)
    if duration > MAX_AUDIO_SECONDS:
        raise MetaASRError(
            "Audio is longer than Meta's 10-minute limit.",
            code="audio_too_long",
        )
    return converted


def turn_segments(turns: Any) -> list[dict[str, Any]]:
    """Map Meta turn data to the app's transcript segment shape.

    Meta's speaker labels (``A``/``B``) are session-scoped and are not verified
    identities, so they are deliberately not mapped to AI_AGENT/CUSTOMER.
    """

    if not isinstance(turns, list):
        return []
    segments: list[dict[str, Any]] = []
    for index, turn in enumerate(turns):
        if not isinstance(turn, dict):
            continue
        text = str(turn.get("transcript") or "").strip()
        if not text:
            continue
        start_ms = turn.get("startMs") or 0
        end_ms = turn.get("endMs") or start_ms
        segments.append(
            {
                "id": f"meta_turn_{turn.get('turnId', index)}",
                "speaker": "UNKNOWN",
                "speakerConfidence": 0,
                "text": text,
                "startTime": (float(start_ms) / 1000.0) if start_ms else 0,
                "endTime": (float(end_ms) / 1000.0) if end_ms else 0,
                "confidence": 0,
            }
        )
    return segments


async def transcribe_with_meta(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    *,
    mode: str = "PUSH_TO_TALK",
    language: Optional[str] = None,
    keywords: Optional[list[str]] = None,
) -> MetaTranscription:
    """Transcribe a completed recording with Meta's multipart endpoint."""

    key = meta_api_key()
    if not key:
        raise MetaASRError(
            "META_API_KEY is not configured on the backend.",
            code="not_configured",
        )
    if mode not in VALID_MODES:
        mode = "PUSH_TO_TALK"

    model = await resolve_meta_asr_model()
    wav = await convert_to_meta_wav(audio_bytes, os.path.splitext(filename)[1])

    settings: dict[str, Any] = {
        "model": model,
        "audioEncoding": "WAV",
        "mode": mode,
    }
    bias = language_bias(language)
    if bias:
        settings["languageBias"] = bias
    cleaned_keywords = _clean_keywords(keywords)
    if cleaned_keywords:
        settings["keywords"] = cleaned_keywords

    timeout = float(os.getenv("META_ASR_TIMEOUT_SECONDS", "120"))
    files = {
        "request": (None, json.dumps(settings), "application/json"),
        "audio": (
            filename if filename.lower().endswith(".wav") else "audio.wav",
            wav,
            "audio/wav",
        ),
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=20.0)
        ) as client:
            response = await client.post(
                META_FILE_TRANSCRIBE_URL,
                headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
                files=files,
            )
    except httpx.TimeoutException as exc:
        raise MetaASRError(
            "Meta transcription timed out.",
            code="timeout",
            retryable=True,
        ) from exc
    except httpx.HTTPError as exc:
        raise MetaASRError(
            "Could not reach Meta transcription.",
            code="connection_failed",
            retryable=True,
        ) from exc

    if response.status_code != 200:
        raise _error_from_response(response)

    try:
        payload = response.json()
    except ValueError as exc:
        raise MetaASRError(
            "Meta returned an unreadable transcription response.",
            code="malformed_response",
        ) from exc
    if not isinstance(payload, dict):
        raise MetaASRError(
            "Meta returned an unexpected transcription response.",
            code="malformed_response",
        )

    transcript = payload.get("transcript")
    if not isinstance(transcript, str):
        raise MetaASRError(
            "Meta returned no transcript text.",
            code="malformed_response",
        )

    return MetaTranscription(
        transcript=transcript.strip(),
        model=model,
        session_id=str(payload.get("sessionId") or ""),
        segments=turn_segments(payload.get("turns")),
        audio_duration_ms=int(payload.get("audioDurationMs") or 0),
    )


def _connection_closed_code(exc: BaseException) -> Optional[int]:
    code = getattr(exc, "code", None)
    if isinstance(code, int):
        return code
    received = getattr(exc, "rcvd", None)
    received_code = getattr(received, "code", None)
    return received_code if isinstance(received_code, int) else None


class MetaRealtimeSession:
    """Small wrapper around the documented realtime WebSocket protocol."""

    def __init__(
        self,
        websocket: Any,
        *,
        session_id: str,
        model: str,
        mode: str,
    ) -> None:
        self._ws = websocket
        self.session_id = session_id
        self.model = model
        self.mode = mode
        self.close_code: Optional[int] = None
        self.close_reason = ""

    @classmethod
    async def connect(
        cls,
        *,
        mode: str = "PUSH_TO_TALK",
        language: Optional[str] = None,
        keywords: Optional[list[str]] = None,
        audio_encoding: str = "PCM_24KHZ",
        session_id: Optional[str] = None,
    ) -> "MetaRealtimeSession":
        key = meta_api_key()
        if not key:
            raise MetaASRError(
                "META_API_KEY is not configured on the backend.",
                code="not_configured",
            )
        if mode not in VALID_MODES:
            mode = "PUSH_TO_TALK"
        if audio_encoding not in VALID_ENCODINGS:
            audio_encoding = "PCM_24KHZ"

        model = await resolve_meta_asr_model()
        sid = session_id or f"recordioai-{uuid.uuid4()}"
        uri = f"{META_REALTIME_URL}?sessionId={quote(sid, safe='')}"

        try:
            websocket = await websockets.connect(
                uri,
                open_timeout=30,
                close_timeout=10,
                ping_interval=20,
                ping_timeout=20,
                max_size=8 * 1024 * 1024,
            )
        except Exception as exc:
            raise MetaASRError(
                "Could not connect to Meta realtime transcription.",
                code="connection_failed",
                retryable=True,
            ) from exc

        handshake: dict[str, Any] = {
            "authorization": {"accessToken": f"Bearer {key}"},
            "audioEncoding": audio_encoding,
            "model": model,
            "mode": mode,
            "partialMode": "CUMULATIVE",
            "emitAudioProgress": False,
        }
        bias = language_bias(language)
        if bias:
            handshake["languageBias"] = bias
        cleaned_keywords = _clean_keywords(keywords)
        if cleaned_keywords:
            handshake["keywords"] = cleaned_keywords

        try:
            await asyncio.wait_for(websocket.send(json.dumps(handshake)), timeout=10)
            raw = await asyncio.wait_for(websocket.recv(), timeout=15)
        except asyncio.TimeoutError as exc:
            await websocket.close()
            raise MetaASRError(
                "Meta did not acknowledge the realtime session in time.",
                code="handshake_timeout",
                retryable=True,
            ) from exc
        except Exception as exc:
            await websocket.close()
            code = _connection_closed_code(exc)
            if code == 1008:
                raise MetaASRError(
                    "Meta rejected the realtime handshake.",
                    code="handshake_rejected",
                ) from exc
            raise MetaASRError(
                "Meta closed the realtime connection during the handshake.",
                code="connection_failed",
                retryable=True,
            ) from exc

        if isinstance(raw, bytes):
            await websocket.close()
            raise MetaASRError(
                "Meta returned an unexpected realtime handshake.",
                code="malformed_response",
            )
        try:
            acknowledgement = json.loads(raw)
        except ValueError as exc:
            await websocket.close()
            raise MetaASRError(
                "Meta returned an unreadable realtime handshake.",
                code="malformed_response",
            ) from exc

        if not isinstance(acknowledgement, dict):
            await websocket.close()
            raise MetaASRError(
                "Meta returned an unexpected realtime handshake.",
                code="malformed_response",
            )

        if acknowledgement.get("type") == "error":
            message = _redact(acknowledgement.get("message", ""))
            error_code = str(acknowledgement.get("errorCode") or "handshake_rejected")
            await websocket.close()
            raise MetaASRError(
                f"Meta rejected the realtime session: {message}",
                code=error_code,
                status=401 if "auth" in error_code else None,
            )

        if "sessionId" not in acknowledgement:
            await websocket.close()
            raise MetaASRError(
                "Meta realtime handshake was not acknowledged.",
                code="handshake_rejected",
            )

        return cls(
            websocket,
            session_id=str(acknowledgement.get("sessionId") or sid),
            model=model,
            mode=mode,
        )

    async def send_audio(self, chunk: bytes) -> None:
        if chunk:
            await self._ws.send(chunk)

    async def end_stream(self) -> None:
        await self._ws.send(json.dumps({"type": "endStream"}))

    async def events(self) -> AsyncIterator[dict[str, Any]]:
        try:
            async for message in self._ws:
                if isinstance(message, bytes):
                    continue
                try:
                    event = json.loads(message)
                except ValueError:
                    continue
                if isinstance(event, dict):
                    yield event
        except websockets.exceptions.ConnectionClosed as exc:
            self.close_code = _connection_closed_code(exc)
            self.close_reason = _redact(getattr(exc, "reason", ""))
        finally:
            if self.close_code is None:
                self.close_code = getattr(self._ws, "close_code", None)
            if not self.close_reason:
                self.close_reason = _redact(getattr(self._ws, "close_reason", ""))

    async def close(self) -> None:
        try:
            await self._ws.close()
        except Exception:
            pass


def _realtime_error(event: dict[str, Any]) -> MetaASRError:
    message = _redact(event.get("message", ""))
    error_code = str(event.get("errorCode") or event.get("errorType") or "realtime_error")
    status = 401 if "auth" in error_code else None
    return MetaASRError(
        f"Meta realtime transcription failed: {message}",
        code=error_code,
        status=status,
    )


def _close_error(code: Optional[int], reason: str) -> MetaASRError:
    if code == 1013:
        return MetaASRError(
            "Meta realtime transcription is rate limited.",
            code="rate_limited",
            retryable=True,
        )
    if code == 1008:
        return MetaASRError(
            "Meta rejected the realtime audio stream (check pacing and format).",
            code="stream_rejected",
        )
    if code == 1011:
        return MetaASRError(
            "Meta realtime transcription failed internally.",
            code="provider_error",
            retryable=True,
        )
    detail = f" ({reason})" if reason else ""
    return MetaASRError(
        f"Meta closed the realtime session{detail}.",
        code="connection_failed",
        retryable=True,
    )


async def transcribe_realtime(
    audio_frames: AsyncIterator[bytes],
    *,
    mode: str = "PUSH_TO_TALK",
    language: Optional[str] = None,
    keywords: Optional[list[str]] = None,
    audio_encoding: str = "PCM_24KHZ",
    session_id: Optional[str] = None,
) -> MetaTranscription:
    """Transcribe a paced PCM stream and collect only finalized text."""

    session = await MetaRealtimeSession.connect(
        mode=mode,
        language=language,
        keywords=keywords,
        audio_encoding=audio_encoding,
        session_id=session_id,
    )
    completed_turns: dict[int, str] = {}
    final_text = ""
    realtime_error: Optional[MetaASRError] = None

    async def send_frames() -> None:
        try:
            async for frame in audio_frames:
                await session.send_audio(frame)
        finally:
            await session.end_stream()

    sender = asyncio.create_task(send_frames())
    try:
        async for event in session.events():
            event_type = event.get("type")
            if event_type == "transcript":
                if event.get("final") and isinstance(event.get("transcript"), str):
                    final_text = event["transcript"]
            elif event_type == "speechComplete":
                turn_id = event.get("turnId")
                text = event.get("transcript")
                if isinstance(turn_id, int) and isinstance(text, str):
                    completed_turns[turn_id] = text.strip()
            elif event_type == "error":
                realtime_error = _realtime_error(event)
    finally:
        if not sender.done():
            sender.cancel()
        try:
            await sender
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        await session.close()

    if realtime_error:
        raise realtime_error
    if session.close_code not in (None, 1000):
        raise _close_error(session.close_code, session.close_reason)

    if mode == "PUSH_TO_TALK":
        transcript = final_text.strip()
    else:
        transcript = "\n".join(
            completed_turns[turn_id].strip()
            for turn_id in sorted(completed_turns)
            if completed_turns[turn_id].strip()
        )

    return MetaTranscription(
        transcript=transcript,
        model=session.model,
        session_id=session.session_id,
    )


async def paced_audio_frames(
    pcm: bytes,
    *,
    bytes_per_second: int = 48_000,
    frame_ms: int = 80,
) -> AsyncIterator[bytes]:
    """Yield PCM in real-time-paced frames, as the realtime endpoint requires."""

    frame_bytes = max(2, bytes_per_second * frame_ms // 1000)
    started = time.monotonic()
    sent = 0
    for offset in range(0, len(pcm), frame_bytes):
        chunk = pcm[offset : offset + frame_bytes]
        if not chunk:
            continue
        yield chunk
        sent += len(chunk)
        target = sent / bytes_per_second
        delay = target - (time.monotonic() - started)
        if delay > 0:
            await asyncio.sleep(delay)
