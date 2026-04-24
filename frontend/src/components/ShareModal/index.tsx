import React, { useEffect, useState } from 'react'
import { Button, Input, message, Modal, Space } from 'antd'
import { CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { bucketsApi } from '../../api/buckets'

interface ShareModalProps {
  bucket: string
  objectKey: string
  visible: boolean
  onClose: () => void
}

export default function ShareModal({ bucket, objectKey, visible, onClose }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShareUrl(null)
    }
  }, [visible])

  const handleCreateLink = async () => {
    setLoading(true)
    try {
      const res = await bucketsApi.createShareLink(bucket, objectKey)
      const fullUrl = `${window.location.origin}${res.data.url}`
      setShareUrl(fullUrl)
    } catch {
      message.error('Failed to create share link')
    } finally {
      setLoading(false)
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
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      title={`Share: ${objectKey.split('/').pop()}`}
      width={600}
      centered
    >
      <div style={{ padding: '16px 0' }}>
        {!shareUrl ? (
          <Button
            icon={<LinkOutlined />}
            onClick={handleCreateLink}
            loading={loading}
            type="primary"
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
