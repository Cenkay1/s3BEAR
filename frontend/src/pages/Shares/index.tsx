import React, { useEffect, useState } from 'react'
import { Button, message, Popconfirm, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { shareApi, ShareLink } from '../../api/share'

const mono = { fontFamily: "'Fira Code', monospace" }

function statusTag(link: ShareLink): React.ReactNode {
  if (link.revoked) return <Tag color="red" style={{ ...mono, fontSize: 11 }}>revoked</Tag>
  if (link.expires_at && dayjs(link.expires_at).isBefore(dayjs())) {
    return <Tag color="volcano" style={{ ...mono, fontSize: 11 }}>expired</Tag>
  }
  return <Tag color="green" style={{ ...mono, fontSize: 11 }}>active</Tag>
}

export default function SharesPage() {
  const [data, setData] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await shareApi.list()
      setData(res.data)
    } catch {
      message.error('Failed to load share links')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRevoke = async (id: string) => {
    try {
      await shareApi.revoke(id)
      message.success('Share link revoked')
      load()
    } catch {
      message.error('Failed to revoke link')
    }
  }

  const columns = [
    {
      title: 'status',
      key: 'status',
      width: 90,
      render: (_: unknown, link: ShareLink) => statusTag(link),
    },
    {
      title: 'bucket',
      dataIndex: 'bucket',
      key: 'bucket',
      width: 150,
      render: (v: string) => <span style={{ ...mono, fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'object',
      dataIndex: 'object_key',
      key: 'object_key',
      ellipsis: true,
      render: (v: string) => <span style={{ ...mono, fontSize: 11, color: '#CBD5E1' }}>{v}</span>,
    },
    {
      title: 'created by',
      dataIndex: 'created_by_email',
      key: 'created_by_email',
      width: 190,
      ellipsis: true,
      render: (v: string) => <span style={{ ...mono, fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 150,
      render: (v: string | null) => (
        <span style={{ ...mono, fontSize: 11, color: '#94A3B8' }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm') : 'never'}
        </span>
      ),
    },
    {
      title: 'hits',
      dataIndex: 'access_count',
      key: 'access_count',
      width: 70,
      render: (v: number) => <span style={{ ...mono, fontSize: 12 }}>{v}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, link: ShareLink) =>
        link.revoked ? null : (
          <Popconfirm
            title="Revoke this link?"
            description="The public URL will stop working immediately."
            onConfirm={() => handleRevoke(link.id)}
            okText="Revoke"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />}>Revoke</Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0, color: '#E6EDF3', fontWeight: 700, fontSize: 22, fontFamily: "'Inter', sans-serif" }}>Shares</Typography.Title>
          <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, ...mono }}>{data.length} link{data.length !== 1 ? 's' : ''}</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        size="small"
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
      />
    </div>
  )
}
