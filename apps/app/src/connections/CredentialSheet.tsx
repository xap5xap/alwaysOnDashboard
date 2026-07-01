// The credential-entry sheet (design-settings-connections.md §6, app-ia.md §4.4 / §5 row 9). The AOD-21 §7
// in-screen sheet that carries a live ServiceDefinition + authClass, so it stays OFF the router (it is
// parameterized by a live object, not serializable route params). The presentation is the AOD-67 `Sheet`
// (scrim + elevation.overlay surfaceAlt + grabber + safe-area bottom inset), composed exactly as AOD-69
// composed the widget picker / config sheets (WidgetPicker.tsx, ConfigFormModal.tsx). The interior is the
// pure CredentialForm, which dispatches on the MECHANISM ('key' | 'location'), never the service.
//
// AOD-70 canonicalization (§10 drift 1): this REPLACES the shipped inline CredentialForm that rendered
// inside the row, replacing the action. The connect / credential body is unchanged; only the presentation
// is canonicalized to the shell's sheet chrome.
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { Button, Sheet } from '../ui';
import { CredentialForm, type CredentialFormProps } from './CredentialForm';

export interface CredentialSheetProps extends CredentialFormProps {
  /** The connecting service's display name, for the "Connect <Service>" header (never the service id). */
  serviceName: string;
}

export function CredentialSheet({ serviceName, ...formProps }: CredentialSheetProps) {
  return (
    <Sheet
      visible
      onRequestClose={formProps.onCancel}
      bottomInset={UnistylesRuntime.insets.bottom}
      testID="credential-sheet"
    >
      <View style={styles.header}>
        <Text style={styles.title} testID="credential-sheet-title">
          Connect {serviceName}
        </Text>
        <Button label="Close" variant="ghost" size="sm" onPress={formProps.onCancel} testID="credential-sheet-close" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <CredentialForm {...formProps} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
}));
