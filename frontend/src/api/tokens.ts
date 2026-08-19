import apiClient from './client'

export interface TokenCreateResponse {
  id: string
  name: string
  token: string // shown only once
  token_prefix: string
  expires_at: string | null
}

export interface ApiToken {
  id: string
  name: string
  token_prefix: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked: boolean
}

export const tokensApi = {
  create: (name: string, expiresIn: string = 'never') =>
    apiClient.post<TokenCreateResponse>('/tokens', { name, expires_in: expiresIn }),
  list: () => apiClient.get<ApiToken[]>('/tokens'),
  revoke: (id: string) => apiClient.delete(`/tokens/${id}`),
}
