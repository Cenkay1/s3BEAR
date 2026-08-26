import React from 'react'
import { C } from './tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

/** Consistent page title row with an optional subtitle and right-aligned actions. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ color: C.text, fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <div style={{ color: C.muted, fontSize: 15, marginTop: 6 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
