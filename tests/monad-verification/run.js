/**
 * Live Monad Testnet verification for the RecordioAI blockchain module.
 *
 * This harness compiles the REAL application module (src/services/blockchain/monad.ts)
 * and exercises it against the public Monad Testnet RPC. Nothing here is mocked:
 * every network assertion reads live chain state.
 *
 * Run:  node tests/monad-verification/run.js
 */
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out', 'src');

// --- compile the real TS sources -------------------------------------------
console.log('[build] compiling src/services/blockchain/monad.ts ...');
execFileSync(
  'cmd',
  ['tsc', '-p', path.join(__dirname, 'tsconfig.json')],
  { cwd: ROOT, stdio: 'inherit' }
);

// --- resolve the "@/..." alias used by the app ------------------------------
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(OUT, request.slice(2));
  }
  return originalResolve.call(this, request, ...rest);
};

const monad = require(path.join(OUT, 'services', 'blockchain', 'monad.js'));
const env = require(path.join(OUT, 'constants', 'env.js'));

if (typeof monad.getMonadNetworkStatus !== 'function') {
  console.error('compiled module is missing the expected exports under', OUT);
  process.exit(1);
}

// --- tiny assertion helpers -------------------------------------------------
let passed = 0;
let failed = 0;
const results = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((detail) => {
      passed += 1;
      results.push({ name, ok: true, detail: detail || '' });
      console.log(`PASS  ${name}${detail ? ` :: ${detail}` : ''}`);
    })
    .catch((error) => {
      failed += 1;
      results.push({ name, ok: false, detail: error && error.message });
      console.log(`FAIL  ${name} :: ${error && error.message}`);
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// A real Monad Testnet proof transaction previously mined by the backend relayer.
// Its calldata uses the exact format this module produces.
const REFERENCE_TX = '0x8c788098de2f5c0e5632bfccdaf1dd7ab362aa8292308b40a2562de2e95b8d36';
const REFERENCE_HASH = `0x${'22'.repeat(32)}`;

async function main() {
  console.log('\n=== RecordioAI Monad Testnet verification ===\n');
  console.log(`chain (configured): ${env.MONAD_TESTNET_CHAIN_ID}`);
  console.log(`rpc   (configured): ${env.MONAD_TESTNET_RPC_URL}`);
  console.log(`explorer          : ${env.MONAD_EXPLORER_URL}\n`);

  const expectedPrefix = Buffer.from('RECORDIOAI-PROOF-V1:', 'utf8').toString('hex');

  await check('proof payload uses the RECORDIOAI-PROOF-V1 prefix', () => {
    const data = monad.proofData(REFERENCE_HASH).slice(2).toLowerCase();
    assert(data.startsWith(expectedPrefix), `payload ${data.slice(0, 40)} lacks prefix`);
    return `${expectedPrefix.length / 2} byte prefix`;
  });

  await check('artifact hash round-trips through proofData/parseProofData', () => {
    const hash = monad.hashArtifact({ reference: 'conversation:test', artifact: 'hello monad' });
    assert(/^0x[0-9a-f]{64}$/.test(hash), `unexpected hash ${hash}`);
    const parsed = monad.parseProofData(monad.proofData(hash));
    assert(parsed === hash, `round trip returned ${parsed}`);
    return hash;
  });

  await check('artifact hashing is deterministic and input sensitive', () => {
    const a = monad.hashArtifact({ b: 1, a: [2, 'x'] });
    const b = monad.hashArtifact({ a: [2, 'x'], b: 1 });
    const c = monad.hashArtifact({ a: [2, 'y'], b: 1 });
    assert(a === b, 'key order changed the hash');
    assert(a !== c, 'different input produced the same hash');
    return 'canonical + collision sensitive';
  });

  await check('parseProofData rejects foreign calldata', () => {
    assert(monad.parseProofData('0xdeadbeef') === null, 'foreign payload was accepted');
    assert(monad.parseProofData(monad.proofData(REFERENCE_HASH)) === REFERENCE_HASH, 'valid payload rejected');
    return 'rejects non-proof calldata';
  });

  await check('formatMonadBalance formats 18-decimal MON', () => {
    const one = monad.formatMonadBalance(10n ** 18n);
    const tiny = monad.formatMonadBalance(1234500000000000n);
    assert(one === '1.0000 MON', `unexpected ${one}`);
    assert(tiny.startsWith('0.0012'), `unexpected ${tiny}`);
    return `${one} / ${tiny}`;
  });

  await check('describeMonadRpcError maps failures to actionable text', () => {
    const t = monad.describeMonadRpcError(new Error('request timed out'));
    const n = monad.describeMonadRpcError(new Error('Network request failed'));
    assert(/timed out/i.test(t) && /retry/i.test(t), `unexpected ${t}`);
    assert(/unreachable/i.test(n), `unexpected ${n}`);
    return 'timeout + network paths';
  });

  // ---------------- live network assertions ----------------
  let liveStatus = null;
  await check('LIVE eth_chainId returns 10143 (Monad Testnet)', async () => {
    const chainId = await monad.getMonadChainId();
    assert(chainId === 10143, `RPC reported ${chainId}`);
    return `chainId=${chainId}`;
  });

  await check('LIVE latest block number is read from the RPC', async () => {
    liveStatus = await monad.getMonadNetworkStatus();
    assert(liveStatus.chainId === 10143, `wrong chain ${liveStatus.chainId}`);
    assert(typeof liveStatus.blockNumber === 'bigint' && liveStatus.blockNumber > 0n, 'no block height');
    return `block=${liveStatus.blockNumber}`;
  });

  await check('LIVE balance read for a funded relayer address', async () => {
    const relayer = '0xeB89542388BE6A425a971319d3AbD08846E7F605';
    const balance = await monad.getMonadBalance(relayer);
    assert(typeof balance === 'bigint', 'balance was not a bigint');
    console.log(`      relayer ${relayer} balance = ${monad.formatMonadBalance(balance)}`);
    return `${balance} wei`;
  });

  await check('LIVE balance read rejects a malformed address', async () => {
    let threw = false;
    try {
      await monad.getMonadBalance('not-an-address');
    } catch {
      threw = true;
    }
    assert(threw, 'invalid address was accepted');
    return 'invalid input rejected before RPC';
  });

  await check('LIVE verifyMonadProof validates a mined on-chain proof', async () => {
    const result = await monad.verifyMonadProof(REFERENCE_TX, REFERENCE_HASH);
    assert(result.verified === true, `proof not verified (block ${result.blockNumber})`);
    return `block=${result.blockNumber} tx=${REFERENCE_TX.slice(0, 18)}…`;
  });

  await check('LIVE verifyMonadProof rejects a mismatched artifact hash', async () => {
    const result = await monad.verifyMonadProof(REFERENCE_TX, `0x${'33'.repeat(32)}`);
    assert(result.verified === false, 'mismatched hash was reported as verified');
    return 'wrong hash correctly not verified';
  });

  console.log('\n=== summary ===');
  console.log(`passed: ${passed}   failed: ${failed}`);
  if (liveStatus) {
    console.log(`live chain: ${liveStatus.chainId}  block: ${liveStatus.blockNumber}  rpc: ${liveStatus.rpcUrl}`);
  }
  console.log(`reference tx: ${env.MONAD_EXPLORER_URL}/tx/${REFERENCE_TX}`);
  console.log('');

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('harness crashed:', error);
  process.exit(1);
});
