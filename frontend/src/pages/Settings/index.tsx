import React, { useEffect, useState } from 'react'
import {
  Button, Card, Drawer, Form, Input, InputNumber, message, Progress,
  Segmented, Space, Switch, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  ApiOutlined, CloudOutlined, CloudServerOutlined, DatabaseOutlined,
  EditOutlined, HddOutlined, LockOutlined, MailOutlined, PlusOutlined, ReloadOutlined,
  SafetyOutlined, WindowsFilled,
} from '@ant-design/icons'
import {
  AuthProvider, AzureAdConfig, S3Connection, settingsApi, StorageStats,
} from '../../api/settings'

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
const bytesToGb = (b: number) => b / (1024 ** 3)
const mono = { fontFamily: "'Fira Code', monospace" }

const PROVIDERS = [
  { value: 'aws', label: 'AWS S3', icon: <CloudOutlined /> },
  { value: 'minio', label: 'MinIO', icon: <HddOutlined /> },
  { value: 'custom', label: 'Custom', icon: <CloudServerOutlined /> },
]

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', fontSize: 18 }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#E6EDF3', fontWeight: 700, fontSize: 17 }}>{title}</div>
        {subtitle && <div style={{ color: '#94A3B8', fontSize: 13 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

const fieldLabel = (t: string) => <span style={{ color: '#94A3B8', fontSize: 13 }}>{t}</span>

/* ── Storage connection card + edit drawer ───────────────────────────────── */
function StorageConnection() {
  const [conn, setConn] = useState<S3Connection | null>(null)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('aws')
  const [useSsl, setUseSsl] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = () => settingsApi.getS3Connection().then((r) => { setConn(r.data) }).catch(() => {})
  useEffect(() => { load() }, [])

  const openDrawer = () => {
    if (!conn) return
    setProvider(conn.provider || 'aws')
    setUseSsl(conn.use_ssl)
    form.setFieldsValue({
      access_key_id: conn.configured ? conn.access_key_id : '',
      region: conn.region || 'us-east-1',
      endpoint_url: conn.endpoint_url,
      presigned_base: conn.presigned_base,
      secret_access_key: '',
    })
    setOpen(true)
  }

  const buildPayload = (values: any) => ({
    provider,
    access_key_id: values.access_key_id,
    secret_access_key: values.secret_access_key || undefined,
    region: values.region || 'us-east-1',
    endpoint_url: provider === 'aws' ? '' : (values.endpoint_url || ''),
    presigned_base: values.presigned_base || '',
    use_ssl: useSsl,
  })

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      const res = await settingsApi.testS3Connection(buildPayload(values))
      res.data.ok ? message.success('Connection successful') : message.error(res.data.error || 'Connection failed')
    } catch (e: any) { if (!e?.errorFields) message.error('Connection test failed') }
    finally { setTesting(false) }
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const res = await settingsApi.updateS3Connection(buildPayload(values))
      setConn(res.data); setOpen(false); message.success('Storage connection saved')
    } catch (e: any) { message.error(e.response?.data?.detail || 'Failed to save connection') }
    finally { setSaving(false) }
  }

  const providerLabel = conn ? (PROVIDERS.find((p) => p.value === conn.provider)?.label || conn.provider) : ''
  const showEndpoint = provider !== 'aws'
  const editingSecret = conn?.configured && conn?.has_secret

  return (
    <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', fontSize: 22, flexShrink: 0 }}>
              <CloudServerOutlined />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#E6EDF3', fontWeight: 600, fontSize: 15 }}>{conn?.configured ? providerLabel : 'Not connected'}</span>
                {conn?.configured
                  ? <Tag color="success" style={{ borderRadius: 6, margin: 0 }}>Connected</Tag>
                  : <Tag color="warning" style={{ borderRadius: 6, margin: 0 }}>Using env defaults</Tag>}
              </div>
              <div style={{ ...mono, color: '#94A3B8', fontSize: 12, marginTop: 6 }}>
                {conn?.endpoint_url || (conn ? `https://s3.${conn.region}.amazonaws.com` : '—')}
              </div>
              <div style={{ ...mono, color: '#64748B', fontSize: 12, marginTop: 2 }}>
                {conn?.access_key_id ? conn.access_key_id.slice(0, 6) + '••••••••' : '—'} · {conn?.region}
              </div>
            </div>
          </div>
          <Button type="primary" ghost icon={conn?.configured ? <EditOutlined /> : <PlusOutlined />} onClick={openDrawer} style={{ flexShrink: 0 }}>
            {conn?.configured ? 'Edit' : 'Connect'}
          </Button>
        </div>
      </Card>

      <Drawer
        title={conn?.configured ? 'Edit Storage Connection' : 'Connect to Storage'}
        open={open}
        onClose={() => setOpen(false)}
        width={460}
        destroyOnClose
      >
        <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 20 }}>Enter your credentials to access your buckets.</div>

        <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>PROVIDER</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
          {PROVIDERS.map((p) => {
            const active = provider === p.value
            return (
              <div key={p.value} onClick={() => setProvider(p.value)} style={{
                cursor: 'pointer', textAlign: 'center', padding: '14px 6px', borderRadius: 10,
                background: active ? 'rgba(59,130,246,0.12)' : '#1A2230',
                border: `1px solid ${active ? '#3B82F6' : '#232C3A'}`,
                color: active ? '#60A5FA' : '#94A3B8', transition: 'all 150ms ease',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</div>
              </div>
            )
          })}
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Form.Item name="access_key_id" label={fieldLabel('Access Key ID')} rules={[{ required: true, message: 'Required' }]}>
            <Input prefix={<ApiOutlined style={{ color: '#64748B' }} />} placeholder="AKIAIOSFODNN7EXAMPLE" style={{ height: 44, ...mono }} />
          </Form.Item>
          <Form.Item name="secret_access_key" label={fieldLabel('Secret Access Key')}
            rules={editingSecret ? [] : [{ required: true, message: 'Required' }]}
            extra={editingSecret ? 'A secret is already stored. Leave empty to keep it.' : undefined}>
            <Input.Password prefix={<LockOutlined style={{ color: '#64748B' }} />} placeholder={editingSecret ? '••••••••••••••••' : 'Enter secret key'} style={{ height: 44, ...mono }} />
          </Form.Item>
          <Form.Item name="region" label={fieldLabel('Region')} initialValue="us-east-1">
            <Input placeholder="us-east-1" style={{ height: 44, ...mono }} />
          </Form.Item>
          {showEndpoint && (
            <Form.Item name="endpoint_url" label={fieldLabel('Endpoint URL')} rules={[{ required: true, message: 'Endpoint is required for MinIO / Custom' }]}>
              <Input placeholder="http://minio:9000" style={{ height: 44, ...mono }} />
            </Form.Item>
          )}
          <Form.Item name="presigned_base" label={fieldLabel('Presigned URL Base (optional)')} extra="External URL the browser uses to reach storage for uploads.">
            <Input placeholder="https://minio.example.com" style={{ height: 44, ...mono }} />
          </Form.Item>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 22px' }}>
            <SafetyOutlined style={{ color: '#64748B' }} />
            <span style={{ color: '#94A3B8', fontSize: 14, flex: 1 }}>Use SSL / HTTPS</span>
            <Switch checked={useSsl} onChange={setUseSsl} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button style={{ flex: 1 }} onClick={handleTest} loading={testing}>Test</Button>
            <Button style={{ flex: 1 }} type="primary" htmlType="submit" loading={saving}>Save</Button>
          </div>
        </Form>
      </Drawer>
    </>
  )
}

/* ── Storage usage / quotas ──────────────────────────────────────────────── */
function StorageUsage() {
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editGlobal, setEditGlobal] = useState(false)
  const [globalVal, setGlobalVal] = useState(0)
  const [editBucket, setEditBucket] = useState<string | null>(null)
  const [bucketVal, setBucketVal] = useState(0)

  const load = () => {
    setLoading(true)
    settingsApi.getStorageStats().then((r) => { setStorage(r.data); setGlobalVal(bytesToGb(r.data.quota_bytes)) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const saveGlobal = async () => {
    try { await settingsApi.updateGlobalQuota(globalVal); message.success('Global quota updated'); setEditGlobal(false); load() }
    catch (e: any) { message.error(e.response?.data?.detail || 'Failed') }
  }
  const saveBucket = async () => {
    if (!editBucket) return
    try { await settingsApi.updateBucketQuota(editBucket, bucketVal); message.success('Quota updated'); setEditBucket(null); load() }
    catch (e: any) { message.error(e.response?.data?.detail || 'Failed') }
  }

  const globalPct = storage && storage.quota_bytes > 0 ? Math.min(100, Math.round((storage.total_size / storage.quota_bytes) * 100)) : 0

  const columns = [
    { title: 'Bucket', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ ...mono, fontSize: 12 }}><DatabaseOutlined style={{ marginRight: 6, color: '#60A5FA' }} />{v}</span> },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 110, render: (v: number) => <span style={{ ...mono, fontSize: 12, color: '#94A3B8' }}>{formatBytes(v)}</span>, sorter: (a: any, b: any) => a.size - b.size },
    { title: 'Objects', dataIndex: 'object_count', key: 'oc', width: 80, render: (v: number) => <span style={{ ...mono, fontSize: 12, color: '#94A3B8' }}>{v}</span> },
    {
      title: 'Quota', key: 'quota', width: 160,
      render: (_: any, r: any) => {
        if (editBucket === r.name) return (
          <Space size={4}><InputNumber size="small" min={0} step={0.5} value={bucketVal} onChange={(v) => setBucketVal(v || 0)} style={{ width: 70 }} />
            <Button size="small" type="primary" onClick={saveBucket}>OK</Button><Button size="small" onClick={() => setEditBucket(null)}>✕</Button></Space>
        )
        const q = r.quota_bytes > 0 ? bytesToGb(r.quota_bytes) : 0
        return <Space size={6}><span style={{ color: '#94A3B8' }}>{q > 0 ? `${q} GB` : 'No limit'}</span>
          <Tooltip title="Edit quota"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditBucket(r.name); setBucketVal(q) }} /></Tooltip></Space>
      },
    },
    {
      title: 'Usage', key: 'usage', width: 160,
      render: (_: any, r: any) => {
        if (r.quota_bytes > 0) { const p = Math.min(100, Math.round((r.size / r.quota_bytes) * 100)); return <Progress percent={p} size="small" status={p >= 90 ? 'exception' : 'normal'} /> }
        const p = storage && storage.total_size > 0 ? Math.round((r.size / storage.total_size) * 100) : 0
        return <Progress percent={p} size="small" strokeColor="#334155" />
      },
    },
  ]

  return (
    <Card loading={loading} title={<span style={{ color: '#E6EDF3' }}>Storage Usage</span>}
      extra={<Button icon={<ReloadOutlined />} size="small" onClick={load}>Refresh</Button>}>
      {storage && (
        <>
          <div style={{ display: 'flex', gap: 28, marginBottom: 18, flexWrap: 'wrap' }}>
            {[['Used', formatBytes(storage.total_size)], ['Objects', String(storage.total_objects)], ['Buckets', String(storage.bucket_count)],
              ['Limit', storage.quota_bytes > 0 ? formatBytes(storage.quota_bytes) : 'Unlimited']].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                <div style={{ ...mono, color: '#E6EDF3', fontSize: 20, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 14px', background: '#1A2230', border: '1px solid #232C3A', borderRadius: 8 }}>
            <span style={{ color: '#E6EDF3', fontWeight: 500 }}>Global storage limit</span>
            {editGlobal ? (
              <Space>
                <InputNumber min={0} step={1} value={globalVal} onChange={(v) => setGlobalVal(v || 0)} style={{ width: 110 }} addonAfter="GB" />
                <Button size="small" type="primary" onClick={saveGlobal}>Save</Button>
                <Button size="small" onClick={() => setEditGlobal(false)}>Cancel</Button>
                <Typography.Text type="secondary">(0 = unlimited)</Typography.Text>
              </Space>
            ) : (
              <Space>
                <span style={{ ...mono, color: '#94A3B8' }}>{storage.quota_bytes > 0 ? `${bytesToGb(storage.quota_bytes)} GB` : 'Unlimited'}</span>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditGlobal(true)}>Edit</Button>
              </Space>
            )}
            {storage.quota_bytes > 0 && <div style={{ flex: 1, minWidth: 120 }}><Progress percent={globalPct} status={globalPct >= 90 ? 'exception' : 'normal'} /></div>}
          </div>

          <Table rowKey="name" columns={columns} dataSource={storage.buckets} pagination={false} size="small" />
        </>
      )}
    </Card>
  )
}

/* ── Auth method row ─────────────────────────────────────────────────────── */
function MethodRow(opts: {
  icon: React.ReactNode; name: string; desc: string; enabled: boolean
  onToggle?: (v: boolean) => void; badge?: React.ReactNode; onConfigure?: () => void; loading?: boolean
}) {
  return (
    <div style={{ background: '#121821', border: '1px solid #232C3A', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: '#0B0F17', border: '1px solid #232C3A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 18, flexShrink: 0 }}>{opts.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{opts.name}</span>
            {opts.badge}
          </div>
          <div style={{ color: '#94A3B8', fontSize: 13 }}>{opts.desc}</div>
        </div>
        {opts.onConfigure && <Button type="primary" ghost size="small" icon={<EditOutlined />} onClick={opts.onConfigure}>Configure</Button>}
        {opts.onToggle && <Switch checked={opts.enabled} onChange={opts.onToggle} loading={opts.loading} />}
      </div>
    </div>
  )
}

/* ── Auth methods section ────────────────────────────────────────────────── */
const PROVIDER_FIELDS: Record<string, { key: string; label: string; textarea?: boolean }[]> = {
  github: [{ key: 'client_id', label: 'Client ID' }, { key: 'callback_url', label: 'Callback URL' }],
  saml: [{ key: 'entity_id', label: 'Entity ID' }, { key: 'sso_url', label: 'SSO URL' }, { key: 'certificate', label: 'Certificate', textarea: true }],
}

function AuthMethods() {
  const [localEnabled, setLocalEnabled] = useState(true)
  const [entraEnabled, setEntraEnabled] = useState(false)
  const [azure, setAzure] = useState<AzureAdConfig | null>(null)
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [savingAuth, setSavingAuth] = useState(false)
  // drawer: { kind: 'azure' | providerId }
  const [drawer, setDrawer] = useState<string | null>(null)
  const [azureForm] = Form.useForm()
  const [provForm] = Form.useForm()

  const load = () => {
    settingsApi.getAuthSettings().then((r) => { setLocalEnabled(r.data.enable_local_auth); setEntraEnabled(r.data.enable_azure_ad) })
    settingsApi.getAzureSettings().then((r) => setAzure(r.data))
    settingsApi.getAuthProviders().then((r) => setProviders(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const saveToggles = async (local: boolean, entra: boolean) => {
    if (!local && !entra && !providers.some((p) => p.enabled)) { message.warning('At least one method must be enabled'); return }
    setSavingAuth(true)
    try { await settingsApi.updateAuthSettings({ enable_local_auth: local, enable_azure_ad: entra }); setLocalEnabled(local); setEntraEnabled(entra) }
    catch (e: any) { message.error(e.response?.data?.detail || 'Failed'); load() }
    finally { setSavingAuth(false) }
  }

  const openAzure = () => {
    azureForm.setFieldsValue({ tenant_id: azure?.tenant_id, client_id: azure?.client_id, redirect_uri: azure?.redirect_uri, client_secret: '' })
    setDrawer('azure')
  }
  const saveAzure = async (values: any) => {
    try {
      const payload: any = { tenant_id: values.tenant_id, client_id: values.client_id, redirect_uri: values.redirect_uri }
      if (values.client_secret) payload.client_secret = values.client_secret
      const res = await settingsApi.updateAzureSettings(payload)
      setAzure(res.data); setDrawer(null); message.success('Microsoft Entra saved')
    } catch (e: any) { message.error(e.response?.data?.detail || 'Failed') }
  }

  const openProvider = (p: AuthProvider) => { provForm.setFieldsValue({ ...p.config, secret: '' }); setDrawer(p.id) }
  const saveProvider = async (p: AuthProvider, values: any) => {
    const fields = PROVIDER_FIELDS[p.id] || []
    const config: Record<string, string> = {}
    for (const f of fields) if (values[f.key]) config[f.key] = values[f.key]
    try {
      await settingsApi.updateAuthProvider(p.id, { enabled: p.enabled, config, secret: values.secret || undefined })
      message.success(`${p.name} saved`); setDrawer(null); load()
    } catch (e: any) { message.error(e.response?.data?.detail || 'Failed') }
  }
  const toggleProvider = async (p: AuthProvider, v: boolean) => {
    try { await settingsApi.updateAuthProvider(p.id, { enabled: v, config: p.config, secret: undefined }); load() }
    catch { message.error('Failed') }
  }

  const activeProvider = providers.find((p) => p.id === drawer)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MethodRow icon={<MailOutlined />} name="Local Authentication" desc="Email + password sign-in"
        enabled={localEnabled} onToggle={(v) => saveToggles(v, entraEnabled)} loading={savingAuth} />

      <MethodRow icon={<WindowsFilled />} name="Microsoft Entra" desc="Microsoft Entra ID (OAuth2 / OIDC)"
        enabled={entraEnabled} onToggle={(v) => saveToggles(localEnabled, v)} loading={savingAuth}
        onConfigure={openAzure}
        badge={azure?.has_secret && azure?.client_id ? <Tag color="success" style={{ borderRadius: 6, margin: 0 }}>Configured</Tag> : <Tag style={{ borderRadius: 6, margin: 0 }}>Not configured</Tag>} />

      {providers.map((p) => (
        <MethodRow key={p.id} icon={p.id === 'github' ? <ApiOutlined /> : <SafetyOutlined />}
          name={p.name} desc={p.type === 'saml' ? 'SAML 2.0 single sign-on' : 'OAuth2 sign-in'}
          enabled={p.enabled} onToggle={(v) => toggleProvider(p, v)} onConfigure={() => openProvider(p)}
          badge={<Tag color={p.configured ? 'success' : 'default'} style={{ borderRadius: 6, margin: 0 }}>{p.configured ? 'Configured' : 'Not configured'}</Tag>} />
      ))}

      {/* Azure drawer */}
      <Drawer title="Configure Microsoft Entra" open={drawer === 'azure'} onClose={() => setDrawer(null)} width={460} destroyOnClose>
        <Form form={azureForm} layout="vertical" onFinish={saveAzure} requiredMark={false}>
          <Form.Item name="tenant_id" label={fieldLabel('Tenant ID')} rules={[{ required: true }]}><Input style={mono} /></Form.Item>
          <Form.Item name="client_id" label={fieldLabel('Client ID')} rules={[{ required: true }]}><Input style={mono} /></Form.Item>
          <Form.Item name="client_secret" label={fieldLabel('Client Secret')} extra={azure?.has_secret ? 'Leave empty to keep existing.' : undefined}>
            <Input.Password placeholder={azure?.has_secret ? '••••••••' : 'Enter secret'} style={mono} />
          </Form.Item>
          <Form.Item name="redirect_uri" label={fieldLabel('Redirect URI')} rules={[{ required: true }]}><Input style={mono} /></Form.Item>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button style={{ flex: 1 }} onClick={() => setDrawer(null)}>Cancel</Button>
            <Button style={{ flex: 1 }} type="primary" htmlType="submit">Save</Button>
          </div>
        </Form>
      </Drawer>

      {/* Provider drawer */}
      <Drawer title={activeProvider ? `Configure ${activeProvider.name}` : ''} open={!!activeProvider} onClose={() => setDrawer(null)} width={460} destroyOnClose>
        {activeProvider && (
          <Form form={provForm} layout="vertical" onFinish={(v) => saveProvider(activeProvider, v)} requiredMark={false}>
            {(PROVIDER_FIELDS[activeProvider.id] || []).map((f) => (
              <Form.Item key={f.key} name={f.key} label={fieldLabel(f.label)}>
                {f.textarea ? <Input.TextArea rows={4} style={mono} /> : <Input style={mono} />}
              </Form.Item>
            ))}
            <Form.Item name="secret" label={fieldLabel(activeProvider.type === 'saml' ? 'Private Key (optional)' : 'Client Secret')} extra={activeProvider.has_secret ? 'Leave empty to keep existing.' : undefined}>
              <Input.Password placeholder={activeProvider.has_secret ? '••••••••' : 'Enter secret'} style={mono} />
            </Form.Item>
            <div style={{ color: '#64748B', fontSize: 12, marginBottom: 16 }}>Note: config is stored; the login flow for this provider is not wired yet.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button style={{ flex: 1 }} onClick={() => setDrawer(null)}>Cancel</Button>
              <Button style={{ flex: 1 }} type="primary" htmlType="submit">Save</Button>
            </div>
          </Form>
        )}
      </Drawer>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [tab, setTab] = useState<string | number>('storage')
  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#E6EDF3', fontWeight: 700, fontSize: 26 }}>Settings</Typography.Title>
        <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>Manage storage connections and authentication.</div>
      </div>

      <Segmented
        block
        size="large"
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Storage', value: 'storage', icon: <CloudServerOutlined /> },
          { label: 'Authentication', value: 'auth', icon: <SafetyOutlined /> },
        ]}
        style={{ marginBottom: 24, padding: 4, background: '#121821', border: '1px solid #232C3A', borderRadius: 12 }}
      />

      {tab === 'storage' ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <SectionTitle icon={<CloudServerOutlined />} title="Storage Connection" subtitle="The S3-compatible backend s3BEAR connects to." />
            <StorageConnection />
          </div>
          <StorageUsage />
        </Space>
      ) : (
        <div>
          <SectionTitle icon={<SafetyOutlined />} title="Authentication Methods" subtitle="Enable and configure how users sign in." />
          <AuthMethods />
        </div>
      )}
    </div>
  )
}
