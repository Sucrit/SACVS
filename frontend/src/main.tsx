import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ClerkProvider } from '@clerk/clerk-react'
import { LegacyAuthProvider } from './auth/auth-context'
import { ToastProvider } from './components/common/ToastProvider'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      signInUrl="/auth/signin"
      signUpUrl="/auth/signup"
      signInFallbackRedirectUrl="/auth/signin"
      signUpFallbackRedirectUrl="/auth/signup"
    >
      <LegacyAuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </LegacyAuthProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
