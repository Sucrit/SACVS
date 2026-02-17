import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AdminDashboard from '@/pages/AdminDashboard'
import RegistrarVerificationDashboard from '@/pages/RegistrarVerificationDashboard'
import RegistrarDashboard from '@/pages/RegistrarDashboard'
import RegistrarIssuingDashboard from '@/pages/RegistrarIssuingDashboard'
import HomePage from '@/pages/Home'
import AuthPage from '@/pages/AuthPage'
import AuthSuccess from '@/pages/AuthSuccess'
import StudentDashboard from '@/pages/StudentDashboard'
import MainLayout from '@/layouts/MainLayout'
import { pageNameByPath } from '@/utils'
import { useSyncUserToBackend } from '@/hooks/useSyncUserToBackend';

function App() {
  const location = useLocation()
  const currentPageName = pageNameByPath[location.pathname] || 'Home'
  useSyncUserToBackend(null);

  return (
    <>
      <MainLayout currentPageName={currentPageName}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route path="/registrar-issuing-dashboard" element={<RegistrarIssuingDashboard />} />
          <Route path="/registrar-dashboard" element={<RegistrarDashboard />} />
          <Route path="/registrar-verification-dashboard" element={<RegistrarVerificationDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </>
  )
}

export default App
