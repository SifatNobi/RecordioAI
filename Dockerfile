FROM python:3.12-slim

# Meta Muse Voice Transcribe accepts mono 16-bit PCM WAV at 16/24 kHz.
# RecordioAI records M4A/AAC on Android, so the backend transcodes with ffmpeg
# before calling Meta's file endpoint. Groq remains the fallback if this binary
# is unavailable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
