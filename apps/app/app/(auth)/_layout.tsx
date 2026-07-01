// The signed-out zone (app-ia.md §4.3): a Stack for the one auth surface (Sign In), with the SYMMETRIC
// guard to (app)/_layout.tsx. When a session appears (the user just authenticated), it redirects back to
// the gate (`/`), which then routes to the dashboard — this is the app-ia §6.1 "Sign In -> home via the gate
// re-running" replace transition made concrete, so a signed-in user never sits on the sign-in surface.
// headerShown is false app-wide (the app draws its own chrome).
// Configure Unistyles before this group's styled children (sign-in) evaluate — the `(auth)` group sorts
// before app/_layout.tsx in the eagerly-evaluated route context (see (app)/_layout.tsx). Module singleton,
// so it is a no-op once configure has already run.
import '../../unistyles';
import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Splash } from '../../src/shell';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
