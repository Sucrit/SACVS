import { Routes, Route, BrowserRouter, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import StudentDashboard from './pages/Student/StudentDashboard';
import InstitutionDashboard from './pages/Institution/InstitutionDashboard';
import EmployerDashboard from './pages/Employer/EmployerDashboard';
import AdminDashboard from './pages/Admin/AdminDashboard';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Unauthorized from './pages/Unauthorized';
import { useLegacyAuth } from './auth/auth-context';
import CredentialQrVerifyPage from './pages/Public/CredentialQrVerifyPage';
import RequestReceiptVerifyPage from './pages/Public/RequestReceiptVerifyPage';

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading } = useLegacyAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-[#f7f7f8] text-slate-700 font-medium">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/:mode" element={<AuthPage />} />
        <Route path="/auth/:mode/*" element={<AuthPage />} />
        <Route path="/verify/qr/:token" element={<CredentialQrVerifyPage />} />
        <Route path="/verify/receipt/:token" element={<RequestReceiptVerifyPage />} />
        
        <Route
          path="/student/*"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="*" element={<StudentDashboard />} />
        </Route>
        <Route
          path="/institution/*"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="*" element={<InstitutionDashboard />} />
        </Route>
        <Route
          path="/employer/*"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="*" element={<EmployerDashboard />} />
        </Route>
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="*" element={<AdminDashboard />} />
        </Route>
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
