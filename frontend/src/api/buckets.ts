import apiClient from './client'

export interface BucketInfo {
  name: string
  creation_date: string | null
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
  create: (name: string, quota_gb?: number) =>
    apiClient.post('/buckets', { name, ...(quota_gb != null ? { quota_gb } : {}) }),
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
  createShareLink: (bucket: string, key: string, expiresHours: number = 24) =>
    apiClient.post<{ url: string; expires_at: string }>(
      `/share/${bucket}/${key}`,
      null,
      { params: { expires_hours: expiresHours } },
    ),
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
}
