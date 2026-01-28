import { useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AdminDashboard from '@/pages/AdminDashboard'
import EmployerDashboard from '@/pages/EmployerDashboard'
import HomePage from '@/pages/Home'
import AuthPage from '@/pages/AuthPage'
import AuthSuccess from '@/pages/AuthSuccess'
import InstitutionDashboard from '@/pages/InstitutionDashboard'
import StudentDashboard from '@/pages/StudentDashboard'
import MainLayout from '@/layouts/MainLayout'
import { pageNameByPath } from '@/utils'

function App() {
  const location = useLocation()
  const currentPageName = pageNameByPath[location.pathname] || 'Home'

  return (
    <>
      <MainLayout currentPageName={currentPageName}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route path="/institution-dashboard" element={<InstitutionDashboard />} />
          <Route path="/employer-dashboard" element={<EmployerDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </>
  )
}

export default App
