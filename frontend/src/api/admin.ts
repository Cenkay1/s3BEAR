import apiClient from './client'

// Users
export interface UserRead {
  id: string
  email: string
  display_name: string
  azure_oid: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  groups: { id: string; name: string }[]
}

export interface UserCreate {
  email: string
  display_name?: string
  is_active?: boolean
  is_admin?: boolean
  password?: string
  group_ids?: string[]
}

export interface UserUpdate {
  display_name?: string
  is_active?: boolean
  is_admin?: boolean
}

// Groups
export interface BucketPermission {
  id: string
  group_id: string
  bucket_pattern: string
  can_list: boolean
  can_read: boolean
  can_write: boolean
  can_delete: boolean
}

export interface GroupRead {
  id: string
  name: string
  description: string
  permissions: BucketPermission[]
}

export interface GroupCreate {
  name: string
  description?: string
}

// Policies
export type PolicyTargetType = 'pattern' | 'tag'

export interface CleanupPolicy {
  id: string
  name: string
  target_type: PolicyTargetType
  bucket_patterns: string[]
  tag_key: string | null
  tag_value: string | null
  prefix_filter: string | null
  older_than_days: number | null
  cron_expression: string
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  last_run_deleted_count: number | null
  created_at: string
}

export interface PolicyCreate {
  name: string
  target_type: PolicyTargetType
  bucket_patterns: string[]
  tag_key?: string | null
  tag_value?: string | null
  prefix_filter?: string | null
  older_than_days?: number | null
  cron_expression?: string
  is_active?: boolean
}

export interface EntraUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
}

export const usersApi = {
  list: () => apiClient.get<UserRead[]>('/users'),
  get: (id: string) => apiClient.get<UserRead>(`/users/${id}`),
  create: (data: UserCreate) => apiClient.post<UserRead>('/users', data),
  update: (id: string, data: UserUpdate) => apiClient.patch<UserRead>(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  searchEntra: (q: string) => apiClient.get<EntraUser[]>('/users/entra/search', { params: { q } }),
  importEntra: (users: EntraUser[], groupIds: string[]) =>
    apiClient.post<UserRead[]>('/users/entra/import', { users, group_ids: groupIds }),
}

export const groupsApi = {
  list: () => apiClient.get<GroupRead[]>('/groups'),
  get: (id: string) => apiClient.get<GroupRead>(`/groups/${id}`),
  create: (data: GroupCreate) => apiClient.post<GroupRead>('/groups', data),
  update: (id: string, data: Partial<GroupCreate>) => apiClient.patch<GroupRead>(`/groups/${id}`, data),
  delete: (id: string) => apiClient.delete(`/groups/${id}`),
  assignUsers: (groupId: string, userIds: string[]) =>
    apiClient.post(`/groups/${groupId}/users`, { user_ids: userIds }),
  addPermission: (groupId: string, perm: Omit<BucketPermission, 'id' | 'group_id'>) =>
    apiClient.post<BucketPermission>(`/groups/${groupId}/permissions`, perm),
  deletePermission: (groupId: string, permId: string) =>
    apiClient.delete(`/groups/${groupId}/permissions/${permId}`),
}

export const policiesApi = {
  list: () => apiClient.get<CleanupPolicy[]>('/policies'),
  get: (id: string) => apiClient.get<CleanupPolicy>(`/policies/${id}`),
  create: (data: PolicyCreate) => apiClient.post<CleanupPolicy>('/policies', data),
  update: (id: string, data: Partial<PolicyCreate>) => apiClient.patch<CleanupPolicy>(`/policies/${id}`, data),
  delete: (id: string) => apiClient.delete(`/policies/${id}`),
  run: (id: string) => apiClient.post(`/policies/${id}/run`),
}
