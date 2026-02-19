import { Routes, Route, BrowserRouter, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import StudentDashboard from './pages/dashboard/StudentDashboard';
import RegistrarDashboard from './pages/dashboard/RegistrarDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Unauthorized from './pages/Unauthorized';
import { useLegacyAuth } from './auth/legacy-auth-context';

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading } = useLegacyAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-medium">Loading session...</div>;
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
        
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="student/*" element={<StudentDashboard />} />
          <Route path="registrar/*" element={<RegistrarDashboard />} />
          <Route path="admin/*" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
