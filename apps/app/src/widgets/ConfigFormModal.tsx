// A bottom-sheet Modal wrapping the pure ConfigForm, reused by both config entry points (the add
// flow's configure-on-add and the dashboard's reconfigure) so the modal chrome is not duplicated. It
// is presentational: it forwards every ConfigForm prop and adds no logic. Visual design is DS-M1
// (AOD-28); this is the functional surface, like the AOD-51 picker sheet it mirrors.
import React from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ConfigForm, type ConfigFormProps } from './ConfigForm';

export function ConfigFormModal(props: ConfigFormProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ConfigForm {...props} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// AOD-20 §13 drift 4 (additive role-swap): the backdrop resolves to the `scrim` token and the sheet fills
// at elevation.overlay (surfaceAlt), so a single token change reskins every sheet. The full adoption of the
// AOD-20 §9 Sheet component (grabber, elevation helper) is AOD-27's config-sheet interior recompose.
const styles = StyleSheet.create((theme, rt) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceAlt,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
    maxHeight: '85%',
  },
}));
