import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ArtifactPage from './components/ArtifactPage.tsx'
import { AuthProvider } from './lib/useAuth'
import AuthGate from './components/AuthGate'
import { setupErrorLogger } from './lib/errorLogger'

// §58 — attach window-level error + unhandledrejection listeners before any
// React code runs, so we capture initial-render exceptions too. Self-gates
// on IS_DEMO; safe to call unconditionally.
setupErrorLogger();

// /artifact/:slug is a standalone public page (candidate #3 — shareable URL,
// no login, no WorkPal shell). Everything else flows through the AuthGate +
// App; in IS_DEMO mode the AuthProvider synthesizes an always-authed state
// so the demo URL never sees the login screen.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/artifact/:slug" element={<ArtifactPage />} />
        <Route
          path="*"
          element={
            <AuthProvider>
              <AuthGate>
                <App />
              </AuthGate>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
