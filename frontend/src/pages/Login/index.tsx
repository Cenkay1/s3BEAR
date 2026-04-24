import React, { useEffect, useState } from 'react'
import { Button, Divider, Form, Input, message, Typography } from 'antd'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../../api/msal'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { authApi, AuthConfig } from '../../api/auth'

export default function LoginPage() {
  const { instance } = useMsal()
  const navigate = useNavigate()
  const { isAuthenticated, setTokens, loadUser } = useAuthStore()
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [localLoading, setLocalLoading] = useState(false)
  const [showLocalLogin, setShowLocalLogin] = useState(false)

  useEffect(() => {
    authApi.getAuthConfig().then((r) => setConfig(r.data)).catch(() => setConfig({ enable_local_auth: true, enable_azure_ad: true }))
  }, [])

  useEffect(() => {
    if (isAuthenticated) navigate('/buckets')
  }, [isAuthenticated])

  const handleAzureLogin = async () => {
    try {
      await instance.loginRedirect(loginRequest)
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const handleLocalLogin = async (values: { email: string; password: string }) => {
    setLocalLoading(true)
    try {
      const res = await authApi.localLogin(values.email, values.password)
      setTokens(res.data.access_token, res.data.refresh_token)
      await loadUser()
      navigate('/buckets')
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLocalLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    color: '#928374',
    fontSize: 12,
    fontFamily: "'Fira Code', monospace",
    letterSpacing: '0.04em',
  }

  const renderContent = () => {
    if (!config) return null
    const { enable_local_auth, enable_azure_ad } = config

    return (
      <>
        {/* Azure AD login — primary when active */}
        {enable_azure_ad && (
          <Button
            size="large"
            block
            onClick={handleAzureLogin}
            style={{
              height: 48,
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "'Fira Code', monospace",
              letterSpacing: '0.03em',
              background: '#fabd2f',
              borderColor: '#fabd2f',
              color: '#1d2021',
              marginBottom: enable_local_auth ? 0 : undefined,
            }}
          >
            $ sign_in --provider=azure-ad
          </Button>
        )}

        {/* Local login — secondary, collapsed behind a link */}
        {enable_local_auth && enable_azure_ad && !showLocalLogin && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              type="link"
              onClick={() => setShowLocalLogin(true)}
              style={{
                color: '#665c54',
                fontSize: 12,
                fontFamily: "'Fira Code', monospace",
              }}
            >
              sign in with username & password
            </Button>
          </div>
        )}

        {/* Local login form */}
        {enable_local_auth && (!enable_azure_ad || showLocalLogin) && (
          <>
            {enable_azure_ad && (
              <Divider style={{ borderColor: '#3c3836', margin: '20px 0 16px' }}>
                <Typography.Text style={{ color: '#504945', fontSize: 11, fontFamily: "'Fira Code', monospace" }}>
                  or local login
                </Typography.Text>
              </Divider>
            )}
            <Form layout="vertical" onFinish={handleLocalLogin} style={{ marginTop: enable_azure_ad ? 0 : 4 }}>
              <Form.Item name="email" label={<span style={labelStyle}>email</span>} rules={[{ required: true, type: 'email' }]}>
                <Input
                  autoComplete="email"
                  size="large"
                  placeholder="user@example.com"
                  style={{ fontFamily: "'Fira Code', monospace", fontSize: 13 }}
                />
              </Form.Item>
              <Form.Item name="password" label={<span style={labelStyle}>password</span>} rules={[{ required: true }]}>
                <Input.Password
                  autoComplete="current-password"
                  size="large"
                  placeholder="••••••••"
                  style={{ fontFamily: "'Fira Code', monospace", fontSize: 13 }}
                />
              </Form.Item>
              <Button
                htmlType="submit"
                block
                loading={localLoading}
                size="large"
                style={{
                  marginTop: 8,
                  height: 44,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  fontFamily: "'Fira Code', monospace",
                  background: '#32302f',
                  borderColor: '#3c3836',
                  color: '#ebdbb2',
                }}
              >
                $ sign_in --local
              </Button>
            </Form>
          </>
        )}

        {!enable_local_auth && !enable_azure_ad && (
          <Typography.Text type="danger">No authentication method is enabled.</Typography.Text>
        )}
      </>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1d2021',
        backgroundImage: `
          linear-gradient(rgba(250,189,47,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(250,189,47,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Amber focal glow behind card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(250,189,47,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Scan line effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Login card */}
      <div
        className="animate-fade-up"
        style={{
          width: 400,
          background: '#282828',
          border: '1px solid #3c3836',
          borderRadius: 8,
          padding: '36px 32px 32px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(250,189,47,0.05)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Terminal header bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #fabd2f, #fe8019, transparent)',
            borderRadius: '8px 8px 0 0',
          }}
        />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#fabd2f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(250,189,47,0.35)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 7C4 5.895 7.582 5 12 5C16.418 5 20 5.895 20 7V10C20 11.105 16.418 12 12 12C7.582 12 4 11.105 4 10V7Z" fill="#1d2021"/>
                <path d="M4 10C4 11.105 7.582 12 12 12C16.418 12 20 11.105 20 10V14C20 15.105 16.418 16 12 16C7.582 16 4 15.105 4 14V10Z" fill="#1d2021" opacity="0.8"/>
                <path d="M4 14C4 15.105 7.582 16 12 16C16.418 16 20 15.105 20 14V17C20 18.105 16.418 19 12 19C7.582 19 4 18.105 4 17V14Z" fill="#1d2021" opacity="0.6"/>
              </svg>
            </div>
          </div>
          <div style={{
            color: '#ebdbb2',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontFamily: "'Fira Code', monospace",
            lineHeight: 1.2,
          }}>
            s3BEAR
          </div>
          <div style={{
            color: '#504945',
            fontSize: 12,
            marginTop: 4,
            fontFamily: "'Fira Code', monospace",
            letterSpacing: '0.04em',
          }}>
            // storage console v1
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  )
}
