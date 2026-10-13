import type {
  Commitment,
  Discrepancy,
  ExtractedFee,
  ExtractedPrice,
  ExtractedProduct,
} from '@/types';

/**
 * Normalizes AI-analysis payloads into fully-formed frontend objects.
 *
 * The backend extraction schema ({ category, commitment, quote, speaker })
 * does not include the fields the UI requires (id, description, promisedBy,
 * status, confidence). Passing those items through unvalidated crashed the
 * Commitments tab with `TypeError: Cannot read property 'replace' of
 * undefined`. Every function here is total: null/undefined/malformed input
 * yields safe, explicitly-defaulted output — never throws.
 */

/** Model default confidence, matching analyzeTranscript's analysis default. */
export const DEFAULT_ITEM_CONFIDENCE = 0.85;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asIsoString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Deterministic id so legacy items keep stable React keys across renders. */
function stableId(prefix: string, seed: string, index: number): string {
  let hash = 0;
  const input = `${prefix}#${seed}#${index}`;
  for (let index2 = 0; index2 < input.length; index2 += 1) {
    hash = (hash * 31 + input.charCodeAt(index2)) | 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}_${index}`;
}

const VALID_PROMISED_BY: ReadonlySet<string> = new Set([
  'AI_AGENT',
  'CUSTOMER',
  'BOTH',
  'UNKNOWN',
]);

const VALID_COMMITMENT_STATUS: ReadonlySet<string> = new Set([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'needs_review',
]);

const VALID_FEE_TYPES: ReadonlySet<string> = new Set([
  'setup',
  'recurring',
  'transaction',
  'penalty',
  'other',
]);

const VALID_BILLING_PERIODS: ReadonlySet<string> = new Set([
  'one_time',
  'monthly',
  'quarterly',
  'annually',
]);

/**
 * Maps the backend's free-text speaker attribution to the frontend enum.
 * The backend emits an empty string when the speaker is not confidently
 * identifiable; that maps to 'UNKNOWN' rather than guessing a party.
 */
export function mapSpeakerToPromisedBy(speaker: unknown): Commitment['promisedBy'] {
  const text = asString(speaker).trim().toLowerCase();
  if (!text) return 'UNKNOWN';
  const saysAgent = /agent|assistant|representative|support|bot|company|ai/.test(text);
  const saysCustomer = /customer|caller|client|user|buyer|person/.test(text);
  if (saysAgent && !saysCustomer) return 'AI_AGENT';
  if (saysCustomer && !saysAgent) return 'CUSTOMER';
  if (saysAgent && saysCustomer) return 'BOTH';
  if (text === 'ai_agent') return 'AI_AGENT';
  return 'UNKNOWN';
}

function normalizePromisedBy(value: unknown, speaker: unknown): Commitment['promisedBy'] {
  if (typeof value === 'string' && VALID_PROMISED_BY.has(value)) {
    return value as Commitment['promisedBy'];
  }
  return mapSpeakerToPromisedBy(speaker);
}

function normalizeCommitmentStatus(value: unknown): Commitment['status'] {
  // Newly extracted commitments have no lifecycle state yet; 'pending' is the
  // honest initial state (the toggle flow drives pending <-> completed).
  if (typeof value === 'string' && VALID_COMMITMENT_STATUS.has(value)) {
    return value as Commitment['status'];
  }
  return 'pending';
}

/** Display label for promisedBy. Never throws; unknown renders as Unknown. */
export function promisedByLabel(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.replace('_', ' ');
  }
  return 'Unknown';
}

/** Display label for commitment status. Never throws. */
export function commitmentStatusLabel(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.replace('_', ' ');
  }
  return 'Unknown';
}

/** Display label for fee type. Never throws. */
export function feeTypeLabel(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.replace('_', ' ');
  }
  return 'Other';
}

/** Display label for audit-trail actions. Never throws. */
export function auditActionLabel(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.replace('_', ' ');
  }
  return 'Unknown action';
}

/**
 * Normalizes one raw extraction item. Accepts both the frontend Commitment
 * shape and the backend extraction shape ({ category, commitment, quote,
 * speaker }). Returns null for items carrying no information at all so
 * callers render an honest empty state instead of blank cards.
 */
export function normalizeCommitment(
  raw: unknown,
  conversationId: string,
  index: number,
  now: string
): Commitment | null {
  const item = asRecord(raw);
  const record = item as Record<string, unknown> & {
    speaker?: unknown;
    commitment?: unknown;
    quote?: unknown;
    category?: unknown;
  };
  const description =
    asString(item.description) ||
    asString(record.commitment) ||
    asString(record.quote);
  const category = asString(record.category);
  if (!description && !category) return null;

  const seed = `${conversationId}|${category}|${description}`;
  return {
    id: asString(item.id) || stableId('cmt', seed, index),
    conversationId: asString(item.conversationId) || conversationId,
    description: description || category,
    promisedBy: normalizePromisedBy(item.promisedBy, record.speaker),
    dueDate: asString(item.dueDate) || undefined,
    status: normalizeCommitmentStatus(item.status),
    confidence: asFiniteNumber(item.confidence, DEFAULT_ITEM_CONFIDENCE),
    sourceSegmentIds: asStringArray(item.sourceSegmentIds),
    completedAt: asString(item.completedAt) || undefined,
    completedBy:
      item.completedBy === 'user' || item.completedBy === 'ai_suggested'
        ? item.completedBy
        : undefined,
    createdAt: asIsoString(item.createdAt, now),
    updatedAt: now,
  };
}

/** Normalizes a raw commitments list; drops empty items, never throws. */
export function normalizeCommitments(
  rawList: unknown,
  conversationId: string,
  now?: string
): Commitment[] {
  if (!Array.isArray(rawList)) return [];
  const timestamp = now || new Date().toISOString();
  const normalized: Commitment[] = [];
  rawList.forEach((raw, index) => {
    const commitment = normalizeCommitment(raw, conversationId, index, timestamp);
    if (commitment) normalized.push(commitment);
  });
  return normalized;
}

function normalizeBillingPeriod(
  value: unknown
): ExtractedPrice['billingPeriod'] {
  return typeof value === 'string' && VALID_BILLING_PERIODS.has(value)
    ? (value as NonNullable<ExtractedPrice['billingPeriod']>)
    : undefined;
}

/** Returns null for prices without a finite amount (nothing honest to show). */
export function normalizePrice(
  raw: unknown,
  index: number,
  now: string
): ExtractedPrice | null {
  const item = asRecord(raw);
  const amount = asFiniteNumber(item.amount, Number.NaN);
  if (!Number.isFinite(amount)) return null;
  return {
    id: asString(item.id) || stableId('price', `${asString(item.currency)}|${amount}`, index),
    productId: asString(item.productId) || undefined,
    amount,
    currency: asString(item.currency) || 'USD',
    billingPeriod: normalizeBillingPeriod(item.billingPeriod),
    confidence: asFiniteNumber(item.confidence, DEFAULT_ITEM_CONFIDENCE),
    sourceSegmentIds: asStringArray(item.sourceSegmentIds),
    context: asString(item.context) || undefined,
  };
}

/** Returns null for fees without a name and finite amount. */
export function normalizeFee(
  raw: unknown,
  index: number,
  now: string
): ExtractedFee | null {
  const item = asRecord(raw);
  const name = asString(item.name);
  const amount = asFiniteNumber(item.amount, Number.NaN);
  if (!name || !Number.isFinite(amount)) return null;
  const type =
    typeof item.type === 'string' && VALID_FEE_TYPES.has(item.type)
      ? (item.type as ExtractedFee['type'])
      : 'other';
  return {
    id: asString(item.id) || stableId('fee', `${name}|${amount}`, index),
    name,
    amount,
    currency: asString(item.currency) || 'USD',
    type,
    confidence: asFiniteNumber(item.confidence, DEFAULT_ITEM_CONFIDENCE),
    sourceSegmentIds: asStringArray(item.sourceSegmentIds),
    context: asString(item.context) || undefined,
  };
}

/** Returns null for products without a name. */
export function normalizeProduct(
  raw: unknown,
  index: number,
  now: string
): ExtractedProduct | null {
  const item = asRecord(raw);
  const name = asString(item.name);
  if (!name) return null;
  return {
    id: asString(item.id) || stableId('prod', name, index),
    name,
    description: asString(item.description) || undefined,
    category: asString(item.category) || undefined,
    sku: asString(item.sku) || undefined,
    confidence: asFiniteNumber(item.confidence, DEFAULT_ITEM_CONFIDENCE),
    sourceSegmentIds: asStringArray(item.sourceSegmentIds),
  };
}

function normalizeList<T>(
  rawList: unknown,
  normalize: (raw: unknown, index: number, now: string) => T | null,
  now: string
): T[] {
  if (!Array.isArray(rawList)) return [];
  const normalized: T[] = [];
  rawList.forEach((raw, index) => {
    const item = normalize(raw, index, now);
    if (item) normalized.push(item);
  });
  return normalized;
}

/** Discrepancies are only counted in the UI; ensure a clean array. */
export function normalizeDiscrepancies(rawList: unknown): Discrepancy[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(
    (item): item is Discrepancy => typeof item === 'object' && item !== null
  );
}

export interface NormalizedAnalysisLists {
  products: ExtractedProduct[];
  prices: ExtractedPrice[];
  fees: ExtractedFee[];
  commitments: Commitment[];
  discrepancies: Discrepancy[];
}

/** Normalizes every analysis list a backend payload may carry. */
export function normalizeAnalysisLists(
  rawAnalysis: unknown,
  conversationId: string,
  now?: string
): NormalizedAnalysisLists {
  const timestamp = now || new Date().toISOString();
  const analysis = asRecord(rawAnalysis);
  return {
    products: normalizeList(analysis.products, normalizeProduct, timestamp),
    prices: normalizeList(analysis.prices, normalizePrice, timestamp),
    fees: normalizeList(analysis.fees, normalizeFee, timestamp),
    commitments: normalizeCommitments(analysis.commitments, conversationId, timestamp),
    discrepancies: normalizeDiscrepancies(analysis.discrepancies),
  };
}

/** Type guard for callers that must distinguish raw backend-shaped items. */
export function isBackendExtractionItem(value: unknown): boolean {
  const item = asRecord(value);
  return (
    typeof item.commitment === 'string' ||
    typeof item.speaker === 'string' ||
    typeof item.quote === 'string'
  );
}
