import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, UserInfo } from '../api/auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: UserInfo) => void
  logout: () => void
  refresh: () => Promise<boolean>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
      },

      setUser: (user) => set({ user }),

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const res = await authApi.refresh(refreshToken)
          set({
            accessToken: res.data.access_token,
            refreshToken: res.data.refresh_token,
            isAuthenticated: true,
          })
          return true
        } catch {
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
          return false
        }
      },

      loadUser: async () => {
        try {
          const res = await authApi.me()
          set({ user: res.data })
        } catch {
          // token might be expired — handled by interceptor
        }
      },
    }),
    {
      name: 's3gw-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
