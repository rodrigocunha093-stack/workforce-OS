import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminPlatform from './pages/AdminPlatform.jsx'

// /admin-plataforma é a área interna da Contagil (criação de empresas de
// clientes) — completamente separada do app do cliente, com login próprio.
const isAdminPlatform = window.location.pathname.startsWith('/admin-plataforma');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminPlatform ? <AdminPlatform /> : <App />}
  </React.StrictMode>,
)
