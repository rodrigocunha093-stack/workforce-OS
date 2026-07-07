import React, { useState } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeTab, onTabChange, onToggle }) {
  const isMobile = window.innerWidth < 768;
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  // Definir aba padrão como 'escala' se nenhuma aba estiver ativa
  React.useEffect(() => {
    if (activeTab !== 'escala' && activeTab !== 'implantacao') {
      onTabChange('escala');
    }
  }, []);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggle) onToggle(newState);
  };

  const tabs = [
    { id: 'escala', label: 'Escala', number: '01' },
    { id: 'implantacao', label: 'Implantacao', number: '02' }
  ];

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
