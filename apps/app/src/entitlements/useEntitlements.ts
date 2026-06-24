// UX-only entitlement resolution on the client (AOD-12 §6.5). It reads CustomerInfo and resolves the
// same @vela/shared Entitlements model the server enforces, but uses it only to decide what the UI
// offers (locks, disabled buttons, the kiosk gate). The server check (AOD-45) is the only line of
// trust; this is convenience only.
import { entitlementsFor, tierFromActiveEntitlements, type Entitlements } from '@vela/shared';
import { useCustomerInfo } from './CustomerInfoContext';

export function useEntitlements(): Entitlements {
  const info = useCustomerInfo();
  const tier = tierFromActiveEntitlements(new Set(info.activeEntitlementIds));
  return entitlementsFor(tier);
}
