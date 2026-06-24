// AOD-10 §5.2 reconcileSize units (testing-strategy.md §4.1).
import { reconcileSize } from '../sizes';

describe('reconcileSize (AOD-10 §5.2)', () => {
  it('picks tall for a tall narrow rect over medium', () => {
    expect(reconcileSize({ w: 1, h: 2 }, ['medium', 'large', 'tall'])).toBe('tall');
  });
  it('lets aspect dominate area (a wide rect picks wide)', () => {
    expect(reconcileSize({ w: 6, h: 2 }, ['small', 'medium', 'wide'])).toBe('wide');
  });
  it('falls to the area tiebreak for equal-aspect rects', () => {
    expect(reconcileSize({ w: 1, h: 1 }, ['small', 'large'])).toBe('small');
    expect(reconcileSize({ w: 2, h: 2 }, ['small', 'large'])).toBe('large');
  });
  it('returns the nearest supported class for a rect far from every class', () => {
    expect(reconcileSize({ w: 10, h: 1 }, ['small', 'medium', 'wide'])).toBe('wide');
  });
  it('uses supported[0] as the seed when only one class is supported', () => {
    expect(reconcileSize({ w: 5, h: 5 }, ['medium'])).toBe('medium');
  });
});
