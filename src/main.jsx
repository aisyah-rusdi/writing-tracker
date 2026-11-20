import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { applyTheme } from './lib/theme'
import { AppProvider } from './state/AppContext.jsx'
import App from './App.jsx'

// Apply the saved theme (System / Light / Dark) before the first paint.
applyTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)