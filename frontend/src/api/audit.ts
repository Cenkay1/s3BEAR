import apiClient from './client'

export interface AuditEntry {
  id: string
  user_id: string | null
  user_email: string
  action: string
  bucket: string | null
  object_key: string | null
  details: Record<string, any> | null
  ip_address: string | null
  created_at: string
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export interface AuditFilters {
  action?: string
  bucket?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export const auditApi = {
  list: (params: AuditFilters = {}) =>
    apiClient.get<AuditPage>('/audit', { params }),
}
