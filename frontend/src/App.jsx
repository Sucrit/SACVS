import { Navigate, Route, Routes } from 'react-router-dom'
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
import { useSyncUserToBackend } from '@/hooks/useSyncUserToBackend';
import ProtectedDashboardRoute from '@/components/auth/ProtectedDashboardRoute';

function App() {
  useSyncUserToBackend(null);

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <MainLayout currentPageName="Home">
            <HomePage />
          </MainLayout>
        )}
      />
      <Route
        path="/auth"
        element={(
          <MainLayout currentPageName="Home">
            <AuthPage />
          </MainLayout>
        )}
      />
      <Route
        path="/admin-auth"
        element={(
          <MainLayout currentPageName="Home">
            <AuthPage />
          </MainLayout>
        )}
      />
      <Route
        path="/auth/success"
        element={(
          <MainLayout currentPageName="Home">
            <AuthSuccess />
          </MainLayout>
        )}
      />
      <Route
        path="/student-dashboard"
        element={(
          <ProtectedDashboardRoute allowedRoles={['STUDENT']}>
            <MainLayout currentPageName="StudentDashboard">
              <StudentDashboard />
            </MainLayout>
          </ProtectedDashboardRoute>
        )}
      />
      <Route
        path="/registrar-issuing-dashboard"
        element={(
          <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
            <MainLayout currentPageName="RegistrarIssuingDashboard">
              <RegistrarIssuingDashboard />
            </MainLayout>
          </ProtectedDashboardRoute>
        )}
      />
      <Route
        path="/registrar-dashboard"
        element={(
          <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
            <MainLayout currentPageName="RegistrarDashboard">
              <RegistrarDashboard />
            </MainLayout>
          </ProtectedDashboardRoute>
        )}
      />
      <Route
        path="/registrar-verification-dashboard"
        element={(
          <ProtectedDashboardRoute allowedRoles={['REGISTRAR']}>
            <MainLayout currentPageName="RegistrarVerificationDashboard">
              <RegistrarVerificationDashboard />
            </MainLayout>
          </ProtectedDashboardRoute>
        )}
      />
      <Route
        path="/admin-dashboard"
        element={(
          <ProtectedDashboardRoute allowedRoles={['ADMIN']}>
            <MainLayout currentPageName="AdminDashboard">
              <AdminDashboard />
            </MainLayout>
          </ProtectedDashboardRoute>
        )}
      />
      <Route path="/pending-approval" element={<PendingApproval />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
