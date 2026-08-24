import React from 'react'

/** Shared visual tokens for the s3BEAR console. */
export const C = {
  bg: '#0B0F14',
  surface: '#121821',
  raised: '#1A2230',
  border: '#232C3A',
  text: '#E6EDF3',
  muted: '#94A3B8',
  dim: '#64748B',
  accent: '#3B82F6',
  accentHover: '#60A5FA',
  accentSoftBg: 'rgba(59,130,246,0.12)',
  accentSoftBorder: 'rgba(59,130,246,0.25)',
  warning: '#F59E0B',
  success: '#22C55E',
  danger: '#EF4444',
} as const

/** Monospace style for technical values (keys, regions, endpoints, ids). */
export const mono: React.CSSProperties = {
  fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
}

/** Section-label style used above form groups and nav sections. */
export const sectionLabel: React.CSSProperties = {
  color: C.dim,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

/** Provider type -> label/icon mapping is reused across pages. */
export const PROVIDER_TYPE_LABEL: Record<string, string> = {
  aws: 'AWS S3', minio: 'MinIO', ceph: 'Ceph', wasabi: 'Wasabi', custom: 'Custom',
}
