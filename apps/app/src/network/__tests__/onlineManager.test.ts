// AOD-127: the netinfo -> onlineManager plumbing. isNetInfoOnline is the pure online decision; setupOnlineManager
// wires it so onlineManager (and everything reading it: useOnline, ProxyDataSource) tracks the device's real
// connectivity. @react-native-community/netinfo is the jest manual mock in __mocks__ (auto-applied); its __setState
// / __reset test helpers drive connectivity flips the way the OS would.
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { isNetInfoOnline, setupOnlineManager } from '../onlineManager';

const netMock = NetInfo as unknown as {
  __setState: (s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void;
  __reset: () => void;
};

describe('isNetInfoOnline (the pure online decision)', () => {
  it('online when a connection exists and the internet is not confirmed-unreachable', () => {
    expect(isNetInfoOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isNetInfoOnline({ isConnected: true, isInternetReachable: null })).toBe(true); // still probing = online
  });

  it('offline when disconnected, or connected to a link with no reachable internet (captive wifi)', () => {
    expect(isNetInfoOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isNetInfoOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isNetInfoOnline({ isConnected: true, isInternetReachable: false })).toBe(false); // captive/dead link
    expect(isNetInfoOnline({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});

describe('setupOnlineManager (wires onlineManager to netinfo)', () => {
  beforeEach(() => {
    netMock.__reset();
  });
  afterEach(() => {
    netMock.__reset();
    onlineManager.setOnline(true);
  });

  it('adopts the current netinfo state on setup, then tracks every flip', () => {
    setupOnlineManager();
    // netinfo emits its current (online) state to the new subscriber synchronously -> onlineManager online
    expect(onlineManager.isOnline()).toBe(true);

    netMock.__setState({ isConnected: false, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false); // going offline pauses queries -> last-known data holds

    netMock.__setState({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.isOnline()).toBe(true); // reconnect resumes

    netMock.__setState({ isConnected: true, isInternetReachable: false });
    expect(onlineManager.isOnline()).toBe(false); // captive wifi reads as offline (device's fault, not ours)
  });
});
