import React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Layout, Menu, Tooltip } from 'antd'
import {
  ApiOutlined,
  AuditOutlined,
  BellOutlined,
  DatabaseOutlined,
  LinkOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../store/auth'

const { Sider, Header, Content } = Layout

const NAV_KEYS = ['buckets', 'shares', 'tokens', 'users', 'groups', 'policies', 'webhooks', 'audit', 'settings'] as const

function resolveSelectedKey(pathname: string): string {
  return NAV_KEYS.find((key) => pathname.startsWith(`/${key}`)) ?? 'buckets'
}

const SIDER_W = 248

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const selectedKey = resolveSelectedKey(location.pathname)

  const menuItems = [
    { key: 'buckets', icon: <DatabaseOutlined />, label: <Link to="/buckets">Buckets</Link> },
    { key: 'shares', icon: <LinkOutlined />, label: <Link to="/shares">Shares</Link> },
    { key: 'tokens', icon: <ApiOutlined />, label: <Link to="/tokens">API Tokens</Link> },
    ...(user?.is_admin
      ? [
          { key: 'users', icon: <UserOutlined />, label: <Link to="/users">Users</Link> },
          { key: 'groups', icon: <TeamOutlined />, label: <Link to="/groups">Permissions</Link> },
          { key: 'policies', icon: <SettingOutlined />, label: <Link to="/policies">Policies</Link> },
          { key: 'webhooks', icon: <ThunderboltOutlined />, label: <Link to="/webhooks">Webhooks</Link> },
          { key: 'audit', icon: <AuditOutlined />, label: <Link to="/audit">Audit Logs</Link> },
          { key: 'settings', icon: <ToolOutlined />, label: <Link to="/settings">Settings</Link> },
        ]
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
        <div style={{ padding: '20px 18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/logo.png"
              alt="S3Bear"
              style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ color: '#E6EDF3', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>S3Bear</div>
              <div style={{ color: '#64748B', fontSize: 12 }}>Cloud Gateway</div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#1A2230', margin: '4px 16px 12px' }} />

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ border: 'none', padding: '0 10px', background: 'transparent' }}
        />

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
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            height: 60,
            padding: '0 28px',
            background: 'rgba(11,15,23,0.85)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid #1A2230',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <Tooltip title="Documentation">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#94A3B8' }}
            >
              <QuestionCircleOutlined style={{ fontSize: 17 }} />
            </a>
          </Tooltip>
          <Tooltip title="Notifications">
            <span style={{ display: 'flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#94A3B8', cursor: 'pointer' }}>
              <BellOutlined style={{ fontSize: 17 }} />
            </span>
          </Tooltip>
          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <Avatar size={34} style={{ background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginLeft: 4 }}>
              {initial}
            </Avatar>
          </Dropdown>
        </Header>

        <Content style={{ padding: '28px 32px', background: 'transparent' }} className="animate-fade-in">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
