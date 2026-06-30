import React, { useState } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ activeTab, onTabChange, onToggle }) {
  const isMobile = window.innerWidth < 768;
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggle) onToggle(newState);
  };

  const tabs = [
    { id: 'diagnostico', label: 'Diagnostico', number: '01' },
    { id: 'escala', label: 'Escala', number: '02' },
    { id: 'domingos', label: 'Domingos', number: '03' },
    { id: 'auditoria', label: 'Auditoria', number: '04' },
    { id: 'controlador', label: 'Controlador', number: '05' },
    { id: 'financeiro', label: 'Financeiro', number: '06' },
    { id: 'resiliencia', label: 'Resiliencia', number: '07' },
    { id: 'setores', label: 'Setores', number: '08' },
    { id: 'memoria', label: 'Memoria', number: '09' },
    { id: 'implantacao', label: 'Implantacao', number: '10' }
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
