import React, { useState, useEffect } from 'react';

const EVENT_LABELS = {
  login_success: { label: 'Login', tone: 'sky' },
  login_failed: { label: 'Login falhou', tone: 'red' },
  login_blocked: { label: 'Login bloqueado', tone: 'red' },
  user_created: { label: 'Usuário criado', tone: 'emerald' },
  user_activated: { label: 'Usuário ativado', tone: 'emerald' },
  user_deactivated: { label: 'Usuário desativado', tone: 'red' },
  password_changed: { label: 'Senha alterada', tone: 'sky' },
};

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await fetch('/api/admin/logs', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Erro ao carregar logs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const c = {
    bg: '#0a0e1a', panel: 'rgba(255,255,255,0.035)', panelBorder: 'rgba(255,255,255,0.08)',
    text: '#e8eef5', muted: '#94a3b8', accent: '#38bdf8'
  };

  const tones = {
    sky: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
    emerald: { bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
    red: { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  };

  const containerStyle = { background: c.bg, minHeight: '100vh', padding: '28px 32px 48px', color: c.text, fontFamily: 'inherit' };
  const panelStyle = { background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: '14px', padding: '22px' };
  const th = { textAlign: 'left', padding: '10px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, borderBottom: `1px solid ${c.panelBorder}` };
  const td = { padding: '10px', fontSize: '13px', color: c.text, borderBottom: `1px solid ${c.panelBorder}` };

  const badge = (eventType) => {
    const info = EVENT_LABELS[eventType] || { label: eventType, tone: 'sky' };
    const t = tones[info.tone];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: t.bg, color: t.color }}>
        {info.label}
      </span>
    );
  };

  return (
    <div style={containerStyle}>
      <p style={{ margin: '0 0 8px', color: c.accent, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Auditoria</p>
      <h2 style={{ margin: '0 0 24px', fontSize: '26px', color: c.text, fontWeight: 700 }}>Logs da sua empresa</h2>

      <div style={panelStyle}>
        {loading ? (
          <p style={{ color: c.muted, fontSize: 13 }}>Carregando...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Nenhum evento registrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Evento</th>
                  <th style={th}>Descrição</th>
                  <th style={th}>Realizado por</th>
                  <th style={th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={td}>{badge(log.event_type)}</td>
                    <td style={td}>{log.description}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{log.performed_by}</td>
                    <td style={td}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
