import { Button, Dropdown, Popconfirm } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import React from 'react'
import { C } from './tokens'

export interface RowAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick?: () => void
  /** If set, clicking shows a confirm popover before firing onClick. */
  confirm?: string
}

/**
 * A single right-aligned kebab (⋯) button that opens a dropdown of row actions.
 * Keeps table rows tidy regardless of how many actions a row has.
 */
export default function RowActions({ actions }: { actions: RowAction[] }) {
  const items = actions.map((a) => ({
    key: a.key,
    danger: a.danger,
    icon: a.icon,
    label: a.confirm ? (
      <Popconfirm
        title={a.confirm}
        okButtonProps={{ danger: a.danger }}
        onConfirm={a.onClick}
      >
        <span onClick={(e) => e.stopPropagation()}>{a.label}</span>
      </Popconfirm>
    ) : (
      a.label
    ),
    onClick: a.confirm ? undefined : ({ domEvent }: any) => { domEvent.stopPropagation(); a.onClick?.() },
  }))

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        icon={<MoreOutlined style={{ fontSize: 18, color: C.muted }} />}
        onClick={(e) => e.stopPropagation()}
      />
    </Dropdown>
  )
}
