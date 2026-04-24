import React, { useEffect } from 'react'
import { Spin } from 'antd'
import { useMsal } from '@azure/msal-react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'

export default function AuthCallbackPage() {
  const { instance } = useMsal()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()

  useEffect(() => {
    const handle = async () => {
      try {
        const result = await instance.handleRedirectPromise()
        if (result?.code) {
          const tokenRes = await authApi.callback(result.code)
          setTokens(tokenRes.data.access_token, tokenRes.data.refresh_token)
          const userRes = await authApi.me()
          setUser(userRes.data)
          navigate('/buckets', { replace: true })
        } else {
          navigate('/login', { replace: true })
        }
      } catch (err) {
        console.error('Callback error:', err)
        navigate('/login', { replace: true })
      }
    }
    handle()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" tip="Authenticating..." />
    </div>
  )
}
