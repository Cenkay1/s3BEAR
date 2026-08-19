import React from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Dropdown, Layout, Menu } from 'antd'
import {
  ApiOutlined,
  AuditOutlined,
  DatabaseOutlined,
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

const NAV_KEYS = ['buckets', 'shares', 'tokens', 'users', 'groups', 'policies', 'webhooks', 'audit', 'settings'] as const

function resolveSelectedKey(pathname: string): string {
  return NAV_KEYS.find((key) => pathname.startsWith(`/${key}`)) ?? 'buckets'
}

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
          { key: 'groups', icon: <TeamOutlined />, label: <Link to="/groups">Groups</Link> },
          { key: 'policies', icon: <SettingOutlined />, label: <Link to="/policies">Policies</Link> },
          { key: 'webhooks', icon: <ThunderboltOutlined />, label: <Link to="/webhooks">Webhooks</Link> },
          { key: 'audit', icon: <AuditOutlined />, label: <Link to="/audit">Audit Log</Link> },
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

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        theme="dark"
        width={232}
        style={{
          background: 'rgba(29,32,33,0.97)',
          borderRight: '1px solid #3c3836',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '22px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fabd2f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 12px rgba(250,189,47,0.35)',
              }}
            >
              <DatabaseOutlined style={{ color: '#1d2021', fontSize: 17, fontWeight: 700 }} />
            </div>
            <div>
              <div style={{
                color: '#ebdbb2',
                fontWeight: 700,
                fontSize: 14,
                lineHeight: '18px',
                letterSpacing: '-0.01em',
                fontFamily: "'Fira Code', monospace",
              }}>
                s3BEAR
              </div>
              <div style={{ color: '#504945', fontSize: 10, lineHeight: '14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                storage console
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#3c3836', margin: '0 16px 10px' }} />

        {/* Nav label */}
        <div style={{
          padding: '0 20px 5px',
          color: '#504945',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontFamily: "'Fira Code', monospace",
        }}>
          // nav
        </div>

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
            borderTop: '1px solid #3c3836',
            padding: '12px 10px',
            background: 'rgba(29,32,33,0.8)',
          }}
        >
          <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '8px 10px',
                borderRadius: 6,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(250,189,47,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Avatar
                size={30}
                style={{
                  background: '#fabd2f',
                  color: '#1d2021',
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
              </Avatar>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{
                  color: '#ebdbb2',
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: "'Fira Code', monospace",
                }}>
                  {user?.display_name || user?.email || 'user'}
                </div>
                <div style={{ color: user?.is_admin ? '#fabd2f' : '#504945', fontSize: 10, letterSpacing: '0.04em' }}>
                  {user?.is_admin ? 'admin' : 'member'}
                </div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 232, background: 'transparent', minHeight: '100vh' }}>
        <Content style={{ padding: '28px 32px' }} className="animate-fade-in">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
