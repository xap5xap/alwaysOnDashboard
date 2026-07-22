// The Glance sky pager (AOD-144; design "Many Skies" §1a "the paged canvas" + §1f "the second sky"). In
// Glance the dashboard is a HORIZONTAL pager over the user's skies — one full-width page per sky, each
// rendered READ-ONLY (a LayoutCanvas with arranging=false).
//
// AOD-194 (design-layout-foundation §9 "one source of truth"): the ACTIVE sky's page (id === activeId) does
// NOT read its own ['sky', id] cache. It renders `activeInstances` — the SAME ['dashboard', userId] cache
// Arrange and the kiosk wall read (handed down from Dashboard's useDashboards().instances). Only NON-active
// pages read ['sky', id] via useSkyInstances. Before, the sky you were ON was held in TWO independently
// MMKV-persisted staleTime:Infinity caches (Glance's ['sky'] and Arrange's ['dashboard']); an interrupted
// persist could leave them permanently divergent, so Glance showed a phantom layout Arrange did not (broken
// WYSIWYG on the flagship surface). Routing the active page through ['dashboard'] means the calm and edit
// views can never disagree about the sky you are on.
// Paging is a plain horizontal FlatList (pagingEnabled) — NO native pager dependency. "Swipe never edits": a
// page only turns; entering the edit surface is the deliberate dial flip or a long-press on a card, both of
// which LEAVE the pager (Dashboard renders the single active-sky LayoutCanvas in Arrange instead). The
// current page is the pager's OWN scroll position (AOD-143 warns activeId lags setActive), reported up so the
// dial arranges the sky actually on screen; the page dots reflect it and ride the AOD-142 chrome-awake state.
//
// The + add-sky control (in the dot row) is the client Pro gate — UX ONLY; the server enforces the real
// limit (RB-38/M4). A Free user (dashboards.length >= maxDashboards) gets the in-place §1f "second sky is
// Pro" invite; a Pro user creates a real sky (useDashboards.createDashboard, which sets it active) and the
// pager pages to it. The full paywall is a later chat — the invite's See Pro is the only through-tap to it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useEntitlements } from '../entitlements/useEntitlements';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import type { DashboardSummary } from '../layout/dashboardRepo';
import { useSkyInstances } from '../layout/useSkyInstances';
import type { WidgetInstance } from '../registry/types';
import type { Orientation } from '../widgets/sizes';
import { EmptyState, ErrorState, LoadingState } from '../shell';
import { AddGlyph } from './glyphs';
import { PageDots } from './PageDots';
import { ProInviteSliver } from './ProInviteSliver';

const noop = () => {};

export interface SkyPagerProps {
  /** The user's skies, ordered (the swipe/dot order, §1e). One page each. */
  dashboards: DashboardSummary[];
  /** The resolved active sky — the mount landing page (return-from-arrange lands on the sky you edited). */
  activeId: string | null;
  /** The active sky's instances, from the SAME ['dashboard', userId] cache Arrange and the wall read
   *  (Dashboard passes useDashboards().instances). AOD-194: the active page (id === activeId) renders THESE,
   *  never its own ['sky', activeId] cache, so Glance and Arrange can never diverge on the sky you are on. */
  activeInstances: WidgetInstance[];
  /** The current device orientation (AOD-197). Threaded into the NON-active pages' per-sky read so every page
   *  resolves the same per-orientation layout the active page (activeInstances) shows. Default landscape. */
  orientation?: Orientation;
  /** Long-press a card on a page -> arrange THAT sky (Dashboard: setActive + arranging). */
  onEnterArrange(skyId: string): void;
  /** An empty page's "Add a card" -> Dashboard opens the add flow for that sky. */
  onAddCard(skyId: string): void;
  /** Create a new sky (Pro only; the hook sets it active). The pager then pages to it. */
  createDashboard(): Promise<string>;
  /** The shared chrome-awake state + its wake pump (useChromeAwake) — the dots ride it; a swipe wakes it. */
  awake: boolean;
  wake(): void;
  /** Report the current page up (on settle + once on mount) so the dial arranges the on-screen sky. */
  onPageChange(index: number): void;
  testID?: string;
}

export function SkyPager({
  dashboards,
  activeId,
  activeInstances,
  orientation = 'landscape',
  onEnterArrange,
  onAddCard,
  createDashboard,
  awake,
  wake,
  onPageChange,
  testID = 'sky-pager',
}: SkyPagerProps) {
  const { width } = useWindowDimensions();
  // Each page must be exactly the pager's width for pagingEnabled to snap. Seed from the window width (a
  // good approximation on device) and refine with onLayout; tests drive the index math off the scroll event
  // instead, so they never depend on this.
  const [pageWidth, setPageWidth] = useState(width);
  const listRef = useRef<FlatList<DashboardSummary>>(null);
  const entitlements = useEntitlements();
  const [inviteOpen, setInviteOpen] = useState(false);

  // The mount landing page = the active sky's index, clamped. On a fresh open it is the resolved active sky;
  // on return from Arrange it is the sky just edited (Dashboard set it active on entering Arrange).
  const activeIndex = Math.max(
    0,
    dashboards.findIndex((d) => d.id === activeId),
  );
  const [current, setCurrent] = useState(activeIndex);

  // Report the mount landing page up ONCE (guarded), so a dial flip before the first swipe arranges the sky
  // actually on screen — initialScrollIndex lands there but fires no scroll event to seed Dashboard's mirror.
  const reportedMount = useRef(false);
  useEffect(() => {
    if (!reportedMount.current) {
      reportedMount.current = true;
      onPageChange(activeIndex);
    }
  }, [activeIndex, onPageChange]);

  // Pro create: after the new sky lands in the list, page to it (§1g "the view descends into the new sky").
  // The scroll waits for the list to grow because createDashboard resolves after the list refetch.
  const pendingScrollToLast = useRef(false);
  useEffect(() => {
    if (pendingScrollToLast.current && dashboards.length > 0) {
      pendingScrollToLast.current = false;
      const last = dashboards.length - 1;
      listRef.current?.scrollToIndex({ index: last, animated: true });
      setCurrent(last);
      onPageChange(last);
    }
  }, [dashboards.length, onPageChange]);

  // The client Pro gate (UX only). Free at the limit -> the in-place invite (NOT the paywall); Pro -> create.
  // The `>= 1` guard is defense-in-depth for the new-user list race (useDashboards heals it, but this closes
  // the transient window before the heal lands): an empty/incoherent list must NOT read as "0 < 1 dashboards,
  // so create is free" — that would let a Free user's + mint a real second sky with no Pro prompt. Empty list
  // -> the + shows the invite, never creates.
  const canCreate = dashboards.length >= 1 && dashboards.length < entitlements.maxDashboards;
  const onAdd = useCallback(async () => {
    if (canCreate) {
      pendingScrollToLast.current = true;
      await createDashboard();
    } else {
      setInviteOpen(true);
    }
  }, [canCreate, createDashboard]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Derive the page from the event's own width (real on device, controlled in tests), falling back to
      // the measured/seed width. The current page is LOCAL scroll state — never activeId, which lags.
      const { contentOffset, layoutMeasurement } = e.nativeEvent;
      const w = layoutMeasurement?.width || pageWidth || 1;
      const idx = Math.round(contentOffset.x / w);
      setCurrent(idx);
      onPageChange(idx);
    },
    [pageWidth, onPageChange],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<DashboardSummary> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      testID={testID}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        data={dashboards}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) =>
          // AOD-194: the active page renders the ['dashboard'] cache (activeInstances), a DIFFERENT component
          // that never calls useSkyInstances — so ['sky', activeId] is never read as a divergent source. Every
          // other page keeps its own ['sky', id] read. Branching the COMPONENT (not a conditional hook) keeps
          // each page's hook calls unconditional.
          item.id === activeId ? (
            <ActiveSkyPage
              sky={item}
              instances={activeInstances}
              width={pageWidth}
              onEnterArrange={() => onEnterArrange(item.id)}
              onAddCard={() => onAddCard(item.id)}
            />
          ) : (
            <SkyPage
              sky={item}
              width={pageWidth}
              orientation={orientation}
              onEnterArrange={() => onEnterArrange(item.id)}
              onAddCard={() => onAddCard(item.id)}
            />
          )
        }
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={wake}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={getItemLayout}
        initialScrollIndex={activeIndex}
        // 2-3 skies is the honest case (§1a): keep every page mounted so a swipe never remounts a page and
        // its per-sky query never refetches mid-swipe.
        initialNumToRender={Math.max(1, dashboards.length)}
        windowSize={Math.max(1, dashboards.length)}
        removeClippedSubviews={false}
        onScrollToIndexFailed={noop}
        testID={`${testID}-list`}
      />

      {/* The dots + add control float at the bottom over the pager. box-none: only the + (and, when open, the
          invite) capture touches; the rest passes the swipe through. */}
      <View style={styles.dotsBar} pointerEvents="box-none">
        <PageDots count={dashboards.length} current={current} awake={awake} onAdd={() => void onAdd()} />
      </View>

      {inviteOpen ? (
        <ProInviteSliver
          onSeePro={() => {
            setInviteOpen(false);
            router.push('/paywall?trigger=dashboards');
          }}
          onDismiss={() => setInviteOpen(false)}
        />
      ) : null}
    </View>
  );
}

/** A NON-active read-only pager page: a sky's OWN instances (useSkyInstances, the ['sky', id] cache), rendered
 *  through a non-arranging LayoutCanvas. Its own loading / error states so a slow or failed sky never blanks
 *  the whole pager. A long-press on a card drops into Arrange for this sky (§1b "holding a card in Glance still
 *  drops straight into card Tend"); an empty sky offers "Add a card" (§1g). The ACTIVE sky uses ActiveSkyPage
 *  instead (AOD-194) — only the instance SOURCE differs, so the resolved body is the shared SkyPageContent. */
function SkyPage({
  sky,
  width,
  orientation,
  onEnterArrange,
  onAddCard,
}: {
  sky: DashboardSummary;
  width: number;
  orientation: Orientation;
  onEnterArrange(): void;
  onAddCard(): void;
}) {
  const { instances, isLoading, isError, refetch } = useSkyInstances(sky.id, orientation);
  return (
    // Fixed to the pager width so pagingEnabled snaps; height comes from the list's cross-axis stretch,
    // giving the flex:1 LayoutCanvas / centered states a concrete box to fill.
    <View style={{ width }} testID={`sky-page-${sky.id}`}>
      {isLoading ? (
        <LoadingState testID={`sky-page-${sky.id}-loading`} />
      ) : isError ? (
        <ErrorState line="Could not load this sky." onRetry={() => refetch()} testID={`sky-page-${sky.id}-error`} />
      ) : (
        <SkyPageContent skyId={sky.id} instances={instances} onEnterArrange={onEnterArrange} onAddCard={onAddCard} />
      )}
    </View>
  );
}

/** The ACTIVE sky's pager page (AOD-194). It renders the `activeInstances` handed down from Dashboard — the
 *  SAME ['dashboard', userId] cache Arrange and the kiosk wall read — instead of its own ['sky', id] cache, so
 *  the calm (Glance) and edit (Arrange) views can never disagree on the sky you are on. NO loading / error
 *  branch: Dashboard gates the whole pager behind its combined isLoading/isError (useDashboards), so the
 *  active instances are already resolved when the pager mounts; a genuinely empty active sky just shows the
 *  empty state. Deliberately does NOT call useSkyInstances, so ['sky', activeId] is never read as a divergent
 *  source. Its testIDs match SkyPage's, so the pager's page contract is identical from the outside. */
function ActiveSkyPage({
  sky,
  instances,
  width,
  onEnterArrange,
  onAddCard,
}: {
  sky: DashboardSummary;
  instances: WidgetInstance[];
  width: number;
  onEnterArrange(): void;
  onAddCard(): void;
}) {
  return (
    <View style={{ width }} testID={`sky-page-${sky.id}`}>
      <SkyPageContent skyId={sky.id} instances={instances} onEnterArrange={onEnterArrange} onAddCard={onAddCard} />
    </View>
  );
}

/** The read-only page body shared by ActiveSkyPage and SkyPage: a resolved instance list renders as either the
 *  §1g empty-state "Add a card" (empty sky) or a non-arranging LayoutCanvas (a long-press drops into Arrange for
 *  this sky, §1b). Only the instance SOURCE (['dashboard'] for the active page, ['sky', id] for the rest)
 *  differs between the two callers; the rendered contract — testIDs and affordances — is identical. */
function SkyPageContent({
  skyId,
  instances,
  onEnterArrange,
  onAddCard,
}: {
  skyId: string;
  instances: WidgetInstance[];
  onEnterArrange(): void;
  onAddCard(): void;
}) {
  const { theme } = useUnistyles();
  return instances.length === 0 ? (
    <EmptyState
      glyph={<AddGlyph color={theme.colors.accent} />}
      line="Nothing here yet."
      subline="Add a card to get started."
      actionLabel="Add a card"
      onAction={onAddCard}
      testID={`sky-page-${skyId}-empty`}
    />
  ) : (
    <LayoutCanvas
      instances={instances}
      arranging={false}
      onEnterArrange={onEnterArrange}
      onExitArrange={noop}
      onCommit={noop}
      onRequestConfigure={noop}
      onRemove={noop}
    />
  );
}

const styles = StyleSheet.create(() => ({
  container: { flex: 1, position: 'relative' },
  list: { flex: 1 },
  dotsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingVertical: 16,
  },
}));
