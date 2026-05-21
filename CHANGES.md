# CHANGES — Mobile UI Adaptation

**Date:** 2026-05-21  
**Scope:** Frontend only (`frontend/`)

---

## Summary

This change set adds responsive / mobile-first UI adaptations to every major
front-end file.  No backend code was modified.

---

## Files Modified

### `frontend/public/index.html`
- Added `viewport-fit=cover` to the `<meta name="viewport">` tag to support
  notch / Dynamic Island safe areas on iOS devices.

### `frontend/src/index.css`
- Added `overflow-x: hidden` on `body` to prevent unintended horizontal scroll.
- Added `.scrollbar-hide` utility class (hides scrollbar track while preserving
  scroll functionality) for use on the tab bar and filter rows.
- Added a `@media (max-width: 639px)` rule that enforces a minimum height of
  36 px on `<button>` and `[role="button"]` elements for comfortable touch
  targets.
- Added `footer` padding rule using `env(safe-area-inset-bottom)` so the footer
  is never obscured by the home indicator on iOS.
- Added `z-index` fix for `react-datepicker` poppers inside modals.
- Added responsive overrides for `react-big-calendar` toolbar and header cells
  (smaller font/padding on mobile).

### `frontend/src/App.tsx`
- **Header:** Reduced heading font size on mobile (`text-base sm:text-xl`);
  subtitle line hidden on mobile; header layout changed from single-row to
  `flex-col items-end` for the right side so auth buttons wrap cleanly.
- **Auth buttons:** User name hidden on mobile (`hidden sm:inline`) to save
  space; button gap reduced; buttons wrap with `flex-wrap`.
- **Tab bar:** Added `overflow-x-auto scrollbar-hide` to the tab container so
  tabs scroll horizontally instead of wrapping or overflowing off-screen.  Each
  tab button gets `flex-shrink-0` and reduced padding/font-size on small screens.
- **Filter bar (Dashboard):** Changed outer container from `flex flex-wrap` to
  `flex-col gap-2`; each filter group (`Type`, `Status`) is its own row with
  `flex-wrap`; "Add Resource" button and the resource count are placed in their
  own row with `justify-between`.  Filter buttons have slightly taller touch
  targets (`py-1.5`).

### `frontend/src/components/Modal.tsx`
- Changed modal alignment from always-centered to **bottom-sheet on mobile /
  centered card on `sm+`** (`items-end sm:items-center`).
- Dialog changed to `rounded-t-2xl sm:rounded-lg` (square bottom corners on
  mobile for a native sheet feel).
- Added a decorative drag-handle pill (`sm:hidden`) at the top of the sheet.
- Added `paddingBottom: env(safe-area-inset-bottom)` to prevent content being
  hidden behind the iPhone home indicator.
- Header text reduced to `text-base sm:text-lg`; close button has a larger tap
  area (`p-1 -mr-1`).

### `frontend/src/components/AllBookings.tsx`
- Status badge container changed from `flex items-center gap-1.5` to
  `flex flex-wrap items-center justify-end gap-1` so the "Overdue" badge wraps
  below the status badge on narrow screens rather than overflowing.
- Booking detail grid changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`
  so date/time lines stack vertically on mobile.
- Status filter row given `overflow-x-auto pb-1` so filter buttons scroll
  horizontally on very narrow screens.

### `frontend/src/components/CalendarView.tsx`
- Added `useMemo`-based `isMobile` flag (reads `window.innerWidth < 640` once on
  mount) to select appropriate defaults.
- Default calendar view changed to `'day'` on mobile, `'week'` on desktop.
- Calendar view type updated to include `'agenda'` as a valid option, and
  `views` prop updated accordingly.
- Calendar container wrapped in `overflow-x-auto` with `minWidth: 320` to
  prevent layout collapse on very narrow viewports.
- Calendar height made responsive: `400px` on mobile, `560px` on desktop.
- Calendar font-size reduced to `11px` on mobile.
- Event detail panel grid changed from `grid-cols-2` to
  `grid-cols-1 sm:grid-cols-2`.

### `frontend/src/components/StatsView.tsx`
- Booking status table wrapped in `<div className="overflow-x-auto">` with the
  `<table>` given `min-w-[480px]` so columns do not crush on small screens —
  the table scrolls horizontally instead.
- Bar chart wrapped in an `overflow-x-auto` / `minWidth: 280` container for the
  same reason.
