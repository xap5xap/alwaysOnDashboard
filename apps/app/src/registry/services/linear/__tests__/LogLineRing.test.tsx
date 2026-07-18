// AOD-135: the Log Line RENDER (LogLineRing.tsx) — proves BOTH ring variants render (the RING_VARIANT Dead
// Reckoning toggle) and the W dash bar, driven directly with a ringLayout fixture (no host needed — the
// component is presentational, every colour a prop). The lit/dim split + the variant are asserted via the
// 0-size marker Views (SVG-internal testIDs are unreliable under RNTL — the TransitArc precedent).
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LogLineRing, LogLineDashes, LogLineBar } from '../LogLineRing';
import { ringLayout, type RingGeometry } from '../logline';

const GEO: RingGeometry = { outerRadius: 40, knotRadius: 4, minKnotRadius: 1.5, minGap: 2 };
const COLOR = '#6E8BFF'; // a stand-in for colors.accent (the component takes the colour as a prop)
const DIM = 0.18; // a stand-in for progress.trackOpacity

describe('LogLineRing — the knots variant (primary)', () => {
  it('draws one marker per knot, the first litCount lit and the rest dim', () => {
    render(<LogLineRing variant="knots" layout={ringLayout(3, 5, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(3);
    expect(screen.getAllByTestId('linear-cycle-knot-dim')).toHaveLength(2);
    // it is the SEGMENTED (knots) render, not the smooth arc
    expect(screen.queryByTestId('linear-cycle-smooth')).toBeNull();
  });

  it('N=1 draws a single knot; N=0 draws none (no crash, no markers)', () => {
    const one = render(<LogLineRing variant="knots" layout={ringLayout(1, 1, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(1);
    expect(screen.queryAllByTestId('linear-cycle-knot-dim')).toHaveLength(0);
    one.unmount();

    render(<LogLineRing variant="knots" layout={ringLayout(0, 0, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.queryAllByTestId('linear-cycle-knot-lit')).toHaveLength(0);
    expect(screen.queryAllByTestId('linear-cycle-knot-dim')).toHaveLength(0);
  });
});

describe('LogLineRing — the smooth variant (Dead Reckoning fallback)', () => {
  it('renders the continuous ring with a lit arc when partially complete — and NO knots', () => {
    render(<LogLineRing variant="smooth" layout={ringLayout(3, 5, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.getByTestId('linear-cycle-smooth')).toBeTruthy();
    expect(screen.getByTestId('linear-cycle-arc')).toBeTruthy(); // fraction 3/5 > 0 → a lit arc
    // the smooth render draws no discrete knots
    expect(screen.queryAllByTestId('linear-cycle-knot-lit')).toHaveLength(0);
    expect(screen.queryAllByTestId('linear-cycle-knot-dim')).toHaveLength(0);
  });

  it('an empty ring (fraction 0) draws the dim track but no lit arc; a full ring draws the arc marker', () => {
    const empty = render(<LogLineRing variant="smooth" layout={ringLayout(0, 5, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getByTestId('linear-cycle-smooth')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle-arc')).toBeNull(); // nothing lit yet
    empty.unmount();

    render(<LogLineRing variant="smooth" layout={ringLayout(5, 5, GEO)} color={COLOR} dimOpacity={DIM} stroke={3} />);
    expect(screen.getByTestId('linear-cycle-arc')).toBeTruthy(); // fully complete → the lit ring
  });
});

describe('LogLineDashes — the W segmented bar', () => {
  it('draws one dash per issue, the first lit and the rest dim', () => {
    render(<LogLineDashes completedCount={16} totalCount={24} height={10} gap={3} radius={2} color={COLOR} dimOpacity={DIM} />);
    expect(screen.getByTestId('linear-cycle-dashes')).toBeTruthy();
    expect(screen.getAllByTestId('linear-cycle-dash-lit')).toHaveLength(16);
    expect(screen.getAllByTestId('linear-cycle-dash-dim')).toHaveLength(8);
  });

  it('renders nothing for a 0-issue cycle (the percent carries it)', () => {
    render(<LogLineDashes completedCount={0} totalCount={0} height={10} gap={3} radius={2} color={COLOR} dimOpacity={DIM} />);
    expect(screen.queryByTestId('linear-cycle-dashes')).toBeNull();
  });
});

describe('LogLineBar — the over-cap W continuous bar (the O(1) linear analogue of the smooth arc)', () => {
  it('renders a single fraction-filled bar — NOT one dash per issue (no per-issue array)', () => {
    render(<LogLineBar completedCount={40} totalCount={100} height={10} radius={2} color={COLOR} dimOpacity={DIM} />);
    expect(screen.getByTestId('linear-cycle-fill')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle-dashes')).toBeNull();
    expect(screen.queryAllByTestId('linear-cycle-dash-lit')).toHaveLength(0);
  });

  it('renders nothing for a 0-issue cycle (the percent carries it)', () => {
    render(<LogLineBar completedCount={0} totalCount={0} height={10} radius={2} color={COLOR} dimOpacity={DIM} />);
    expect(screen.queryByTestId('linear-cycle-fill')).toBeNull();
  });
});
