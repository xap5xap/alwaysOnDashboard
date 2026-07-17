// Component-band tests for the shared FitBody (AOD-123; vela-DESIGN.md §7-8). Assert the mechanism's
// observable contract: the value ALWAYS renders; detail renders in a tall box and DROPS in a short one;
// a lead is held; and an absent `box` falls back to the size-derived box. Heights come from the theme
// type scale, so these use real roles (the same the migrated leaves pass).
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FitBody } from '../FitBody';

function line(key: string, role: React.ComponentProps<typeof FitBody>['value']['role'], text: string, extra?: object) {
  return { key, role, node: <Text testID={`fit-${key}`}>{text}</Text>, ...extra };
}

describe('FitBody: the value is held, detail drops for height (§7-8)', () => {
  it('renders the value at every box, even one shorter than the value', () => {
    render(
      <FitBody
        size="S"
        box={{ width: 72, height: 10 }}
        value={line('value', 'hero', '72°')}
        detail={[line('d1', 'meta', 'Feels 70°')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    // the one detail line cannot fit a 10px box -> dropped
    expect(screen.queryByTestId('fit-d1')).toBeNull();
  });

  it('keeps all detail in a tall (L/M) box', () => {
    render(
      <FitBody
        size="L"
        box={{ width: 168, height: 144 }}
        value={line('value', 'hero', '72°')}
        detail={[line('d1', 'heading', 'Partly cloudy'), line('d2', 'meta', 'Feels 70° · 60%')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    expect(screen.getByTestId('fit-d1')).toBeTruthy();
    expect(screen.getByTestId('fit-d2')).toBeTruthy();
  });

  it('drops detail bottom-up in a short (1-unit, ~48px) W box: value survives, detail sheds', () => {
    render(
      <FitBody
        size="W"
        box={{ width: 168, height: 48 }}
        value={line('value', 'hero', '72°')}
        detail={[line('d1', 'heading', 'Partly cloudy'), line('d2', 'meta', 'Feels 70° · 60%')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    // a 44px-ish hero already fills a 48px body -> both detail lines drop rather than clip
    expect(screen.queryByTestId('fit-d1')).toBeNull();
    expect(screen.queryByTestId('fit-d2')).toBeNull();
  });

  it('holds the lead even when the box is too short to seat detail', () => {
    render(
      <FitBody
        size="S"
        box={{ width: 72, height: 72 }}
        lead={line('lead', 'label', 'IN 20 MIN')}
        value={line('value', 'title', 'Standup', { lines: 2 })}
        detail={[line('d1', 'meta', 'Room 3')]}
      />,
    );
    expect(screen.getByTestId('fit-lead')).toBeTruthy();
    expect(screen.getByTestId('fit-value')).toBeTruthy();
  });

  it('falls back to the size-derived box when no box is passed (direct render, no host)', () => {
    // S 1x1 with a suppressed header -> a 72x72 body; a hero value fits, a tall detail stack sheds.
    render(
      <FitBody
        size="S"
        headerShown={false}
        value={line('value', 'hero', '72°')}
        detail={[line('d1', 'heading', 'Partly cloudy'), line('d2', 'meta', 'x'), line('d3', 'meta', 'y'), line('d4', 'meta', 'z')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    // the fourth detail line cannot fit a 72px body under a hero value -> dropped
    expect(screen.queryByTestId('fit-d4')).toBeNull();
  });
});
