import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Implantacao from './pages/Implantacao';
import Sidebar from './components/Sidebar';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('escala');
  const [loading, setLoading] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    if (token) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Interceptor para token expirado
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [token]);

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handleSidebarToggle = (isExpanded) => {
    setSidebarExpanded(isExpanded);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar-gradient" style={{
        background: '#0d171e',
        padding: '16px 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#e8eef5', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Escalágil</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400', display: 'flex', alignItems: 'center', gap: '12px' }}>
                uma solução Contagil
                <svg width="16" height="20" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ flexShrink: 0 }}>
                  <rect width="34" height="42" fill="url(#pattern0_3825_3)"/>
                  <defs>
                    <pattern id="pattern0_3825_3" patternContentUnits="objectBoundingBox" width="1" height="1">
                      <use xlinkHref="#image0_3825_3" transform="scale(0.0294118 0.0238095)"/>
                    </pattern>
                    <image id="image0_3825_3" width="34" height="42" preserveAspectRatio="none" xlinkHref="data:image/png;base64,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"/>
                  </defs>
                </svg>
              </span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#e8eef5', fontSize: '14px' }}>Bem-vindo, {user?.name || 'Usuário'}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 14px',
                background: 'rgba(59,130,246,0.15)',
                color: '#0ea5e9',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onToggle={handleSidebarToggle} />

      <div style={{ marginLeft: sidebarExpanded ? '214px' : '60px', marginTop: '76px', flex: 1, overflow: 'auto', height: 'calc(100vh - 76px)', transition: 'margin-left 0.3s ease' }}>
        <main style={{ minHeight: '100%' }}>
          {activeTab === 'escala' && <Dashboard token={token} />}
          {activeTab === 'implantacao' && <Implantacao />}

          {activeTab !== 'escala' && activeTab !== 'implantacao' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              color: '#94a3b8',
              fontSize: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p>Esta página ainda não foi implementada</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer style={{
        background: '#0d171e',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 24px',
        color: '#e8eef5',
        position: 'relative',
        zIndex: 1001,
        height: '76px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
          width: '100%'
        }}>
          <div style={{ fontSize: '12px' }}>
            <strong>Contagil Contabilidade</strong>
          </div>

          <div style={{ display: 'flex', gap: '24px', fontSize: '12px', flex: 1, justifyContent: 'center' }}>
            <a href="#" style={{ color: '#ffffff', textDecoration: 'none' }}>Documentação</a>
            <a href="#" style={{ color: '#ffffff', textDecoration: 'none' }}>Contato</a>
            <a href="https://www.contagilpb.com.br" target="_blank" rel="noopener" style={{ color: '#ffffff', textDecoration: 'none' }}>Contagil</a>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', whiteSpace: 'nowrap' }}>
            © 2026 Escalágil · uma solução Contagil
          </div>
        </div>
      </footer>
    </div>
  );
}
