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
}

export interface StorageStats {
  total_size: number
  total_objects: number
  bucket_count: number
  quota_bytes: number
  buckets: BucketStorageStat[]
}

export const settingsApi = {
  getAuthSettings: () => apiClient.get<AuthSettings>('/settings/auth'),
  updateAuthSettings: (data: AuthSettings) => apiClient.put<AuthSettings>('/settings/auth', data),
  getAzureSettings: () => apiClient.get<AzureAdConfig>('/settings/azure'),
  updateAzureSettings: (data: AzureAdConfigUpdate) => apiClient.put<AzureAdConfig>('/settings/azure', data),
  getStorageStats: () => apiClient.get<StorageStats>('/settings/storage'),
  updateGlobalQuota: (quotaGb: number) => apiClient.put('/settings/storage/quota', { quota_gb: quotaGb }),
  updateBucketQuota: (bucket: string, quotaGb: number) => apiClient.put(`/settings/storage/quota/${bucket}`, { quota_gb: quotaGb }),
}
