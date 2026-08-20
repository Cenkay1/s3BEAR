import React, { useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { policiesApi, CleanupPolicy, PolicyCreate } from '../../api/admin'
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
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: CleanupPolicy) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(r.id)}>Run</Button>
          <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm title="Delete policy?" onConfirm={() => policiesApi.delete(r.id).then(() => { message.success('Deleted'); load() })}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0, color: '#E6EDF3', fontWeight: 700, fontSize: 22, fontFamily: "'Inter', sans-serif" }}>Cleanup Policies</Typography.Title>
          <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, fontFamily: "'Fira Code', monospace" }}>{policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        <Button icon={<PlusOutlined />} type="primary" onClick={openCreate} style={{ fontWeight: 600, height: 40 }}>New Policy</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={policies} loading={loading} />

      <Modal
        open={modalOpen}
        title={editPolicy ? 'Edit Policy' : 'New Policy'}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={560}
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
      </Modal>
    </div>
  )
}
