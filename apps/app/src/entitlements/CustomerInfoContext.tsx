// The client's view of RevenueCat CustomerInfo (AOD-12 §6.5), reduced to the active-entitlement ids the tier
// math reads. AOD-29 makes it STATEFUL: a purchase / restore / SDK CustomerInfo update flips the ids through
// the setter, so the Gate locks fall away without a restart. The `value` prop seeds the initial ids (tests
// inject a Pro/Free set; the app seeds the AOD-75 dogfood grant, [] outside internal builds); the live SDK
// wiring is the PurchasesBridge, which reads the setter. This value is UX only; the server (AOD-45 webhook)
// is the line of trust.
import React, { createContext, useContext, useMemo, useState } from 'react';
import { devGrantedEntitlementIds } from './devEntitlements';

export interface CustomerInfoLike {
  activeEntitlementIds: string[];
}

const CustomerInfoContext = createContext<CustomerInfoLike>({ activeEntitlementIds: [] });
const SetCustomerInfoContext = createContext<(activeEntitlementIds: string[]) => void>(() => {});

export function CustomerInfoProvider({
  value,
  children,
}: {
  /** Optional initial ids. Tests inject a fixed set; the app seeds [] and lets the PurchasesBridge drive it. */
  value?: CustomerInfoLike;
  children: React.ReactNode;
}) {
  // The AOD-75 dogfood grant seeds the INITIAL ids only (never in production builds, see
  // devEntitlements.ts); an injected `value` wins, and any real SDK update overrides via the setter.
  const [activeEntitlementIds, setActiveEntitlementIds] = useState<string[]>(
    value?.activeEntitlementIds ?? devGrantedEntitlementIds(),
  );
  const info = useMemo<CustomerInfoLike>(() => ({ activeEntitlementIds }), [activeEntitlementIds]);
  return (
    <SetCustomerInfoContext.Provider value={setActiveEntitlementIds}>
      <CustomerInfoContext.Provider value={info}>{children}</CustomerInfoContext.Provider>
    </SetCustomerInfoContext.Provider>
  );
}

export function useCustomerInfo(): CustomerInfoLike {
  return useContext(CustomerInfoContext);
}

/** The setter the PurchasesBridge (SDK listener) and the paywall purchase/restore push CustomerInfo through. */
export function useSetCustomerInfo(): (activeEntitlementIds: string[]) => void {
  return useContext(SetCustomerInfoContext);
}
