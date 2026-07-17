// Component-band tests for the shared FitBody (AOD-123 attempt 2; vela-DESIGN.md §7-8). Assert the two
// fit stages' observable contract: the value ALWAYS renders and WIDTH-FITS (scales down, never clips); the
// value YIELDS height so held detail is kept where it fits; detail DROPS only when it cannot fit even with
// the value at its floor; a lead is held; and an absent `box` falls back to the size-derived box. The
// value's render receives the fitted font size, which these tests echo to observe the scale.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FitBody, type FitLine, type FitValue } from '../FitBody';
import { tabularWidth } from '../fitLadder';

function value(baseSize: number, text: string): FitValue {
  return {
    key: 'value',
    baseSize,
    intrinsicWidth: tabularWidth(text, baseSize),
    // echo the fitted size so a test can read what the width-fit chose
    render: (fontSize) => (
      <Text testID="fit-value" style={{ fontSize }}>
        {text}
      </Text>
    ),
  };
}

function detailLine(key: string, role: FitLine['role'], text: string): FitLine {
  return { key, role, node: <Text testID={`fit-${key}`}>{text}</Text> };
}

/** The fitted font size the value rendered at (from the echoed style). */
function fittedSize(): number {
  return screen.getByTestId('fit-value').props.style.fontSize as number;
}

describe('FitBody stage 1: the value width-fits and never clips (AOD-95/97)', () => {
  it('renders the value at its base size when it fits the box', () => {
    render(<FitBody size="L" box={{ width: 168, height: 144 }} value={value(40, '$4.00')} />);
    expect(fittedSize()).toBe(40);
  });

  it('scales the value DOWN so it fits a narrow box (would clip at base size)', () => {
    // "$1,234.56" at 40px is far wider than a 72px S body -> it must shrink to fit the width.
    const v = value(40, '$1,234.56');
    render(<FitBody size="S" box={{ width: 72, height: 72 }} value={v} />);
    const size = fittedSize();
    expect(size).toBeLessThan(40);
    expect(tabularWidth('$1,234.56', size)).toBeLessThanOrEqual(72 + 0.001); // now fits the width — no clip
  });

  it('the Clock time that clipped at S (34px) now fits the 72px width', () => {
    render(<FitBody size="S" headerShown={false} box={{ width: 72, height: 72 }} value={value(34, '18:45')} />);
    const size = fittedSize();
    expect(size).toBeLessThan(34);
    expect(tabularWidth('18:45', size)).toBeLessThanOrEqual(72 + 0.001);
  });
});

describe('FitBody stage 2: the value yields to held detail; detail drops only when it cannot fit', () => {
  it('keeps a detail line in a short wide (W) box by shrinking the value (anti-regression)', () => {
    // W body 168x48: a full-size 40px value would fill the height, but the value yields so the run-rate is
    // KEPT with a smaller value rather than dropped.
    render(
      <FitBody
        size="W"
        box={{ width: 168, height: 48 }}
        value={value(40, '$4.00')}
        detail={[detailLine('runrate', 'meta', '$2.00/day')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    expect(screen.getByTestId('fit-runrate')).toBeTruthy(); // kept, not dropped
    expect(fittedSize()).toBeLessThan(40); // the value shrank to make room
  });

  it('keeps all detail in a tall (L) box at the full value size', () => {
    render(
      <FitBody
        size="L"
        box={{ width: 168, height: 144 }}
        value={value(44, '72°')}
        detail={[detailLine('d1', 'heading', 'Partly cloudy'), detailLine('d2', 'meta', 'Feels 70°')]}
      />,
    );
    expect(screen.getByTestId('fit-d1')).toBeTruthy();
    expect(screen.getByTestId('fit-d2')).toBeTruthy();
    expect(fittedSize()).toBe(44);
  });

  it('drops detail bottom-up when it cannot fit even with the value at its floor', () => {
    // A very short box: the floored value + two detail lines cannot coexist -> the lower-priority line drops.
    render(
      <FitBody
        size="W"
        box={{ width: 168, height: 30 }}
        value={value(44, '72°')}
        detail={[detailLine('d1', 'meta', 'a'), detailLine('d2', 'meta', 'b')]}
      />,
    );
    expect(screen.getByTestId('fit-value')).toBeTruthy();
    expect(screen.queryByTestId('fit-d2')).toBeNull(); // the last line dropped
  });

  it('holds the lead above the value', () => {
    render(
      <FitBody
        size="S"
        box={{ width: 72, height: 72 }}
        lead={detailLine('lead', 'label', 'IN 20 MIN')}
        value={value(18, 'Standup')}
        detail={[detailLine('loc', 'meta', 'Room 3')]}
      />,
    );
    expect(screen.getByTestId('fit-lead')).toBeTruthy();
    expect(screen.getByTestId('fit-value')).toBeTruthy();
  });

  it('falls back to the size-derived box when no box is passed (direct render, no host)', () => {
    render(<FitBody size="S" headerShown={false} value={value(34, '18:45')} />);
    // S 1x1 header-suppressed -> 72x72; the 34px time over-fills the 72px width, so it scales down.
    expect(fittedSize()).toBeLessThan(34);
  });
});
