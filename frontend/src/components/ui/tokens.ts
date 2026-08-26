import React from 'react'

/** Shared visual tokens for the s3BEAR console. */
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
