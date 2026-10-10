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
