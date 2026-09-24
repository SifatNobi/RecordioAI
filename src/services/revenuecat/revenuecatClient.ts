import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { REVENUECAT_ANDROID_API_KEY } from '@/constants/env';
import { Entitlements } from '@/types';
import {
  REVENUECAT_PLANS,
  getPlanCatalogByStoreProduct,
} from './catalog';

/**
 * RevenueCat customer info / subscription logic. All subscription truth lives
 * in RevenueCat (CustomerInfo). Purchases are never simulated - a plan is only
 * considered active when RevenueCat confirms its entitlement.
 */

let configured = false;
let customerInfoListener: ((customerInfo: CustomerInfo) => void) | null = null;

/** Configures RevenueCat exactly once. Safe to call across app reloads. */
export function configureRevenueCat(): boolean {
  if (configured) {
    return true;
  }

  try {
    Purchases.configure({ apiKey: REVENUECAT_ANDROID_API_KEY });
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** Fetches the RevenueCat current/default offering (never faked locally). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export interface PlanPackage {
  /** The RevenueCat package that maps to one of our configured plans. */
  pkg: PurchasesPackage;
  planId: string;
}

/** Maps the packages in a RevenueCat offering to the app's plans by their
 * actual product identifiers. */
export function mapOfferingPackages(
  offering: PurchasesOffering | null
): PlanPackage[] {
  if (!offering) {
    return [];
  }

  const result: PlanPackage[] = [];

  for (const pkg of offering.availablePackages) {
    const plan = getPlanCatalogByStoreProduct(pkg.product.identifier);
    if (plan) {
      result.push({ pkg, planId: plan.planId });
    }
  }

  return result;
}

export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** Subscribes to CustomerInfo updates from RevenueCat (idempotent). */
export function subscribeToCustomerInfoUpdates(
  listener: (customerInfo: CustomerInfo) => void
): void {
  if (customerInfoListener) {
    Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
  }

  customerInfoListener = listener;
  Purchases.addCustomerInfoUpdateListener(customerInfoListener);
}

const TIER_ORDER = REVENUECAT_PLANS.map((plan) => plan.planId);

/** Derives the app's entitlement model from RevenueCat CustomerInfo. Higher
 * plans (per tier rank) grant access to the features of lower plans. */
export function deriveEntitlements(customerInfo: CustomerInfo): Entitlements {
  const active = new Set(
    Object.keys(customerInfo.entitlements.active)
  );

  const entitlements: Entitlements = {
    trial: false,
    raven: false,
    grey_parrot: false,
    myna: false,
    enterprise: false,
  };

  let highestActiveRank = 0;

  for (const plan of REVENUECAT_PLANS) {
    if (active.has(plan.entitlementIdentifier)) {
      entitlements[plan.planId] = true;
      highestActiveRank = Math.max(highestActiveRank, plan.rank);
    }
  }

  // Any active plan grants access to every lower-tier plan in the hierarchy.
  if (highestActiveRank > 0) {
    for (const plan of REVENUECAT_PLANS) {
      if (plan.rank < highestActiveRank) {
        entitlements[plan.planId] = true;
      }
    }
  }

  return entitlements;
}

/** Returns the highest active plan id derived from CustomerInfo, or null. */
export function deriveCurrentPlanId(
  entitlements: Entitlements
): string | null {
  for (let index = TIER_ORDER.length - 1; index >= 0; index -= 1) {
    const planId = TIER_ORDER[index];
    if (entitlements[planId]) {
      return planId;
    }
  }

  return null;
}

export interface ClassifiedError {
  kind:
    | 'cancelled'
    | 'already_purchased'
    | 'network'
    | 'store_problem'
    | 'pending'
    | 'product_unavailable'
    | 'configuration'
    | 'unknown';
  message: string;
}

/** Classifies RevenueCat errors into the outcomes the UI must distinguish. */
export function classifyRevenueCatError(error: unknown): ClassifiedError {
  const err = error as {
    code?: string;
    message?: string;
    userCancelled?: boolean | null;
    underlyingErrorMessage?: string;
  };

  if (err.userCancelled) {
    return {
      kind: 'cancelled',
      message: 'The purchase was cancelled before completing.',
    };
  }

  const code = err.code;

  switch (code) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
      return {
        kind: 'cancelled',
        message: 'The purchase was cancelled before completing.',
      };
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return {
        kind: 'already_purchased',
        message: 'This plan was already purchased on this account.',
      };
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      return {
        kind: 'network',
        message:
          'A network error occurred. Check your connection and try again.',
      };
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return {
        kind: 'store_problem',
        message:
          'The store (RevenueCat Test Store / play billing) reported a problem.',
      };
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return {
        kind: 'pending',
        message:
          'The purchase is still pending. Complete it in the store to finish.',
      };
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return {
        kind: 'product_unavailable',
        message:
          'This product is unavailable in the RevenueCat Test Store. Verify it is configured with a price.',
      };
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
    case PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR:
    case PURCHASES_ERROR_CODE.API_ENDPOINT_BLOCKED:
      return {
        kind: 'configuration',
        message:
          'RevenueCat is not configured correctly for this build. Check the SDK key and project configuration.',
      };
    default:
      return {
        kind: 'unknown',
        message:
          err.message ||
          err.underlyingErrorMessage ||
          'An unknown error occurred while processing the purchase.',
      };
  }
}