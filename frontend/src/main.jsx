import { StrictMode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react';
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient()

function ClerkRouterWrapper({ children }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} navigate={(to) => navigate(to)}>
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
