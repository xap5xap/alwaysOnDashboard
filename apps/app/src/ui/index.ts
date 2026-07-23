// The Vela app-chrome component library (design-component-library.md, AOD-20). The reusable set every core
// screen (AOD-27/28/29), the paywall, and the kiosk PIN surface compose. Themed only against the AOD-66
// coded roles + the §12 component token groups in unistyles.ts, never a raw hex. The widget CARD chrome +
// lifecycle + empty body are NOT here (owned by design-widget-system / AOD-62); this is the app chrome.
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Input, SearchRow } from './Input';
export type { InputProps, SearchRowProps } from './Input';
export { Toggle } from './Toggle';
export type { ToggleProps } from './Toggle';
export { Segmented } from './Segmented';
export type { SegmentedProps, SegmentedOption } from './Segmented';
export { Pills } from './Pills';
export type { PillsProps, PillOption } from './Pills';
export { Card, RowGroup, ListRow, AuthCard, Wordmark } from './Surfaces';
export type { ListRowProps } from './Surfaces';
export { Sheet, Modal, Popover, MenuItem } from './Overlays';
export type { SheetProps, ModalProps } from './Overlays';
export { Skeleton, SkeletonBar } from './Skeleton';
export { StatusBadge, AccentBadge, CountBadge } from './Badge';
export type { StatusKind } from './Badge';
export { LockRow, LockedTile } from './LockRow';
export type { LockRowProps, LockedTileProps } from './LockRow';
export { FocusRing } from './FocusRing';
export { LockGlyph, ChevronGlyph, CloseGlyph, CheckGlyph, AdjustGlyph, LayoutGlyph, MinusCircleGlyph } from './glyphs';
export type { GlyphProps } from './glyphs';
export { roleColor, roleRadius, elevationStyle } from './theme';
export type { Theme } from './theme';
