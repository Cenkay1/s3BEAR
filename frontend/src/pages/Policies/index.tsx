import { useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { policiesApi, CleanupPolicy, PolicyCreate } from '../../api/admin'
import { PageHeader, EditDrawer, RowActions } from '../../components/ui'
import dayjs from 'dayjs'

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<CleanupPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<CleanupPolicy | null>(null)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    policiesApi.list().then((r) => { setPolicies(r.data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditPolicy(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (p: CleanupPolicy) => {
    setEditPolicy(p)
    form.setFieldsValue({ ...p, bucket_patterns: p.bucket_patterns })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editPolicy) {
        await policiesApi.update(editPolicy.id, values)
        message.success('Policy updated')
      } else {
        await policiesApi.create(values as PolicyCreate)
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
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Bucket Patterns',
      key: 'patterns',
      render: (_: any, r: CleanupPolicy) => r.bucket_patterns.map((p) => <Tag key={p}>{p}</Tag>),
    },
    { title: 'Older Than', dataIndex: 'older_than_days', render: (v: any) => v ? `${v} days` : '-' },
    { title: 'Cron', dataIndex: 'cron_expression' },
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
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="bucket_patterns" label="Bucket Patterns (glob)" rules={[{ required: true }]}>
            <Select mode="tags" placeholder="e.g. data-*, my-bucket" />
          </Form.Item>
          <Form.Item name="prefix_filter" label="Prefix Filter (optional)">
            <Input placeholder="e.g. logs/" />
          </Form.Item>
          <Form.Item name="older_than_days" label="Older Than (days, leave empty = all)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cron_expression" label="Cron Expression" rules={[{ required: true }]}>
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
