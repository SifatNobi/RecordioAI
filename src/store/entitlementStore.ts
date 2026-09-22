import { create } from 'zustand';
import { Entitlements, SubscriptionPlan } from '@/types';

interface EntitlementState {
  entitlements: Entitlements;
  plans: SubscriptionPlan[];
  currentPlanId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface EntitlementActions {
  setEntitlements: (entitlements: Partial<Entitlements>) => void;
  setPlans: (plans: SubscriptionPlan[]) => void;
  setCurrentPlan: (planId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hasEntitlement: (key: keyof Entitlements) => boolean;
  hasFeature: (feature: string) => boolean;
  getCurrentPlan: () => SubscriptionPlan | null;
  reset: () => void;
  initializeEntitlements: () => void;
}

const defaultEntitlements: Entitlements = {
  trial: false,
  raven: false,
  grey_parrot: false,
  myna: false,
  enterprise: false,
};

const defaultPlans: SubscriptionPlan[] = [
  {
    id: 'trial',
    name: '7-Day Premium Trial',
    description: 'Try all premium features free for 7 days',
    price: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      '10 AI conversation recordings',
      '10 AI detections',
      '10 transcriptions',
      '10 summaries',
      '10 promise/agreement extractions',
      '10 price/fee extractions',
      '10 hidden-fee analyses',
      '10 evidence reports',
    ],
    limits: {
      conversations: 10,
      detections: 10,
      transcriptions: 10,
      summaries: 10,
      promiseExtractions: 10,
      priceExtractions: 10,
      feeAnalyses: 10,
      evidenceReports: 10,
    },
    entitlementId: 'trial',
  },
  {
    id: 'raven',
    name: 'Raven',
    description: 'Essential trust layer for AI conversations',
    price: 199.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Unlimited AI conversation recordings',
      'Unlimited AI detections',
      'Unlimited transcriptions',
      'Unlimited summaries',
      'Unlimited promise/agreement extractions',
      'Unlimited price/fee extractions',
      'Unlimited hidden-fee analyses',
      'Unlimited evidence reports',
      'Cryptographic integrity verification',
      'Resolve Centre access',
    ],
    limits: {
      conversations: 'unlimited',
      detections: 'unlimited',
      transcriptions: 'unlimited',
      summaries: 'unlimited',
      promiseExtractions: 'unlimited',
      priceExtractions: 'unlimited',
      feeAnalyses: 'unlimited',
      evidenceReports: 'unlimited',
    },
    entitlementId: 'raven',
  },
  {
    id: 'grey_parrot',
    name: 'Grey Parrot',
    description: 'Advanced analytics and team collaboration',
    price: 499.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Everything in Raven',
      'Advanced conversation analytics',
      'Team workspace (up to 5 members)',
      'Custom integrations',
      'Priority support',
      'API access',
      'SLA guarantee',
    ],
    limits: {
      conversations: 'unlimited',
      detections: 'unlimited',
      transcriptions: 'unlimited',
      summaries: 'unlimited',
      promiseExtractions: 'unlimited',
      priceExtractions: 'unlimited',
      feeAnalyses: 'unlimited',
      evidenceReports: 'unlimited',
      teamMembers: 5,
      apiAccess: true,
      sla: '99.9%',
    },
    entitlementId: 'grey_parrot',
    isPopular: true,
  },
  {
    id: 'myna',
    name: 'Myna',
    description: 'Enterprise-grade trust and compliance',
    price: 1119.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Everything in Grey Parrot',
      'Unlimited team members',
      'Custom compliance rules',
      'Dedicated infrastructure',
      'Audit logging API',
      'White-label evidence packages',
      '24/7 dedicated support',
      'Custom SLA',
    ],
    limits: {
      conversations: 'unlimited',
      detections: 'unlimited',
      transcriptions: 'unlimited',
      summaries: 'unlimited',
      promiseExtractions: 'unlimited',
      priceExtractions: 'unlimited',
      feeAnalyses: 'unlimited',
      evidenceReports: 'unlimited',
      teamMembers: 'unlimited',
      apiAccess: true,
      sla: '99.99%',
    },
    entitlementId: 'myna',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom deployment and compliance',
    price: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Custom pricing',
      'On-premise deployment option',
      'Custom compliance frameworks',
      'Dedicated account management',
      'Custom integrations',
      'Unlimited everything',
    ],
    limits: {
      conversations: 'unlimited',
      detections: 'unlimited',
      transcriptions: 'unlimited',
      summaries: 'unlimited',
      promiseExtractions: 'unlimited',
      priceExtractions: 'unlimited',
      feeAnalyses: 'unlimited',
      evidenceReports: 'unlimited',
      teamMembers: 'unlimited',
      apiAccess: true,
    },
    entitlementId: 'enterprise',
    isEnterprise: true,
  },
];

export const useEntitlementStore = create<EntitlementState & EntitlementActions>()(
  (set, get) => ({
    entitlements: defaultEntitlements,
    plans: defaultPlans,
    currentPlanId: null,
    isLoading: false,
    error: null,
    lastFetched: null,

    setEntitlements: (entitlements) =>
      set((state) => ({
        entitlements: { ...state.entitlements, ...entitlements },
        lastFetched: Date.now(),
      })),

    setPlans: (plans) => set({ plans }),

    setCurrentPlan: (planId) => set({ currentPlanId: planId }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    hasEntitlement: (key) => get().entitlements[key],

    hasFeature: (feature) => {
      const { entitlements, plans, currentPlanId } = get();
      if (!currentPlanId) return false;
      const plan = plans.find((p) => p.id === currentPlanId);
      if (!plan) return false;
      return plan.features.some((f) =>
        f.toLowerCase().includes(feature.toLowerCase())
      );
    },

    getCurrentPlan: () => {
      const { plans, currentPlanId } = get();
      return plans.find((p) => p.id === currentPlanId) || null;
    },

    reset: () =>
      set({
        entitlements: defaultEntitlements,
        currentPlanId: null,
        error: null,
        lastFetched: null,
      }),

    initializeEntitlements: () => {
      // Initialization logic can go here if needed
    },
  })
);