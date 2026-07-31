import { useState, useEffect } from 'react';
import axios from 'axios';
import EscalaSchedule from '../components/EscalaSchedule';

/* ============================================================
   Escala — Escalágil (redesign premium)
   Mesma lógica/API do original. Header alinhado aos redesigns
   (fundo escuro, arco de luz, grade de pontos, eyebrow com ponto
   pulsante, título em gradiente). O EscalaSchedule renderiza
   DIRETO, sem painel envolvente, para evitar "card dentro de card".
   ============================================================ */

const styles = `
  @keyframes esc-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes esc-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @keyframes esc-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  @keyframes esc-spin { to { transform: rotate(360deg); } }
  .esc-fade { animation: esc-fade-up .6s cubic-bezier(.22,.61,.36,1) both; }
  .esc-spin { animation: esc-spin .9s linear infinite; }

  .esc-btn { transition: filter .15s ease, transform .1s ease, box-shadow .2s ease; }
  .esc-btn:hover { filter: brightness(1.08); box-shadow: 0 12px 30px -10px rgba(74,168,255,0.6); }
  .esc-btn:active { transform: translateY(1px); }
`;

export default function Escala({ token }) {
  const [schedule, setSchedule] = useState(null);
  const [demand, setDemand] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      console.error('Token não disponível');
      setLoading(false);
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Token:', token ? 'Presente' : 'Ausente');

      const api = axios.create({
        baseURL: '/api',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const [scheduleRes, demandRes, employeesRes] = await Promise.all([
        api.get('/schedule'),
        api.get('/schedule/demand?day=6'),
        api.get('/employees')
      ]);

      setSchedule(scheduleRes.data);
      setDemand(demandRes.data);
      setEmployees(employeesRes.data);
      console.log('Dados carregados com sucesso');
    } catch (err) {
      console.error('Erro ao carregar dados:', err.response?.status, err.response?.data);
      const errorMsg = err.response?.data?.error || err.message;
      if (err.response?.status === 400 || errorMsg.includes('Configure a loja')) {
        setError('Configure a loja em Implantação antes de gerar a escala');
      } else {
        setError(errorMsg || 'Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  };

  // Validar se há colaboradores importados (etapa 2 da Implantação)
  const hasEmployees = employees && employees.length > 0;

  // ---------------- Estilos ----------------
  const c = { text: '#e8eef5', muted: '#94a3b8', accent: '#4aa8ff' };

  const containerStyle = {
    position: 'relative',
    minHeight: '100vh',
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
    filter: 'blur(6px)', pointerEvents: 'none', animation: 'esc-breathe 7s ease-in-out infinite',
  };

  const gridStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    maskImage: 'radial-gradient(760px 400px at 50% 0%, #000 0%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(760px 400px at 50% 0%, #000 0%, transparent 78%)',
  };

  const contentStyle = { position: 'relative', maxWidth: '1280px', margin: '0 auto' };

  const eyebrowStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    margin: '0 0 14px', padding: '5px 12px', borderRadius: '999px',
    background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.22)',
    color: '#bcd8ff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em',
  };
  const dotStyle = { width: '6px', height: '6px', borderRadius: '50%', background: c.accent, boxShadow: `0 0 10px ${c.accent}`, animation: 'esc-dot 1.8s ease-in-out infinite' };

  const titleStyle = {
    margin: '0 0 10px', fontSize: '34px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em',
    background: 'linear-gradient(180deg, #ffffff 0%, #b9d4ff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  };
  const subtitleStyle = { margin: '0 0 30px', fontSize: '15px', color: c.muted, lineHeight: 1.5 };

  // ---------------- Loading ----------------
  if (loading) {
    return (
      <div style={containerStyle}>
        <style>{styles}</style>
        <div style={arcStyle} />
        <div style={gridStyle} />
        <div style={{ ...contentStyle, minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px' }} className="esc-fade">
          <div
            className="esc-spin"
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              border: '3px solid rgba(74,168,255,0.15)', borderTopColor: c.accent,
            }}
          />
          <div style={{ fontSize: '14px', color: c.muted, letterSpacing: '.02em' }}>Carregando escala...</div>
        </div>
      </div>
    );
  }

  // ---------------- Erro / Configuração necessária ----------------
  if (error) {
    const errorPanel = {
      position: 'relative', maxWidth: '460px', width: '100%', padding: '34px 30px', textAlign: 'center',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
      border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px',
      boxShadow: '0 30px 80px -40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    };
    return (
      <div style={containerStyle}>
        <style>{styles}</style>
        <div style={arcStyle} />
        <div style={gridStyle} />
        <div style={{ ...contentStyle, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="esc-fade" style={errorPanel}>
            <div
              style={{
                width: '54px', height: '54px', margin: '0 auto 18px', borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fcd34d', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 8v5 M12 16h.01" />
              </svg>
            </div>
            <h2 style={{ fontSize: '20px', margin: '0 0 10px', fontWeight: 700, color: c.text }}>Configuração necessária</h2>
            <p style={{ margin: '0 0 22px', color: c.muted, fontSize: '14px', lineHeight: 1.55 }}>{error}</p>
            <button
              className="esc-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'implantacao' }))}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px', border: 'none', borderRadius: '11px', cursor: 'pointer',
                fontSize: '13.5px', fontWeight: 700, fontFamily: 'inherit', color: '#ffffff',
                background: 'linear-gradient(135deg, #6cc0ff, #3a7bff)',
                boxShadow: '0 12px 28px -10px rgba(74,168,255,0.7), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </svg>
              Ir para Implantação
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Escala ----------------
  return (
    <div style={containerStyle}>
      <style>{styles}</style>
      <div style={arcStyle} />
      <div style={gridStyle} />

      <div style={contentStyle}>
        {!hasEmployees && !loading && (
          <div className="esc-fade" style={{ marginBottom: '24px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', marginBottom: '4px' }}>Colaboradores não importados</div>
              <div style={{ fontSize: '12px', color: c.muted }}>Complete a etapa 2 da Implantação para importar dados dos colaboradores e gerar a escala.</div>
            </div>
          </div>
        )}

        <div className="esc-fade">
          <span style={eyebrowStyle}><span style={dotStyle} /> Planejamento</span>
          <h2 style={titleStyle}>Escala da sua equipe</h2>
          <p style={subtitleStyle}>Visualize e ajuste a distribuição de turnos com base na demanda da loja.</p>
        </div>

        {/* Sem painel envolvente: o EscalaSchedule já tem seus próprios cards */}
        {/* Só renderiza se houver colaboradores importados */}
        {schedule && hasEmployees && (
          <div className="esc-fade" style={{ animationDelay: '.08s' }}>
            <EscalaSchedule
              schedule={schedule.schedule}
              demand={demand}
              employees={employees}
              periodo={schedule.periodo}
              token={token}
              storeHours={schedule.storeHours}
              pdvs={schedule.storeHours?.pdvs}
            />
          </div>
        )}
      </div>
    </div>
  );
}