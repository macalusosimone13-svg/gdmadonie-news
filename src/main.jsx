import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/redesign.css'
import '@/redesign-dark.css'
import { setupEdgeSwipeGuard } from '@/lib/edgeSwipeGuard'

// Blocca lo swipe laterale "torna indietro" di Safari iOS (cronologia).
// Una sola volta all'avvio dell'app.
setupEdgeSwipeGuard();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
