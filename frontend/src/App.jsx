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

  useEffect(() => {
    if (token) {
      setUser({ token });
    }
  }, [token]);

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
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

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        background: '#0d171e',
        borderBottom: '3px solid #0369a1',
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#e8eef5' }}>
              <span style={{ color: '#0ea5e9' }}>Escal</span>ágil <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400', marginLeft: '8px' }}>uma solução Contagil</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#e8eef5', fontSize: '14px' }}>Bem-vindo</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: '214px 1fr', flex: 1 }}>
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <main style={{ overflow: 'auto' }}>
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
    </div>
  );
}
