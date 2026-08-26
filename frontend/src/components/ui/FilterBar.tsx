import React from 'react'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { C } from './tokens'

interface FilterBarProps {
  search?: string
  onSearch?: (v: string) => void
  placeholder?: string
  /** Filter controls / view toggles rendered on the right. */
  children?: React.ReactNode
}

/** A search field plus a slot for dropdown filters and view toggles. */
export default function FilterBar({ search, onSearch, placeholder = 'Search…', children }: FilterBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 10, marginBottom: 16,
    }}>
      {onSearch && (
        <Input
          allowClear
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          prefix={<SearchOutlined style={{ color: C.dim }} />}
          placeholder={placeholder}
          style={{ height: 44, maxWidth: 320, flex: '1 1 220px' }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
        {children}
      </div>
    </div>
  )
}
