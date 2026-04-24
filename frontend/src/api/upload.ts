import apiClient from './client'

export interface MultipartInitResponse {
  upload_id: string
  key: string
  part_size: number
  num_parts: number
  urls: string[]
}

export interface PartETag {
  part_number: number
  etag: string
}

export const uploadApi = {
  initMultipart: (bucket: string, key: string, fileSize: number, contentType: string) =>
    apiClient.post<MultipartInitResponse>(`/buckets/${bucket}/upload/init`, {
      key,
      file_size: fileSize,
      content_type: contentType,
    }),

  completeMultipart: (bucket: string, key: string, uploadId: string, parts: PartETag[]) =>
    apiClient.post(`/buckets/${bucket}/upload/complete`, {
      key,
      upload_id: uploadId,
      parts,
    }),

  abortMultipart: (bucket: string, key: string, uploadId: string) =>
    apiClient.post(`/buckets/${bucket}/upload/abort`, {
      key,
      upload_id: uploadId,
    }),

  presignDownload: (bucket: string, key: string) =>
    apiClient.post<{ url: string }>(`/buckets/${bucket}/presign`, { key }),
}
