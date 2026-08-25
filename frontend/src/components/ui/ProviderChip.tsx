import React from 'react'
import { CloudOutlined, HddOutlined, DatabaseOutlined, CloudServerOutlined } from '@ant-design/icons'
import { C, PROVIDER_TYPE_LABEL } from './tokens'

const ICONS: Record<string, React.ReactNode> = {
  aws: <CloudOutlined />, minio: <HddOutlined />, ceph: <DatabaseOutlined />,
  wasabi: <CloudOutlined />, custom: <CloudServerOutlined />,
}

interface ProviderChipProps {
  name?: string | null
  type?: string | null
  /** icon-only compact form for dense tables */
  compact?: boolean
}

/** Consistent provider badge (icon + name) used in tables, cards and filters. */
export default function ProviderChip({ name, type, compact }: ProviderChipProps) {
  if (!name && !type) {
    return <span style={{ color: C.dim, fontSize: 12 }}>—</span>
  }
  const icon = ICONS[type || 'custom'] || <CloudServerOutlined />
  const label = name || PROVIDER_TYPE_LABEL[type || 'custom'] || type
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: C.accentSoftBg, border: `1px solid ${C.accentSoftBorder}`,
      color: C.accentHover, borderRadius: 8, padding: compact ? '2px 8px' : '4px 10px',
      fontSize: compact ? 12 : 13, fontWeight: 500, maxWidth: 220,
    }}>
      <span style={{ display: 'inline-flex', fontSize: compact ? 12 : 14 }}>{icon}</span>
      {!compact && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
    </span>
  )
}
