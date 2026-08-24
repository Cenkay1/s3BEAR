import apiClient from './client'

export interface AuthSettings {
  enable_local_auth: boolean
  enable_azure_ad: boolean
}

export interface AzureAdConfig {
  tenant_id: string
  client_id: string
  redirect_uri: string
  has_secret: boolean
}

export interface AzureAdConfigUpdate {
  tenant_id: string
  client_id: string
  client_secret?: string
  redirect_uri: string
}

export interface BucketStorageStat {
  name: string
  size: number
  object_count: number
  quota_bytes: number
  provider_id?: string | null
  provider_name?: string | null
}

export interface StorageStats {
  total_size: number
  total_objects: number
  bucket_count: number
  quota_bytes: number
  buckets: BucketStorageStat[]
}

export interface S3Connection {
  provider: string
  access_key_id: string
  region: string
  endpoint_url: string
  presigned_base: string
  use_ssl: boolean
  has_secret: boolean
  configured: boolean
  source: string
}

export interface S3ConnectionUpdate {
  provider: string
  access_key_id: string
  secret_access_key?: string
  region: string
  endpoint_url: string
  presigned_base: string
  use_ssl: boolean
}

export interface AuthProvider {
  id: string
  name: string
  type: string
  enabled: boolean
  configured: boolean
  has_secret: boolean
  config: Record<string, string>
}

export interface AuthProviderUpdate {
  enabled: boolean
  config: Record<string, string>
  secret?: string
}

export const settingsApi = {
  getAuthSettings: () => apiClient.get<AuthSettings>('/settings/auth'),
  updateAuthSettings: (data: AuthSettings) => apiClient.put<AuthSettings>('/settings/auth', data),
  getAzureSettings: () => apiClient.get<AzureAdConfig>('/settings/azure'),
  updateAzureSettings: (data: AzureAdConfigUpdate) => apiClient.put<AzureAdConfig>('/settings/azure', data),
  getStorageStats: () => apiClient.get<StorageStats>('/settings/storage'),
  updateGlobalQuota: (quotaGb: number) => apiClient.put('/settings/storage/quota', { quota_gb: quotaGb }),
  updateBucketQuota: (bucket: string, quotaGb: number) => apiClient.put(`/settings/storage/quota/${bucket}`, { quota_gb: quotaGb }),
  getS3Connection: () => apiClient.get<S3Connection>('/settings/storage/connection'),
  updateS3Connection: (data: S3ConnectionUpdate) => apiClient.put<S3Connection>('/settings/storage/connection', data),
  testS3Connection: (data: S3ConnectionUpdate) => apiClient.post<{ ok: boolean; error: string | null }>('/settings/storage/connection/test', data),
  getAuthProviders: () => apiClient.get<AuthProvider[]>('/settings/auth/providers'),
  updateAuthProvider: (id: string, data: AuthProviderUpdate) => apiClient.put<AuthProvider>(`/settings/auth/providers/${id}`, data),
}
