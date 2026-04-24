import React, { useEffect, useState } from 'react'
import { Badge, Button, Card, Descriptions, Form, Input, InputNumber, message, Progress, Space, Statistic, Switch, Table, Tooltip, Typography } from 'antd'
import { CheckCircleOutlined, CloudServerOutlined, DatabaseOutlined, EditOutlined, FileOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { settingsApi, AuthSettings, AzureAdConfig, StorageStats } from '../../api/settings'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function bytesToGb(bytes: number) {
  return bytes / (1024 * 1024 * 1024)
}

function useStorageState() {
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [storageLoading, setStorageLoading] = useState(true)
  const [editingGlobalQuota, setEditingGlobalQuota] = useState(false)
  const [globalQuotaValue, setGlobalQuotaValue] = useState<number>(0)
  const [editingBucketQuota, setEditingBucketQuota] = useState<string | null>(null)
  const [bucketQuotaValue, setBucketQuotaValue] = useState<number>(0)

  const loadStorage = () => {
    setStorageLoading(true)
    settingsApi.getStorageStats()
      .then((r) => {
        setStorage(r.data)
        setGlobalQuotaValue(bytesToGb(r.data.quota_bytes))
      })
      .catch(() => {})
      .finally(() => setStorageLoading(false))
  }

  const handleSaveGlobalQuota = async () => {
    try {
      await settingsApi.updateGlobalQuota(globalQuotaValue)
      message.success('Global quota updated')
      setEditingGlobalQuota(false)
      loadStorage()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed')
    }
  }

  const handleSaveBucketQuota = async () => {
    if (!editingBucketQuota) return
    try {
      await settingsApi.updateBucketQuota(editingBucketQuota, bucketQuotaValue)
      message.success(`Quota for '${editingBucketQuota}' updated`)
      setEditingBucketQuota(null)
      loadStorage()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed')
    }
  }

  return {
    storage, storageLoading, loadStorage,
    editingGlobalQuota, setEditingGlobalQuota, globalQuotaValue, setGlobalQuotaValue, handleSaveGlobalQuota,
    editingBucketQuota, setEditingBucketQuota, bucketQuotaValue, setBucketQuotaValue, handleSaveBucketQuota,
  }
}

function useAuthState() {
  const [authConfig, setAuthConfig] = useState<AuthSettings>({ enable_local_auth: true, enable_azure_ad: true })
  const [authLoading, setAuthLoading] = useState(true)
  const [authSaving, setAuthSaving] = useState(false)

  useEffect(() => {
    settingsApi.getAuthSettings().then((r) => { setAuthConfig(r.data); setAuthLoading(false) })
  }, [])

  const handleSaveAuth = async () => {
    if (!authConfig.enable_local_auth && !authConfig.enable_azure_ad) {
      message.warning('At least one authentication method must be enabled')
      return
    }
    setAuthSaving(true)
    try {
      const res = await settingsApi.updateAuthSettings(authConfig)
      setAuthConfig(res.data)
      message.success('Saved')
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to save')
    } finally {
      setAuthSaving(false)
    }
  }

  return { authConfig, setAuthConfig, authLoading, authSaving, handleSaveAuth }
}

function useAzureState() {
  const [azureConfig, setAzureConfig] = useState<AzureAdConfig | null>(null)
  const [azureLoading, setAzureLoading] = useState(true)
  const [azureSaving, setAzureSaving] = useState(false)
  const [azureEditing, setAzureEditing] = useState(false)
  const [azureForm] = Form.useForm()

  useEffect(() => {
    settingsApi.getAzureSettings().then((r) => {
      setAzureConfig(r.data)
      azureForm.setFieldsValue({
        tenant_id: r.data.tenant_id,
        client_id: r.data.client_id,
        redirect_uri: r.data.redirect_uri,
      })
      setAzureLoading(false)
    })
  }, [])

  const handleSaveAzure = async (values: any) => {
    setAzureSaving(true)
    try {
      const payload: any = {
        tenant_id: values.tenant_id,
        client_id: values.client_id,
        redirect_uri: values.redirect_uri,
      }
      if (values.client_secret) payload.client_secret = values.client_secret
      const res = await settingsApi.updateAzureSettings(payload)
      setAzureConfig(res.data)
      azureForm.setFieldValue('client_secret', '')
      setAzureEditing(false)
      message.success('Azure AD configuration saved')
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to save Azure settings')
    } finally {
      setAzureSaving(false)
    }
  }

  return { azureConfig, azureLoading, azureSaving, azureEditing, setAzureEditing, azureForm, handleSaveAzure }
}

function StorageCard({ state }: { state: ReturnType<typeof useStorageState> }) {
  const {
    storage, storageLoading, loadStorage,
    editingGlobalQuota, setEditingGlobalQuota, globalQuotaValue, setGlobalQuotaValue, handleSaveGlobalQuota,
    editingBucketQuota, setEditingBucketQuota, bucketQuotaValue, setBucketQuotaValue, handleSaveBucketQuota,
  } = state

  const globalPct = storage && storage.quota_bytes > 0
    ? Math.min(100, Math.round((storage.total_size / storage.quota_bytes) * 100))
    : 0

  const bucketColumns = [
    {
      title: 'Bucket',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <><DatabaseOutlined style={{ marginRight: 6 }} />{v}</>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (v: number) => formatBytes(v),
      sorter: (a: any, b: any) => a.size - b.size,
    },
    {
      title: 'Objects',
      dataIndex: 'object_count',
      key: 'object_count',
      width: 80,
      sorter: (a: any, b: any) => a.object_count - b.object_count,
    },
    {
      title: 'Quota',
      key: 'quota',
      width: 120,
      render: (_: any, record: any) => {
        if (editingBucketQuota === record.name) {
          return (
            <Space size={4}>
              <InputNumber
                size="small"
                min={0}
                step={0.5}
                value={bucketQuotaValue}
                onChange={(v) => setBucketQuotaValue(v || 0)}
                style={{ width: 70 }}
                suffix="GB"
              />
              <Button size="small" type="primary" onClick={handleSaveBucketQuota}>OK</Button>
              <Button size="small" onClick={() => setEditingBucketQuota(null)}>X</Button>
            </Space>
          )
        }
        const quotaGb = record.quota_bytes > 0 ? bytesToGb(record.quota_bytes) : 0
        return (
          <Space size={4}>
            <Typography.Text>{quotaGb > 0 ? `${quotaGb} GB` : 'No limit'}</Typography.Text>
            <Tooltip title="Edit quota">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => { setEditingBucketQuota(record.name); setBucketQuotaValue(quotaGb) }}
              />
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 150,
      render: (_: any, record: any) => {
        if (record.quota_bytes > 0) {
          const pct = Math.min(100, Math.round((record.size / record.quota_bytes) * 100))
          return <Progress percent={pct} size="small" status={pct >= 90 ? 'exception' : 'normal'} />
        }
        const pct = storage && storage.total_size > 0
          ? Math.round((record.size / storage.total_size) * 100)
          : 0
        return <Progress percent={pct} size="small" strokeColor="#d9d9d9" />
      },
    },
  ]

  return (
    <Card
      title={<><CloudServerOutlined style={{ marginRight: 8 }} />S3 Storage</>}
      loading={storageLoading}
      extra={<Button icon={<ReloadOutlined />} size="small" onClick={loadStorage} loading={storageLoading}>Refresh</Button>}
    >
      {storage && (
        <>
          <Space size="large" style={{ marginBottom: 16 }}>
            <Statistic title="Used" value={formatBytes(storage.total_size)} />
            {storage.quota_bytes > 0 && (
              <Statistic title="Limit" value={formatBytes(storage.quota_bytes)} />
            )}
            <Statistic title="Objects" value={storage.total_objects} prefix={<FileOutlined />} />
            <Statistic title="Buckets" value={storage.bucket_count} prefix={<DatabaseOutlined />} />
          </Space>

          {storage.quota_bytes > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Global usage: {formatBytes(storage.total_size)} / {formatBytes(storage.quota_bytes)}
              </Typography.Text>
              <Progress
                percent={globalPct}
                status={globalPct >= 90 ? 'exception' : 'normal'}
                strokeWidth={12}
              />
            </div>
          )}

          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
            <Space>
              <Typography.Text strong>Global Storage Limit:</Typography.Text>
              {editingGlobalQuota ? (
                <>
                  <InputNumber
                    min={0}
                    step={1}
                    value={globalQuotaValue}
                    onChange={(v) => setGlobalQuotaValue(v || 0)}
                    style={{ width: 100 }}
                    addonAfter="GB"
                  />
                  <Button size="small" type="primary" onClick={handleSaveGlobalQuota}>Save</Button>
                  <Button size="small" onClick={() => setEditingGlobalQuota(false)}>Cancel</Button>
                  <Typography.Text type="secondary">(0 = unlimited)</Typography.Text>
                </>
              ) : (
                <>
                  <Typography.Text>
                    {storage.quota_bytes > 0 ? `${bytesToGb(storage.quota_bytes)} GB` : 'Unlimited'}
                  </Typography.Text>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setEditingGlobalQuota(true)}>Edit</Button>
                </>
              )}
            </Space>
          </div>

          <Table
            rowKey="name"
            columns={bucketColumns}
            dataSource={storage.buckets}
            pagination={false}
            size="small"
          />
        </>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const { authConfig, setAuthConfig, authLoading, authSaving, handleSaveAuth } = useAuthState()
  const { azureConfig, azureLoading, azureSaving, azureEditing, setAzureEditing, azureForm, handleSaveAzure } = useAzureState()
  const storageState = useStorageState()

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#504945', fontSize: 11, fontFamily: "'Fira Code', monospace", letterSpacing: '0.06em', marginBottom: 4 }}>// admin / settings</div>
        <Typography.Title level={3} style={{ margin: 0, color: '#ebdbb2', fontWeight: 700, fontSize: 22, fontFamily: "'Fira Sans', sans-serif" }}>Settings</Typography.Title>
        <div style={{ color: '#928374', fontSize: 12, marginTop: 2, fontFamily: "'Fira Code', monospace" }}>auth &amp; storage configuration</div>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 800 }}>
        <StorageCard state={storageState} />

        {/* Auth method toggles */}
        <Card title="Authentication Methods" loading={authLoading}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <div>
                <Typography.Text strong>Local Authentication</Typography.Text>
                <br />
                <Typography.Text type="secondary">Email + password login</Typography.Text>
              </div>
              <Switch
                checked={authConfig.enable_local_auth}
                onChange={(v) => setAuthConfig((c) => ({ ...c, enable_local_auth: v }))}
              />
            </Space>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <div>
                <Typography.Text strong>Azure AD Authentication</Typography.Text>
                <br />
                <Typography.Text type="secondary">Microsoft Entra (OAuth2)</Typography.Text>
              </div>
              <Switch
                checked={authConfig.enable_azure_ad}
                onChange={(v) => setAuthConfig((c) => ({ ...c, enable_azure_ad: v }))}
              />
            </Space>
            <Button type="primary" onClick={handleSaveAuth} loading={authSaving}>
              Save
            </Button>
          </Space>
        </Card>

        {/* Azure AD config */}
        <Card
          title="Azure AD Configuration"
          loading={azureLoading}
          extra={
            azureConfig && !azureEditing && (
              <Button size="small" icon={<EditOutlined />} onClick={() => {
                azureForm.setFieldsValue({
                  tenant_id: azureConfig.tenant_id,
                  client_id: azureConfig.client_id,
                  redirect_uri: azureConfig.redirect_uri,
                  client_secret: '',
                })
                setAzureEditing(true)
              }}>
                Edit
              </Button>
            )
          }
        >
          {azureConfig && !azureEditing ? (
            <>
              {/* Connected status */}
              {azureConfig.tenant_id && azureConfig.client_id && azureConfig.has_secret ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(82,196,26,0.08)', border: '1px solid rgba(82,196,26,0.2)', borderRadius: 6 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                  <Typography.Text style={{ color: '#52c41a' }}>Connected</Typography.Text>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(250,173,20,0.08)', border: '1px solid rgba(250,173,20,0.2)', borderRadius: 6 }}>
                  <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
                  <Typography.Text style={{ color: '#faad14' }}>Not configured</Typography.Text>
                </div>
              )}
              <Descriptions column={1} size="small" labelStyle={{ color: '#928374', width: 130 }}>
                <Descriptions.Item label="Tenant ID">
                  <Typography.Text copyable={{ text: azureConfig.tenant_id }} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                    {azureConfig.tenant_id || <Typography.Text type="secondary">—</Typography.Text>}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Client ID">
                  <Typography.Text copyable={{ text: azureConfig.client_id }} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                    {azureConfig.client_id || <Typography.Text type="secondary">—</Typography.Text>}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Client Secret">
                  {azureConfig.has_secret
                    ? <Badge status="success" text="Configured" />
                    : <Badge status="default" text="Not set" />
                  }
                </Descriptions.Item>
                <Descriptions.Item label="Redirect URI">
                  <Typography.Text copyable={{ text: azureConfig.redirect_uri }} style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                    {azureConfig.redirect_uri || <Typography.Text type="secondary">—</Typography.Text>}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </>
          ) : (
            <Form form={azureForm} layout="vertical" onFinish={handleSaveAzure}>
              <Form.Item
                name="tenant_id"
                label="Tenant ID"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Form.Item>
              <Form.Item
                name="client_id"
                label="Client ID (Application ID)"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Form.Item>
              <Form.Item
                name="client_secret"
                label="Client Secret"
                extra={azureConfig?.has_secret ? 'A secret is already configured. Leave empty to keep it.' : 'No secret configured yet.'}
              >
                <Input.Password placeholder={azureConfig?.has_secret ? '••••••••••••••••' : 'Enter client secret'} />
              </Form.Item>
              <Form.Item
                name="redirect_uri"
                label="Redirect URI"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="https://yourdomain.com/auth/callback" />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={azureSaving}>
                  Save
                </Button>
                {azureConfig && (
                  <Button onClick={() => setAzureEditing(false)}>Cancel</Button>
                )}
              </Space>
            </Form>
          )}
        </Card>
      </Space>
    </div>
  )
}
