import { BucketTag } from '../../api/buckets'
import { C, mono } from './tokens'

interface TagBadgesProps {
  tags: BucketTag[]
  max?: number
}

/** Compact read-only rendering of bucket tags as key=value chips. */
export default function TagBadges({ tags, max }: TagBadgesProps) {
  if (!tags || tags.length === 0) {
    return <span style={{ color: C.dim, fontSize: 12 }}>—</span>
  }
  const shown = max ? tags.slice(0, max) : tags
  const rest = max ? tags.length - shown.length : 0
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((t) => (
        <span key={t.key} style={{
          ...mono, fontSize: 11, color: C.muted, background: C.raised,
          border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 7px',
        }}>
          <span style={{ color: C.dim }}>{t.key}</span>
          {t.value ? <span style={{ color: C.muted }}>={t.value}</span> : null}
        </span>
      ))}
      {rest > 0 && <span style={{ color: C.dim, fontSize: 11 }}>+{rest}</span>}
    </span>
  )
}
