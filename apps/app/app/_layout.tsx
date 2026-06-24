// The expo-router root layout: configure Unistyles (must run before any StyleSheet.create) and wrap
// the app in its providers. The production WidgetDataSource is a ProxyDataSource over the supabase
// client, so the host's fetches go to the AOD-44 proxy with the session JWT. CustomerInfo defaults
// to Free (the RevenueCat SDK lands later); the registry and query client are app-wide singletons.
// The query cache is persisted (AOD-25): MMKV on device, localStorage on web, so the last-known
// dashboard layout (AOD-7) paints on cold start. GestureHandlerRootView is required by the AOD-25
// gesture stack that the free-form layout engine uses for drag/resize.
import '../unistyles';
import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from '../src/auth/AuthProvider';
import { RegistryProvider } from '../src/registry/RegistryProvider';
import { CustomerInfoProvider } from '../src/entitlements/CustomerInfoContext';
import { WidgetDataSourceProvider } from '../src/host/WidgetDataSource';
import { ProxyDataSource } from '../src/host/ProxyDataSource';
import { supabase } from '../src/supabase/client';
import { queryPersister } from '../src/storage/queryPersister';

// gcTime must outlive the persister maxAge or restored queries are dropped as stale on rehydrate.
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { gcTime: CACHE_MAX_AGE_MS } },
      }),
    [],
  );
  const dataSource = useMemo(() => new ProxyDataSource(supabase), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE_MS }}
        >
          <AuthProvider>
            <RegistryProvider>
              <CustomerInfoProvider value={{ activeEntitlementIds: [] }}>
                <WidgetDataSourceProvider source={dataSource}>
                  <Stack screenOptions={{ headerShown: false }} />
                </WidgetDataSourceProvider>
              </CustomerInfoProvider>
            </RegistryProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
