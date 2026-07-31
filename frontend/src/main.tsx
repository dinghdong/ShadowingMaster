import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tokens.css'
import './components.css'
import { initTheme } from './theme-mode'
import App from './App.tsx'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
