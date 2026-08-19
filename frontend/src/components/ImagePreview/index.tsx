import React, { useEffect, useState } from 'react'
import { Button, Image, Input, message, Modal, Space, Typography } from 'antd'
import { CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { shareApi } from '../../api/share'

interface ImagePreviewProps {
  bucket: string
  objectKey: string
  visible: boolean
  onClose: () => void
}

export default function ImagePreview({ bucket, objectKey, visible, onClose }: ImagePreviewProps) {
  const src = `/api/v1/images/${bucket}/${objectKey}`
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShareUrl(null)
    }
  }, [visible])

  const handleCreateLink = async () => {
    setShareLoading(true)
    try {
      const res = await shareApi.create(bucket, objectKey, '24h')
      const fullUrl = `${window.location.origin}${res.data.url}`
      setShareUrl(fullUrl)
    } catch {
      message.error('Failed to create share link')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      message.success('Link copied to clipboard')
    } catch {
      message.error('Failed to copy')
    }
  }

  return (
    <Modal open={visible} onCancel={onClose} footer={null} width={800} centered title={objectKey}>
      <div style={{ textAlign: 'center', padding: 16 }}>
        <Image
          src={src}
          alt={objectKey}
          style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        />
      </div>
      <div style={{ marginTop: 16 }}>
        {!shareUrl ? (
          <Button
            icon={<LinkOutlined />}
            onClick={handleCreateLink}
            loading={shareLoading}
            block
          >
            Generate Share Link (24h)
          </Button>
        ) : (
          <Space.Compact style={{ width: '100%' }}>
            <Input value={shareUrl} readOnly />
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              Copy
            </Button>
          </Space.Compact>
        )}
      </div>
    </Modal>
  )
}
