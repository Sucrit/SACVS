import { StrictMode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react';
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { ENV } from './config/env.js'

const queryClient = new QueryClient()

function resolveClerkKey(location) {
  const searchParams = new URLSearchParams(location.search);
  const role = (searchParams.get('role') || '').trim().toLowerCase();
  const isAdminContext =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/admin-auth') ||
    (location.pathname === '/auth' && role === 'admin') ||
    (location.pathname === '/auth/success' && role === 'admin');

  if (isAdminContext && ENV.CLERK_ADMIN_PUBLISHABLE_KEY) {
    return ENV.CLERK_ADMIN_PUBLISHABLE_KEY;
  }
  return ENV.CLERK_PUBLISHABLE_KEY;
}

export function ClerkRouterWrapper({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const publishableKey = resolveClerkKey(location);

  if (!publishableKey) {
    throw new Error('Missing Clerk publishable key in frontend environment.');
  }

  return (
    <ClerkProvider
      key={publishableKey}
      publishableKey={publishableKey}
      navigate={(to) => navigate(to)}
    >
      {children}
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkRouterWrapper>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkRouterWrapper>
    </BrowserRouter>
  </StrictMode>
)
