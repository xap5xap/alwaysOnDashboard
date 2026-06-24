// The client's view of RevenueCat CustomerInfo (AOD-12 §6.5), reduced to the active-entitlement ids
// the tier math reads. The real Purchases SDK + paywall are out of scope for the app shell; this
// context supplies the ids and defaults to Free. Tests inject a Pro set; later PS-M2 wires the SDK's
// CustomerInfo updates into this provider. This value is UX only; the server is the line of trust.
import React, { createContext, useContext } from 'react';

export interface CustomerInfoLike {
  activeEntitlementIds: string[];
}

const CustomerInfoContext = createContext<CustomerInfoLike>({ activeEntitlementIds: [] });

export function CustomerInfoProvider({
  value,
  children,
}: {
  value: CustomerInfoLike;
  children: React.ReactNode;
}) {
  return <CustomerInfoContext.Provider value={value}>{children}</CustomerInfoContext.Provider>;
}

export function useCustomerInfo(): CustomerInfoLike {
  return useContext(CustomerInfoContext);
}
