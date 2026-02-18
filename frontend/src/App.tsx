import { Routes, Route, BrowserRouter, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import DashboardLayout from './layouts/DashboardLayout';
import StudentDashboard from './pages/dashboard/StudentDashboard';
import RegistrarDashboard from './pages/dashboard/RegistrarDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import LandingPage from './pages/LandingPage';
import Unauthorized from './pages/Unauthorized';
// Determine role based on metadata or specific logic - mocked for now or derived from user data

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route
          path="/dashboard"
          element={
            <>
              <SignedIn>
                <DashboardLayout />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        >
           {/* Role-based sub-routes will be handled in Layout or here */}
           <Route path="student" element={<StudentDashboard />} />
           <Route path="registrar" element={<RegistrarDashboard />} />
           <Route path="admin" element={<AdminDashboard />} />
        </Route>
        
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;