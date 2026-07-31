import React, { useState } from 'react';

/* ============================================================
   Sidebar — Escalágil redesign
   Mesma API/props e lógica do original (activeTab, onTabChange,
   onToggle, isAdmin). Visual remodelado: glass, indicador
   ativo com glow, ícones numéricos e transições suaves.
   Não depende mais do Sidebar.module.css.
   ============================================================ */

const SIDEBAR_STYLES = `
.eg-aside {
  --border: rgba(255,255,255,0.08);
  --text: #eaf1f9;
  --muted: #8c9bb3;
  --accent: #4aa8ff;
  position: fixed; top: 72px; left: 0; bottom: 0; z-index: 900;
  width: 214px;
  display: flex; flex-direction: column;
  padding: 16px 12px;
  background: rgba(8,11,22,0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-right: 1px solid var(--border);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.eg-aside.collapsed { width: 60px; padding: 16px 8px; }
.eg-aside.collapsed .eg-toggle { width: 44px; height: 44px; margin-left: auto; margin-right: auto; }

.eg-toggle {
  display: grid; place-items: center;
  width: 100%; height: 52px; margin-bottom: 16px;
  padding: 0;
  border-radius: 12px; border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  color: var(--muted); cursor: pointer; font-size: 20px;
  transition: all .25s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0;
  backdrop-filter: blur(8px);
}
.eg-aside.collapsed .eg-toggle {
  width: 40px !important; height: 40px !important; font-size: 16px;
  margin: 0 auto 16px;
}
.eg-toggle:hover {
  color: var(--accent); border-color: rgba(74,168,255,0.5);
  background: linear-gradient(135deg, rgba(74,168,255,0.15), rgba(74,168,255,0.05));
  box-shadow: 0 0 16px rgba(74,168,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
  transform: translateY(-1px);
}
.eg-toggle:active { transform: translateY(0); }

.eg-nav-list { display: flex; flex-direction: column; gap: 4px; }

.eg-item {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 11px 12px;
  border: 1px solid transparent; border-radius: 12px;
  background: transparent; color: var(--muted);
  cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600;
  text-align: left; white-space: nowrap;
  transition: all .2s ease;
}
.eg-item:hover { background: rgba(255,255,255,0.045); color: var(--text); }

.eg-item.active {
  background: linear-gradient(90deg, rgba(74,168,255,0.16), rgba(74,168,255,0.04));
  border-color: rgba(74,168,255,0.28);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}
.eg-item.active::before {
  content: ''; position: absolute; left: -12px; top: 50%; transform: translateY(-50%);
  width: 3px; height: 22px; border-radius: 0 4px 4px 0;
  background: var(--accent); box-shadow: 0 0 12px var(--accent);
}

.eg-icon {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 32px; height: 32px; border-radius: 12px;
  font-size: 16px; color: var(--muted); transition: all .2s ease;
}
.eg-icon svg {
  width: 18px; height: 18px;
  transition: all .2s ease;
}
.eg-item:hover .eg-icon { color: var(--text); }
.eg-item.active .eg-icon {
  color: #ffffff;
  background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 6px 14px -6px rgba(74,168,255,0.8);
}
.eg-item.active .eg-icon svg {
  width: 19px; height: 19px;
}
.eg-aside.collapsed .eg-icon {
  width: 28px; height: 28px; font-size: 14px;
  border-radius: 10px;
}
.eg-aside.collapsed .eg-icon svg {
  width: 18px; height: 18px;
}
.eg-aside.collapsed .eg-item.active .eg-icon {
  box-shadow: 0 4px 10px -4px rgba(74,168,255,0.6);
}

.eg-lbl { transition: opacity .2s ease; }
.eg-aside.collapsed .eg-lbl { opacity: 0; pointer-events: none; }

.eg-aside.collapsed .eg-item {
  padding: 11px 7px;
}
.eg-aside.collapsed .eg-item.active::before {
  display: none;
}
`;

const getIcon = (id) => {
  const icons = {
    escala: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    implantacao: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3"/><polyline points="12 12 20 7.5"/><polyline points="12 21 12 12"/><polyline points="4 7.5 12 12"/></svg>,
    perfil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    usuarios: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    logs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
  };
  return icons[id] || null;
};

export default function Sidebar({ activeTab, onTabChange, onToggle, isAdmin = false }) {
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  const tabs = [
    { id: 'escala', label: 'Escala' },
    ...(isAdmin ? [{ id: 'implantacao', label: 'Implantacao' }] : []),
    { id: 'perfil', label: 'Perfil' },
    ...(isAdmin ? [{ id: 'usuarios', label: 'Usuários' }] : []),
    ...(isAdmin ? [{ id: 'logs', label: 'Logs' }] : [])
  ];

  // Definir aba padrão como 'escala' se a aba ativa não for permitida
  React.useEffect(() => {
    const allowed = tabs.map((t) => t.id);
    if (!allowed.includes(activeTab)) {
      onTabChange('escala');
    }
  }, [isAdmin]);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggle) onToggle(newState);
  };

  return (
    <aside className={`eg-aside ${!isExpanded ? 'collapsed' : ''}`}>
      <style>{SIDEBAR_STYLES}</style>

      <button className="eg-toggle" onClick={handleToggle} title={isExpanded ? 'Ocultar' : 'Expandir'}>
        <span aria-hidden="true">☰</span>
      </button>

      <div className="eg-nav-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`eg-item ${activeTab === tab.id ? 'active' : ''}`}
            title={tab.label}
          >
            <span className="eg-icon">{getIcon(tab.id)}</span>
            <span className="eg-lbl">{tab.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
