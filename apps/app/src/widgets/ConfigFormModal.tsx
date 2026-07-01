// A bottom-sheet wrapping the pure ConfigForm, reused by both config entry points (the add flow's
// configure-on-add and the dashboard's reconfigure) so the sheet chrome is not duplicated. It is
// presentational: it forwards every ConfigForm prop and adds no logic.
//
// AOD-69 canonicalization (design-dashboard-editor §7, §11 drift 5): the presentation is now the AOD-21 §7
// in-screen sheet, composed from the AOD-67 `Sheet` component (scrim + elevation.overlay surfaceAlt +
// grabber + safe-area bottom inset), replacing the local rgba/`background` reimplementation the AOD-67
// build had already role-swapped. A single component now owns the sheet chrome for every widget's config.
import React from 'react';
import { ScrollView } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { Sheet } from '../ui';
import { ConfigForm, type ConfigFormProps } from './ConfigForm';

export function ConfigFormModal(props: ConfigFormProps) {
  return (
    <Sheet visible onRequestClose={props.onCancel} bottomInset={UnistylesRuntime.insets.bottom} testID="config-sheet">
      <ScrollView keyboardShouldPersistTaps="handled">
        <ConfigForm {...props} />
      </ScrollView>
    </Sheet>
  );
}
