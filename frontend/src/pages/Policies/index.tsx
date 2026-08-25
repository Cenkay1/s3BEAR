import { useEffect, useState } from 'react'
import {
  AutoComplete,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { policiesApi, CleanupPolicy, PolicyCreate, PolicyTargetType } from '../../api/admin'
import { bucketsApi } from '../../api/buckets'
import { C, mono, PageHeader, EditDrawer, RowActions } from '../../components/ui'
import dayjs from 'dayjs'

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<CleanupPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<CleanupPolicy | null>(null)
  const [targetType, setTargetType] = useState<PolicyTargetType>('pattern')
  const [tagKey, setTagKey] = useState('')
  const [suggest, setSuggest] = useState<Record<string, string[]>>({})
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    policiesApi.list().then((r) => { setPolicies(r.data); setLoading(false) })
    bucketsApi.suggestTags().then((r) => setSuggest(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditPolicy(null)
    form.resetFields()
    setTargetType('pattern')
    setTagKey('')
    setModalOpen(true)
  }
  const openEdit = (p: CleanupPolicy) => {
    setEditPolicy(p)
    setTargetType(p.target_type)
    setTagKey(p.tag_key || '')
    form.setFieldsValue({
      name: p.name,
      bucket_patterns: p.bucket_patterns,
      tag_key: p.tag_key || undefined,
      tag_value: p.tag_value || undefined,
      prefix_filter: p.prefix_filter,
      older_than_days: p.older_than_days,
      cron_expression: p.cron_expression,
      is_active: p.is_active,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    // Build a clean, mutually-exclusive payload for the chosen mode.
    const payload: PolicyCreate = {
      name: values.name,
      target_type: targetType,
      bucket_patterns: targetType === 'pattern' ? (values.bucket_patterns || []) : [],
      tag_key: targetType === 'tag' ? (values.tag_key || null) : null,
      tag_value: targetType === 'tag' ? (values.tag_value || null) : null,
      prefix_filter: values.prefix_filter || null,
      older_than_days: values.older_than_days ?? null,
      cron_expression: values.cron_expression,
      is_active: values.is_active,
    }
    try {
      if (editPolicy) {
        await policiesApi.update(editPolicy.id, payload)
        message.success('Policy updated')
      } else {
        await policiesApi.create(payload)
        message.success('Policy created')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Error')
    }
  }

  const handleRun = async (id: string) => {
    try {
      const r = await policiesApi.run(id)
      message.success(`Run complete: deleted ${(r.data as any).deleted_count} objects`)
      load()
    } catch {
      message.error('Run failed')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ color: C.text, fontWeight: 600 }}>{v}</span> },
    {
      title: 'Target',
      key: 'target',
      render: (_: any, r: CleanupPolicy) => r.target_type === 'tag'
        ? <Tag color="purple" style={{ ...mono, fontSize: 11 }}>tag: {r.tag_key}{r.tag_value ? `=${r.tag_value}` : ' (any)'}</Tag>
        : <Space size={4} wrap>{r.bucket_patterns.map((p) => <Tag key={p} style={{ ...mono, fontSize: 11 }}>{p}</Tag>)}</Space>,
    },
    { title: 'Older Than', dataIndex: 'older_than_days', render: (v: any) => v ? `${v} days` : '-' },
    { title: 'Cron', dataIndex: 'cron_expression', render: (v: string) => <span style={{ ...mono, fontSize: 12, color: C.muted }}>{v}</span> },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: CleanupPolicy) => (
        <Space>
          <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? 'Active' : 'Inactive'}</Tag>
          {r.last_run_status && (
            <Tag color={r.last_run_status === 'success' ? 'blue' : 'orange'}>{r.last_run_status}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Last Run',
      dataIndex: 'last_run_at',
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      render: (_: any, r: CleanupPolicy) => (
        <RowActions actions={[
          { key: 'run', label: 'Run now', icon: <PlayCircleOutlined />, onClick: () => handleRun(r.id) },
          { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: () => openEdit(r) },
          { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true, confirm: `Delete '${r.name}'?`, onClick: () => deleteRow(r.id) },
        ]} />
      ),
    },
  ]

  const deleteRow = (id: string) => {
    policiesApi.delete(id).then(() => { message.success('Deleted'); load() })
  }

  const handleDelete = () => {
    if (!editPolicy) return
    policiesApi.delete(editPolicy.id).then(() => { message.success('Deleted'); setModalOpen(false); load() })
  }

  const keyOptions = Object.keys(suggest).map((k) => ({ value: k }))
  const valueOptions = (suggest[tagKey] || []).map((v) => ({ value: v }))

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle={`${policies.length} cleanup polic${policies.length !== 1 ? 'ies' : 'y'}`}
        actions={<Button icon={<PlusOutlined />} type="primary" onClick={openCreate} style={{ fontWeight: 600, height: 40 }}>New Policy</Button>}
      />
      <Table rowKey="id" columns={columns} dataSource={policies} loading={loading} />

      <EditDrawer
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPolicy ? `Edit ${editPolicy.name}` : 'New Policy'}
        onSubmit={() => form.submit()}
        submitLabel={editPolicy ? 'Save' : 'Create'}
        onDelete={editPolicy ? handleDelete : undefined}
        deleteLabel="Delete policy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>

          {/* Targeting mode — pick exactly one */}
          <Form.Item label="Target buckets by">
            <Segmented
              block
              value={targetType}
              onChange={(v) => setTargetType(v as PolicyTargetType)}
              options={[
                { label: 'Name pattern', value: 'pattern' },
                { label: 'Tag', value: 'tag' },
              ]}
            />
          </Form.Item>

          {targetType === 'pattern' ? (
            <Form.Item name="bucket_patterns" label="Bucket Patterns (glob)"
              rules={[{ required: true, message: 'Add at least one pattern' }]}>
              <Select mode="tags" placeholder="e.g. data-*, my-bucket" />
            </Form.Item>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <Form.Item name="tag_key" label="Tag key" style={{ flex: 1 }}
                rules={[{ required: true, message: 'Tag key is required' }]}>
                <AutoComplete options={keyOptions} onChange={(v) => setTagKey(v)}
                  placeholder="e.g. owner" filterOption={(i, o) => (o?.value || '').toLowerCase().includes(i.toLowerCase())}
                  styles={{ popup: { root: { ...mono } } }} />
              </Form.Item>
              <Form.Item name="tag_value" label="Tag value (optional)" style={{ flex: 1 }}
                extra="Empty = any value for this key">
                <AutoComplete options={valueOptions} placeholder="e.g. cenkay.yaman"
                  filterOption={(i, o) => (o?.value || '').toLowerCase().includes(i.toLowerCase())}
                  styles={{ popup: { root: { ...mono } } }} />
              </Form.Item>
            </div>
          )}

          <Form.Item name="prefix_filter" label="Prefix Filter (optional)">
            <Input placeholder="e.g. logs/" />
          </Form.Item>
          <Form.Item name="older_than_days" label="Older Than (days, leave empty = all)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cron_expression" label="Cron Expression" rules={[{ required: true, message: 'Cron is required' }]}>
            <Input placeholder="0 2 * * *" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue>
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </EditDrawer>
    </div>
  )
}
