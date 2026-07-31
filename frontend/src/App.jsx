import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './pages/Login';
import Escala from './pages/Escala';
import Implantacao from './pages/Implantacao';
import Usuarios from './pages/Usuarios';
import Logs from './pages/Logs';
import Perfil from './pages/Perfil';
import Sidebar from './components/Sidebar';
import './index.css';
import './App.responsive.css';

/* ============================================================
   Shell (Navbar + Footer) — Escalágil redesign
   Mesma lógica do original: estado, interceptors, troca de aba,
   props do Sidebar e das páginas permanecem idênticos.
   Só o visual foi remodelado (glass, gradientes, hover, glow).
   ============================================================ */

const SHELL_STYLES = `
.eg-shell {
  --bg: #05070f;
  --bg-2: #080b16;
  --border: rgba(255,255,255,0.08);
  --text: #eaf1f9;
  --muted: #8c9bb3;
  --accent: #4aa8ff;
  --accent-2: #7c5cff;
  background: var(--bg);
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 100vh;
}

/* ---------- Navbar ---------- */
.eg-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  height: 72px; display: flex; align-items: center;
  padding: 0 24px;
  background: rgba(8,11,22,0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid var(--border);
}
.eg-nav::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(74,168,255,0.6), rgba(124,92,255,0.5), transparent);
  opacity: .8;
}
.eg-nav-row { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px; }
.eg-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.eg-brand-mark {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 8px 20px -8px rgba(74,168,255,0.8), inset 0 1px 0 rgba(255,255,255,0.4);
  color: #05101f; font-weight: 900; font-size: 16px;
}
.eg-brand-txt { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.eg-brand-name {
  margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.02em;
  background: linear-gradient(180deg, #ffffff, #a9c4e6);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  white-space: nowrap;
}
.eg-brand-sub { font-size: 12px; color: var(--muted); font-weight: 400; white-space: nowrap; }

.eg-nav-right { display: flex; align-items: center; gap: 14px; margin-left: auto; }
.eg-welcome { display: flex; align-items: center; gap: 9px; color: var(--text); font-size: 13.5px; white-space: nowrap; }
.eg-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center; flex-shrink: 0;
  background: rgba(74,168,255,0.14); border: 1px solid rgba(74,168,255,0.3);
  color: #bcd8ff; font-size: 12px; font-weight: 700; text-transform: uppercase;
}
.eg-welcome b { color: #cfe0f2; font-weight: 700; }
.eg-logout {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 15px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  color: #cbd7e6; border: 1px solid var(--border);
  cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit;
  transition: all .2s ease; min-height: 38px;
}
.eg-logout:hover {
  background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.4); color: #fca5a5;
  transform: translateY(-1px);
}
.eg-logout svg { width: 15px; height: 15px; }

/* ---------- Footer ---------- */
.eg-footer {
  position: relative; z-index: 10;
  padding: 31px 32px 26px;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(8,11,22,0.4), rgba(5,7,15,0.9));
  color: var(--text);
}
.eg-footer::before {
  content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(74,168,255,0.5), transparent);
}
.eg-footer-grid {
  display: flex; flex-wrap: wrap; gap: 24px 40px;
  align-items: flex-start; justify-content: space-between;
  max-width: 1100px; margin: 0 auto;
}
.eg-footer-brand { display: flex; flex-direction: column; gap: 6px; min-width: 180px; }
.eg-footer-brand strong {
  font-size: 14px;
  background: linear-gradient(180deg, #ffffff, #a9c4e6);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.eg-footer-brand span { font-size: 12px; color: var(--muted); max-width: 240px; line-height: 1.5; }
.eg-footer-links { display: flex; flex-wrap: wrap; gap: 8px 26px; }
.eg-footer-links a {
  position: relative; color: var(--muted); text-decoration: none;
  font-size: 13px; font-weight: 500; padding: 2px 0; transition: color .2s ease;
}
.eg-footer-links a::after {
  content: ''; position: absolute; left: 0; bottom: -2px; width: 0; height: 1px;
  background: var(--accent); transition: width .25s ease;
}
.eg-footer-links a:hover { color: #dbe7f5; }
.eg-footer-links a:hover::after { width: 100%; }
.eg-footer-copy { width: 100%; margin: 0px auto 0; max-width: 1100px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.05); font-size: 11.5px; color: #5c6a82; }

@media (max-width: 640px) {
  .eg-footer-grid { flex-direction: column; gap: 20px; }
  .eg-footer-copy { text-align: left; }
}
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('escala');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarExpanded, setSidebarExpanded] = useState(window.innerWidth >= 768);
  const [sessionExpired, setSessionExpired] = useState(false);

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
          setSessionExpired(true);
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [token]);

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    const handleCustomTabChange = (e) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('changeTab', handleCustomTabChange);
    return () => window.removeEventListener('changeTab', handleCustomTabChange);
  }, []);

  const handleSidebarToggle = (isExpanded) => {
    setSidebarExpanded(isExpanded);
  };

  if (!token) {
    return <Login onLogin={handleLogin} sessionExpired={sessionExpired} />;
  }

  const initials = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="eg-shell">
      <style>{SHELL_STYLES}</style>

      <nav className="eg-nav">
        <div className="eg-nav-row">
          <div className="eg-brand">
            <span className="eg-brand-txt">
              <h1 className="eg-brand-name">Escalágil</h1>
              {!isMobile && <span className="eg-brand-sub">uma solução Contagil</span>}
            </span>
          </div>

          <div className="eg-nav-right">
            {!isMobile && (
              <span className="eg-welcome">
                <span className="eg-avatar" aria-hidden="true">{initials}</span>
                Bem-vindo, <b>{user?.name || 'Usuário'}</b>
              </span>
            )}
            <button onClick={handleLogout} className="eg-logout" title="Sair">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </nav>

      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onToggle={handleSidebarToggle} isAdmin={!!user?.is_admin} />

      <div style={{
        marginLeft: sidebarExpanded ? '214px' : '60px',
        marginTop: '72px',
        transition: 'margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <main>
          {activeTab === 'escala' && <Escala token={token} />}
          {activeTab === 'implantacao' && user?.is_admin && <Implantacao />}
          {activeTab === 'usuarios' && user?.is_admin && <Usuarios />}
          {activeTab === 'logs' && user?.is_admin && <Logs />}
          {activeTab === 'perfil' && <Perfil />}

          <footer className="eg-footer">
            <div className="eg-footer-grid">
              <div className="eg-footer-brand">
                <strong>Contagil Contabilidade</strong>
                <span>Soluções inteligentes de gestão contábil e escalas de equipe.</span>
              </div>

              <div className="eg-footer-links">
                <a href="#">Documentação</a>
                <a href="#">Contato</a>
                <a href="https://www.contagilpb.com.br" target="_blank" rel="noopener">Contagil</a>
                <div className="eg-footer-copy">
                  © 2026 Escalágil · uma solução Contagil
                </div>
              </div>
            </div>

            
          </footer>
        </main>
      </div>
    </div>
  );
}
