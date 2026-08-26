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
