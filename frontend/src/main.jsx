import { StrictMode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react';
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { ENV } from './config/env.js'

const queryClient = new QueryClient()

function resolveClerkConfig(location) {
  const isAdminContext =
    location.pathname.startsWith('/admin-auth') ||
    location.pathname.startsWith('/admin-dashboard');

  if (isAdminContext) {
    if (!ENV.CLERK_ADMIN_PUBLISHABLE_KEY) {
      throw new Error('Missing VITE_CLERK_ADMIN_PUBLISHABLE_KEY for admin auth routes.');
    }
    return {
      publishableKey: ENV.CLERK_ADMIN_PUBLISHABLE_KEY,
      context: 'admin',
    };
  }

  if (!ENV.CLERK_PUBLISHABLE_KEY) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY for user auth routes.');
  }

  return {
    publishableKey: ENV.CLERK_PUBLISHABLE_KEY,
    context: 'user',
  };
}

export function ClerkRouterWrapper({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { publishableKey, context } = resolveClerkConfig(location);

  return (
    <ClerkProvider
      key={`${context}:${publishableKey}`}
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
