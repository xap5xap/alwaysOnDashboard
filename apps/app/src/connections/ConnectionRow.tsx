// One service row in the connections surface. It is generic: it reads the action from rowAction(
// service.authClass, status) and renders the matching affordance, never branching on which service.
// OAuth connects open the provider URL; key/location connects open the inline generic CredentialForm;
// connected rows offer Disconnect; reauth_required/error rows offer Reconnect (re-running the class's
// connect mechanism, AOD-9 §9). Per-row pending/error state wraps each awaited Edge Function call.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { ServiceDefinition } from '../registry/types';
import { rowAction, statusLabel } from './affordance';
import type { ConnectionView } from './connectionsRepo';
import { CredentialForm } from './CredentialForm';
import type { ConnectionActions } from './useConnectionActions';

export interface ConnectionRowProps {
  service: ServiceDefinition;
  connection: ConnectionView | undefined;
  loading: boolean;
  actions: ConnectionActions;
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Something went wrong. Try again.';
}

export function ConnectionRow({ service, connection, loading, actions }: ConnectionRowProps) {
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
    if (action.mechanism === 'oauth') {
      void run(() => actions.oauthConnect(service.id));
    } else {
      setError(null);
      setFormOpen(true);
    }
  };

  const isFormMechanism =
    (action.kind === 'connect' || action.kind === 'reconnect') && action.mechanism !== 'oauth';

  return (
    <View style={styles.row} testID={`connection-row-${service.id}`}>
      <View style={styles.head}>
        <View style={styles.identity}>
          <Text style={styles.name}>{service.displayName}</Text>
          <Text style={styles.status} testID={`connection-status-${service.id}`}>
            {loading ? 'Checking...' : statusLabel(connection?.status)}
            {connection?.accountLabel ? ` · ${connection.accountLabel}` : ''}
          </Text>
        </View>

        {action.kind === 'none' ? (
          <Text style={styles.builtIn}>No connection needed</Text>
        ) : (
          !formOpen && (
            <Pressable
              onPress={onPressAction}
              accessibilityRole="button"
              disabled={pending}
              testID={`connection-action-${service.id}`}
            >
              <Text style={[styles.action, action.kind === 'disconnect' && styles.actionDanger]}>
                {pending ? '...' : action.label}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {!formOpen && error && (
        <Text style={styles.error} testID={`connection-error-${service.id}`}>
          {error}
        </Text>
      )}

      {formOpen && isFormMechanism && (
        <CredentialForm
          mechanism={action.mechanism as 'key' | 'location'}
          pending={pending}
          error={error}
          onSubmit={(payload) => void run(() => actions.submitCredentials(service.id, payload))}
          onCancel={() => {
            setFormOpen(false);
            setError(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    paddingVertical: theme.spacing(3),
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    gap: theme.spacing(1),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
  },
  identity: {
    flexShrink: 1,
    gap: theme.spacing(0.5),
  },
  name: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  builtIn: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  action: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  actionDanger: {
    color: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
}));
