import apiClient from './client'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserInfo {
  id: string
  email: string
  display_name: string
  azure_oid: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  groups: { id: string; name: string }[]
}

export interface AuthConfig {
  enable_local_auth: boolean
  enable_azure_ad: boolean
}

export const authApi = {
  getLoginUrl: () => apiClient.get<{ auth_url: string }>('/auth/login'),
  callback: (code: string) => apiClient.post<TokenResponse>('/auth/callback', null, { params: { code } }),
  refresh: (refresh_token: string) => apiClient.post<TokenResponse>('/auth/refresh', { refresh_token }),
  me: () => apiClient.get<UserInfo>('/auth/me'),
  getAuthConfig: () => apiClient.get<AuthConfig>('/auth/config'),
  localLogin: (email: string, password: string) => {
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)
    return apiClient.post<TokenResponse>('/auth/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
}
