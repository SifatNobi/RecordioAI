export interface AIProvider {
  id: string;
  name: string;
  description: string;
  logo: string;
  supportedFeatures: ProviderFeature[];
  configSchema: ProviderConfigSchema;
}

export type ProviderFeature =
  | 'transcription'
  | 'analysis'
  | 'recording'
  | 'phone_numbers'
  | 'webhooks'
  | 'real_time';

export interface ProviderConfigSchema {
  fields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'boolean' | 'url';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: string;
}

export interface AIAgent {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  status: AgentStatus;
  configuration: Record<string, unknown>;
  phoneNumbers: PhoneNumber[];
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  version?: string;
  configVersion?: string;
}

export type AgentStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'syncing'
  | 'paused';

export interface PhoneNumber {
  id: string;
  agentId: string;
  number: string;
  displayName?: string;
  direction: 'inbound' | 'outbound' | 'both';
  recordingConsent: RecordingConsentConfig;
  processingConfig: ProcessingConfig;
  isActive: boolean;
  createdAt: string;
}

export interface RecordingConsentConfig {
  requireDisclosure: boolean;
  disclosureMessage?: string;
  consentMethod: 'explicit' | 'implied' | 'opt_out';
  jurisdiction?: string;
}

export interface ProcessingConfig {
  transcribe: boolean;
  analyze: boolean;
  extractProducts: boolean;
  extractPrices: boolean;
  extractFees: boolean;
  extractCommitments: boolean;
  detectDiscrepancies: boolean;
  generateReceipt: boolean;
  language?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  phoneNumberId: string;
  customer: Customer;
  direction: 'inbound' | 'outbound';
  status: ConversationStatus;
  processingStatus: ProcessingStatus;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  transcript?: Transcript;
  analysis?: ConversationAnalysis;
  receipt?: ConversationReceipt;
  qualityMetrics?: ConversationQuality;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ConversationStatus =
  | 'active'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'voicemail';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partial';

export interface Customer {
  id: string;
  phoneNumber: string;
  name?: string;
  displayName: string;
  email?: string;
  metadata: Record<string, unknown>;
  identifiedAt?: string;
  identificationSource?: 'agent_intro' | 'caller_id' | 'manual' | 'crm';
  createdAt: string;
  updatedAt: string;
}

export interface Transcript {
  id: string;
  conversationId: string;
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
  confidence: number;
  status: TranscriptStatus;
  provider: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptStatus = 'processing' | 'completed' | 'failed' | 'partial';

export interface TranscriptSegment {
  id: string;
  speaker: SpeakerLabel;
  speakerConfidence: number;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words?: WordTimestamp[];
}

export type SpeakerLabel = 'AI_AGENT' | 'CUSTOMER' | 'UNKNOWN';

export interface WordTimestamp {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface ConversationAnalysis {
  id: string;
  conversationId: string;
  products: ExtractedProduct[];
  prices: ExtractedPrice[];
  fees: ExtractedFee[];
  commitments: Commitment[];
  discrepancies: Discrepancy[];
  summary: string;
  keyPoints: string[];
  sentiment: SentimentAnalysis;
  language: string;
  confidence: number;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  confidence: number;
  sourceSegmentIds: string[];
}

export interface ExtractedPrice {
  id: string;
  productId?: string;
  amount: number;
  currency: string;
  billingPeriod?: 'one_time' | 'monthly' | 'quarterly' | 'annually';
  confidence: number;
  sourceSegmentIds: string[];
  context?: string;
}

export interface ExtractedFee {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: 'setup' | 'recurring' | 'transaction' | 'penalty' | 'other';
  confidence: number;
  sourceSegmentIds: string[];
  context?: string;
}

export interface Commitment {
  id: string;
  conversationId: string;
  description: string;
  promisedBy: 'AI_AGENT' | 'CUSTOMER' | 'BOTH';
  dueDate?: string;
  status: CommitmentStatus;
  confidence: number;
  sourceSegmentIds: string[];
  completedAt?: string;
  completedBy?: 'user' | 'ai_suggested';
  createdAt: string;
  updatedAt: string;
}

export type CommitmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'needs_review';

export interface Discrepancy {
  id: string;
  conversationId: string;
  type: DiscrepancyType;
  description: string;
  promisedValue: unknown;
  actualValue: unknown;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  sourceSegmentIds: string[];
  status: DiscrepancyStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type DiscrepancyType =
  | 'price_mismatch'
  | 'fee_not_disclosed'
  | 'feature_mismatch'
  | 'timeline_mismatch'
  | 'commitment_unfulfilled'
  | 'product_mismatch'
  | 'other';

export type DiscrepancyStatus =
  | 'detected'
  | 'under_review'
  | 'confirmed'
  | 'resolved'
  | 'dismissed';

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  customer: 'positive' | 'neutral' | 'negative';
  agent: 'positive' | 'neutral' | 'negative';
  score: number;
}

export interface ConversationQuality {
  id: string;
  conversationId: string;
  audioClarity: QualityMetric;
  transcriptConfidence: QualityMetric;
  disclosureCompliance: QualityMetric;
  commitmentsCoverage: QualityMetric;
  unresolvedCommitments: number;
  potentialDiscrepancies: number;
  customerExperienceSignals: CustomerExperienceSignal[];
  overallScore: number;
  createdAt: string;
}

export interface QualityMetric {
  score: number;
  label: string;
  details?: string;
}

export interface CustomerExperienceSignal {
  type: 'frustration' | 'confusion' | 'satisfaction' | 'hesitation' | 'urgency';
  timestamp: number;
  segmentId: string;
  confidence: number;
}

export interface ConversationReceipt {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentVersion?: string;
  configVersion?: string;
  policyVersion?: string;
  customer: Customer;
  phoneNumber?: string;
  direction: 'inbound' | 'outbound';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  consentStatus: ConsentStatus;
  transcriptRef: string;
  products: ExtractedProduct[];
  prices: ExtractedPrice[];
  fees: ExtractedFee[];
  promises: Commitment[];
  commitments: Commitment[];
  disclosures: Disclosure[];
  actions: ReceiptAction[];
  integrityHash: string;
  verificationStatus: VerificationStatus;
  auditHistory: AuditEvent[];
  createdAt: string;
  verifiedAt?: string;
}

export interface ConsentStatus {
  disclosed: boolean;
  disclosureTimestamp?: string;
  method?: string;
  jurisdiction?: string;
  recordingConsented: boolean;
}

export interface Disclosure {
  id: string;
  type: 'recording' | 'ai_agent' | 'data_processing' | 'pricing' | 'terms';
  content: string;
  timestamp: number;
  segmentId?: string;
  acknowledged: boolean;
}

export interface ReceiptAction {
  id: string;
  type: 'transfer' | 'schedule_callback' | 'send_info' | 'create_ticket' | 'escalate' | 'other';
  description: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
}

export type VerificationStatus =
  | 'verified'
  | 'failed'
  | 'pending'
  | 'unavailable';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actor: 'user' | 'system' | 'agent' | 'integration';
  actorId?: string;
  recordType: string;
  recordId: string;
  version?: number;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export type AuditAction =
  | 'agent_connected'
  | 'agent_disconnected'
  | 'conversation_received'
  | 'transcript_finalized'
  | 'analysis_generated'
  | 'receipt_generated'
  | 'receipt_verified'
  | 'receipt_verification_failed'
  | 'commitment_updated'
  | 'dispute_opened'
  | 'evidence_exported'
  | 'agent_config_changed'
  | 'record_archived'
  | 'record_deleted'
  | 'customer_updated'
  | 'phone_number_updated'
  | 'consent_updated';

export interface EvidencePackage {
  id: string;
  conversationId: string;
  disputeId?: string;
  conversation: Conversation;
  receipt: ConversationReceipt;
  transcript: Transcript;
  analysis: ConversationAnalysis;
  quality: ConversationQuality;
  auditTrail: AuditEvent[];
  disputeDetails?: DisputeDetails;
  generatedAt: string;
  generatedBy: string;
}

export interface DisputeDetails {
  id: string;
  title: string;
  description: string;
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  conversations: string[];
  evidence: string[];
  notes: DisputeNote[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export type DisputeStatus =
  | 'open'
  | 'investigating'
  | 'waiting_customer'
  | 'waiting_business'
  | 'resolved'
  | 'closed';

export interface DisputeNote {
  id: string;
  disputeId: string;
  author: 'user' | 'customer' | 'system';
  authorId?: string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface SearchResult {
  type: 'conversation' | 'customer' | 'agent' | 'transcript' | 'product' | 'price' | 'fee' | 'commitment' | 'receipt' | 'dispute';
  id: string;
  title: string;
  subtitle: string;
  matchedFields: string[];
  relevanceScore: number;
  timestamp: string;
}

export interface Entitlements {
  trial: boolean;
  raven: boolean;
  grey_parrot: boolean;
  myna: boolean;
  enterprise: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'annually';
  features: string[];
  limits: PlanLimits;
  entitlementId: keyof Entitlements;
  isPopular?: boolean;
  isEnterprise?: boolean;
}

export interface PlanLimits {
  conversations: number | 'unlimited';
  detections: number | 'unlimited';
  transcriptions: number | 'unlimited';
  summaries: number | 'unlimited';
  promiseExtractions: number | 'unlimited';
  priceExtractions: number | 'unlimited';
  feeAnalyses: number | 'unlimited';
  evidenceReports: number | 'unlimited';
  teamMembers?: number | 'unlimited';
  apiAccess?: boolean;
  sla?: string;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  seenSteps: number[];
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  notifications: boolean;
  autoSync: boolean;
  dataRetentionDays: number;
  language: string;
  timezone: string;
}