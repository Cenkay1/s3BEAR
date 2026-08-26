# UI Refresh Design — Neutral Palette, Emerald Accent, Comfortable Sizing, Card Redesign

Branch: `fix/ui-refresh`
Date: 2026-08-26

## Goal

Refresh the s3BEAR web console UI along four axes, without changing behavior or data flow:

1. Move the palette from blue-slate to neutral black/gray, with an emerald accent for all highlights (hover, active, selected, progress).
2. Increase the size of UI elements (sidebar nav, cards, lists, buttons, inputs) for a more comfortable, less cramped experience.
3. Redesign the bucket card to a fixed-height "usage + objects + tags" layout that never breaks when tags are added.
4. Group the bucket grid by provider with a clear provider heading, and add a dashed "Create New Bucket" tile to each group.

Stack: React 18 + TypeScript + Vite + Ant Design 5 (`ConfigProvider` dark theme) + zustand.

## Architecture / Where Things Live

- Central color tokens: `src/components/ui/tokens.ts` (the `C` object) and `src/main.tsx` (antd `ConfigProvider` theme).
- Hardcoded blue values (`#3B82F6`, `#2563EB`, `#60A5FA`, `rgba(59,130,246,...)`) appear in 8 files: `main.tsx`, `components/ui/tokens.ts`, `components/BucketBrowser/index.tsx`, `components/Layout/index.tsx`, `components/UploadButton/index.tsx`, `pages/Buckets/index.tsx`, `pages/Settings/index.tsx`, `pages/Login/index.tsx`.
- Bucket grid + card + provider grouping: `pages/Buckets/index.tsx`.
- Shared UI: `components/ui/TagBadges.tsx`, `ProviderChip.tsx`, `PageHeader.tsx`, `FilterBar.tsx`.
- Sidebar: `components/Layout/index.tsx`.

Approach: drive color and size from the central tokens/theme wherever possible; replace scattered literals to match. No refactor beyond what these four changes require.

## 1. Palette: Blue → Neutral Black/Gray + Emerald Accent

Update `C` in `tokens.ts`:

| token | from | to |
|-------|------|----|
| `bg` | `#0B0F14` | `#0A0A0B` |
| `surface` | `#121821` | `#141416` |
| `raised` | `#1A2230` | `#1C1C20` |
| `border` | `#232C3A` | `#2A2A30` |
| `text` | `#E6EDF3` | `#ECECEE` |
| `muted` | `#94A3B8` | `#A0A0A8` |
| `dim` | `#64748B` | `#6B6B73` |
| `accent` | `#3B82F6` | `#10B981` |
| `accentHover` | `#60A5FA` | `#34D399` |
| `accentSoftBg` | `rgba(59,130,246,0.12)` | `rgba(16,185,129,0.12)` |
| `accentSoftBorder` | `rgba(59,130,246,0.25)` | `rgba(16,185,129,0.28)` |

`warning` (#F59E0B), `danger` (#EF4444) unchanged. `success` (#22C55E) unchanged (used for status semantics distinct from the emerald accent).

Update `main.tsx` theme:
- `PRIMARY` and the local slate constants (`BG`, `SURFACE`, `ELEVATED`, `BORDER`, `TEXT`, `MUTED`) retargeted to the neutral ramp above; `colorPrimary = #10B981`.
- Every `rgba(59,130,246,...)` in `Menu` (selected/hover) and `Table` (rowHoverBg) → emerald rgba equivalents.
- `colorLink`, `colorLinkHover`, `colorInfo` → emerald; `Progress.defaultColor` → emerald.

Replace remaining literals in the 8 files:
- `Buckets/index.tsx`: bucket icon gradient `linear-gradient(135deg, #3B82F6, #2563EB)` → `linear-gradient(135deg, #10B981, #059669)`; card hover glow `rgba(59,130,246,...)` → emerald; the `#0B0F17` on-icon glyph color follows the new `bg`.
- `Layout/index.tsx`: avatar `background #3B82F6` → emerald; user-row hover `rgba(59,130,246,0.08)` → emerald; admin label `#60A5FA` → `accentHover`; hardcoded slate backgrounds/borders → neutral ramp.
- `UploadButton`, `Settings`, `Login`, `BucketBrowser`: swap any blue literal to the matching token.

Acceptance: no blue-family hex/rgba (`3B82F6|2563EB|60A5FA|1D4ED8|1E40AF|59,130,246`) remains under `src/`; all highlight/hover/active/selected states render emerald.

## 2. Comfortable Sizing

Central levers:
- `ConfigProvider`: add `componentSize="large"` and raise base `token.fontSize` 14 → 15. This enlarges Button, Input, Select, Table controls app-wide.
- `Menu` theme: raise item height and font (`itemHeight` ~44, item `fontSize` ~15) so sidebar nav is comfortable.
- `Table` theme: increase `cellPaddingBlock` for taller rows.

Targeted bumps:
- Sidebar (`Layout/index.tsx`): `SIDER_W` 248 → 264; group label and nav font sizes up; avatar 32 → 36; content padding eased.
- `PageHeader`: title 26 → 28, subtitle 14 → 15.
- `FilterBar`: search input height 38 → 44.
- `Buckets` header "Create New Bucket" button height 40 → 44 (or rely on `large`).
- `TagBadges`: font 11 → 12 with slightly larger padding.

Acceptance: sidebar items, primary buttons, list/table rows, and inputs are visibly larger; no layout overflow at common widths (1280–1920).

## 3. Bucket Card Redesign (fixed height, tag overflow)

New card structure in `gridRenderItem` (`Buckets/index.tsx`), matching the reference mockup:

1. **Header row:** icon tile (emerald gradient, enlarged) + bucket name (mono, wraps within a bounded area) + right-side control (admin: delete; else: chevron).
2. **Usage block:** label `Usage` + value `<used> / <quota>` (e.g. `332.4 GB / 500 GB`) + a progress bar.
   - `used` from `bucketStats[name].size`; `quota` from the bucket's `quota_gb` (GB → bytes).
   - Bar color by ratio: `< 0.75` emerald, `>= 0.75` warning (amber), `>= 0.90` danger (red).
   - **No quota:** show only the used size (e.g. `332.4 GB`), render the bar track empty/neutral (no fill) so height stays constant.
3. **Divider** (1px `raised`).
4. **Objects row:** `OBJECTS` label + count on the left; **tags on the right of the same row**.

Equal-height rule:
- Card is a flex column with a fixed `minHeight` and consistent internal spacing; the tag area occupies a single reserved row so cards with 0, 1, or many tags are identical in size.
- The antd `List` grid already equalizes column widths; the fixed card height equalizes rows.

Tag overflow (`+N`):
- Show up to **2** tag chips inline. If there are more than 2, OR the visible chips would overflow the row (long tag), collapse the remainder into a single `+N` chip.
- The `+N` chip opens an antd `Popover` (hover/click) listing **all** tags as `key=value` chips.
- Implementation: extend `TagBadges` (or a small local variant) to accept a `max` plus an `overflow="popover"` mode; the current `+N` plain text becomes an interactive chip with a Popover. Clicks on card interior stop propagation so the popover does not trigger card navigation.

Acceptance: a bucket with 0 tags and a bucket with 6 long tags render as the same size; all tags remain reachable via the `+N` popover; usage bar reflects quota state with correct color thresholds.

## 4. Provider Grouping + Create-New-Bucket Tile

- Keep grid grouping by provider (existing behavior). Restyle `ProviderHeading` to the mockup: server icon in a soft emerald tile + bold provider name + a `N BUCKETS` pill/badge + a thin divider line filling the row.
- Append a **dashed "Create New Bucket" tile** as the last grid item of each provider group (admin only). It matches the card footprint (dashed border, centered `+` icon, "Create New Bucket" label), and on click opens the existing create drawer with that group's provider pre-selected.
- The header "Create New Bucket" button is retained for quick access.
- When a provider filter is active, only the matching group renders (natural consequence of existing filtering), so the split effectively collapses to one group.

Acceptance: with no filter, buckets appear under per-provider headings each ending with a dashed create tile; clicking a tile opens the create drawer with the provider preset; header button still works.

## 5. Branch

Work happens on `fix/ui-refresh` in the `s3BEAR/` repo (its own git root, branched from `main`). Plain `fix` was unavailable due to an existing `fix/code-scanning-alerts` ref.

## Out of Scope

- No backend/API changes; no data model changes.
- No new navigation tabs (clarified: "make elements larger", not "add tabs").
- No unrelated refactoring of pages beyond the color/size swaps they require.

## Verification

- `npm run build` (tsc + vite) passes.
- Manual: run `npm run dev`, verify emerald highlights, larger sidebar/buttons/rows, redesigned equal-height cards with `+N` popover, provider headings, and the create tile.
- `grep -rE '3B82F6|2563EB|60A5FA|1D4ED8|1E40AF|59,130,246' src` returns nothing.
