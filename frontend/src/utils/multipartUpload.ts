import axios from 'axios'
import { uploadApi, PartETag } from '../api/upload'

const MAX_CONCURRENT = 4
const MAX_RETRIES = 3

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface MultipartUploadHandle {
  promise: Promise<void>
  abort: () => void
}

export function multipartUpload(
  bucket: string,
  file: File,
  prefix: string,
  onProgress?: (progress: UploadProgress) => void,
): MultipartUploadHandle {
  let aborted = false
  let uploadId = ''
  let key = ''

  const abort = () => {
    aborted = true
    if (uploadId) {
      uploadApi.abortMultipart(bucket, key, uploadId).catch(() => {})
    }
  }

  const promise = (async () => {
    key = prefix ? `${prefix}${file.name}` : file.name
    const contentType = file.type || 'application/octet-stream'

    // 1. Init multipart upload
    const { data: init } = await uploadApi.initMultipart(bucket, key, file.size, contentType)
    uploadId = init.upload_id

    if (aborted) throw new Error('Upload aborted')

    const partSize = init.part_size
    const completedParts: PartETag[] = []
    const partProgress: number[] = new Array(init.num_parts).fill(0)

    const reportProgress = () => {
      const loaded = partProgress.reduce((a, b) => a + b, 0)
      onProgress?.({
        loaded,
        total: file.size,
        percentage: Math.round((loaded / file.size) * 100),
      })
    }

    // 2. Upload parts with concurrency limit
    let nextPart = 0
    const uploadPart = async (): Promise<void> => {
      while (nextPart < init.num_parts) {
        if (aborted) throw new Error('Upload aborted')
        const partIndex = nextPart++
        const start = partIndex * partSize
        const end = Math.min(start + partSize, file.size)
        const blob = file.slice(start, end)
        const url = init.urls[partIndex]

        let etag = ''
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (aborted) throw new Error('Upload aborted')
          try {
            const resp = await axios.put(url, blob, {
              // No extra headers — presigned URL signature covers only what was signed.
              // Sending Content-Type or Authorization causes 403 SignatureDoesNotMatch.
              transformRequest: [(data) => data],
              onUploadProgress: (e) => {
                partProgress[partIndex] = e.loaded ?? 0
                reportProgress()
              },
            })
            etag = resp.headers['etag'] || resp.headers['ETag'] || ''
            break
          } catch (err) {
            if (attempt === MAX_RETRIES - 1) throw err
          }
        }

        completedParts.push({
          part_number: partIndex + 1,
          etag: etag.replace(/"/g, ''),
        })
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, init.num_parts) }, () => uploadPart())
    await Promise.all(workers)

    if (aborted) throw new Error('Upload aborted')

    // 3. Complete multipart upload
    await uploadApi.completeMultipart(bucket, key, uploadId, completedParts)
  })()

  return { promise, abort }
}
