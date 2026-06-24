// A UX-only gate around a Pro feature (AOD-12 §6.5, §7). It renders children when the resolved
// Entitlements allow the boolean lever, otherwise the fallback (a lock / upsell). It never performs
// the gated mutation; the server refuses an over-limit request regardless of what the UI shows.
import React from 'react';
import type { Entitlements } from '@vela/shared';
import { useEntitlements } from './useEntitlements';

// The boolean entitlement levers (AOD-12 §4): canUseKiosk, canUseThemes, canUsePremiumPacks.
type BooleanFeature = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

export function Gate({
  feature,
  children,
  fallback,
}: {
  feature: BooleanFeature;
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const entitlements = useEntitlements();
  return <>{entitlements[feature] ? children : fallback}</>;
}
