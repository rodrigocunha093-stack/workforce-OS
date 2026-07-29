import React, { useState } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeTab, onTabChange, onToggle, isAdmin = false }) {
  const isMobile = window.innerWidth < 768;
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  const tabs = [
    { id: 'escala', label: 'Escala', number: '01' },
    ...(isAdmin ? [{ id: 'implantacao', label: 'Implantacao', number: '02' }] : []),
    ...(isAdmin ? [{ id: 'usuarios', label: 'Usuários', number: '03' }] : []),
    ...(isAdmin ? [{ id: 'logs', label: 'Logs', number: '04' }] : []),
    { id: 'perfil', label: 'Perfil', number: '05' }
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
    <aside className={`${styles.sidebar} ${!isExpanded ? styles.collapsed : ''}`}>
      <button
        className={styles.toggleBtn}
        onClick={handleToggle}
        title={isExpanded ? 'Ocultar' : 'Expandir'}
      >
        <span className={styles.hamburger}>☰</span>
      </button>

      <div className={styles.sidebarContent}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`${styles.sidebarButton} ${activeTab === tab.id ? styles.active : ''}`}
            title={tab.label}
          >
            <span className={styles.number}>{tab.number}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
