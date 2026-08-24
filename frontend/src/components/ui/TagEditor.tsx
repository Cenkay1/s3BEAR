import React from 'react'
import { AutoComplete, Button } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { BucketTag } from '../../api/buckets'
import { C, mono, sectionLabel } from './tokens'

interface TagEditorProps {
  value: BucketTag[]
  onChange: (tags: BucketTag[]) => void
  /** { key: [distinct values...] } used to power autocomplete. */
  suggest?: Record<string, string[]>
}

/**
 * Edit a list of key/value tags. The key field autocompletes from existing
 * keys; the value field autocompletes from existing values for the chosen key.
 * The user can always type a brand-new key or value.
 */
export default function TagEditor({ value, onChange, suggest = {} }: TagEditorProps) {
  const keyOptions = Object.keys(suggest).map((k) => ({ value: k }))

  const setRow = (i: number, patch: Partial<BucketTag>) => {
    const next = value.map((t, idx) => (idx === i ? { ...t, ...patch } : t))
    onChange(next)
  }
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const addRow = () => onChange([...value, { key: '', value: '' }])

  const filterOpt = (input: string, opt?: { value: string }) =>
    (opt?.value || '').toLowerCase().includes(input.toLowerCase())

  return (
    <div>
      <div style={{ ...sectionLabel, marginBottom: 8 }}>Tags</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {value.map((tag, i) => {
          const valueOptions = (suggest[tag.key] || []).map((v) => ({ value: v }))
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AutoComplete
                value={tag.key}
                options={keyOptions}
                filterOption={filterOpt}
                onChange={(v) => setRow(i, { key: v })}
                placeholder="key (e.g. owner)"
                style={{ flex: 1 }}
                styles={{ popup: { root: { ...mono } } }}
              />
              <span style={{ color: C.dim }}>=</span>
              <AutoComplete
                value={tag.value}
                options={valueOptions}
                filterOption={filterOpt}
                onChange={(v) => setRow(i, { value: v })}
                placeholder="value (e.g. cenkay.yaman)"
                style={{ flex: 1 }}
                styles={{ popup: { root: { ...mono } } }}
              />
              <Button type="text" size="small" icon={<CloseOutlined style={{ color: C.dim }} />} onClick={() => removeRow(i)} />
            </div>
          )
        })}
      </div>
      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 10 }}>
        Add tag
      </Button>
    </div>
  )
}
