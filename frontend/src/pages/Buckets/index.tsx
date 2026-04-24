import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Form, Input, InputNumber, List, message, Modal, Popconfirm, Space, Tag, Typography } from 'antd'
import { DatabaseOutlined, DeleteOutlined, FileOutlined, PlusOutlined } from '@ant-design/icons'
import { bucketsApi, BucketInfo } from '../../api/buckets'
import { settingsApi, BucketStorageStat } from '../../api/settings'
import { useAuthStore } from '../../store/auth'
import BucketBrowser from '../../components/BucketBrowser'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export default function BucketsPage() {
  const { bucketName } = useParams<{ bucketName?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [bucketStats, setBucketStats] = useState<Record<string, BucketStorageStat>>({})
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    bucketsApi.list().then((res) => {
      setBuckets(res.data)
      setLoading(false)
    })
    if (user?.is_admin) {
      settingsApi.getStorageStats().then((res) => {
        const map: Record<string, BucketStorageStat> = {}
        for (const b of res.data.buckets) map[b.name] = b
        setBucketStats(map)
      }).catch(() => {})
    }
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: { name: string; quota_gb?: number }) => {
    setCreateLoading(true)
    try {
      await bucketsApi.create(values.name, values.quota_gb)
      message.success(`Bucket '${values.name}' created`)
      setCreateModal(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to create bucket')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await bucketsApi.deleteBucket(name)
      message.success(`Bucket '${name}' deleted`)
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to delete bucket')
    }
  }

  const selected = buckets.find((b) => b.name === bucketName)

  // Bucket detail view
  if (bucketName && selected) {
    return (
      <div className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <Button
            type="text"
            onClick={() => navigate('/buckets')}
            style={{ color: '#504945', padding: '0 4px', height: 'auto', fontWeight: 500, fontFamily: "'Fira Code', monospace", fontSize: 13 }}
          >
            ~/buckets
          </Button>
          <span style={{ color: '#504945', fontFamily: "'Fira Code', monospace" }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#fabd2f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DatabaseOutlined style={{ color: '#1d2021', fontSize: 11 }} />
            </div>
            <span style={{ color: '#ebdbb2', fontWeight: 600, fontSize: 15, fontFamily: "'Fira Code', monospace" }}>
              {bucketName}
            </span>
          </div>
        </div>
        <BucketBrowser
          bucket={bucketName}
          canWrite={selected.can_write}
          canDelete={selected.can_delete}
        />
      </div>
    )
  }

  // Bucket list view
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ color: '#504945', fontSize: 11, fontFamily: "'Fira Code', monospace", letterSpacing: '0.06em', marginBottom: 4 }}>
            // storage / buckets
          </div>
          <Typography.Title level={3} style={{
            margin: 0,
            color: '#ebdbb2',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontFamily: "'Fira Sans', sans-serif",
            fontSize: 24,
          }}>
            Buckets
          </Typography.Title>
          <div style={{ color: '#928374', fontSize: 13, marginTop: 3, fontFamily: "'Fira Code', monospace" }}>
            {buckets.length} bucket{buckets.length !== 1 ? 's' : ''} available
          </div>
        </div>
        {user?.is_admin && (
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => { form.resetFields(); setCreateModal(true) }}
            style={{ fontWeight: 700, height: 38, fontFamily: "'Fira Code', monospace", fontSize: 12, letterSpacing: '0.02em' }}
          >
            + new bucket
          </Button>
        )}
      </div>

      {/* Bucket grid with staggered animation */}
      <List
        loading={loading}
        grid={{ gutter: 14, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={buckets}
        renderItem={(bucket, idx) => {
          const stats = bucketStats[bucket.name]
          const staggerClass = `stagger-${Math.min(idx + 1, 6)}`
          return (
            <List.Item>
              <div
                className={`animate-fade-up ${staggerClass}`}
                onClick={() => navigate(`/buckets/${bucket.name}`)}
                style={{
                  background: '#282828',
                  border: '1px solid #3c3836',
                  borderRadius: 6,
                  padding: '18px 18px 16px',
                  cursor: 'pointer',
                  transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#fabd2f'
                  e.currentTarget.style.boxShadow = '0 0 0 1px rgba(250,189,47,0.2), 0 8px 32px rgba(0,0,0,0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#3c3836'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Subtle top accent line */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, #fabd2f, transparent)',
                  opacity: 0.4,
                }} />

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      background: 'rgba(250,189,47,0.1)',
                      border: '1px solid rgba(250,189,47,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <DatabaseOutlined style={{ color: '#fabd2f', fontSize: 15 }} />
                    </div>
                    <div style={{
                      color: '#ebdbb2',
                      fontWeight: 600,
                      fontSize: 14,
                      fontFamily: "'Fira Code', monospace",
                      wordBreak: 'break-all',
                      lineHeight: 1.3,
                    }}>
                      {bucket.name}
                    </div>
                  </div>

                  {user?.is_admin && (
                    <Popconfirm
                      title={`Delete '${bucket.name}'?`}
                      description="Bucket must be empty."
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(bucket.name) }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        style={{ opacity: 0.4, marginTop: 2 }}
                      />
                    </Popconfirm>
                  )}
                </div>

                {/* Stats row */}
                {stats && (
                  <div style={{ display: 'flex', gap: 20, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #32302f' }}>
                    <div>
                      <div style={{ color: '#504945', fontSize: 10, fontFamily: "'Fira Code', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>size</div>
                      <div style={{ color: '#928374', fontSize: 12, fontFamily: "'Fira Code', monospace" }}>{formatBytes(stats.size)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#504945', fontSize: 10, fontFamily: "'Fira Code', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>objects</div>
                      <div style={{ color: '#928374', fontSize: 12, fontFamily: "'Fira Code', monospace" }}>{stats.object_count}</div>
                    </div>
                  </div>
                )}

                {/* Permissions */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {bucket.can_list && (
                    <span style={{ fontSize: 10, fontFamily: "'Fira Code', monospace", color: '#83a598', background: 'rgba(131,165,152,0.1)', border: '1px solid rgba(131,165,152,0.2)', borderRadius: 3, padding: '1px 6px' }}>list</span>
                  )}
                  {bucket.can_read && (
                    <span style={{ fontSize: 10, fontFamily: "'Fira Code', monospace", color: '#b8bb26', background: 'rgba(184,187,38,0.1)', border: '1px solid rgba(184,187,38,0.2)', borderRadius: 3, padding: '1px 6px' }}>read</span>
                  )}
                  {bucket.can_write && (
                    <span style={{ fontSize: 10, fontFamily: "'Fira Code', monospace", color: '#fe8019', background: 'rgba(254,128,25,0.1)', border: '1px solid rgba(254,128,25,0.2)', borderRadius: 3, padding: '1px 6px' }}>write</span>
                  )}
                  {bucket.can_delete && (
                    <span style={{ fontSize: 10, fontFamily: "'Fira Code', monospace", color: '#fb4934', background: 'rgba(251,73,52,0.1)', border: '1px solid rgba(251,73,52,0.2)', borderRadius: 3, padding: '1px 6px' }}>delete</span>
                  )}
                </div>
              </div>
            </List.Item>
          )
        }}
      />

      <Modal
        open={createModal}
        title={<span style={{ fontFamily: "'Fira Code', monospace", fontSize: 14 }}>// new bucket</span>}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createLoading}
        okText="create"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#928374' }}>bucket_name</span>}
            rules={[
              { required: true, message: 'Bucket name is required' },
              { pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, message: 'Lowercase letters, numbers, dots, hyphens. 3-63 chars.' },
            ]}
          >
            <Input
              placeholder="my-bucket-name"
              size="large"
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item
            name="quota_gb"
            label={<span style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#928374' }}>quota (GB) — optional</span>}
          >
            <InputNumber
              min={0.1}
              step={1}
              placeholder="e.g. 50"
              style={{ width: '100%', fontFamily: "'Fira Code', monospace", fontSize: 13 }}
              size="large"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
