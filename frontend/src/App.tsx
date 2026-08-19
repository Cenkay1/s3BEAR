import React, { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './store/auth'
import AppLayout from './components/Layout'
import LoginPage from './pages/Login'
import AuthCallbackPage from './pages/Login/Callback'
import BucketsPage from './pages/Buckets'
import SharesPage from './pages/Shares'
import UsersPage from './pages/Users'
import GroupsPage from './pages/Groups'
import PoliciesPage from './pages/Policies'
import SettingsPage from './pages/Settings'
import AuditLogPage from './pages/AuditLog'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user && !user.is_admin) return <Navigate to="/buckets" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, loadUser } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) loadUser()
  }, [isAuthenticated])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/buckets" replace />} />
          <Route path="buckets" element={<BucketsPage />} />
          <Route path="buckets/:bucketName" element={<BucketsPage />} />
          <Route path="shares" element={<SharesPage />} />
          <Route
            path="users"
            element={
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            }
          />
          <Route
            path="groups"
            element={
              <RequireAdmin>
                <GroupsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="policies"
            element={
              <RequireAdmin>
                <PoliciesPage />
              </RequireAdmin>
            }
          />
          <Route
            path="audit"
            element={
              <RequireAdmin>
                <AuditLogPage />
              </RequireAdmin>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAdmin>
                <SettingsPage />
              </RequireAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
