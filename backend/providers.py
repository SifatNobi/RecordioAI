import asyncio
import io
import json
import os
from typing import Any, Optional

from openai import OpenAI
from openai import AuthenticationError, APIStatusError


DEFAULT_GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo"
DEFAULT_GROQ_CHAT_MODEL = "openai/gpt-oss-20b"


def groq_api_key() -> Optional[str]:
    value = os.getenv("GROQ_API_KEY")
    return value.strip() if value and value.strip() else None


def groq_enabled() -> bool:
    return bool(groq_api_key())


def groq_client() -> Optional[OpenAI]:
    key = groq_api_key()
    if not key:
        return None
    return OpenAI(
        api_key=key,
        base_url="https://api.groq.com/openai/v1",
        timeout=60.0,
        max_retries=1,
    )


async def transcribe_with_groq(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    client = groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_TRANSCRIPTION_MODEL", DEFAULT_GROQ_TRANSCRIPTION_MODEL)
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename or "audio.m4a"

    def _call() -> Any:
        return client.audio.transcriptions.create(
            file=file_obj,
            model=model,
            response_format="text",
        )

    try:
        result = await asyncio.get_running_loop().run_in_executor(None, _call)
    except AuthenticationError as exc:
        raise RuntimeError("Groq rejected the server API key.") from exc
    except APIStatusError as exc:
        raise RuntimeError(f"Groq transcription request failed with status {exc.status_code}.") from exc
    if isinstance(result, str):
        return result.strip()
    if hasattr(result, "text"):
        return str(result.text).strip()
    return str(result).strip()


async def extract_with_groq(system_message: str, user_prompt: str) -> str:
    client = groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    model = os.getenv("GROQ_CHAT_MODEL", DEFAULT_GROQ_CHAT_MODEL)

    def _call() -> Any:
        return client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_completion_tokens=2048,
            reasoning_effort="low",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt},
            ],
        )

    result = await asyncio.get_running_loop().run_in_executor(None, _call)
    message = result.choices[0].message.content if getattr(result, "choices", None) else ""
    if not message:
        raise ValueError("GROQ returned an empty completion.")
    return message


def active_ai_provider() -> str:
    return "groq" if groq_enabled() else "gemini"


def meta_api_key() -> Optional[str]:
    value = os.getenv("META_MODEL_API_KEY")
    return value.strip() if value and value.strip() else None


def meta_enabled() -> bool:
    return bool(meta_api_key())


async def transcribe_with_meta(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Transcribe audio using Meta Muse Voice Transcribe API.

    POST https://api.meta.ai/v1/asr/transcribe
    Model: muse-voice-transcribe-1.0
    Authentication: META_MODEL_API_KEY as query parameter
    Format: multipart/form-data with 'file' and optionally 'model' fields
    """
    api_key = meta_api_key()
    if not api_key:
        raise RuntimeError("META_MODEL_API_KEY is not configured.")

    model = os.getenv("META_ASR_MODEL", "muse-voice-transcribe-1.0")

    import httpx

    url = "https://api.meta.ai/v1/asr/transcribe"

    def _call() -> Any:
        files = {
            "file": (filename or "audio.m4a", audio_bytes, "audio/mp4"),
        }
        data = {
            "model": model,
        }
        headers = {}
        if api_key:
            # Use bearer token auth
            headers["Authorization"] = f"Bearer {api_key}"

        response = httpx.TimeoutClient(timeout=30.0).post(
            url,
            files=files,
            data=data,
            headers=headers,
        )
        return response

    try:
        response = await asyncio.get_running_loop().run_in_executor(None, _call)
        response.raise_for_status()

        result = response.json()

        # Extract transcript from response - handle various possible formats
        if isinstance(result, dict):
            # Check common response fields
            transcript = (
                result.get("transcript")
                or result.get("text")
                or result.get("result")
                or result.get("text_transcription")
            )
            if isinstance(transcript, str):
                return transcript.strip()
            # If transcript is nested, try to find it
            if transcript is not None:
                return str(transcript).strip()
        # If we got here, try to extract any string that looks like text
        if isinstance(result, str):
            return result.strip()
        if isinstance(result, dict):
            # Last resort: find any string value that could be a transcript
            for v in result.values():
                if isinstance(v, str) and len(v) > 5:
                    return v.strip()
        raise RuntimeError(f"Unexpected Meta API response format: {str(result)[:200]}")

    except httpx.TimeoutException as exc:
        raise RuntimeError("Meta transcription request timed out.") from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise RuntimeError("Meta rejected the API key.") from exc
        if exc.response.status_code == 403:
            raise RuntimeError("Meta access denied - check API key permissions.") from exc
        if exc.response.status_code == 429:
            raise RuntimeError("Meta rate limit exceeded.") from exc
        if exc.response.status_code >= 500:
            raise RuntimeError(f"Meta transcription service error: {exc.response.status_code}.") from exc
        raise RuntimeError(f"Meta transcription request failed with status {exc.response.status_code}.") from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"Meta transcription request failed: {str(exc)}") from exc
