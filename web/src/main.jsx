import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext'
import AuthGate from './lib/AuthGate'

// HashRouter, not BrowserRouter: the built app ships as static files
// inside the Chrome extension (chrome-extension://<id>/wishlist/...),
// with no server to fall back arbitrary deep paths to index.html.
// Hash-based routes (#/collections/irish) still give real, bookmarkable
// URLs with working back/forward, but always resolve to the one real
// file on refresh - a BrowserRouter path would 404 there instead.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <HashRouter>
        <AuthGate>
          <App />
        </AuthGate>
      </HashRouter>
    </AuthProvider>
  </StrictMode>,
)
