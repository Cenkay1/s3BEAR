import apiClient from './client'

export interface ShareCreateResponse {
  token: string
  url: string
  expires_at: string | null
}

export interface ShareLink {
  id: string
  bucket: string
  object_key: string
  created_by_email: string
  created_at: string
  expires_at: string | null
  revoked: boolean
  access_count: number
  last_accessed_at: string | null
}

export const shareApi = {
  create: (bucket: string, key: string, expiresIn: string = '7d') =>
    apiClient.post<ShareCreateResponse>(
      `/share/${bucket}/${key}`,
      { expires_in: expiresIn },
    ),
  list: (bucket?: string) =>
    apiClient.get<ShareLink[]>('/share', { params: bucket ? { bucket } : {} }),
  revoke: (id: string) => apiClient.delete(`/share/${id}`),
}
