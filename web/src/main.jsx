import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext'
import AuthGate from './lib/AuthGate'

// HashRouter, not BrowserRouter: the built app ships as static files inside
// the extension, with no server to rewrite deep paths to index.html.
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
