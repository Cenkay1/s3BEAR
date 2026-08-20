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
            style={{ color: '#64748B', padding: '0 4px', height: 'auto', fontWeight: 500, fontFamily: "'Fira Code', monospace", fontSize: 13 }}
          >
            ~/buckets
          </Button>
          <span style={{ color: '#64748B', fontFamily: "'Fira Code', monospace" }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DatabaseOutlined style={{ color: '#0B0F17', fontSize: 11 }} />
            </div>
            <span style={{ color: '#E6EDF3', fontWeight: 600, fontSize: 15, fontFamily: "'Fira Code', monospace" }}>
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
          <Typography.Title level={3} style={{
            margin: 0,
            color: '#E6EDF3',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontFamily: "'Inter', sans-serif",
            fontSize: 26,
          }}>
            Buckets
          </Typography.Title>
          <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
            {buckets.length} bucket{buckets.length !== 1 ? 's' : ''} available
          </div>
        </div>
        {user?.is_admin && (
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => { form.resetFields(); setCreateModal(true) }}
            style={{ fontWeight: 600, height: 40 }}
          >
            Create Bucket
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
                  background: 'linear-gradient(180deg, #141B26 0%, #121821 100%)',
                  border: '1px solid #232C3A',
                  borderRadius: 14,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
                  e.currentTarget.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.15), 0 12px 32px rgba(0,0,0,0.45)'
                  e.currentTarget.style.transform = 'translateY(-3px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#232C3A'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                    }}>
                      <DatabaseOutlined style={{ color: '#fff', fontSize: 19 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        color: '#E6EDF3',
                        fontWeight: 600,
                        fontSize: 15,
                        fontFamily: "'Fira Code', monospace",
                        wordBreak: 'break-all',
                        lineHeight: 1.3,
                      }}>
                        {bucket.name}
                      </div>
                      <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>S3 bucket</div>
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
                        style={{ opacity: 0.5 }}
                      />
                    </Popconfirm>
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: '#0B0F17', border: '1px solid #1A2230', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Size</div>
                    <div style={{ color: '#E6EDF3', fontSize: 14, fontFamily: "'Fira Code', monospace" }}>{stats ? formatBytes(stats.size) : '—'}</div>
                  </div>
                  <div style={{ flex: 1, background: '#0B0F17', border: '1px solid #1A2230', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Objects</div>
                    <div style={{ color: '#E6EDF3', fontSize: 14, fontFamily: "'Fira Code', monospace" }}>{stats ? stats.object_count : '—'}</div>
                  </div>
                </div>

                {/* Permissions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bucket.can_list && (
                    <span style={{ fontSize: 11, color: '#60A5FA', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, padding: '2px 9px' }}>list</span>
                  )}
                  {bucket.can_read && (
                    <span style={{ fontSize: 11, color: '#22C55E', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '2px 9px' }}>read</span>
                  )}
                  {bucket.can_write && (
                    <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '2px 9px' }}>write</span>
                  )}
                  {bucket.can_delete && (
                    <span style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '2px 9px' }}>delete</span>
                  )}
                </div>
              </div>
            </List.Item>
          )
        }}
      />

      <Modal
        open={createModal}
        title="Create Bucket"
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createLoading}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontSize: 13, color: '#94A3B8' }}>Bucket name</span>}
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
            label={<span style={{ fontSize: 13, color: '#94A3B8' }}>Quota (GB) — optional</span>}
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
