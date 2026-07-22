// AOD-195 component band: the long-press quick-actions menu. The load-bearing contract is that the item set
// VARIES BY WIDGET — Edit Widget only when the def declares config fields (the iPad Notes-yes / Music-no
// rule), the S/M/W/L row only when it supports more than one size — and that each item fires its callback and
// an outside tap dismisses. The registry is stubbed to control the def; the menu names no service (it reads
// configSchema.fields.length + supportedSizes, never a service id). Segmented is the AOD-148 selector reused.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { WidgetDefinition, WidgetInstance } from '../../registry/types';

// The registry lookup feeds the def whose configSchema/supportedSizes decide the item set. `mock`-prefixed so
// the jest.mock factory may close over it; reassigned per render before the tree reads it (lazily, on render).
let mockDef: Partial<WidgetDefinition> | undefined;
jest.mock('../../registry/RegistryProvider', () => ({
  useRegistry: () => ({ getWidgetDef: () => mockDef }),
}));

import { CardQuickActions } from '../CardQuickActions';

const instance = (size: WidgetInstance['size'] = 'W'): WidgetInstance => ({
  instanceId: 'card-1',
  serviceId: 'svc',
  widgetType: 'w',
  config: {},
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
  size,
});

// A configurable, multi-size widget (Linear/Weather/Calendar-like): one config field + >1 supported size.
const CONFIGURABLE_MULTISIZE: Partial<WidgetDefinition> = {
  configSchema: { fields: [{ key: 'zone', label: 'Zone', required: false, kind: 'string' }] },
  supportedSizes: ['S', 'W', 'L'],
};
// A Clock-like widget: NOTHING to configure (empty fields) + a single supported size.
const CLOCK: Partial<WidgetDefinition> = { configSchema: { fields: [] }, supportedSizes: ['S'] };

function renderMenu(def: Partial<WidgetDefinition> | undefined, inst: WidgetInstance = instance()) {
  mockDef = def;
  const handlers = {
    onEditWidget: jest.fn(),
    onEditScreen: jest.fn(),
    onDeleteWidget: jest.fn(),
    onSelectSize: jest.fn(),
    onDismiss: jest.fn(),
  };
  const utils = render(<CardQuickActions instance={inst} anchor={{ x: 40, y: 60 }} {...handlers} />);
  return { ...utils, ...handlers };
}

describe('CardQuickActions — item visibility by widget (AOD-195)', () => {
  it('a configurable, multi-size widget shows Edit Widget AND the size row (plus Edit Screen + Delete)', () => {
    renderMenu(CONFIGURABLE_MULTISIZE);
    expect(screen.getByTestId('card-quick-actions-edit-widget')).toBeTruthy();
    expect(screen.getByTestId('card-quick-actions-edit-screen')).toBeTruthy();
    expect(screen.getByTestId('card-quick-actions-delete-widget')).toBeTruthy();
    expect(screen.getByTestId('card-quick-actions-size-row')).toBeTruthy();
  });

  it('a Clock (no config fields, single size) shows NEITHER Edit Widget NOR the size row', () => {
    renderMenu(CLOCK);
    expect(screen.queryByTestId('card-quick-actions-edit-widget')).toBeNull();
    expect(screen.queryByTestId('card-quick-actions-size-row')).toBeNull();
    // Edit Screen + Delete are ALWAYS present.
    expect(screen.getByTestId('card-quick-actions-edit-screen')).toBeTruthy();
    expect(screen.getByTestId('card-quick-actions-delete-widget')).toBeTruthy();
  });

  it('each menu item fires its callback; an outside tap dismisses', () => {
    const h = renderMenu(CONFIGURABLE_MULTISIZE);
    fireEvent.press(screen.getByTestId('card-quick-actions-edit-widget'));
    expect(h.onEditWidget).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('card-quick-actions-edit-screen'));
    expect(h.onEditScreen).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('card-quick-actions-delete-widget'));
    expect(h.onDeleteWidget).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('card-quick-actions-scrim'));
    expect(h.onDismiss).toHaveBeenCalled();
  });

  it('the size row reuses the AOD-148 Segmented and reports the chosen size', () => {
    const h = renderMenu(CONFIGURABLE_MULTISIZE);
    // The Segmented renders one segment per supported size (S, W, L here); pressing L reports it.
    fireEvent.press(screen.getByTestId('segmented-L'));
    expect(h.onSelectSize).toHaveBeenCalledWith('L');
  });

  it('the size row marks the current size (the live instance drives the segmented value)', () => {
    renderMenu(CONFIGURABLE_MULTISIZE, instance('L'));
    expect(screen.getByTestId('segmented-L').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-W').props.accessibilityState).toMatchObject({ selected: false });
  });
});
