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

const styles = `
  @keyframes logs-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes logs-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @keyframes logs-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  .logs-fade { animation: logs-fade-up .6s cubic-bezier(.22,.61,.36,1) both; }
  .logs-row { transition: background .18s ease; }
  .logs-row:hover { background: rgba(74,168,255,0.05); }
  .logs-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .logs-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
`;

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
    text: '#e8eef5', muted: '#94a3b8', accent: '#4aa8ff'
  };

  const tones = {
    sky: { bg: 'rgba(74,168,255,0.14)', color: '#4aa8ff', border: 'rgba(74,168,255,0.3)' },
    emerald: { bg: 'rgba(52,211,153,0.14)', color: '#34d399', border: 'rgba(52,211,153,0.3)' },
    red: { bg: 'rgba(248,113,113,0.14)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  };

  const containerStyle = {
    position: 'relative',
    // minHeight: '100vh',
    padding: '40px 32px 48px',
    color: c.text,
    fontFamily: 'inherit',
    background: 'radial-gradient(1200px 600px at 50% -320px, #0f1b33 0%, #0a0e1a 55%, #070a13 100%)',
    overflow: 'hidden',
  };

  const arcStyle = {
    position: 'absolute', top: '-260px', left: '50%', transform: 'translateX(-50%)',
    width: '900px', height: '520px', borderRadius: '50%',
    background: 'radial-gradient(closest-side, rgba(74,168,255,0.28), rgba(74,168,255,0.04) 62%, transparent 72%)',
    filter: 'blur(6px)', pointerEvents: 'none', animation: 'logs-breathe 7s ease-in-out infinite',
  };

  const gridStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    maskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
  };

  const contentStyle = { position: 'relative', maxWidth: '1040px', margin: '0 auto' };

  const eyebrowStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    margin: '0 0 14px', padding: '5px 12px', borderRadius: '999px',
    background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.22)',
    color: '#bcd8ff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em',
  };
  const dotStyle = { width: '6px', height: '6px', borderRadius: '50%', background: c.accent, boxShadow: `0 0 10px ${c.accent}`, animation: 'logs-dot 1.8s ease-in-out infinite' };

  const titleStyle = {
    margin: '0 0 10px', fontSize: '34px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em',
    background: 'linear-gradient(180deg, #ffffff 0%, #b9d4ff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  };
  const subtitleStyle = { margin: '0 0 30px', fontSize: '15px', color: c.muted, lineHeight: 1.5 };

  const panelStyle = {
    position: 'relative',
    minHeight: '421px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '18px', padding: '10px',
    boxShadow: '0 30px 80px -40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  };

  const th = { textAlign: 'left', padding: '13px 16px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.07em', color: c.muted, borderBottom: '1px solid rgba(255,255,255,0.09)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#0d1220', zIndex: 1 };
  const td = { padding: '14px 16px', fontSize: '13px', color: c.text, borderBottom: '1px solid rgba(255,255,255,0.05)' };

  const badge = (eventType) => {
    const info = EVENT_LABELS[eventType] || { label: eventType, tone: 'sky' };
    const t = tones[info.tone];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '4px 11px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
        {info.label}
      </span>
    );
  };

  return (
    <div style={containerStyle}>
      <style>{styles}</style>
      <div style={arcStyle} />
      <div style={gridStyle} />

      <div style={contentStyle}>
        <div className="logs-fade">
          <span style={eyebrowStyle}><span style={dotStyle} /> Auditoria</span>
          <h2 style={titleStyle}>Logs da sua empresa</h2>
          <p style={subtitleStyle}>Acompanhe cada evento de segurança e atividade dos usuários em tempo real.</p>
        </div>

        <div className="logs-fade" style={{ ...panelStyle, animationDelay: '.08s' }}>
          {loading ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Carregando...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '48px 0' }}>Nenhum evento registrado ainda.</p>
          ) : (
            <div className="logs-scroll" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px' }}>
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
                    <tr key={log.id} className="logs-row">
                      <td style={td}>{badge(log.event_type)}</td>
                      <td style={{ ...td, color: c.muted }}>{log.description}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{log.performed_by}</td>
                      <td style={{ ...td, color: c.muted }}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
