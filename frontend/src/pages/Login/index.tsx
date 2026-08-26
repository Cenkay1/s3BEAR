import React, { useEffect, useState } from 'react'
import { Button, Divider, Form, Input, message, Switch } from 'antd'
import { ArrowRightOutlined, LockOutlined, MailOutlined, WindowsFilled } from '@ant-design/icons'
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

  const enableLocal = config?.enable_local_auth ?? true
  const enableAzure = config?.enable_azure_ad ?? false

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0B0F17' }}>
      {/* Left hero panel */}
      <div
        className="login-hero"
        style={{
          flex: '1.15',
          position: 'relative',
          overflow: 'hidden',
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(1000px 600px at 30% 55%, rgba(16,185,129,0.14), transparent 60%), #0A0A0B',
          borderRight: '1px solid #1C1C20',
        }}
      >
        {/* grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(900px 600px at 30% 50%, #000, transparent 75%)',
            pointerEvents: 'none',
          }}
        />

        {/* logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="S3Bear" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 18, color: '#ECECEE', letterSpacing: '-0.01em' }}>S3Bear</span>
        </div>

        {/* hero copy */}
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <h1 style={{ fontSize: 48, lineHeight: 1.08, fontWeight: 800, margin: 0, color: '#ECECEE', letterSpacing: '-0.02em' }}>
            Infrastructure<br />Management,<br />
            <span style={{ color: '#10B981' }}>Simplified.</span>
          </h1>
          <p style={{ marginTop: 24, fontSize: 16, lineHeight: 1.6, color: '#A0A0A8', maxWidth: 460 }}>
            Securely manage your S3 buckets, serve images to the web and to LLMs, and
            configure policies from a centralized, high-performance console.
          </p>
        </div>

        {/* status */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Fira Code', monospace", fontSize: 13, color: '#A0A0A8' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 10px #22C55E' }} />
          System Status: All Systems Operational
        </div>
      </div>

      {/* Right auth panel */}
      <div
        style={{
          flex: '0.85',
          minWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          background: '#0B0F17',
        }}
      >
        <div className="animate-fade-up" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#ECECEE', margin: 0 }}>Sign In</h2>
            <p style={{ color: '#A0A0A8', marginTop: 8, fontSize: 14 }}>Access your S3 infrastructure</p>
          </div>

          {enableAzure && (
            <Button
              size="large"
              block
              icon={<WindowsFilled />}
              onClick={handleAzureLogin}
              style={{ height: 46, fontWeight: 600, background: '#1C1C20', borderColor: '#232C3A', color: '#ECECEE', marginBottom: enableLocal ? 4 : 0 }}
            >
              Sign in with Microsoft Entra
            </Button>
          )}

          {enableAzure && enableLocal && (
            <Divider style={{ borderColor: '#232C3A', margin: '20px 0' }}>
              <span style={{ color: '#64748B', fontSize: 12 }}>or continue with email</span>
            </Divider>
          )}

          {enableLocal && (
            <Form layout="vertical" onFinish={handleLocalLogin} requiredMark={false}>
              <Form.Item
                name="email"
                label={<span style={{ color: '#A0A0A8', fontSize: 13, fontWeight: 500 }}>Email</span>}
                rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
              >
                <Input
                  autoComplete="email"
                  size="large"
                  prefix={<MailOutlined style={{ color: '#64748B' }} />}
                  placeholder="you@example.com"
                  style={{ height: 46 }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#A0A0A8', fontSize: 13, fontWeight: 500 }}>Password</span>
                  </div>
                }
                rules={[{ required: true, message: 'Enter your password' }]}
              >
                <Input.Password
                  autoComplete="current-password"
                  size="large"
                  prefix={<LockOutlined style={{ color: '#64748B' }} />}
                  placeholder="••••••••"
                  style={{ height: 46 }}
                />
              </Form.Item>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Switch size="small" />
                <span style={{ color: '#A0A0A8', fontSize: 13 }}>Remember device</span>
              </div>

              <Button
                htmlType="submit"
                type="primary"
                block
                loading={localLoading}
                size="large"
                style={{ height: 46, fontWeight: 600, fontSize: 15 }}
              >
                Sign In <ArrowRightOutlined />
              </Button>
            </Form>
          )}

          {!enableLocal && !enableAzure && (
            <div style={{ textAlign: 'center', color: '#EF4444' }}>No authentication method is enabled.</div>
          )}

          <div style={{ textAlign: 'center', marginTop: 32, color: '#64748B', fontSize: 12 }}>
            © {new Date().getFullYear()} S3Bear · Secure S3 Gateway
          </div>
        </div>
      </div>
    </div>
  )
}
