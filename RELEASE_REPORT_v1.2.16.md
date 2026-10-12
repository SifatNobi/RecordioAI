# RecordioAI v1.2.16 — Release Build Repair & Monad Testnet Verification

**Release date:** October 12, 2026
**Repository:** https://github.com/SifatNobi/RecordioAI
**Baseline:** v1.2.15 (versionCode 21)
**This release:** v1.2.16 (versionCode 22)

---

## 1. Executive summary

The stalled Android release build was diagnosed and repaired, and the Monad Testnet
integration was repaired and verified against live chain data.

- **Build blocker:** the release build failed deterministically at
  `:app:createBundleReleaseJsAndAssets` because the Node.js runtime on `PATH`
  (`v20.12.0`) rejects `util.styleText([...])` with an array of formats. The
  WalletConnect → `uint8arrays` dependency chain calls it during bundling.
  Building with a supported Node (`>=22.13`) resolves it, and no dependency was
  downgraded or removed.
- **Real Monad defect found and fixed:** `parseProofData()` decoded the on-chain
  proof payload incorrectly, so `verifyMonadProof()` and the wallet-submission
  verification path could never succeed — even for a genuinely mined transaction.
- **Monad configuration corrected:** the app pointed at a non-official explorer
  (`testnet.monadexplorer.com`). It now uses the official Monad Testnet explorer.
- **Live verification:** 12/12 automated checks pass against the public Monad
  Testnet RPC, including validating a real mined proof transaction.

---

## 2. Root cause of the stalled build

### 2.1 Observed state at diagnosis time

- Two Java processes were running but **idle**: the Gradle daemon (PID 15840,
  started 11:03:14) and its child Kotlin compile daemon (PID 27164). A 12-second
  CPU sample showed no work (`+0.016s` and `+0.000s` CPU respectively).
- The Gradle **client process was gone** (parent PID 15120 no longer existed), and
  `C:\Users\User\.gradle\daemon\9.3.1\daemon-15840.out.log` was `0` bytes.
- `registry.bin` was last written at 11:14:03, and **no new APK** was produced by
  that run — only `lintVital*` and NDK/CMake intermediates were refreshed.

**Conclusion:** no build was actually running. The reported "stall" was an
orphaned, already-terminated build leaving idle daemons behind, so nothing was
killed and no caches were deleted.

### 2.2 The real, reproducible failure

Running the documented command reproduced a hard failure in 17 seconds:

```
> Task :app:createBundleReleaseJsAndAssets
env: load .env
Starting Metro Bundler

TypeError [ERR_INVALID_ARG_VALUE]: The argument 'format' must be one of: 'reset', 'bold', ...
Received [ 'yellow', 'inverse', 'bold' ]

Import stack:
 node_modules\uint8arrays\cjs\src\util\bases.js
Android Bundling failed 3000ms node_modules\expo-router\entry.js (2643 modules)
...
> Task :app:createBundleReleaseJsAndAssets FAILED
BUILD FAILED in 17s
```

Isolated cause:

| Node runtime | `util.styleText(['yellow','inverse','bold'],'x')` |
| --- | --- |
| `v20.12.0` (was on `PATH`) | `ERR_INVALID_ARG_VALUE` |
| `v22.13.1` | OK |
| `v24.11.1` | OK |

`util.styleText` exists in Node 20.12 but only later releases accept an **array** of
formats. The bundle-time import chain
`@walletconnect/modal-react-native → universal-provider → sign-client → core →
uint8arrays → multiformats` triggers this during Metro bundling.

The previous v1.2.15 APK was built with Node 24.15.0, which is why this only
appeared once the toolchain on `PATH` changed.

### 2.3 Fix

- Build the release with a supported Node runtime (`>=22.13`). Verified with
  Node `v24.11.1`; the previous good build used `v24.15.0`.
- Declared the requirement in `package.json`:
  `"engines": { "node": ">=22.13.0" }`.
- **No** dependency versions were changed, **no** caches were deleted, and no
  application feature was disabled.

Both tasks named in the original report are healthy:
`:app:generateCodegenArtifactsFromSchema` is a **SKIPPED** no-op that completes in
~4 s (the app declares no codegen config), and `:app:assembleRelease` completes
once bundling succeeds.

---

## 3. Code and configuration changes

| File | Change |
| --- | --- |
| `src/services/blockchain/monad.ts` | **Bug fix:** `parseProofData()` now hex-decodes the payload before matching `RECORDIOAI-PROOF-V1:` (the payload embeds the hash as `0x…`, so the old length check always failed). Added `hexToAscii()` (never throws). Added `getMonadNetworkStatus()`, `getMonadBalance()`, `formatMonadBalance()`, `describeMonadRpcError()`. Added RPC transport `timeout: 15s`, `retryCount: 2`, `retryDelay: 750ms`. Added `blockExplorers` + `testnet: true` to the chain definition. Preserved `getMonadChainId()`. |
| `src/constants/env.ts` | Official explorer default (`https://testnet.monadscan.com`), plus `MONAD_EXPLORER_NAME`, `MONAD_ALT_EXPLORER_*`, `MONAD_FAUCET_URL`, `MONAD_NATIVE_CURRENCY`. Version → `1.2.16`. |
| `src/app/settings/monad.tsx` | Added a live "LIVE NETWORK • MONAD TESTNET" card showing the RPC URL, reported chain ID, latest block, and the connected wallet's real MON balance, with loading / error / retry states and an explicit testnet-currency disclaimer. All state updates happen after `await` to avoid cascading renders. |
| `backend/server.py` | Explorer URL now derives from `PROVENANCE_EXPLORER_URL` (`MONAD_EXPLORER_URL`, default `https://testnet.monadscan.com`) instead of a hardcoded non-official host. |
| `tests/monad-verification/` | New live verification harness (`run.js`, `tsconfig.json`, `globals.d.ts`) plus `npm run test:monad`. Compiles the **real** `monad.ts` and asserts against the live RPC. |
| `package.json` | `engines.node >= 22.13.0`, `test:monad` script, version `1.2.16`. |
| `app.json`, `android/app/build.gradle` | `versionCode 22`, `versionName 1.2.16`. |
| `.gitignore` | Ignore `tests/monad-verification/out/`. |

No secrets, keystores, `local.properties`, or `.env` values were added to the
repository. No new smart contract was introduced and no contract address was invented.

---

## 4. Monad Testnet configuration used

Verified against the official documentation
(<https://docs.monad.xyz/developer-essentials/testnet>):

| Item | Value | Source |
| --- | --- | --- |
| Chain ID | `10143` (`0x279f`) | Official docs + live `eth_chainId` |
| Network name | `Monad Testnet` | Official docs |
| Native currency | `MON`, 18 decimals | Official docs + live `getBalance` |
| RPC | `https://testnet-rpc.monad.xyz` | Official docs + live `web3_clientVersion` → `Monad/0.16.3` |
| Explorer | `https://testnet.monadscan.com` | Official docs (Monadscan) |
| Alt explorer | `https://testnet.monadvision.com` | Official docs (MonadVision) |
| Faucet | `https://faucet.monad.xyz` | Official docs |

The previously configured `https://testnet.monadexplorer.com` is **not** listed in
the official documentation and returns an HTTP 308 redirect; it was replaced.

---

## 5. Verification results

### 5.1 Live RPC connectivity — VERIFIED

Read directly from `https://testnet-rpc.monad.xyz`:

- `eth_chainId` → `0x279f` = **10143** (matches configured chain)
- `eth_blockNumber` → **70,317,600** (live, advancing)
- `web3_clientVersion` → `Monad/0.16.3`
- `eth_getBalance(0xeB89542388BE6A425a971319d3AbD08846E7F605)` → `9994900000000000000` wei = **9.9949 MON**

### 5.2 Automated harness — 12/12 PASS (`npm run test:monad`)

```
PASS  proof payload uses the RECORDIOAI-PROOF-V1 prefix :: 20 byte prefix
PASS  artifact hash round-trips through proofData/parseProofData
PASS  artifact hashing is deterministic and input sensitive
PASS  parseProofData rejects foreign calldata
PASS  formatMonadBalance formats 18-decimal MON
PASS  describeMonadRpcError maps failures to actionable text
PASS  LIVE eth_chainId returns 10143 (Monad Testnet)
PASS  LIVE latest block number is read from the RPC :: block=70317600
PASS  LIVE balance read for a funded relayer address :: 9994900000000000000 wei
PASS  LIVE balance read rejects a malformed address
PASS  LIVE verifyMonadProof validates a mined on-chain proof :: block=70025606
PASS  LIVE verifyMonadProof rejects a mismatched artifact hash
```

The last check runs the application's own `verifyMonadProof()` against a genuinely
mined Monad Testnet transaction:

- **Tx:** `0x8c788098de2f5c0e5632bfccdaf1dd7ab362aa8292308b40a2562de2e95b8d36`
- **Block:** 70025606
- **Calldata:** `RECORDIOAI-PROOF-V1:0x2222222222222222222222222222222222222222222222222222222222222222`
- **Explorer:** <https://testnet.monadscan.com/tx/0x8c788098de2f5c0e5632bfccdaf1dd7ab362aa8292308b40a2562de2e95b8d36>

**Before the `parseProofData` fix this check failed.** The app would have reported
"the mined transaction did not contain the expected artifact proof" for every
successful transaction.

### 5.3 Backend relayer — VERIFIED (configured and healthy)

`GET https://recordioai.onrender.com/health`:

```json
{"relayer":{"configured":true,"address":"0xeB89542388BE6A425a971319d3AbD08846E7F605",
 "chain_id":10143,"balance_wei":9994900000000000000,"error":null}}
```

Auth error handling on `POST /v1/provenance/submit`:

- no bearer token → `401 {"detail":"Missing bearer token"}`
- bogus token → `401 {"detail":"Invalid session"}`
- malformed payload → `401 {"detail":"Invalid session"}`

No unauthenticated or malformed request can cause a broadcast.

### 5.4 Not verified (and why)

| Item | Status | Reason |
| --- | --- | --- |
| Wallet connection on a device | NOT VERIFIED | No Android device or emulator available; WalletConnect needs a real wallet app to complete a session. |
| Balance retrieval inside the running app UI | NOT VERIFIED | Same — no device. The underlying read is verified via the harness. |
| **New** testnet transaction signed by a user wallet | NOT VERIFIED | Requires a physical device plus a funded wallet; no signing was performed. |
| **New** relayer-broadcast proof transaction | NOT PERFORMED | Would spend the project's MON testnet funds. Deliberately not done without explicit authorization — see §8. |
| Contract deployment | N/A | This integration anchors proof hashes in EOA self-transaction calldata; no smart contract is deployed or required. |

**No transaction hash is reported above as "new" — the referenced transaction was
mined by a previous relayer run and is validated here as an existing on-chain fact.**

---

## 6. Build and APK validation

Build command (from `android/`, with Node `v24.11.1` on `PATH`):

```powershell
.\gradlew.bat assembleRelease --stacktrace --console=plain
```

Result: **BUILD SUCCESSFUL in 49s** — `742 actionable tasks: 45 executed, 697 up-to-date`

| Property | Value |
| --- | --- |
| APK path | `E:\RecordioAI\RecordioAI\android\app\build\outputs\apk\release\app-release.apk` |
| Size | 52,392,870 bytes (49.97 MB) |
| SHA-256 | `0FE5B9C5310DC8F50A9CDFEBAA74FE2C341808D87727750651F79028CDA893CD` |
| Package | `com.recordioai.app` (unchanged) |
| versionCode / versionName | 22 / 1.2.16 |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |
| Architecture | `arm64-v8a` |
| Signing | APK Signature Scheme v2 — **Verifies** |
| Signer cert SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` (same debug cert as v1.2.15) |

Content checks inside the packaged JS bundle:

- `testnet.monadscan.com` → present
- `testnet-rpc.monad.xyz` → present
- `RECORDIOAI-PROOF-V1` → present
- `10143` → present
- `1.2.16` → present
- `monadexplorer` (stale host) → **absent**
- `lib/arm64-v8a/libuniffi_yttrium_wcpay.so` (WalletConnect native dependency) → present
- `libreactnative.so`, `libhermesvm.so`, `libexpo-modules-core.so`, `libappmodules.so`, `libreanimated.so`, `libworklets.so` → present

Secret leakage check on the packaged bundle:

- `GROQ_API_KEY` → **not present**
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` → **not present**

The prior verified v1.2.15 APK was preserved before rebuilding at
`E:\RecordioAI\_build-backups\app-release-v1.2.15-verified.apk`, and the published
v1.2.15 GitHub release was not modified.

Quality gates: `tsc --noEmit` → **0 errors**; `expo lint` → **0 errors, 55 pre-existing warnings**.

---

## 7. RevenueCat status — IMPORTANT

**RevenueCat is not present in the current codebase.** It was **not removed by this
work**. It had already been removed by an earlier commit:

- Commit `719fafb` (2026-10-10) "fix(android): stabilize release build and configure arm64 APK"
  deleted `src/services/revenuecat/catalog.ts`, `src/services/revenuecat/revenuecatClient.ts`,
  and `src/store/revenuecatStore.ts`.
- `react-native-purchases` is absent from both `package.json` and `package-lock.json`.
- `src/app/settings/subscription/index.tsx` still exists and is preserved, but it is a
  static plan list whose own copy states: *"In-app billing is not configured in this build."*
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` is still present in the local (git-ignored)
  `.env` but is referenced by no source file, so it is **not** inlined into the APK
  (verified above).

Because there is no SDK integration in the tree, a RevenueCat test-store purchase
flow **could not be verified** — there is nothing to exercise. This is reported as a
fact, not an assumption. Restoring it requires re-adding the SDK and native module,
which is a feature restoration (and a native rebuild) and was not performed
unilaterally.

---

## 8. Remaining blockers and required credentials

1. **On-device verification:** no Android device or emulator is available
   (`adb devices` → empty; the `emulator` binary is not installed). Splash/startup,
   navigation, recording, and the Monad screen UI were therefore **not** device-tested.
   This release does not claim device-level verification.
2. **A live end-to-end proof transaction** (relayer or wallet-signed) has **not** been
   performed. This requires explicit authorization because it spends testnet MON.
   The relayer wallet holds 9.9949 MON and the endpoint is healthy, so the run is
   ready to execute on request.
3. **Backend redeploy:** the explorer-URL change in `backend/server.py` only takes
   effect once the service is redeployed to Render; the currently deployed instance
   still returns the legacy explorer URL.
4. **RevenueCat:** restoration decision required (see §7).
5. **Environment note:** the local `.env` sets `EXPO_PUBLIC_ENVIRONMENT=development`,
   so release bundles embed `development`. `IS_DEV` is currently unused, so there is
   no functional impact, but it should be set to `production` for distributable builds.

---

## 9. Release artifact

```
E:\RecordioAI\RecordioAI\android\app\build\outputs\apk\release\app-release.apk
E:\RecordioAI\RecordioAI\RecordioAI-v1.2.16-release.apk   (same bytes, release asset)
```

SHA-256 `0FE5B9C5310DC8F50A9CDFEBAA74FE2C341808D87727750651F79028CDA893CD`
