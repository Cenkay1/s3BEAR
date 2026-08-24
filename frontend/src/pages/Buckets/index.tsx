import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Form, Input, InputNumber, List, message, Modal, Popconfirm, Segmented, Select, Table, Tag, Typography } from 'antd'
import { AppstoreOutlined, CloudServerOutlined, DatabaseOutlined, DeleteOutlined, PlusOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { bucketsApi, BucketInfo } from '../../api/buckets'
import { settingsApi, BucketStorageStat } from '../../api/settings'
import { providersApi, StorageProvider } from '../../api/providers'
import { useAuthStore } from '../../store/auth'
import BucketBrowser from '../../components/BucketBrowser'
import dayjs from 'dayjs'

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
  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [bucketStats, setBucketStats] = useState<Record<string, BucketStorageStat>>({})
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('bucketView') as 'grid' | 'list') || 'grid')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [form] = Form.useForm()

  const setView = (v: 'grid' | 'list') => { setViewMode(v); localStorage.setItem('bucketView', v) }

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
      providersApi.list().then((res) => setProviders(res.data)).catch(() => {})
    }
  }, [user?.is_admin])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: { name: string; quota_gb?: number; provider_id?: string }) => {
    setCreateLoading(true)
    try {
      await bucketsApi.create(values.name, values.quota_gb, values.provider_id)
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

  // ── Group buckets by provider + apply the provider filter ────────────────
  const providerOptions = Array.from(
    new Map(buckets.filter((b) => b.provider_id).map((b) => [b.provider_id as string, b.provider_name as string])).entries()
  ).map(([value, label]) => ({ value, label }))
  const hasUnassigned = buckets.some((b) => !b.provider_id)

  const visibleBuckets = providerFilter === 'all'
    ? buckets
    : providerFilter === 'none'
      ? buckets.filter((b) => !b.provider_id)
      : buckets.filter((b) => b.provider_id === providerFilter)

  const groupMap = new Map<string, { key: string; name: string; items: BucketInfo[] }>()
  for (const b of visibleBuckets) {
    const key = b.provider_id || 'none'
    if (!groupMap.has(key)) groupMap.set(key, { key, name: b.provider_name || 'No provider', items: [] })
    groupMap.get(key)!.items.push(b)
  }
  // Unassigned buckets sort last; the rest alphabetically by provider name.
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.key === 'none') return 1
    if (b.key === 'none') return -1
    return a.name.localeCompare(b.name)
  })

  const gridRenderItem = (bucket: BucketInfo, idx: number) => {
    const stats = bucketStats[bucket.name]
    const staggerClass = `stagger-${Math.min(idx + 1, 6)}`
    return (
      <List.Item>
        <div
          className={`animate-fade-up ${staggerClass}`}
          onClick={() => navigate(`/buckets/${bucket.name}`)}
          style={{
            background: 'linear-gradient(180deg, #141B26 0%, #121821 100%)',
            border: '1px solid #232C3A', borderRadius: 16, padding: 20, cursor: 'pointer',
            transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
            position: 'relative', overflow: 'hidden',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
            }}>
              <DatabaseOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#E6EDF3', fontWeight: 600, fontSize: 15, fontFamily: "'Fira Code', monospace", wordBreak: 'break-all', lineHeight: 1.3 }}>
                {bucket.name}
              </div>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{bucket.creation_date ? `Created ${dayjs(bucket.creation_date).format('MMM D, YYYY')}` : 'S3 bucket'}</span>
                {bucket.provider_name ? (
                  <Tag icon={<CloudServerOutlined />} color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                    {bucket.provider_name}
                  </Tag>
                ) : null}
              </div>
            </div>
            {user?.is_admin ? (
              <Popconfirm
                title={`Delete '${bucket.name}'?`} description="Bucket must be empty."
                onConfirm={(e) => { e?.stopPropagation(); handleDelete(bucket.name) }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} style={{ opacity: 0.5 }} />
              </Popconfirm>
            ) : (
              <RightOutlined style={{ color: '#334155', fontSize: 13 }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: '#0B0F17', border: '1px solid #1A2230', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Size</div>
              <div style={{ color: '#E6EDF3', fontSize: 14, fontFamily: "'Fira Code', monospace" }}>{stats ? formatBytes(stats.size) : '—'}</div>
            </div>
            <div style={{ flex: 1, background: '#0B0F17', border: '1px solid #1A2230', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Objects</div>
              <div style={{ color: '#E6EDF3', fontSize: 14, fontFamily: "'Fira Code', monospace" }}>{stats ? stats.object_count : '—'}</div>
            </div>
          </div>
        </div>
      </List.Item>
    )
  }

  const listColumns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
            <DatabaseOutlined style={{ fontSize: 14 }} />
          </span>
          <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: '#E6EDF3' }}>{v}</span>
        </span>
      ),
    },
    { title: 'Created', dataIndex: 'creation_date', key: 'created', width: 160, render: (v: string | null) => <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#94A3B8' }}>{v ? dayjs(v).format('MMM D, YYYY') : '—'}</span> },
    { title: 'Size', key: 'size', width: 120, render: (_: any, b: BucketInfo) => { const s = bucketStats[b.name]; return <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#94A3B8' }}>{s ? formatBytes(s.size) : '—'}</span> } },
    { title: 'Objects', key: 'objects', width: 100, render: (_: any, b: BucketInfo) => { const s = bucketStats[b.name]; return <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#94A3B8' }}>{s ? s.object_count : '—'}</span> } },
    ...(user?.is_admin ? [{
      title: '', key: 'actions', width: 60,
      render: (_: any, b: BucketInfo) => (
        <Popconfirm title={`Delete '${b.name}'?`} description="Bucket must be empty."
          onConfirm={(e) => { e?.stopPropagation(); handleDelete(b.name) }} onCancel={(e) => e?.stopPropagation()}>
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
        </Popconfirm>
      ),
    }] : []),
  ]

  const ProviderHeading = ({ name, count }: { name: string; count: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
        <CloudServerOutlined style={{ fontSize: 15 }} />
      </div>
      <span style={{ color: '#E6EDF3', fontWeight: 700, fontSize: 15 }}>{name}</span>
      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{count} bucket{count === 1 ? '' : 's'}</Tag>
      <div style={{ flex: 1, height: 1, background: '#1A2230' }} />
    </div>
  )

  // Bucket list view
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <Typography.Title level={3} style={{
            margin: 0, color: '#E6EDF3', fontWeight: 700, letterSpacing: '-0.01em', fontFamily: "'Inter', sans-serif", fontSize: 26,
          }}>
            Buckets
          </Typography.Title>
          <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
            {providerFilter === 'all'
              ? `${buckets.length} bucket${buckets.length !== 1 ? 's' : ''} across ${groups.length} provider${groups.length !== 1 ? 's' : ''}`
              : `${visibleBuckets.length} bucket${visibleBuckets.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {providerOptions.length > 0 && (
            <Select
              value={providerFilter}
              onChange={setProviderFilter}
              style={{ minWidth: 190 }}
              suffixIcon={<CloudServerOutlined />}
              options={[
                { value: 'all', label: 'All providers' },
                ...providerOptions,
                ...(hasUnassigned ? [{ value: 'none', label: 'No provider' }] : []),
              ]}
            />
          )}
          {user?.is_admin && (
            <Button icon={<PlusOutlined />} type="primary" onClick={() => { form.resetFields(); setCreateModal(true) }} style={{ fontWeight: 600, height: 40 }}>
              Create Bucket
            </Button>
          )}
          <Segmented
            value={viewMode}
            onChange={(v) => setView(v as 'grid' | 'list')}
            options={[
              { value: 'grid', icon: <AppstoreOutlined /> },
              { value: 'list', icon: <UnorderedListOutlined /> },
            ]}
            style={{ background: '#121821', border: '1px solid #232C3A', padding: 3 }}
          />
        </div>
      </div>

      {loading ? (
        <List loading grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }} dataSource={[]} renderItem={() => null} />
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
          <DatabaseOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} />
          <div>{buckets.length === 0 ? 'No buckets yet.' : 'No buckets for this provider.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map((g) => (
            <div key={g.key}>
              <ProviderHeading name={g.name} count={g.items.length} />
              {viewMode === 'grid' ? (
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
                  dataSource={g.items}
                  renderItem={gridRenderItem}
                />
              ) : (
                <Table
                  rowKey="name"
                  dataSource={g.items}
                  pagination={false}
                  onRow={(bucket) => ({ onClick: () => navigate(`/buckets/${bucket.name}`), style: { cursor: 'pointer' } })}
                  columns={listColumns}
                />
              )}
            </div>
          ))}
        </div>
      )}

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
            name="provider_id"
            label={<span style={{ fontSize: 13, color: '#94A3B8' }}>Storage provider</span>}
            extra={providers.length === 0 ? <span style={{ fontSize: 12, color: '#64748B' }}>No providers configured — add one under Settings → Storage Providers. The default connection will be used.</span> : undefined}
          >
            <Select
              size="large"
              allowClear
              placeholder={providers.length ? 'Use default provider' : 'Default connection'}
              disabled={providers.length === 0}
              options={providers.map((p) => ({
                value: p.id,
                label: `${p.name}${p.is_default ? ' (default)' : ''} · ${p.provider_type}`,
              }))}
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
