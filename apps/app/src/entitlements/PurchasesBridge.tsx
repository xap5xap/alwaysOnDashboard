// The bridge from the RevenueCat SDK to the client CustomerInfo state (AOD-29 / AOD-12 §5.3, §6.5). Mounted
// once inside the CustomerInfoProvider + AuthProvider: it configures the SDK and identifies the user
// (Purchases.logIn = app_user_id) whenever the session changes, and subscribes to CustomerInfo updates,
// pushing the active-entitlement ids into the provider so a purchase / restore flips the Gate locks off
// without a restart. Renders nothing. Kept out of CustomerInfoContext so that context stays SDK-free (the
// entitlement tests mount the provider without pulling the native module).
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useSetCustomerInfo } from './CustomerInfoContext';
import { purchases } from './purchases';

export function PurchasesBridge() {
  const { session } = useAuth();
  const setCustomerInfo = useSetCustomerInfo();
  const userId = session?.user?.id ?? null;

  // Configure + identify (no-op without a key). Re-runs on sign-in so app_user_id == auth.uid() (AOD-12 §5.3).
  useEffect(() => {
    purchases.configure(userId);
  }, [userId]);

  // Reflect SDK CustomerInfo updates into the client Entitlements (a purchase / restore unlocks instantly).
  useEffect(() => {
    return purchases.addListener((result) => setCustomerInfo(result.activeEntitlementIds));
  }, [setCustomerInfo]);

  return null;
}
