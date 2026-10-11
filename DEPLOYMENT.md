# Backend deployment

The mobile app expects a public HTTPS backend base URL ending in `/v1`, for
example `https://<render-service>.onrender.com/v1`. Do not put secrets in the
mobile app or Expo environment variables.

## Render

1. Open [Render](https://render.com/) and sign in to the account that owns the
   deployment.
2. Create a Blueprint from the `SifatNobi/RecordioAI` GitHub repository and
   branch `main`.
3. Review the service created from [`render.yaml`](./render.yaml). The Docker
   image is defined by [`Dockerfile`](./Dockerfile).
4. In the service's Environment settings, set these secret values:
   - `MONGO_URL`: the MongoDB connection string
   - `GROQ_API_KEY`: the Groq API key
5. Keep these non-secret values:
   - `DB_NAME=recordioai`
   - `GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo`
   - `GROQ_CHAT_MODEL=openai/gpt-oss-20b`
6. Deploy the service and wait for the Render deploy to finish.
7. Verify `https://<render-service>.onrender.com/health` returns HTTP 200 and
   reports `"status":"ok"`.
8. Verify the API path used by the app at
   `https://<render-service>.onrender.com/v1/`.
9. Verify the unauthenticated transcription contract with a safe audio sample:
   `POST /v1/transcribe` with a multipart field named `file`. Transcription uses
   the server-side Groq key; it does not accept or require a Groq key in the
   mobile app. Record-management endpoints remain session-authenticated.
10. Set `EXPO_PUBLIC_API_BASE_URL` locally to
   `https://<render-service>.onrender.com/v1`, rebuild the Android app, and
   confirm that the final APK contains that URL.

The current `api.recordioai.com` hostname has no public DNS record, so it must
not be used for a release until DNS and HTTPS are configured and verified.

## Monad provenance

The app computes a deterministic fingerprint from the finalized transcript,
analysis, recording type, duration, and recording start time. It stores only
that fingerprint in the calldata of a zero-value self-transaction on Monad
Testnet. The app waits for a successful receipt and re-reads the transaction
calldata before showing the proof as verified.

The app now requests a scoped device session over HTTPS and stores the returned
token only in Android SecureStore. The token is accepted only by the
provenance relayer endpoint; it cannot access user records or account routes.
After a finalized recording is saved, the conversation screen automatically
tries the relayer. WalletConnect remains an optional fallback for manual
submission.

The authenticated relayer endpoint is implemented at
`POST /v1/provenance/submit`. It remains unavailable until these Render
environment variables are configured:

- `PROVENANCE_RELAYER_PRIVATE_KEY`: a dedicated Monad Testnet-only private key.
- `MONAD_RELAYER_RPC_URL`: optional; defaults to
  `https://testnet-rpc.monad.xyz`.

The endpoint accepts either an existing RecordioAI bearer session or the
scoped device session created by `POST /v1/auth/device`, accepts only a
32-byte artifact hash and an idempotency key, signs only a zero-value
self-transaction to the relayer address, applies a per-device/user hourly
limit, verifies the receipt and calldata, and never returns the private key.
Device sessions expire after 30 days and can be revoked server-side by setting
`revoked_at`. Never embed a relayer key or static privileged token in the APK.
