// The OAuth callback cold-start fallback (app-ia.md §8.1, design-core-navigation.md). The backend's final
// 302 into the app is `vela://oauth/done?service=…&status=ok|error`, carrying a success signal only, never
// a token. The PRIMARY path is in-session capture inside the connect action (WebBrowser.openAuthSessionAsync
// resolves in the calling code) — that is AOD-28's connect wiring, NOT here. THIS route is the FALLBACK: if
// the OS delivers the deep-link as a cold launch / foreground (app killed, or the auth session dismissed),
// expo-router routes it to `app/oauth/done.tsx`, which renders this. It reads { service, status }, surfaces
// success or failure, and routes to Settings → Connections (which re-fetches its RLS-scoped connections on
// mount). It owns no token and renders no durable surface. Scheme `vela` is already registered in app.json.
import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar, ErrorState, EmptyState, Screen, ScreenBody } from '../shell';

export function OAuthDone() {
  const { service, status } = useLocalSearchParams<{ service?: string; status?: string }>();
  const ok = status !== 'error';
  const label = service ?? 'the service';

  return (
    <Screen>
      <AppBar variant="pushed" title="Connection" />
      <ScreenBody scroll={false}>
        {ok ? (
          <EmptyState
            line={`Connected ${label}.`}
            actionLabel="Continue"
            onAction={() => router.replace('/settings')}
            testID="oauth-done-ok"
          />
        ) : (
          <ErrorState
            line="Connection failed."
            detail={`Could not finish connecting ${label}.`}
            onRetry={() => router.replace('/settings')}
            testID="oauth-done-error"
          />
        )}
      </ScreenBody>
    </Screen>
  );
}
