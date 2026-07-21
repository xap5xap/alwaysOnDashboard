// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real skies from
// Supabase under RLS (useDashboards: the active sky's live surface + the ordered sky list + create) and, per
// the AOD-142 dial, shows ONE of two surfaces: in GLANCE a horizontal sky pager (SkyPager) with one
// read-only page per sky; in ARRANGE the single active-sky LayoutCanvas (the free-form layout engine). The
// screen owns the arrange-mode flag and the pager's current page; it never names a service (the AOD-8 seam
// holds end to end).
//
// AOD-144 (design "Many Skies" §1a/§1f): the Glance surface becomes a pager over the skies. The dial GATES
// the surface, which makes "swipe never edits" structural (a page turn can never reach an edit) and dodges
// the swipe-vs-card-drag gesture conflict (there is no horizontal paging while arranging). Entering Arrange
// from page K sets that sky active so Arrange edits the sky you are viewing; leaving Arrange hands the edited
// layout back to the pager's per-sky cache (seedSkyFromActive) and returns to the pager at page K. The page
// dots + the Pro gate on the second sky live inside SkyPager.
//
// AOD-142 (design "The sky fills in" §1e): the arranging Done pill is REPLACED by the persistent Glance |
// Arrange dial in the hub header; the wall Preview pill stays (AOD-81). The dial AND the page dots ride a
// single "chrome awake" idle state (useChromeAwake) wired to the surface's touch callbacks, so the hub chrome
// sinks when idle (calm Glance) and wakes on any touch — one mechanism.
//
// AOD-68 canonicalization (design-core-navigation §3, §5, §8, §12 drift 1-2): the inline header is the shell
// HUB AppBar (the vela wordmark + Add + Settings + the dashboards-switcher chevron), sign out is RELOCATED to
// Account, and the ad-hoc load / error become the shell screen-level states. AOD-69 fills the AOD-27
// dashboard INTERIOR: the arranging header shows the Preview pill, the per-sky empty branch composes the
// shell EmptyState (now inside SkyPager's pages), and the canvas / picker / config sheet are the polished
// editor surfaces.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { ConfigureInstanceModal } from '../layout/ConfigureInstanceModal';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { WidgetPicker } from '../layout/WidgetPicker';
import { useDashboards } from '../layout/useDashboards';
import { useRemoveWidget } from '../layout/useRemoveWidget';
import { seedActiveFromSky, seedSkyFromActive } from '../layout/useSkyInstances';
import { WallPreview } from '../kiosk/WallPreview';
import type { WidgetInstance } from '../registry/types';
import { AppBar, ErrorState, LoadingState, Screen } from '../shell';
import { Button } from '../ui/Button';
import { ChevronGlyph } from '../ui/glyphs';
import { ModeDial } from './ModeDial';
import { SkyPager } from './SkyPager';
import { useChromeAwake } from './useChromeAwake';

export function Dashboard() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { instances, isLoading, isError, error, refetch, commit, dashboards, activeId, setActive, createDashboard } =
    useDashboards();
  const { removeWidget } = useRemoveWidget();
  const { theme } = useUnistyles();
  const [arranging, setArranging] = useState(false);
  // AOD-144: the pager's current page (a mirror of SkyPager's local scroll position, reported via
  // onPageChange). It drives which sky the dial arranges — the sky on screen, NOT activeId (which lags
  // setActive, AOD-143). Persists across the arrange round-trip (SkyPager unmounts in Arrange), and SkyPager
  // re-seeds it to the active sky's index on remount.
  const [currentPage, setCurrentPage] = useState(0);
  // AOD-142: the single "chrome awake" idle state. `wake` is wired to the surface touch callbacks below;
  // `awake` drives the dial's fade AND the page dots. One timer, reset on any touch.
  const { awake, wake } = useChromeAwake();
  const [picking, setPicking] = useState(false);
  // AOD-81 §6: the wall preview peek. Owned here like `picking`/`arranging` (the app-ia locked fact: a
  // surface carrying a live object stays in-screen, never a router route), mounted as an overlay below.
  const [previewing, setPreviewing] = useState(false);
  // The instance whose config form is open (AOD-10 §4). Owned here like `picking`/`arranging` so both
  // reconfigure entries (arrange-mode "Configure" and the host's needs_config prompt) route through it.
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);

  // AOD-144: enter Arrange on a specific sky. Setting it active first means Arrange (which renders the active
  // sky's LayoutCanvas) edits the sky you were viewing — the dial flip from page K, or a long-press on a card
  // on page K, both land here. The `!== activeId` guard skips a redundant setActive (and its ['dashboard']
  // invalidate/refetch) when the on-screen sky is already active — the common single-sky case, where flipping
  // to Arrange must NOT reload the board the way it did before AOD-144. Leaving Arrange is the else-branch below.
  const enterArrange = (skyId: string) => {
    if (skyId !== activeId) {
      // Paint the target sky NOW: copy its already-loaded pager instances (['sky', skyId]) into the active-sky
      // cache BEFORE setActive, whose refetch lags (AOD-143). Without this, Arrange would render the PREVIOUS
      // active sky for one round-trip and a commit in that window would persist to the wrong sky. The invalidate
      // that setActive fires then confirms the same data in the background.
      seedActiveFromSky(queryClient, userId, skyId);
      setActive(skyId);
    }
    setArranging(true);
  };

  // AOD-144: an empty page's "Add a card". For the active sky (the single-sky common case, and any freshly
  // created sky) the picker already targets it via the ['dashboard'] cache, so open it directly — no
  // setActive lag. For a non-active sky, enter Arrange (setActive + arranging) so the add flow there targets
  // the right sky without racing the active-sky refetch.
  const onAddCard = (skyId: string) => {
    if (skyId === activeId) setPicking(true);
    else enterArrange(skyId);
  };

  // AOD-144: the dial flip. Arrange -> enter Arrange on the sky currently on screen (currentPage). Glance ->
  // leave Arrange AND hand the just-edited active-sky layout back to the pager's per-sky cache, so the page
  // repaints the edit immediately (no refetch, no debounced-write race).
  const onDialChange = (mode: 'glance' | 'arrange') => {
    if (mode === 'arrange') {
      const sky = dashboards[currentPage];
      if (sky) enterArrange(sky.id);
      else setArranging(true);
    } else {
      setArranging(false);
      if (activeId) seedSkyFromActive(queryClient, userId, activeId);
    }
  };

  // AOD-142: the hub trailing cluster. The Glance | Arrange dial is the PERSISTENT mode control (present in
  // both modes — flipping it to Glance is how you leave Arrange), riding the chrome-awake state so it sinks
  // when the surface is idle. Its mode-specific siblings follow it: while arranging, only the wall Preview
  // pill (AOD-81 §6, ghost; the Done pill it once paired with is gone — the dial replaces it); otherwise
  // Add + Settings + the dashboards-switcher chevron. The dial + Add appear once the board has loaded (there
  // is nothing to arrange while loading/erroring); Settings + the switcher stay put as before.
  const canArrange = !isLoading && !isError;
  const headerRight = (
    <>
      {canArrange ? (
        <ModeDial mode={arranging ? 'arrange' : 'glance'} awake={awake} onChange={onDialChange} />
      ) : null}
      {arranging ? (
        <Button label="Preview" variant="ghost" size="sm" pill onPress={() => setPreviewing(true)} testID="dashboard-preview" />
      ) : (
        <>
          {canArrange ? (
            <Button label="Add" variant="ghost" size="sm" onPress={() => setPicking(true)} testID="dashboard-add-widget" />
          ) : null}
          <Button label="Settings" variant="ghost" size="sm" onPress={() => router.push('/settings')} testID="dashboard-settings" />
          <Pressable
            onPress={() => router.push('/dashboards')}
            accessibilityRole="button"
            accessibilityLabel="Switch dashboard"
            hitSlop={8}
            testID="dashboard-switcher"
          >
            <ChevronGlyph color={theme.colors.textMuted} />
          </Pressable>
        </>
      )}
    </>
  );

  return (
    <>
      <Screen>
        {/* AOD-142 the wake surface: any touch re-arms the chrome-awake idle timer. onTouchStart/onTouchMove
            are PASSIVE responder callbacks (they never call setResponder), so they observe the touch without
            capturing it — they can't move a card ("waking ≠ editing") and never contend with the arrange or
            paging gestures. Wrapping the whole hub means a touch on the dial, a card, the pager, or empty
            space all wake it. */}
        <View style={styles.surface} onTouchStart={wake} onTouchMove={wake} testID="dashboard-surface">
          <AppBar variant="hub" right={headerRight} testID="dashboard-header" />

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState line="Could not load your dashboard." detail={error?.message} onRetry={() => void refetch()} />
          ) : arranging ? (
            // AOD-144: ARRANGE renders the single active-sky LayoutCanvas (as before AOD-144). An empty board
            // still renders the canvas (nothing to show, but the add/exit affordances live here).
            <View style={styles.body}>
              {/* AOD-142: the arrange-only hint. The old Glance instruction is gone — the dial is the visible
                  control now. Glance stays wordless and calm. */}
              <Text style={styles.hint}>Drag to move. Drag a corner to resize. Flip to Glance to finish.</Text>
              <LayoutCanvas
                instances={instances}
                arranging
                onEnterArrange={() => setArranging(true)}
                onExitArrange={() => setArranging(false)}
                onCommit={commit}
                onRequestConfigure={setConfiguring}
                onRemove={(instanceId) => void removeWidget(instanceId)}
              />
            </View>
          ) : (
            // AOD-144: GLANCE is a horizontal pager over the skies. Each page renders its sky read-only; the
            // dots + the second-sky Pro gate live inside. A single bootstrapped sky is the common case and
            // renders as a one-page pager (no dots).
            <View style={styles.body}>
              <SkyPager
                dashboards={dashboards}
                activeId={activeId}
                onEnterArrange={enterArrange}
                onAddCard={onAddCard}
                createDashboard={createDashboard}
                awake={awake}
                wake={wake}
                onPageChange={setCurrentPage}
              />
            </View>
          )}

          {picking && <WidgetPicker onClose={() => setPicking(false)} />}
          {configuring && <ConfigureInstanceModal instance={configuring} onClose={() => setConfiguring(null)} />}
        </View>
      </Screen>
      {/* AOD-81 §6: the wall preview, mounted OVER the whole route container (a sibling of Screen, above the
          shell chrome) so the peek is edge to edge like the wall. Reachable only while arranging (now entered
          via the AOD-142 dial or a long-press); WallPreview renders an empty draft fine, so the dial entering
          Arrange on an empty board is harmless. Tap anywhere / OS back returns. */}
      {previewing ? <WallPreview instances={instances} onClose={() => setPreviewing(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  // AOD-142 the wake surface: fills the frame so a touch anywhere in the hub re-arms the idle timer.
  surface: { flex: 1 },
  body: { flex: 1 },
  hint: {
    color: theme.colors.textMuted,
    ...theme.type.meta,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
}));
