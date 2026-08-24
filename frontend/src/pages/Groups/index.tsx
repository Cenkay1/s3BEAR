import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Form,
  Input,
  message,
  Select,
  Table,
} from 'antd'
import { EditOutlined, PlusOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import { groupsApi, GroupRead, BucketPermission, usersApi, UserRead } from '../../api/admin'
import { C, mono, sectionLabel, PageHeader, EditDrawer, RowActions } from '../../components/ui'

type PermDraft = {
  id?: string
  bucket_pattern: string
  can_list: boolean
  can_read: boolean
  can_write: boolean
  can_delete: boolean
}

const PERM_FLAGS = [
  { key: 'can_list', label: 'List', color: 'blue' },
  { key: 'can_read', label: 'Read', color: 'green' },
  { key: 'can_write', label: 'Write', color: 'orange' },
  { key: 'can_delete', label: 'Delete', color: 'red' },
] as const

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRead[]>([])
  const [users, setUsers] = useState<UserRead[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroupRead | null>(null)
  const [form] = Form.useForm()
  const [perms, setPerms] = useState<PermDraft[]>([])
  const [userIds, setUserIds] = useState<string[]>([])

  const load = () => {
    setLoading(true)
    Promise.all([groupsApi.list(), usersApi.list()]).then(([gr, ur]) => {
      setGroups(gr.data)
      setUsers(ur.data)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setPerms([])
    setUserIds([])
    setOpen(true)
  }

  const openEdit = (g: GroupRead) => {
    setEditing(g)
    form.setFieldsValue({ name: g.name, description: g.description })
    setPerms(g.permissions.map((p) => ({ ...p })))
    setUserIds(users.filter((u) => u.groups.some((gr) => gr.id === g.id)).map((u) => u.id))
    setOpen(true)
  }

  const addPerm = () => setPerms((p) => [...p, { bucket_pattern: '', can_list: true, can_read: true, can_write: false, can_delete: false }])
  const removePerm = (i: number) => setPerms((p) => p.filter((_, idx) => idx !== i))
  const setPerm = (i: number, patch: Partial<PermDraft>) => setPerms((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const handleSave = async () => {
    let values
    try { values = await form.validateFields() } catch { return }
    const cleanPerms = perms.filter((p) => p.bucket_pattern.trim())
    setSaving(true)
    try {
      let groupId: string
      if (editing) {
        await groupsApi.update(editing.id, { name: values.name, description: values.description })
        groupId = editing.id
        // Sync permissions: delete removed, add new.
        const existing = editing.permissions
        const keptIds = new Set(cleanPerms.filter((p) => p.id).map((p) => p.id))
        for (const ex of existing) {
          if (!keptIds.has(ex.id)) await groupsApi.deletePermission(groupId, ex.id)
        }
        for (const p of cleanPerms.filter((p) => !p.id)) {
          await groupsApi.addPermission(groupId, permPayload(p))
        }
      } else {
        const res = await groupsApi.create({ name: values.name, description: values.description })
        groupId = res.data.id
        for (const p of cleanPerms) await groupsApi.addPermission(groupId, permPayload(p))
      }
      await groupsApi.assignUsers(groupId, userIds)
      message.success(editing ? 'Group updated' : 'Group created')
      setOpen(false)
      load()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  const permPayload = (p: PermDraft): Omit<BucketPermission, 'id' | 'group_id'> => ({
    bucket_pattern: p.bucket_pattern.trim(),
    can_list: p.can_list, can_read: p.can_read, can_write: p.can_write, can_delete: p.can_delete,
  })

  const handleDelete = async () => {
    if (!editing) return
    await groupsApi.delete(editing.id)
    message.success('Group deleted')
    setOpen(false)
    load()
  }

  const deleteRow = async (g: GroupRead) => {
    await groupsApi.delete(g.id)
    message.success('Group deleted')
    load()
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ color: C.text, fontWeight: 600 }}>{v}</span> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => <span style={{ color: C.muted }}>{v || '—'}</span> },
    {
      title: '', key: 'actions', width: 56,
      render: (_: any, r: GroupRead) => (
        <RowActions actions={[
          { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: () => openEdit(r) },
          { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true, confirm: `Delete '${r.name}'?`, onClick: () => deleteRow(r) },
        ]} />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Groups"
        subtitle={`${groups.length} group${groups.length !== 1 ? 's' : ''}`}
        actions={<Button icon={<PlusOutlined />} type="primary" onClick={openCreate} style={{ fontWeight: 600, height: 40 }}>New Group</Button>}
      />
      <Table rowKey="id" columns={columns} dataSource={groups} loading={loading} />

      <EditDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New Group'}
        width={520}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create Group'}
        submitLoading={saving}
        onDelete={editing ? handleDelete : undefined}
        deleteLabel="Delete group"
        deleteConfirm="This removes the group and its permissions."
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Data Engineers" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>

        {/* Permissions */}
        <div style={{ ...sectionLabel, marginBottom: 10, marginTop: 8 }}>Permissions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {perms.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>No permissions yet.</div>}
          {perms.map((p, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Input
                  value={p.bucket_pattern}
                  onChange={(e) => setPerm(i, { bucket_pattern: e.target.value })}
                  placeholder="bucket pattern (e.g. data-* )"
                  style={{ ...mono, fontSize: 12 }}
                />
                <Button type="text" size="small" icon={<CloseOutlined style={{ color: C.dim }} />} onClick={() => removePerm(i)} />
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {PERM_FLAGS.map((f) => (
                  <Checkbox key={f.key} checked={(p as any)[f.key]} onChange={(e) => setPerm(i, { [f.key]: e.target.checked } as any)}>
                    {f.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addPerm} style={{ marginTop: 10 }}>Add permission</Button>

        {/* Users */}
        <div style={{ ...sectionLabel, marginBottom: 10, marginTop: 24 }}>Assigned Users</div>
        <Select
          mode="multiple"
          value={userIds}
          onChange={setUserIds}
          placeholder="Assign users to this group"
          style={{ width: '100%' }}
          optionFilterProp="label"
          options={users.map((u) => ({ label: u.display_name || u.email, value: u.id }))}
        />
      </EditDrawer>
    </div>
  )
}
