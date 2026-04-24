import React, { useEffect, useState } from 'react'
import { Input, message, Modal, Select, Space } from 'antd'
import { BucketInfo, bucketsApi } from '../../api/buckets'

interface CopyMoveModalProps {
  visible: boolean
  mode: 'copy' | 'move'
  sourceBucket: string
  sourceKey: string
  onClose: () => void
  onSuccess: () => void
}

export default function CopyMoveModal({
  visible,
  mode,
  sourceBucket,
  sourceKey,
  onClose,
  onSuccess,
}: CopyMoveModalProps) {
  const [buckets, setBuckets] = useState<BucketInfo[]>([])
  const [destBucket, setDestBucket] = useState(sourceBucket)
  const [destKey, setDestKey] = useState(sourceKey)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      setDestBucket(sourceBucket)
      setDestKey(sourceKey)
      bucketsApi.list().then((res) => setBuckets(res.data)).catch(() => {})
    }
  }, [visible, sourceBucket, sourceKey])

  const handleOk = async () => {
    if (!destKey.trim()) {
      message.error('Destination key is required')
      return
    }
    setLoading(true)
    try {
      if (mode === 'copy') {
        await bucketsApi.copyObject(destBucket, sourceBucket, sourceKey, destKey)
        message.success('Object copied')
      } else {
        await bucketsApi.moveObject(destBucket, sourceBucket, sourceKey, destKey)
        message.success('Object moved')
      }
      onSuccess()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || `${mode} failed`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={visible}
      title={
        <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: '#ebdbb2' }}>
          {mode === 'copy' ? 'cp' : 'mv'} {sourceKey.split('/').pop()}
        </span>
      }
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={mode}
      width={480}
    >
      <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
        <div>
          <div style={{ color: '#928374', fontSize: 11, fontFamily: "'Fira Code', monospace", marginBottom: 4 }}>
            destination bucket
          </div>
          <Select
            value={destBucket}
            onChange={setDestBucket}
            style={{ width: '100%' }}
            options={buckets
              .filter((b) => b.can_write)
              .map((b) => ({ label: b.name, value: b.name }))}
          />
        </div>
        <div>
          <div style={{ color: '#928374', fontSize: 11, fontFamily: "'Fira Code', monospace", marginBottom: 4 }}>
            destination key
          </div>
          <Input
            value={destKey}
            onChange={(e) => setDestKey(e.target.value)}
            style={{ fontFamily: "'Fira Code', monospace", fontSize: 12 }}
          />
        </div>
      </Space>
    </Modal>
  )
}
