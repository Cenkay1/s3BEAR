# UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the s3BEAR web console to a neutral black/gray palette with an emerald accent, enlarge cramped UI elements, and redesign the bucket card into a fixed-height layout with provider grouping and a create tile.

**Architecture:** Colors and sizing are driven from two central sources — `src/components/ui/tokens.ts` (the `C` object) and the antd `ConfigProvider` theme in `src/main.tsx`. Scattered blue literals in other files are swapped to match. The bucket card and provider grouping are rewritten in `src/pages/Buckets/index.tsx`, and `TagBadges` gains a popover overflow mode.

**Tech Stack:** React 18, TypeScript, Vite 7, Ant Design 5, zustand. No test framework — verification is `npm run build` (tsc + vite) plus targeted `grep` and manual dev-server checks.

## Global Constraints

- Work on branch `fix/ui-refresh` in the `s3BEAR/` git repo.
- No backend/API/data-model changes. Behavior unchanged; visuals only.
- Repo docs are English, no emojis, professional tone.
- All commands run from `s3BEAR/frontend/` unless noted. All git commands run from `s3BEAR/`.
- Neutral ramp (final values): `bg #0A0A0B`, `surface #141416`, `raised #1C1C20`, `border #2A2A30`, `text #ECECEE`, `muted #A0A0A8`, `dim #6B6B73`.
- Emerald accent: `accent #10B981`, `accentHover #34D399`, soft-bg `rgba(16,185,129,0.12)`, soft-border `rgba(16,185,129,0.28)`, gradient `linear-gradient(135deg, #10B981, #059669)`.
- Keep `success #22C55E`, `warning #F59E0B`, `danger #EF4444`.

---

### Task 1: Central palette — neutral ramp + emerald accent

**Files:**
- Modify: `src/components/ui/tokens.ts` (the `C` object, lines 4-19)
- Modify: `src/main.tsx` (theme constants + `token`/`components`)

**Interfaces:**
- Produces: the `C` token object with new hex values (same keys, same types) consumed by every page; antd theme with `colorPrimary = #10B981`.

- [ ] **Step 1: Rewrite the `C` object in `tokens.ts`**

Replace the object body (keep keys/comment/`as const`):

```ts
export const C = {
  bg: '#0A0A0B',
  surface: '#141416',
  raised: '#1C1C20',
  border: '#2A2A30',
  text: '#ECECEE',
  muted: '#A0A0A8',
  dim: '#6B6B73',
  accent: '#10B981',
  accentHover: '#34D399',
  accentSoftBg: 'rgba(16,185,129,0.12)',
  accentSoftBorder: 'rgba(16,185,129,0.28)',
  warning: '#F59E0B',
  success: '#22C55E',
  danger: '#EF4444',
} as const
```

- [ ] **Step 2: Retarget the color constants in `main.tsx`**

Replace lines 9-16:

```ts
// Neutral / Emerald palette
const BG       = '#0A0A0B'
const SURFACE  = '#141416'
const ELEVATED = '#1C1C20'
const BORDER   = '#2A2A30'
const PRIMARY  = '#10B981'
const TEXT     = '#ECECEE'
const MUTED    = '#A0A0A8'
```

- [ ] **Step 3: Update theme token colors in `main.tsx`**

In the `token` block: `colorTextPlaceholder: '#6B6B73'`, `colorLinkHover: '#34D399'`. `colorPrimary`, `colorInfo`, `colorLink` already use `PRIMARY` (now emerald) — no change needed there. Set `colorBorderSecondary: '#1C1C20'` (was `#1A2230`).

In the `components` block, replace every blue rgba:
- `Menu.darkItemSelectedBg: 'rgba(16,185,129,0.14)'`
- `Menu.darkItemSelectedColor: '#34D399'`
- `Menu.darkItemHoverBg: 'rgba(16,185,129,0.08)'`
- `Table.rowHoverBg: 'rgba(16,185,129,0.07)'`
- `Table.borderColor: '#1C1C20'`

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: PASS (no TS errors, vite build completes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/tokens.ts frontend/src/main.tsx
git commit -m "style: neutral palette and emerald accent in central tokens/theme"
```

---

### Task 2: Replace scattered blue literals in remaining files

**Files:**
- Modify: `src/components/Layout/index.tsx`
- Modify: `src/pages/Buckets/index.tsx`
- Modify: `src/components/BucketBrowser/index.tsx`
- Modify: `src/components/UploadButton/index.tsx`
- Modify: `src/pages/Settings/index.tsx`
- Modify: `src/pages/Login/index.tsx`

**Interfaces:**
- Consumes: `C` tokens from Task 1.
- Produces: no blue-family literals remain under `src/`.

- [ ] **Step 1: Find every remaining blue literal**

Run: `grep -rnE '3B82F6|2563EB|60A5FA|1D4ED8|1E40AF|59,130,246' frontend/src`
Note each hit; these are the edit sites for this task.

- [ ] **Step 2: Swap literals to emerald/neutral**

Apply per hit:
- `#3B82F6` used as a solid accent (avatar bg, small icon tile, detail-view icon square) → `#10B981`.
- `#60A5FA` → `#34D399`.
- Bucket icon gradient `linear-gradient(135deg, #3B82F6, #2563EB)` → `linear-gradient(135deg, #10B981, #059669)`.
- `rgba(59,130,246,X)` → `rgba(16,185,129,X)` (keep the same alpha `X`).
- In `Layout/index.tsx`, hardcoded slate backgrounds/borders `#121821`/`#1A2230` on the Sider/user-area/dividers → `#141416` (surface) / `#1C1C20` (raised) to match the neutral ramp. The glyph-on-emerald color `#0B0F17` (if present) → `#0A0A0B`.

Prefer referencing `C.*` tokens where the file already imports `C`; use raw hex only where the file uses raw hex today (e.g. `Layout/index.tsx`).

- [ ] **Step 3: Verify no blue remains**

Run: `grep -rnE '3B82F6|2563EB|60A5FA|1D4ED8|1E40AF|59,130,246' frontend/src`
Expected: no output.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "style: replace remaining blue literals with emerald/neutral"
```

---

### Task 3: Comfortable sizing

**Files:**
- Modify: `src/main.tsx` (`ConfigProvider` props + theme tokens/components)
- Modify: `src/components/Layout/index.tsx`
- Modify: `src/components/ui/PageHeader.tsx`
- Modify: `src/components/ui/FilterBar.tsx`
- Modify: `src/components/ui/TagBadges.tsx`

**Interfaces:**
- Consumes: theme from Task 1.
- Produces: globally larger controls; `SIDER_W = 264`.

- [ ] **Step 1: Enlarge global controls in `main.tsx`**

On `<ConfigProvider>` add the prop `componentSize="large"`. In the `token` block set `fontSize: 15` (was 14). In `components`:
- `Menu`: add `itemHeight: 44` and `fontSize: 15` (keep existing keys).
- `Table`: add `cellPaddingBlock: 14`.
- `Statistic.contentFontSize: 22` (was 20).

- [ ] **Step 2: Enlarge the sidebar in `Layout/index.tsx`**

- `const SIDER_W = 264` (was 248).
- Group label style: `fontSize: 12` (was 11).
- Avatar: `size={36}` (was 32); its font `fontSize: 14`.
- User name line `fontSize: 14`; role line `fontSize: 12`.

- [ ] **Step 3: Enlarge shared header/filter/tags**

- `PageHeader.tsx`: title `fontSize: 28` (was 26); subtitle `fontSize: 15` (was 14).
- `FilterBar.tsx`: search `Input` `height: 44` (was 38).
- `TagBadges.tsx`: chip `fontSize: 12` (was 11), padding `'3px 9px'` (was `'2px 7px'`); `rest` label `fontSize: 12`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run: `npm run dev`, open the app. Confirm sidebar items, primary buttons, table rows, and the search input are visibly larger with no horizontal overflow. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "style: larger sidebar, controls, and typography for comfortable density"
```

---

### Task 4: TagBadges popover overflow (`+N` shows all tags)

**Files:**
- Modify: `src/components/ui/TagBadges.tsx`

**Interfaces:**
- Consumes: `C`, `mono` tokens; antd `Popover`; `BucketTag` (`{ key: string; value: string }`).
- Produces: `TagBadges` accepts an optional `overflow?: 'text' | 'popover'` prop (default `'text'`). When `'popover'`, the `+N` element is an interactive chip that opens a `Popover` listing every tag. Existing callers (default `'text'`) are unchanged.

- [ ] **Step 1: Rewrite `TagBadges.tsx`**

```tsx
import { Popover } from 'antd'
import { BucketTag } from '../../api/buckets'
import { C, mono } from './tokens'

interface TagBadgesProps {
  tags: BucketTag[]
  max?: number
  /** How to render the hidden remainder when tags exceed `max`. */
  overflow?: 'text' | 'popover'
}

const chip = {
  ...mono, fontSize: 12, color: C.muted, background: C.raised,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px',
} as const

function Chip({ t }: { t: BucketTag }) {
  return (
    <span style={chip}>
      <span style={{ color: C.dim }}>{t.key}</span>
      {t.value ? <span style={{ color: C.muted }}>={t.value}</span> : null}
    </span>
  )
}

/** Compact read-only rendering of bucket tags as key=value chips. */
export default function TagBadges({ tags, max, overflow = 'text' }: TagBadgesProps) {
  if (!tags || tags.length === 0) {
    return <span style={{ color: C.dim, fontSize: 12 }}>—</span>
  }
  const shown = max ? tags.slice(0, max) : tags
  const rest = tags.slice(shown.length)
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {shown.map((t) => <Chip key={t.key} t={t} />)}
      {rest.length > 0 && overflow === 'popover' && (
        <Popover
          trigger={['hover', 'click']}
          content={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 280 }}>
              {tags.map((t) => <Chip key={t.key} t={t} />)}
            </div>
          }
        >
          <span
            onClick={(e) => e.stopPropagation()}
            style={{ ...chip, cursor: 'pointer', color: C.accentHover, borderColor: C.accentSoftBorder, background: C.accentSoftBg }}
          >
            +{rest.length}
          </span>
        </Popover>
      )}
      {rest.length > 0 && overflow === 'text' && (
        <span style={{ color: C.dim, fontSize: 12 }}>+{rest.length}</span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/TagBadges.tsx
git commit -m "feat: TagBadges popover overflow mode for full tag list"
```

---

### Task 5: Bucket card redesign (fixed height, usage bar, objects + tags)

**Files:**
- Modify: `src/pages/Buckets/index.tsx` (the `gridRenderItem` function, lines ~182-254; add a `usagePct`/quota helper near `formatBytes`)

**Interfaces:**
- Consumes: `bucketStats[name]` (`BucketStorageStat`: `{ size: number; object_count: number; quota_bytes: number }`), `bucket.tags`, `TagBadges` with `overflow="popover"` from Task 4.
- Produces: a fixed-height card; no new exports.

**Data note:** `BucketInfo` has NO quota field. Size, object count, and quota all come from `bucketStats[name]` — `size`, `object_count`, `quota_bytes` (all in bytes; `quota_bytes` is `0` when no quota). `bucketStats` is loaded for admins only, so non-admins see `—` and an empty bar (matches current behavior).

- [ ] **Step 1: Add a usage-bar helper near `formatBytes`**

```tsx
// Returns fill ratio 0..1 (or null when no quota) and the bar color for that ratio.
function usageBar(sizeBytes: number, quotaBytes: number) {
  if (!quotaBytes || quotaBytes <= 0) return { ratio: null as number | null, color: C.dim }
  const ratio = Math.min(sizeBytes / quotaBytes, 1)
  const color = ratio >= 0.9 ? C.danger : ratio >= 0.75 ? C.warning : C.accent
  return { ratio, color }
}
```

- [ ] **Step 2: Rewrite `gridRenderItem` body**

Replace the returned card `<div>` inner content (header + tags + stats) with this fixed-height layout. Keep the outer `List.Item`, the `onClick` navigate, the hover handlers (update glow to emerald), and the `staggerClass`.

```tsx
const gridRenderItem = (bucket: BucketInfo, idx: number) => {
  const stats = bucketStats[bucket.name]
  const staggerClass = `stagger-${Math.min(idx + 1, 6)}`
  const size = stats?.size ?? 0
  const quota = stats?.quota_bytes ?? 0
  const { ratio, color } = usageBar(size, quota)
  return (
    <List.Item>
      <div
        className={`animate-fade-up ${staggerClass}`}
        onClick={() => navigate(`/buckets/${bucket.name}`)}
        style={{
          background: 'linear-gradient(180deg, #16161A 0%, #141416 100%)',
          border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, cursor: 'pointer',
          transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
          position: 'relative', overflow: 'hidden',
          minHeight: 232, display: 'flex', flexDirection: 'column',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'
          e.currentTarget.style.boxShadow = '0 0 0 1px rgba(16,185,129,0.15), 0 12px 32px rgba(0,0,0,0.45)'
          e.currentTarget.style.transform = 'translateY(-3px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.border
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
          }}>
            <DatabaseOutlined style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 16, ...mono, wordBreak: 'break-all', lineHeight: 1.3 }}>
              {bucket.name}
            </div>
          </div>
          {user?.is_admin ? (
            <Popconfirm
              title={`Delete '${bucket.name}'?`} description="Bucket must be empty."
              onConfirm={(e) => { e?.stopPropagation(); handleDelete(bucket.name) }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} style={{ opacity: 0.5 }} />
            </Popconfirm>
          ) : (
            <RightOutlined style={{ color: C.dim, fontSize: 13 }} />
          )}
        </div>

        {/* Usage */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ color: C.muted, fontSize: 13, ...mono }}>Usage</span>
            <span style={{ color: C.text, fontSize: 14, ...mono }}>
              {formatBytes(size)}{quota > 0 ? ` / ${formatBytes(quota)}` : ''}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: C.raised, overflow: 'hidden' }}>
            {ratio !== null && (
              <div style={{ width: `${Math.max(ratio * 100, 2)}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 300ms ease' }} />
            )}
          </div>
        </div>

        <div style={{ height: 1, background: C.raised, margin: '0 0 16px' }} />

        {/* Objects + tags, pinned to the bottom for equal alignment */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ color: C.dim, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Objects</div>
            <div style={{ color: C.text, fontSize: 16, ...mono }}>{stats ? stats.object_count.toLocaleString() : '—'}</div>
          </div>
          <div style={{ marginLeft: 'auto', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
            {bucket.tags && bucket.tags.length > 0
              ? <TagBadges tags={bucket.tags} max={2} overflow="popover" />
              : null}
          </div>
        </div>
      </div>
    </List.Item>
  )
}
```

- [ ] **Step 3: Confirm stat fields**

Run: `grep -nE "quota_bytes|object_count|size" frontend/src/api/settings.ts`
Expected: `BucketStorageStat` has `size`, `object_count`, `quota_bytes` (all bytes). Confirms the fields used in Steps 1-2.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run `npm run dev`. Confirm: cards are equal height regardless of tag count; usage bar is emerald under 75%, amber 75-90%, red above; a bucket with 3+ tags shows `+N` and hovering it lists all tags. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Buckets/index.tsx
git commit -m "feat: redesign bucket card with usage bar, objects, and equal height"
```

---

### Task 6: Provider heading restyle + Create-New-Bucket tile

**Files:**
- Modify: `src/pages/Buckets/index.tsx` (`ProviderHeading` component ~290-299; the grid render block ~397-408)

**Interfaces:**
- Consumes: `groups` (already computed), `openCreate`, `form`, `providers`, `user`.
- Produces: a create tile appended per group; restyled heading.

- [ ] **Step 1: Restyle `ProviderHeading` to a pill-badge heading**

```tsx
const ProviderHeading = ({ name, count }: { name: string; count: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px' }}>
    <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accentSoftBg, border: `1px solid ${C.accentSoftBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accentHover }}>
      <CloudServerOutlined style={{ fontSize: 17 }} />
    </div>
    <span style={{ color: C.text, fontWeight: 700, fontSize: 17 }}>{name}</span>
    <span style={{ ...mono, color: C.muted, fontSize: 11, letterSpacing: '0.06em', background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 9px' }}>
      {count} BUCKET{count === 1 ? '' : 'S'}
    </span>
    <div style={{ flex: 1, height: 1, background: C.raised }} />
  </div>
)
```

- [ ] **Step 2: Add an `openCreate` variant that presets the provider**

Just above `gridRenderItem`, add:

```tsx
const openCreateForProvider = (providerId?: string) => {
  form.resetFields()
  setCreateTags([])
  if (providerId) form.setFieldValue('provider_id', providerId)
  setCreateOpen(true)
}
```

- [ ] **Step 3: Append a dashed create tile to each provider group's grid**

Replace the group `<List ... />` block (inside `groups.map`) so admins get an extra tile item. Build a data source that appends a sentinel, and branch in `renderItem`:

```tsx
<List
  grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
  dataSource={user?.is_admin ? [...g.items, { __createTile: true } as unknown as BucketInfo] : g.items}
  renderItem={(item, idx) =>
    (item as any).__createTile ? (
      <List.Item key="__create">
        <div
          onClick={() => openCreateForProvider(g.key === 'none' ? undefined : g.key)}
          style={{
            minHeight: 232, borderRadius: 16, border: `1.5px dashed ${C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: 'pointer', color: C.muted,
            transition: 'border-color 180ms ease, color 180ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accentHover; e.currentTarget.style.color = C.accentHover }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
        >
          <PlusOutlined style={{ fontSize: 26 }} />
          <span style={{ fontSize: 15, fontWeight: 500 }}>Create New Bucket</span>
        </div>
      </List.Item>
    ) : gridRenderItem(item, idx)
  }
/>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Visual check**

Run `npm run dev`. Confirm each provider group shows the pill heading and ends with a dashed "Create New Bucket" tile matching card height; clicking it opens the drawer with that provider preset. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Buckets/index.tsx
git commit -m "feat: provider pill heading and per-group create-bucket tile"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: No blue remains**

Run: `grep -rnE '3B82F6|2563EB|60A5FA|1D4ED8|1E40AF|59,130,246' frontend/src`
Expected: no output.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`; walk through Buckets (grid + list), Settings, and one admin page. Confirm emerald highlights, larger controls, equal-height cards, `+N` popover, provider headings, and create tile all render correctly.

- [ ] **Step 4: Lint (best-effort)**

Run: `npm run lint`
Expected: no new errors introduced by these changes (pre-existing warnings acceptable).

## Self-Review Notes

- Spec §1 palette → Tasks 1-2. §2 sizing → Task 3. §3 card + tag overflow → Tasks 4-5. §4 provider grouping + tile → Task 6. §5 branch → done (`fix/ui-refresh`).
- Quota/size/objects come from `bucketStats[name]` (`quota_bytes`, `size`, `object_count`), verified in Task 5 Step 3. `BucketInfo` has no quota field. Non-admins have no stats → `—` and empty bar.
- `TagBadges` prop name `overflow` is consistent between Task 4 (definition) and Task 5 (usage).
