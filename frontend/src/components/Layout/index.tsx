import React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Layout, Menu } from 'antd'
import {
  ApiOutlined,
  AuditOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  LinkOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/auth'

const { Sider, Content } = Layout

const NAV_KEYS = ['buckets', 'shares', 'tokens', 'users', 'groups', 'policies', 'webhooks', 'observability', 'audit', 'settings'] as const

function resolveSelectedKey(pathname: string): string {
  return NAV_KEYS.find((key) => pathname.startsWith(`/${key}`)) ?? 'buckets'
}

const SIDER_W = 248

type NavGroup = { label: string; items: { key: string; icon: React.ReactNode; label: React.ReactNode }[] }

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const selectedKey = resolveSelectedKey(location.pathname)

  const navGroups: NavGroup[] = [
    {
      label: 'Storage',
      items: [
        { key: 'buckets', icon: <DatabaseOutlined />, label: <Link to="/buckets">Buckets</Link> },
        { key: 'shares', icon: <LinkOutlined />, label: <Link to="/shares">Shares</Link> },
      ],
    },
    {
      label: 'Access',
      items: [
        ...(user?.is_admin ? [{ key: 'users', icon: <UserOutlined />, label: <Link to="/users">Users</Link> }] : []),
        ...(user?.is_admin ? [{ key: 'groups', icon: <TeamOutlined />, label: <Link to="/groups">Groups</Link> }] : []),
        { key: 'tokens', icon: <ApiOutlined />, label: <Link to="/tokens">Tokens</Link> },
      ],
    },
    ...(user?.is_admin
      ? [{
          label: 'System',
          items: [
            { key: 'observability', icon: <LineChartOutlined />, label: <Link to="/observability">Observability</Link> },
            { key: 'policies', icon: <SettingOutlined />, label: <Link to="/policies">Policies</Link> },
            { key: 'webhooks', icon: <ThunderboltOutlined />, label: <Link to="/webhooks">Webhooks</Link> },
            { key: 'audit', icon: <AuditOutlined />, label: <Link to="/audit">Logs</Link> },
            { key: 'settings', icon: <ToolOutlined />, label: <Link to="/settings">Settings</Link> },
          ],
        }]
      : []),
  ]

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Sign out',
        onClick: () => {
          logout()
          navigate('/login')
        },
      },
    ],
  }

  const initial = (user?.display_name || user?.email || 'U')[0].toUpperCase()

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        width={SIDER_W}
        style={{
          background: '#121821',
          borderRight: '1px solid #1A2230',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '14px 12px 12px' }}>
          <img
            src="/logo.png"
            alt="S3Bear"
            style={{ width: '100%', maxHeight: 96, objectFit: 'contain', display: 'block' }}
          />
        </div>

        <div style={{ height: 1, background: '#1A2230', margin: '4px 16px 12px' }} />

        <div style={{ overflowY: 'auto', position: 'absolute', top: 128, bottom: 68, left: 0, right: 0 }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ padding: '10px 22px 6px', color: '#64748B', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {group.label}
              </div>
              <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[selectedKey]}
                items={group.items}
                style={{ border: 'none', padding: '0 10px', background: 'transparent' }}
              />
            </div>
          ))}
        </div>

        {/* User area */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid #1A2230',
            padding: '12px 10px',
            background: '#121821',
          }}
        >
          <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, transition: 'background 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Avatar size={32} style={{ background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {initial}
              </Avatar>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{ color: '#E6EDF3', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.display_name || user?.email || 'user'}
                </div>
                <div style={{ color: user?.is_admin ? '#60A5FA' : '#64748B', fontSize: 11 }}>
                  {user?.is_admin ? 'Administrator' : 'Member'}
                </div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Sider>

      <Layout style={{ marginLeft: SIDER_W, background: 'transparent', minHeight: '100vh' }}>
        <Content style={{ padding: '32px 36px', background: 'transparent' }} className="animate-fade-in">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
