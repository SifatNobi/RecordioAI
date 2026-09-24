import { create } from 'zustand';
import { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Entitlements } from '@/types';
import { useEntitlementStore } from '@/store/entitlementStore';
import {
  classifyRevenueCatError,
  ClassifiedError,
  configureRevenueCat,
  deriveCurrentPlanId,
  deriveEntitlements,
  getCurrentOffering,
  getCustomerInfo,
  mapOfferingPackages,
  PlanPackage,
  purchasePackage,
  restorePurchases,
  subscribeToCustomerInfoUpdates,
} from '@/services/revenuecat/revenuecatClient';

export type RevenueCatStatus = 'uninitialized' | 'configured' | 'error';

interface RevenueCatState {
  status: RevenueCatStatus;
  offeringsLoading: boolean;
  offeringsError: string | null;
  /** RevenueCat package per planId (raven/grey_parrot/myna), from the live offering. */
  packageByPlan: Partial<Record<string, PurchasesPackage | null>>;
  /** Localized display price per planId returned by RevenueCat (priceString). */
  priceByPlan: Partial<Record<string, string>>;
  customerInfo: CustomerInfo | null;
  entitlements: Entitlements;
  currentPlanId: string | null;
  /** planId currently being purchased (guards against double taps). */
  purchasingPlanId: string | null;
  restoring: boolean;
  purchaseError: string | null;
  restoreMessage: { kind: 'success' | 'none' | 'error'; text: string } | null;
}

interface RevenueCatActions {
  initialize: () => Promise<void>;
  loadOfferings: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  purchase: (planId: string) => Promise<CustomerInfo | null>;
  restore: () => Promise<void>;
  clearPurchaseError: () => void;
  clearRestoreMessage: () => void;
}

const defaultEntitlements: Entitlements = {
  trial: false,
  raven: false,
  grey_parrot: false,
  myna: false,
  enterprise: false,
};

export const useRevenueCatStore = create<RevenueCatState & RevenueCatActions>()(
  (set, get) => {
    const applyCustomerInfo = (info: CustomerInfo) => {
      const entitlements = deriveEntitlements(info);
      const currentPlanId = deriveCurrentPlanId(entitlements);

      set({ customerInfo: info, entitlements, currentPlanId });

      // Feed the app's existing subscription/entitlement store so current UI
      // and feature gating reflect the real RevenueCat CustomerInfo.
      useEntitlementStore.getState().setEntitlements(entitlements);
      useEntitlementStore.getState().setCurrentPlan(currentPlanId);
    };

    const loadOfferings = async (): Promise<void> => {
      set({ offeringsLoading: true, offeringsError: null });

      try {
        const offering = await getCurrentOffering();
        const mapped: PlanPackage[] = mapOfferingPackages(offering);

        const packageByPlan: RevenueCatState['packageByPlan'] = {};
        const priceByPlan: RevenueCatState['priceByPlan'] = {};

        for (const item of mapped) {
          packageByPlan[item.planId] = item.pkg;
          const priceString = item.pkg.product.priceString;
          if (priceString) {
            priceByPlan[item.planId] = priceString;
          }
        }

        set({ packageByPlan, priceByPlan, offeringsLoading: false });

        if (mapped.length === 0) {
          set({
            offeringsError:
              'No matching RevenueCat packages were found in the default offering. Verify the Test Store products are attached to an offering.',
          });
        }
      } catch (error) {
        const classified: ClassifiedError = classifyRevenueCatError(error);
        set({
          offeringsLoading: false,
          offeringsError:
            classified.message ||
            'Unable to load plans from RevenueCat. Check your connection and try again.',
        });
      }
    };

    const refreshCustomerInfo = async (): Promise<void> => {
      try {
        const info = await getCustomerInfo();
        applyCustomerInfo(info);
      } catch (error) {
        const classified: ClassifiedError = classifyRevenueCatError(error);
        set({
          offeringsError:
            get().offeringsError ||
            (classified.message ||
              'Unable to read subscription status from RevenueCat.'),
        });
      }
    };

    const purchase = async (planId: string): Promise<CustomerInfo | null> => {
      if (get().purchasingPlanId) {
        return null;
      }

      const pkg = get().packageByPlan[planId];
      if (!pkg) {
        set({
          purchaseError:
            'This plan is not available from RevenueCat yet. Verify the Test Store offering contains it and try again.',
        });
        return null;
      }

      set({ purchasingPlanId: planId, purchaseError: null });

      try {
        const customerInfo = await purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        set({ purchasingPlanId: null });
        return customerInfo;
      } catch (error) {
        const classified: ClassifiedError = classifyRevenueCatError(error);
        set({ purchasingPlanId: null, purchaseError: classified.message });
        return null;
      }
    };

    const restore = async (): Promise<void> => {
      if (get().restoring) {
        return;
      }

      set({ restoring: true, purchaseError: null, restoreMessage: null });

      try {
        const customerInfo = await restorePurchases();
        applyCustomerInfo(customerInfo);

        const entitlements = deriveEntitlements(customerInfo);
        const hasActive =
          entitlements.raven ||
          entitlements.grey_parrot ||
          entitlements.myna;

        set({
          restoring: false,
          restoreMessage: hasActive
            ? { kind: 'success', text: 'Purchases restored successfully.' }
            : {
                kind: 'none',
                text: 'No previous purchases were found on this account.',
              },
        });
      } catch (error) {
        const classified: ClassifiedError = classifyRevenueCatError(error);
        set({
          restoring: false,
          restoreMessage: {
            kind: 'error',
            text: classified.message,
          },
        });
      }
    };

    return {
      status: 'uninitialized',
      offeringsLoading: false,
      offeringsError: null,
      packageByPlan: {},
      priceByPlan: {},
      customerInfo: null,
      entitlements: defaultEntitlements,
      currentPlanId: null,
      purchasingPlanId: null,
      restoring: false,
      purchaseError: null,
      restoreMessage: null,

      initialize: async () => {
        if (get().status !== 'uninitialized') {
          return;
        }

        if (!configureRevenueCat()) {
          set({
            status: 'error',
            offeringsError:
              'RevenueCat could not be initialized. Please try again.',
          });
          return;
        }

        set({ status: 'configured' });

        subscribeToCustomerInfoUpdates((info) => {
          applyCustomerInfo(info);
        });

        // Fire-and-forget warm-up: load offerings and current CustomerInfo.
        void loadOfferings();
        void refreshCustomerInfo();
      },

      loadOfferings,
      refreshCustomerInfo,
      purchase,
      restore,
      clearPurchaseError: () => set({ purchaseError: null }),
      clearRestoreMessage: () => set({ restoreMessage: null }),
    };
  }
);