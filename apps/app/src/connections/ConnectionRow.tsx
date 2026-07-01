// One service row in the connections surface. It is generic: it reads the action from rowAction(
// service.authClass, status) and renders the matching affordance, never branching on which service.
// OAuth connects open the provider URL; key/location connects open the credential SHEET; connected rows
// offer Disconnect; reauth_required/error rows offer Reconnect (re-running the class's connect mechanism,
// AOD-9 §9). Per-row pending/error state wraps each awaited Edge Function call.
//
// AOD-70 canonicalization (design-settings-connections.md §4, §10 drift 1/4): the row IS the AOD-67 §8
// `ListRow` now (identity = displayName + status line; trailing = the affordance), replacing the ad-hoc
// View/Pressable text. The affordance is the AOD-67 §5 Button (destructive Disconnect, ghost Connect/
// Reconnect); a reauth_required/error row leads with the warning `dot` (§9 row 3). The inline credential
// form moves into the AOD-21 §7 CredentialSheet. The connect-limit gate turns a Connect into the AOD-67
// §11 LockRow -> Paywall (§8): a COUNT gate (mayConnectAnother), computed by the list and passed in, so the
// row stays generic. The state matrix (rowAction) is REUSED unchanged; only the presentation is canonicalized.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ServiceDefinition } from '../registry/types';
import { Button, ListRow, LockRow } from '../ui';
import { type RowAction, rowAction, statusLabel } from './affordance';
import type { ConnectionView } from './connectionsRepo';
import { CredentialSheet } from './CredentialSheet';
import type { ConnectionActions } from './useConnectionActions';

export interface ConnectionRowProps {
  service: ServiceDefinition;
  connection: ConnectionView | undefined;
  loading: boolean;
  actions: ConnectionActions;
  /** UX-only connect-limit gate (AOD-12 §7.1, mayConnectAnother), computed by the list. When false, a
   *  Connect becomes the LockRow -> Paywall; reconnect / disconnect are never gated. The server enforces. */
  canConnectAnother: boolean;
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Something went wrong. Try again.';
}

/** §9 row 3 the reauth status dot: the shipped `dot` token (r 4.5) filled `warning` (the AOD-37 §3.1 mark). */
function WarningDot() {
  const { theme } = useUnistyles();
  return (
    <View
      testID="connection-warning-dot"
      style={{ width: theme.dot.r * 2, height: theme.dot.r * 2, borderRadius: theme.dot.r, backgroundColor: theme.colors.warning }}
    />
  );
}

/** The trailing affordance: a muted "No connection needed" label (none), else the AOD-67 §5 Button
 *  (destructive Disconnect / ghost Connect·Reconnect). Pending drives the Button's loading spinner. */
function TrailingAffordance({
  action,
  pending,
  onPress,
  serviceId,
}: {
  action: RowAction;
  pending: boolean;
  onPress: () => void;
  serviceId: string;
}) {
  const { theme } = useUnistyles();
  if (action.kind === 'none') {
    return <Text style={{ ...theme.type.meta, color: theme.colors.textMuted }}>No connection needed</Text>;
  }
  return (
    <Button
      label={action.label}
      variant={action.kind === 'disconnect' ? 'destructive' : 'ghost'}
      size="sm"
      loading={pending}
      onPress={onPress}
      testID={`connection-action-${serviceId}`}
    />
  );
}

export function ConnectionRow({ service, connection, loading, actions, canConnectAnother }: ConnectionRowProps) {
  const action = rowAction(service.authClass, connection?.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const run = async (op: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await op();
      setFormOpen(false);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  const onPressAction = () => {
    if (action.kind === 'none') return;
    if (action.kind === 'disconnect') {
      if (connection) void run(() => actions.disconnect(connection.connectionId));
      return;
    }
    // connect or reconnect: branch on the class mechanism, never the service.
    // SEAM (AOD-70): the oauth path opens the URL via the shipped Linking transport, and the cold-start
    // OAuthDone route completes vela://oauth/done. The in-session WebBrowser.openAuthSessionAsync capture
    // (app-ia §8.1) is a flagged follow-up (needs expo-web-browser); the affordance is canonicalized here.
    if (action.mechanism === 'oauth') {
      void run(() => actions.oauthConnect(service.id));
    } else {
      setError(null);
      setFormOpen(true);
    }
  };

  // The non-oauth mechanism the credential sheet renders, or null (oauth / disconnect / none don't sheet).
  const formMechanism: 'key' | 'location' | null =
    (action.kind === 'connect' || action.kind === 'reconnect') && action.mechanism !== 'oauth'
      ? (action.mechanism as 'key' | 'location')
      : null;

  const showWarnDot = connection?.status === 'reauth_required' || connection?.status === 'error';
  const gatedConnect = action.kind === 'connect' && !canConnectAnother;
  const statusLine =
    (loading ? 'Checking...' : statusLabel(connection?.status)) +
    (connection?.accountLabel ? ` · ${connection.accountLabel}` : '');

  return (
    <View testID={`connection-row-${service.id}`}>
      {gatedConnect ? (
        // §8 the connect-limit gate: the same lock vocabulary as the Settings Themes/Kiosk rows.
        <LockRow
          title={service.displayName}
          onPress={() => router.push('/paywall?trigger=services')}
          testID={`connection-locked-${service.id}`}
        />
      ) : (
        <>
          <ListRow
            title={service.displayName}
            subtitle={statusLine}
            leading={showWarnDot ? <WarningDot /> : undefined}
            trailing={
              <TrailingAffordance action={action} pending={pending} onPress={onPressAction} serviceId={service.id} />
            }
          />
          {!formOpen && error ? (
            <Text style={styles.error} testID={`connection-error-${service.id}`}>
              {error}
            </Text>
          ) : null}
        </>
      )}

      {formOpen && formMechanism ? (
        <CredentialSheet
          serviceName={service.displayName}
          mechanism={formMechanism}
          pending={pending}
          error={error}
          onSubmit={(payload) => void run(() => actions.submitCredentials(service.id, payload))}
          onCancel={() => {
            setFormOpen(false);
            setError(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // §4 the inline per-row error: type.meta / error, indented under the row content (listRow padding).
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
    paddingHorizontal: theme.listRow.padding,
    paddingBottom: theme.spacing(2),
  },
}));
