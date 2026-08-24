import apiClient from './client'

export interface BucketInfo {
  name: string
  creation_date: string | null
  provider_id: string | null
  provider_name: string | null
  can_list: boolean
  can_read: boolean
  can_write: boolean
  can_delete: boolean
}

export interface S3Object {
  key: string
  size: number
  last_modified: string
  etag: string
  is_folder: boolean
}

export interface BrowseResult {
  prefix: string
  objects: S3Object[]
  common_prefixes: string[]
}

export interface DeleteRequest {
  keys: string[]
}

export const bucketsApi = {
  list: () => apiClient.get<BucketInfo[]>('/buckets'),
  create: (name: string, quota_gb?: number, provider_id?: string) =>
    apiClient.post('/buckets', {
      name,
      ...(quota_gb != null ? { quota_gb } : {}),
      ...(provider_id ? { provider_id } : {}),
    }),
  deleteBucket: (name: string) => apiClient.delete(`/buckets/${name}`),
  browse: (bucket: string, prefix: string = '') =>
    apiClient.get<BrowseResult>(`/buckets/${bucket}/browse`, { params: { prefix } }),
  upload: (bucket: string, file: File, prefix: string = '') => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post(`/buckets/${bucket}/objects`, formData, {
      params: { prefix },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteObjects: (bucket: string, keys: string[]) =>
    apiClient.delete(`/buckets/${bucket}/objects`, { data: { keys } }),
  copyObject: (destBucket: string, sourceBucket: string, sourceKey: string, destKey: string) =>
    apiClient.post(`/buckets/${destBucket}/objects/copy`, {
      source_bucket: sourceBucket,
      source_key: sourceKey,
      dest_key: destKey,
    }),
  moveObject: (destBucket: string, sourceBucket: string, sourceKey: string, destKey: string) =>
    apiClient.post(`/buckets/${destBucket}/objects/move`, {
      source_bucket: sourceBucket,
      source_key: sourceKey,
      dest_key: destKey,
    }),
  bulkCopy: (destBucket: string, sourceBucket: string, keys: string[], destPrefix: string) =>
    apiClient.post<BulkResult>(`/buckets/${destBucket}/objects/bulk-copy`, {
      source_bucket: sourceBucket,
      keys,
      dest_prefix: destPrefix,
    }),
  bulkMove: (destBucket: string, sourceBucket: string, keys: string[], destPrefix: string) =>
    apiClient.post<BulkResult>(`/buckets/${destBucket}/objects/bulk-move`, {
      source_bucket: sourceBucket,
      keys,
      dest_prefix: destPrefix,
    }),
}

export interface BulkResult {
  succeeded: string[]
  errors: { key: string; error: string }[]
}
