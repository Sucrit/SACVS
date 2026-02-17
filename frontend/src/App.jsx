import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AdminDashboard from '@/pages/AdminDashboard'
import RegistrarVerificationDashboard from '@/pages/RegistrarVerificationDashboard'
import RegistrarDashboard from '@/pages/RegistrarDashboard'
import RegistrarIssuingDashboard from '@/pages/RegistrarIssuingDashboard'
import HomePage from '@/pages/Home'
import AuthPage from '@/pages/AuthPage'
import AuthSuccess from '@/pages/AuthSuccess'
import StudentDashboard from '@/pages/StudentDashboard'
import PendingApproval from '@/pages/PendingApproval'
import MainLayout from '@/layouts/MainLayout'
import { pageNameByPath } from '@/utils'
import { useSyncUserToBackend } from '@/hooks/useSyncUserToBackend';
import ProtectedDashboardRoute from '@/components/auth/ProtectedDashboardRoute';

function App() {
  const location = useLocation()
  const currentPageName = pageNameByPath[location.pathname] || 'Home'
  useSyncUserToBackend(null);

  return (
    <>
      <MainLayout currentPageName={currentPageName}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/student-dashboard"
            element={(
              <ProtectedDashboardRoute allowedRoles={['STUDENT']}>
                <StudentDashboard />
              </ProtectedDashboardRoute>
            )}
          />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route
            path="/registrar-issuing-dashboard"
            element={(
              <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
                <RegistrarIssuingDashboard />
              </ProtectedDashboardRoute>
            )}
          />
          <Route
            path="/registrar-dashboard"
            element={(
              <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
                <RegistrarDashboard />
              </ProtectedDashboardRoute>
            )}
          />
          <Route
            path="/registrar-verification-dashboard"
            element={(
              <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
                <RegistrarVerificationDashboard />
              </ProtectedDashboardRoute>
            )}
          />
          <Route
            path="/admin-dashboard"
            element={(
              <ProtectedDashboardRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedDashboardRoute>
            )}
          />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </>
  )
}

export default App
