import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ArtifactPage from './components/ArtifactPage.tsx'

// /artifact/:slug is a standalone public page (candidate #3 — shareable URL,
// no login, no WorkPal shell). Everything else flows through App's own URL
// parsing, so we keep the catch-all wildcard route to App.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/artifact/:slug" element={<ArtifactPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
