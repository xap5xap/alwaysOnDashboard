// The expo-router root layout: configure Unistyles (must run before any StyleSheet.create) and wrap
// the app in its providers. The production WidgetDataSource is a ProxyDataSource over the supabase
// client, so the host's fetches go to the AOD-44 proxy with the session JWT. CustomerInfo defaults
// to Free (the RevenueCat SDK lands later); the registry and query client are app-wide singletons.
import '../unistyles';
import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/auth/AuthProvider';
import { RegistryProvider } from '../src/registry/RegistryProvider';
import { CustomerInfoProvider } from '../src/entitlements/CustomerInfoContext';
import { WidgetDataSourceProvider } from '../src/host/WidgetDataSource';
import { ProxyDataSource } from '../src/host/ProxyDataSource';
import { supabase } from '../src/supabase/client';

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const dataSource = useMemo(() => new ProxyDataSource(supabase), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RegistryProvider>
            <CustomerInfoProvider value={{ activeEntitlementIds: [] }}>
              <WidgetDataSourceProvider source={dataSource}>
                <Stack screenOptions={{ headerShown: false }} />
              </WidgetDataSourceProvider>
            </CustomerInfoProvider>
          </RegistryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
