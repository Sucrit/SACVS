import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { LegacyAuthProvider } from './auth/legacy-auth-context'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LegacyAuthProvider>
      <App />
    </LegacyAuthProvider>
  </React.StrictMode>,
)
