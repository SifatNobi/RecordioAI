/**
 * One-to-one mapping between the app's subscription plans and the products and
 * entitlements actually configured in the RecordioAIApp RevenueCat project.
 *
 * These identifiers come from the RevenueCat dashboard/Test Store and must not
 * be invented or replaced. `storeProductId` is the Android store product id and
 * is also what RevenueCat returns as `storeProduct.identifier`. The
 * RevenueCat product/entitlement GUIDs are kept here for traceability and
 * never used as purchase/entitlement matchers (matching is always done through
 * the identifiers RevenueCat returns at runtime).
 */
export interface RevenueCatPlanCatalog {
  planId: 'raven' | 'grey_parrot' | 'myna';
  /** Store product id (also `storeProduct.identifier` returned by RevenueCat). */
  storeProductId: string;
  /** RevenueCat product GUID. */
  revenueCatProductId: string;
  /** Entitlement identifier configured in RevenueCat. */
  entitlementIdentifier: string;
  /** RevenueCat entitlement GUID. */
  entitlementKey: string;
  /** Tier rank used to implement "higher plan includes lower plan" access. */
  rank: number;
}

export const REVENUECAT_PLANS: RevenueCatPlanCatalog[] = [
  {
    planId: 'raven',
    storeProductId: 'recordioai_raven_monthly',
    revenueCatProductId: 'prod8bed37379f',
    entitlementIdentifier: 'raven',
    entitlementKey: 'entl33904337b9',
    rank: 1,
  },
  {
    planId: 'grey_parrot',
    storeProductId: 'recordioai_grey_parrot_monthly',
    revenueCatProductId: 'prod3f2c17f03e',
    entitlementIdentifier: 'grey_parrot',
    entitlementKey: 'entlaabb5d4e43',
    rank: 2,
  },
  {
    planId: 'myna',
    storeProductId: 'recordioai_myna_monthly',
    revenueCatProductId: 'prod993c38e9fb',
    entitlementIdentifier: 'myna',
    entitlementKey: 'entl79f38c0da3',
    rank: 3,
  },
];

export function getPlanCatalog(
  planId: string
): RevenueCatPlanCatalog | undefined {
  return REVENUECAT_PLANS.find((plan) => plan.planId === planId);
}

export function getPlanCatalogByEntitlement(
  entitlementIdentifier: string
): RevenueCatPlanCatalog | undefined {
  return REVENUECAT_PLANS.find(
    (plan) => plan.entitlementIdentifier === entitlementIdentifier
  );
}

export function getPlanCatalogByStoreProduct(
  storeProductId: string
): RevenueCatPlanCatalog | undefined {
  return REVENUECAT_PLANS.find(
    (plan) =>
      plan.storeProductId === storeProductId ||
      plan.revenueCatProductId === storeProductId
  );
}