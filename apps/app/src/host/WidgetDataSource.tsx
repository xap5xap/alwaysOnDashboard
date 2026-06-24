// The widget data-source seam. The host fetches normalized widget data through this interface; the
// production implementation (ProxyDataSource) calls the AOD-44 proxy Edge Function with the Supabase
// session JWT. Injecting it via context keeps the host testable (a mock source drives every
// lifecycle state) and keeps the AOD-8 seam intact: the host never names a service or a transport.
import React, { createContext, useContext } from 'react';
import type { ProxyResult } from '../widgets/lifecycle';

export interface WidgetDataRequest {
  serviceId: string;
  widgetType: string;
  params: Record<string, unknown>;
}

export interface WidgetDataSource {
  /** Resolve normalized data, or throw a ProxyError (AOD-10 §6.4) on a typed failure. */
  fetch(req: WidgetDataRequest): Promise<ProxyResult>;
}

const WidgetDataSourceContext = createContext<WidgetDataSource | null>(null);

export function WidgetDataSourceProvider({
  source,
  children,
}: {
  source: WidgetDataSource;
  children: React.ReactNode;
}) {
  return <WidgetDataSourceContext.Provider value={source}>{children}</WidgetDataSourceContext.Provider>;
}

export function useWidgetDataSource(): WidgetDataSource {
  const source = useContext(WidgetDataSourceContext);
  if (!source) throw new Error('WidgetDataSource not provided. Wrap the tree in <WidgetDataSourceProvider>.');
  return source;
}
