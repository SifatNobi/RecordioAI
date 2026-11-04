# RecordioAI — Meta Muse Voice Transcribe Integration Report

Date: 2026-11-04

## Root cause

The recording pipeline was already working end to end, but the backend had no
Meta speech-to-text provider. `POST /v1/transcribe` only knew about Groq Whisper
and the Emergent/OpenAI Whisper fallback. The Android recorder emits M4A/AAC,
while Meta's file endpoint only accepts mono 16-bit PCM WAV at 16 kHz or 24 kHz,
so simply adding a Meta client would also have failed on format.

## Confirmed Meta details

- Docs: <https://dev.meta.ai/docs/speech-to-text>
- File endpoint: `POST https://api.meta.ai/v1/asr/transcribe`
- Realtime endpoint: `wss://api.meta.ai/v1/asr/realtime`
- Model catalogue: `GET https://api.meta.ai/v1/models`
- Documented model ID: `muse-voice-transcribe-1.0`

The model ID is verified against `GET /v1/models` at runtime. An
`META_ASR_MODEL` override is only honoured when that ID is present in the
catalogue returned for the configured key.

Live verification is blocked because no Meta Model API key exists in this
environment. A request with a deliberately invalid key returned
`401 Unauthorized` / `invalid_api_key`; that confirms the endpoint is reachable
but does not verify account access.

## Files changed

- `backend/meta_asr.py` (new) — Meta model discovery/verification, WAV
  validation and ffmpeg conversion, file transcription, realtime session
  handshake/event handling, paced PCM helper, sanitized errors.
- `backend/server.py` — Meta-first provider chain, multipart form options,
  `/v1/transcription/status`, `/v1/transcription/models`, and the authenticated
  server-side WebSocket proxy at `/v1/asr/stream` (also `/api/asr/stream`).
- `backend/tests/test_meta_asr.py` (new) — 18 focused tests covering model
  selection, redaction, language biasing, ffmpeg conversion (including M4A),
  the documented multipart request shape, and realtime handshake/events.
- `src/services/recording/transcription.ts` — FastAPI `detail` parsing,
  415/422/502/503/504 handling, 180 s timeout, 25 MB guard, segment validation,
  and an honest `0` confidence when the provider does not report one.
- `src/app/conversations/[id]/index.tsx` — shows “Not reported” instead of
  inventing a confidence percentage.
- `.env.example`, `render.yaml`, `Dockerfile`, `DEPLOYMENT.md` — Meta
  configuration, `ffmpeg` installation, and deployment/verification notes.

## Behaviour

Provider order:

1. Meta when `META_API_KEY` (or `MODEL_API_KEY`) is configured.
2. Groq Whisper when `GROQ_API_KEY` is configured.
3. Emergent/OpenAI Whisper when `EMERGENT_LLM_KEY` is configured.

A Meta failure (auth, timeout, format, rate limit, empty transcript) is recorded
and the next provider is tried. The existing Groq path therefore remains a
working fallback. The original audio bytes are hashed before conversion, so the
returned `audio_sha256` still covers exactly what the user recorded.

Audio conversion uses `ffmpeg` with mono, 24 kHz, signed 16-bit PCM. Two
pipeline bugs were found and fixed during testing:

- WAV written to stdout has a placeholder data size and reports a huge
  duration; conversion now writes to a seekable temporary file.
- M4A/MP4 input on stdin can fail when the `moov` atom needs seeking; input is
  now also written to a seekable temporary file.

Meta speaker labels (`A`/`B`) are session-scoped, so they are mapped to
`UNKNOWN` rather than fabricated as `AI_AGENT`/`CUSTOMER`. Meta returns no
confidence score, so the app records `0` and displays “Not reported”.

## Realtime

The app records completed M4A files, so it continues to use the file endpoint.
For realtime clients, the backend exposes `wss://<host>/v1/asr/stream`. The
first frame is a JSON configuration object; later binary frames are raw PCM.
The backend adds `authorization.accessToken` and connects to Meta, so the Meta
key never reaches the app. Supported modes are `PUSH_TO_TALK`, `ENDPOINTING`,
and `DIARIZATION`; `endStream`, Meta error events, and close codes are forwarded.

## Verification performed

- `python -m pytest backend/tests/test_meta_asr.py backend/tests/test_transcription_contract.py -q -n 0`
  → **20 passed**.
- `python -m py_compile backend/meta_asr.py backend/server.py backend/tests/test_meta_asr.py`
  → passed.
- Local FastAPI server against the real Groq key:
  - `GET /v1/transcription/status` → `primary: groq`,
    `meta.code: not_configured`.
  - `POST /v1/transcribe` with a synthesized WAV → real transcript and SHA-256.
  - `POST /v1/transcribe` with a synthesized M4A/AAC → real transcript and
    SHA-256.
  - With a deliberately invalid Meta key → Meta `authentication_error`, then a
    successful Groq transcript (fallback confirmed).
  - With only the invalid Meta key → HTTP `502` and the sanitized
    authentication message.
  - `GET /v1/transcription/models` without a key → HTTP `503`.
  - `wss://.../v1/asr/stream` without a key → `not_configured` error event.
  - `wss://.../v1/asr/stream` with an invalid key → sanitized
    `authentication_error` event, close `1011`.
- `npx tsc --noEmit` → clean.
- `npx expo lint` → 0 errors (52 pre-existing warnings).
- `npx expo export --platform android` → bundled successfully (2,684 modules).
- Exported Android bundle scanned for the Groq key value in UTF-8 and UTF-16 →
  not present.
- M4A → 24 kHz mono 16-bit WAV conversion validated locally with `ffmpeg`
  (9.35 s input, 449,012-byte output).

The web export cannot run because `react-dom` and `react-native-web` are not
installed; the project does not target web. The old `backend/tests` modules that
call a decommissioned preview URL were not used.

## Required configuration

Set these on the backend service (never in the mobile app or an `EXPO_PUBLIC_*`
variable):

```text
META_API_KEY=<Meta Model API key>
META_ASR_MODEL=muse-voice-transcribe-1.0   # optional; remove to auto-select
META_ASR_TIMEOUT_SECONDS=120
```

`MODEL_API_KEY` is accepted as an alias for `META_API_KEY`. The Docker image now
installs `ffmpeg`. `GROQ_API_KEY` can remain configured as the fallback.

## Remaining blockers / limitations

- No Meta Model API key is available here, so a real Meta transcript has not
  been produced. The exact blocker is `401 invalid_api_key` from
  `GET https://api.meta.ai/v1/models`.
- The production Render service now runs the new backend (commit `d8e29b2`).
  `GET https://recordioai.onrender.com/v1/transcription/status` returns `200`
  with `meta.configured: false`, `meta.code: not_configured`, and
  `groq.configured: true`; `GET /v1/transcription/models` returns `503` with
  the sanitized "`META_API_KEY` is not configured" message. The only remaining
  blocker for live Meta transcription is setting `META_API_KEY` on Render.
- Meta accepts at most 10 minutes / 32 MB per file. Longer recordings fall back
  to Groq; they are not truncated or silently summarized.
- The mobile app still records M4A/AAC and uses the file endpoint. The realtime
  proxy is available but is not wired to the native recorder, which would
  require a raw-PCM capture path.

## Release and deployment

- Backend commit `d8e29b2` is pushed to `main` and is live on Render at
  <https://recordioai.onrender.com>. Verified after deploy:
  - `GET /health` → `200`, `database_configured: true`, `ai_provider: groq`.
  - `GET /v1/transcription/status` → `200` (was `404` before the deploy).
  - `GET /v1/transcription/models` → `503` with the sanitized
    `META_API_KEY is not configured on the backend.` message.
- Android release `1.2.21` (`versionCode 27`) was built from the same code with
  `assembleRelease -PreactNativeArchitectures=arm64-v8a`:
  - Artifact: `RecordioAI-v1.2.21-arm64-release.apk` (52,609,746 bytes).
  - SHA-256: `E78BEB6794A388406284954028B778C533B92FAD6791A2C6F0CDDDF0B2F2EF35`.
  - `applicationId com.recordioai.app`, versionName `1.2.21`, versionCode `27`,
    native-code `arm64-v8a` only, minSdk 24, targetSdk 36.
  - Signed with the generated debug keystore, as with previous test-store
    builds. This is not a Play Store signing key.
  - Bundle checks: `Not reported` and `HTTP_504` present, production API URL
    `https://recordioai.onrender.com/v1` inlined, and no Groq/Meta key value
    found in the bundle.
- `npx tsc --noEmit` and `npx expo lint` pass (0 errors, 52 pre-existing
  warnings) on the release commit.

No API keys were added to the repository, logs, or build artifacts.
