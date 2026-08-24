import apiClient from './client'

export interface StorageProvider {
  id: string
  name: string
  provider_type: string // aws | minio | ceph | wasabi | custom
  access_key_id: string
  region: string
  endpoint_url: string
  presigned_base: string
  use_ssl: boolean
  is_default: boolean
  has_secret: boolean
  bucket_count: number
  created_at: string
}

export interface StorageProviderCreate {
  name: string
  provider_type: string
  access_key_id: string
  secret_access_key: string
  region: string
  endpoint_url: string
  presigned_base: string
  use_ssl: boolean
  is_default: boolean
}

export interface StorageProviderUpdate {
  name?: string
  provider_type?: string
  access_key_id?: string
  secret_access_key?: string
  region?: string
  endpoint_url?: string
  presigned_base?: string
  use_ssl?: boolean
  is_default?: boolean
}

export interface ProviderTestRequest {
  id?: string
  name: string
  provider_type: string
  access_key_id: string
  secret_access_key?: string
  region: string
  endpoint_url: string
  presigned_base: string
  use_ssl: boolean
}

export const providersApi = {
  list: () => apiClient.get<StorageProvider[]>('/providers'),
  create: (data: StorageProviderCreate) => apiClient.post<StorageProvider>('/providers', data),
  update: (id: string, data: StorageProviderUpdate) => apiClient.put<StorageProvider>(`/providers/${id}`, data),
  remove: (id: string) => apiClient.delete(`/providers/${id}`),
  setDefault: (id: string) => apiClient.post<StorageProvider>(`/providers/${id}/default`, {}),
  test: (data: ProviderTestRequest) => apiClient.post<{ ok: boolean; error: string | null }>('/providers/test', data),
}
