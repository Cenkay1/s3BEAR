import React from 'react'
import { Drawer, Button, Popconfirm } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { C } from './tokens'

interface EditDrawerProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  width?: number
  /** Primary action (Save/Create). When omitted the footer submit is hidden. */
  onSubmit?: () => void
  submitLabel?: string
  submitLoading?: boolean
  submitDisabled?: boolean
  /** Optional destructive action, rendered left-aligned in the footer. */
  onDelete?: () => void
  deleteLabel?: string
  deleteConfirm?: string
  deleteDisabled?: boolean
  /** Hide the built-in footer entirely (e.g. read-only / custom flows). */
  hideFooter?: boolean
}

/**
 * Right-side drawer used for every create/edit flow in the console: a titled
 * header, a scrollable body, and a sticky footer with Cancel + primary action
 * and an optional left-aligned Delete.
 */
export default function EditDrawer({
  open, onClose, title, children, width = 460,
  onSubmit, submitLabel = 'Save', submitLoading, submitDisabled,
  onDelete, deleteLabel = 'Delete', deleteConfirm = 'This cannot be undone.', deleteDisabled,
  hideFooter,
}: EditDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={<span style={{ color: C.text }}>{title}</span>}
      width={width}
      destroyOnClose
      styles={{ body: { paddingBottom: hideFooter ? undefined : 88 } }}
      footer={hideFooter ? undefined : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {onDelete && (
              <Popconfirm title={deleteLabel} description={deleteConfirm} okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button danger type="text" icon={<DeleteOutlined />} disabled={deleteDisabled}>{deleteLabel}</Button>
              </Popconfirm>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={onClose}>Cancel</Button>
            {onSubmit && (
              <Button type="primary" onClick={onSubmit} loading={submitLoading} disabled={submitDisabled}>
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </Drawer>
  )
}
