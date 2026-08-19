import apiClient from './client'

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  enabled: boolean
  created_at: string
}

export interface WebhookCreateResponse extends Webhook {
  secret: string // shown only once
}

export interface WebhookDelivery {
  id: string
  event: string
  status: string
  attempts: number
  last_status_code: number | null
  last_error: string | null
  created_at: string
  next_retry_at: string | null
  delivered_at: string | null
}

export const WEBHOOK_EVENTS = [
  'upload', 'delete', 'copy', 'move', 'create_bucket', 'delete_bucket',
  'share_create', 'share_revoke', 'token_create', 'token_revoke',
  'user_create', 'user_delete', 'permission_change', 'cleanup',
]

export const webhooksApi = {
  list: () => apiClient.get<Webhook[]>('/webhooks'),
  create: (name: string, url: string, events: string[]) =>
    apiClient.post<WebhookCreateResponse>('/webhooks', { name, url, events }),
  update: (id: string, patch: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'enabled'>>) =>
    apiClient.patch<Webhook>(`/webhooks/${id}`, patch),
  remove: (id: string) => apiClient.delete(`/webhooks/${id}`),
  deliveries: (id: string) => apiClient.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
  test: (id: string) => apiClient.post<WebhookDelivery>(`/webhooks/${id}/test`),
}
