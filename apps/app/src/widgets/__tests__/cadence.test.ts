// The AOD-10 §6.6 cadence-profile seam (cadence.ts). The runtime sets "kiosk" on enter and restores
// "foreground" on exit; this locks the default + the set/restore. See the cadence.ts FLAG: no scheduler
// consumer reads it yet (keep-awake delivers the kiosk cadence today), so this is the seam contract only.
import { getCadenceProfile, setCadenceProfile } from '../cadence';

describe('CadenceProfile §6.6', () => {
  afterEach(() => setCadenceProfile('foreground')); // restore the module default between tests

  it('defaults to foreground', () => {
    expect(getCadenceProfile()).toBe('foreground');
  });

  it('the runtime sets kiosk on enter and restores foreground on exit', () => {
    setCadenceProfile('kiosk');
    expect(getCadenceProfile()).toBe('kiosk');
    setCadenceProfile('foreground');
    expect(getCadenceProfile()).toBe('foreground');
  });
});
