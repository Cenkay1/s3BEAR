import React, { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { groupsApi, GroupRead, usersApi, UserRead } from '../../api/admin'

function PermissionCell({ group, onDeletePerm }: { group: GroupRead; onDeletePerm: (groupId: string, permId: string) => void }) {
  if (group.permissions.length === 0) {
    return <span style={{ color: '#64748B', fontFamily: "'Fira Code', monospace", fontSize: 11 }}>no permissions</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {group.permissions.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 4,
            padding: '4px 8px',
            border: '1px solid #232C3A',
          }}
        >
          <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: '#3B82F6', fontWeight: 600, minWidth: 80 }}>
            {p.bucket_pattern}
          </span>
          <span style={{ display: 'flex', gap: 4 }}>
            {p.can_list && <Tag color="blue" style={{ fontSize: 10, lineHeight: '18px', margin: 0, fontFamily: "'Fira Code', monospace" }}>list</Tag>}
            {p.can_read && <Tag color="green" style={{ fontSize: 10, lineHeight: '18px', margin: 0, fontFamily: "'Fira Code', monospace" }}>read</Tag>}
            {p.can_write && <Tag color="orange" style={{ fontSize: 10, lineHeight: '18px', margin: 0, fontFamily: "'Fira Code', monospace" }}>write</Tag>}
            {p.can_delete && <Tag color="red" style={{ fontSize: 10, lineHeight: '18px', margin: 0, fontFamily: "'Fira Code', monospace" }}>delete</Tag>}
          </span>
          <Popconfirm title="Remove this permission?" onConfirm={() => onDeletePerm(group.id, p.id)}>
            <Button type="text" size="small" danger style={{ marginLeft: 'auto', fontSize: 10, height: 20, padding: '0 4px' }}>
              x
            </Button>
          </Popconfirm>
        </div>
      ))}
    </div>
  )
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRead[]>([])
  const [users, setUsers] = useState<UserRead[]>([])
  const [loading, setLoading] = useState(true)
  const [groupModal, setGroupModal] = useState(false)
  const [permModal, setPermModal] = useState(false)
  const [userDrawer, setUserDrawer] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<GroupRead | null>(null)
  const [groupForm] = Form.useForm()
  const [permForm] = Form.useForm()
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([groupsApi.list(), usersApi.list()]).then(([gr, ur]) => {
      setGroups(gr.data)
      setUsers(ur.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleCreateGroup = async (values: any) => {
    try {
      await groupsApi.create(values)
      message.success('Group created')
      setGroupModal(false)
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Error')
    }
  }

  const handleAddPermission = async (values: any) => {
    if (!selectedGroup) return
    try {
      await groupsApi.addPermission(selectedGroup.id, values)
      message.success('Permission added')
      setPermModal(false)
      permForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Error')
    }
  }

  const handleDeletePerm = async (groupId: string, permId: string) => {
    await groupsApi.deletePermission(groupId, permId)
    message.success('Permission removed')
    load()
  }

  const handleAssignUsers = async () => {
    if (!selectedGroup) return
    await groupsApi.assignUsers(selectedGroup.id, selectedUserIds)
    message.success('Users assigned')
    setUserDrawer(false)
    load()
  }

  const openPermModal = (group: GroupRead) => {
    setSelectedGroup(group)
    permForm.resetFields()
    setPermModal(true)
  }

  const openUserDrawer = (group: GroupRead) => {
    setSelectedGroup(group)
    setSelectedUserIds(users.filter((u) => u.groups.some((g) => g.id === group.id)).map((u) => u.id))
    setUserDrawer(true)
  }

  const handleDeleteGroup = (groupId: string) => {
    groupsApi.delete(groupId).then(() => { message.success('Deleted'); load() })
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: any, r: GroupRead) => <PermissionCell group={r} onDeletePerm={handleDeletePerm} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: GroupRead) => (
        <Space>
          <Button size="small" onClick={() => openPermModal(r)}>+ Permission</Button>
          <Button size="small" onClick={() => openUserDrawer(r)}>Assign Users</Button>
          <Popconfirm title="Delete group?" onConfirm={() => handleDeleteGroup(r.id)}>
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
          <Typography.Title level={3} style={{ margin: 0, color: '#E6EDF3', fontWeight: 700, fontSize: 22, fontFamily: "'Inter', sans-serif" }}>Groups</Typography.Title>
          <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, fontFamily: "'Fira Code', monospace" }}>{groups.length} group{groups.length !== 1 ? 's' : ''}</div>
        </div>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => { groupForm.resetFields(); setGroupModal(true) }} style={{ fontWeight: 600, height: 40 }}>
          New Group
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={groups} loading={loading} />

      <Drawer open={groupModal} title="New Group" onClose={() => setGroupModal(false)} width={460} destroyOnClose
        extra={<Space><Button onClick={() => setGroupModal(false)}>Cancel</Button><Button type="primary" onClick={() => groupForm.submit()}>Save</Button></Space>}>
        <Form form={groupForm} layout="vertical" onFinish={handleCreateGroup}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        open={permModal}
        title={`Add Permission — ${selectedGroup?.name}`}
        onClose={() => setPermModal(false)}
        width={460}
        destroyOnClose
        extra={<Space><Button onClick={() => setPermModal(false)}>Cancel</Button><Button type="primary" onClick={() => permForm.submit()}>Save</Button></Space>}
      >
        <Form form={permForm} layout="vertical" onFinish={handleAddPermission} initialValues={{ can_list: false, can_read: false, can_write: false, can_delete: false }}>
          <Form.Item name="bucket_pattern" label="Bucket Pattern (glob)" rules={[{ required: true }]}>
            <Input placeholder="e.g. data-* or my-bucket" />
          </Form.Item>
          <Form.Item name="can_list" valuePropName="checked"><Checkbox>List</Checkbox></Form.Item>
          <Form.Item name="can_read" valuePropName="checked"><Checkbox>Read</Checkbox></Form.Item>
          <Form.Item name="can_write" valuePropName="checked"><Checkbox>Write</Checkbox></Form.Item>
          <Form.Item name="can_delete" valuePropName="checked"><Checkbox>Delete</Checkbox></Form.Item>
        </Form>
      </Drawer>

      <Drawer
        open={userDrawer}
        title={`Assign Users — ${selectedGroup?.name}`}
        onClose={() => setUserDrawer(false)}
        extra={<Button type="primary" onClick={handleAssignUsers}>Save</Button>}
      >
        <Checkbox.Group
          value={selectedUserIds}
          onChange={(v) => setSelectedUserIds(v as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {users.map((u) => (
            <Checkbox key={u.id} value={u.id}>
              {u.display_name || u.email}
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Drawer>
    </div>
  )
}
