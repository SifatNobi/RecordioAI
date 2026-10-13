/**
 * Regression tests for the CommitmentsTab startup crash:
 *   TypeError: Cannot read property 'replace' of undefined
 *
 * The backend extraction schema ({ category, commitment, quote, speaker })
 * does not include the fields the UI requires (id, description, promisedBy,
 * status). Unvalidated passthrough crashed the render. These tests exercise
 * the REAL normalizer + label helpers against backend-shaped, legacy,
 * malformed, and empty inputs. Nothing is mocked except the absence of
 * React Native (pure logic only).
 *
 * Run:  node tests/analysis-normalization/run.js
 */
/* global __dirname */
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out', 'src', 'services', 'recording');

// Compile the real TS source with the project's own TypeScript. Using the
// node binary directly avoids npx spawn issues on Windows.
console.log('[build] compiling src/services/recording/normalizeAnalysis.ts ...');
execFileSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    path.join(__dirname, 'tsconfig.json'),
  ],
  { cwd: ROOT, stdio: 'inherit' }
);

const n = require(path.join(OUT, 'normalizeAnalysis.js'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('PASS  ' + name);
}

// --- The exact crash expression from the field report ----------------------
check('old pattern throws on undefined (documents the regression)', () => {
  assert.throws(() => undefined.replace('_', ' '), /replace/);
});

// --- Label helpers never throw ----------------------------------------------
check('label helpers tolerate undefined/null/empty', () => {
  for (const v of [undefined, null, '', 0, {}]) {
    assert.strictEqual(n.promisedByLabel(v), 'Unknown');
    assert.strictEqual(n.commitmentStatusLabel(v), 'Unknown');
    assert.strictEqual(n.feeTypeLabel(v), 'Other');
    assert.strictEqual(n.auditActionLabel(v), 'Unknown action');
  }
});

check('label helpers preserve existing display for valid values', () => {
  assert.strictEqual(n.promisedByLabel('AI_AGENT'), 'AI AGENT');
  assert.strictEqual(n.promisedByLabel('CUSTOMER'), 'CUSTOMER');
  assert.strictEqual(n.promisedByLabel('BOTH'), 'BOTH');
  assert.strictEqual(n.commitmentStatusLabel('needs_review'), 'needs review');
  assert.strictEqual(n.commitmentStatusLabel('in_progress'), 'in progress');
  assert.strictEqual(n.feeTypeLabel('setup'), 'setup');
});

// --- Backend-shaped commitments normalize ------------------------------------
const backendItems = [
  { category: 'Refund', commitment: 'Full refund within five days', quote: 'I will refund you', speaker: 'AI Agent' },
  { category: 'Cancellation Fee', commitment: 'No fee charged', quote: 'No fee', speaker: 'The customer' },
  { category: 'Deadline', commitment: 'Reply by Friday', quote: 'By Friday', speaker: '' },
];

check('backend items gain id/description/promisedBy/status', () => {
  const out = n.normalizeCommitments(backendItems, 'conv_1', '2026-01-01T00:00:00.000Z');
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].description, 'Full refund within five days');
  assert.strictEqual(out[0].promisedBy, 'AI_AGENT');
  assert.strictEqual(out[1].promisedBy, 'CUSTOMER');
  assert.strictEqual(out[2].promisedBy, 'UNKNOWN');
  for (const c of out) {
    assert.strictEqual(c.status, 'pending');
    assert.strictEqual(c.confidence, 0.85);
    assert.ok(typeof c.id === 'string' && c.id.length > 0);
    assert.deepStrictEqual(c.sourceSegmentIds, []);
    // The exact render expressions from CommitmentsTab must not throw.
    assert.doesNotThrow(() => n.promisedByLabel(c.promisedBy));
    assert.doesNotThrow(() => n.commitmentStatusLabel(c.status));
  }
});

check('normalized ids are stable across calls (legacy React keys)', () => {
  const a = n.normalizeCommitments(backendItems, 'conv_1', '2026-01-01T00:00:00.000Z');
  const b = n.normalizeCommitments(backendItems, 'conv_1', '2026-06-01T00:00:00.000Z');
  assert.deepStrictEqual(a.map((c) => c.id), b.map((c) => c.id));
});

check('valid frontend-shaped items pass through unchanged', () => {
  const raw = [{
    id: 'cmt_9', conversationId: 'conv_1', description: 'Do the thing',
    promisedBy: 'BOTH', status: 'in_progress', confidence: 0.9,
    sourceSegmentIds: ['s1'], createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }];
  const out = n.normalizeCommitments(raw, 'conv_1', '2026-01-01T00:00:00.000Z');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'cmt_9');
  assert.strictEqual(out[0].promisedBy, 'BOTH');
  assert.strictEqual(out[0].status, 'in_progress');
  assert.strictEqual(out[0].confidence, 0.9);
});

// --- Malformed / empty inputs -------------------------------------------------
check('empty objects are dropped, nullish lists become []', () => {
  assert.deepStrictEqual(n.normalizeCommitments([{}, null, undefined, 42, 'x'], 'c', 't'), []);
  assert.deepStrictEqual(n.normalizeCommitments(null, 'c', 't'), []);
  assert.deepStrictEqual(n.normalizeCommitments(undefined, 'c', 't'), []);
  assert.deepStrictEqual(n.normalizeCommitments('nope', 'c', 't'), []);
});

check('fresh-install/offline shapes stay empty without throwing', () => {
  const lists = n.normalizeAnalysisLists(null, 'conv_x', 't');
  assert.deepStrictEqual(lists, { products: [], prices: [], fees: [], commitments: [], discrepancies: [] });
  const lists2 = n.normalizeAnalysisLists({}, 'conv_x', 't');
  assert.deepStrictEqual(lists2.commitments, []);
});

// --- Prices / fees -------------------------------------------------------------
check('price without billingPeriod is kept; price without amount is dropped', () => {
  const lists = n.normalizeAnalysisLists(
    { prices: [{ id: 'p1', amount: 49.99, currency: 'USD' }, { id: 'p2', currency: 'USD' }] },
    'c', 't'
  );
  assert.strictEqual(lists.prices.length, 1);
  assert.strictEqual(lists.prices[0].billingPeriod, undefined);
});

check('fee without type defaults to other; fee without name/amount is dropped', () => {
  const lists = n.normalizeAnalysisLists(
    { fees: [{ id: 'f1', name: 'Fee', amount: 5, currency: 'USD' }, { id: 'f2' }] },
    'c', 't'
  );
  assert.strictEqual(lists.fees.length, 1);
  assert.strictEqual(lists.fees[0].type, 'other');
  assert.strictEqual(n.feeTypeLabel(undefined), 'Other');
});

check('product without name is dropped', () => {
  const lists = n.normalizeAnalysisLists(
    { products: [{ id: 'x', confidence: 0.5 }, { id: 'y', name: 'Widget' }] },
    'c', 't'
  );
  assert.strictEqual(lists.products.length, 1);
  assert.strictEqual(lists.products[0].name, 'Widget');
});

// --- Speaker mapping -------------------------------------------------------------
check('speaker mapping covers agent/customer/both/unknown', () => {
  assert.strictEqual(n.mapSpeakerToPromisedBy('AI Agent'), 'AI_AGENT');
  assert.strictEqual(n.mapSpeakerToPromisedBy('support representative'), 'AI_AGENT');
  assert.strictEqual(n.mapSpeakerToPromisedBy('Customer'), 'CUSTOMER');
  assert.strictEqual(n.mapSpeakerToPromisedBy(''), 'UNKNOWN');
  assert.strictEqual(n.mapSpeakerToPromisedBy(undefined), 'UNKNOWN');
  assert.strictEqual(n.mapSpeakerToPromisedBy('Agent and customer agreed'), 'BOTH');
  assert.strictEqual(n.mapSpeakerToPromisedBy('customer support rep'), 'BOTH');
});

// --- Toggle flow works on normalized legacy items ----------------------------------
check('status toggle works by normalized id', () => {
  const out = n.normalizeCommitments(backendItems, 'conv_1', 't');
  const toggled = out.map((c) =>
    c.id === out[0].id
      ? { ...c, status: c.status === 'completed' ? 'pending' : 'completed' }
      : c
  );
  assert.strictEqual(toggled[0].status, 'completed');
  assert.strictEqual(toggled[1].status, 'pending');
});

console.log('\n=== summary ===');
console.log('passed: ' + passed + '   failed: 0');
