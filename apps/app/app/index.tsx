// The index route: the auth GATE (app-ia.md §4.2, design-core-navigation.md §4). It owns `/`. While the
// session resolves it renders the shell Splash; then it routes by (session, onboarded) with <Redirect>
// (replace semantics, so the OS back never returns into a stale auth state). The signed-in/out zones are
// the (auth) / (app) route groups; the Dashboard home lives at /dashboard because the gate owns `/` and a
// transparent group index cannot also claim it. Route files stay thin and delegate to src/ so the Unistyles
// babel plugin's `root: 'src'` covers all styled components; the gate predicate lives in src/shell/gate.ts.
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { GATE_HREF, Splash, resolveGateTarget, useOnboarded } from '../src/shell';

export default function Index() {
  const { session, loading } = useAuth();
  const onboarded = useOnboarded();
  const target = resolveGateTarget({ loading, hasSession: !!session, onboarded });
  if (target === 'splash') return <Splash />;
  return <Redirect href={GATE_HREF[target]} />;
}
