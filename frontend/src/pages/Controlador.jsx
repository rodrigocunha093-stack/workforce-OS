import { useState, useEffect } from 'react';
import axios from 'axios';

/* ============================================================
   Controlador — Escalágil
   Peças portadas do EscalaON:
   1) Previsão de demanda — 7 dias (decomposição dia-da-semana ×
      semana-do-mês, alimentada pelo histórico real de sales_data)
   2) Calendário de eventos (feriados fixos automáticos + eventos
      manuais que ajustam o fator de demanda)
   Visual no padrão do projeto, mas layout pensado por seção — cards
   pra previsão (não tabela), lista compacta pra eventos manuais com
   os feriados automáticos escondidos atrás de um "mostrar mais"
   (senão vira uma tabela gigante de itens que ninguém precisa ver
   toda hora).
   ============================================================ */

const TIPO_OPCOES = [
  { value: 'promocao', label: 'Promoção (×1.35)' },
  { value: 'data_comemorativa', label: 'Data comemorativa (×1.25)' },
  { value: 'pagamento', label: 'Dia de pagamento (×1.15)' },
  { value: 'feriado', label: 'Feriado (×0.30)' },
  { value: 'vespera', label: 'Véspera (×1.40)' },
];

const TIPO_INFO = {
  feriado: { label: 'Feriado', icon: '🎌', tone: '#f87171' },
  vespera: { label: 'Véspera', icon: '⏳', tone: '#fbbf24' },
  promocao: { label: 'Promoção', icon: '🏷️', tone: '#34d399' },
  data_comemorativa: { label: 'Comemorativa', icon: '🎉', tone: '#c084fc' },
  pagamento: { label: 'Pagamento', icon: '💰', tone: '#4aa8ff' },
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const STATUS_INFO = {
  adequado: { label: 'Equilibrado', cor: '#34d399' },
  leve_excesso: { label: 'Levemente folgado', cor: '#4aa8ff' },
  excesso: { label: 'Mais gente que o necessário', cor: '#4aa8ff' },
  deficit: { label: 'Risco de fila', cor: '#f87171' },
};

const styles = `
  @keyframes ctl-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ctl-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @keyframes ctl-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  .ctl-fade { animation: ctl-fade-up .6s cubic-bezier(.22,.61,.36,1) both; }
  .ctl-btn { transition: filter .15s ease, transform .1s ease, box-shadow .2s ease; }
  .ctl-btn:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 12px 30px -10px rgba(74,168,255,0.6); }
  .ctl-btn:active:not(:disabled) { transform: translateY(1px); }
  .ctl-btn:disabled { opacity: .6; cursor: default; }
  .ctl-input:focus { border-color: rgba(74,168,255,0.6) !important; box-shadow: 0 0 0 3px rgba(74,168,255,0.12); }
  .ctl-row { transition: background .15s ease; }
  .ctl-row:hover { background: rgba(74,168,255,0.05); }
  .ctl-del:hover { color: #fca5a5 !important; background: rgba(248,113,113,0.1) !important; }
  .ctl-toggle:hover { color: #cfe0f2 !important; }
  .ctl-scroll::-webkit-scrollbar { height: 8px; }
  .ctl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

  .ctl-panel { position: relative; }
  .ctl-panel::before {
    content: ''; position: absolute; inset: 0; border-radius: 18px; padding: 1px;
    background: linear-gradient(140deg, rgba(74,168,255,0.5), transparent 35%, transparent 65%, rgba(124,92,255,0.4));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .7;
  }

  .ctl-daycard {
    position: relative; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
    overflow: hidden;
  }
  .ctl-daycard::before {
    content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 1px; opacity: 0;
    background: linear-gradient(150deg, var(--ctl-accent, rgba(74,168,255,0.6)), transparent 55%, transparent 75%, var(--ctl-accent, rgba(74,168,255,0.6)));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
    transition: opacity .25s ease;
  }
  .ctl-daycard:hover { transform: translateY(-4px); box-shadow: 0 16px 32px -16px rgba(0,0,0,0.6); }
  .ctl-daycard:hover::before { opacity: 1; }
  .ctl-daycard.today::before { opacity: .9; }

  .ctl-ferias-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  @media (max-width: 900px) { .ctl-ferias-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .ctl-ferias-grid { grid-template-columns: 1fr; } }

  .ctl-daytab {
    padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8;
    transition: all .18s ease; white-space: nowrap;
  }
  .ctl-daytab:hover { color: #cfe0f2; border-color: rgba(74,168,255,0.3); }
  .ctl-daytab.active { color: #ffffff; background: linear-gradient(135deg, #6cc0ff, #3a7bff); border-color: transparent; }
  .ctl-hourrow { transition: background .15s ease; border-left: 3px solid transparent; }
  .ctl-hourrow:hover { background: rgba(255,255,255,0.03); }
`;

const c = { text: '#e8eef5', muted: '#94a3b8', faint: '#5b6880', accent: '#4aa8ff', red: '#f87171', green: '#34d399' };

const EMPTY_FORM = { data: '', tipo: 'promocao', nome: '', fator: '' };

function formatMoneyCompact(v) {
  const n = Number(v || 0);
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

export default function Controlador() {
  const [forecast, setForecast] = useState(null);
  const [forecastMsg, setForecastMsg] = useState('');
  const [loadingForecast, setLoadingForecast] = useState(true);

  const [eventos, setEventos] = useState([]);
  const [eventMap, setEventMap] = useState({});
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [showAutoEventos, setShowAutoEventos] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [caixaDow, setCaixaDow] = useState(new Date().getDay());
  const [caixaHoras, setCaixaHoras] = useState([]);
  const [caixaMsg, setCaixaMsg] = useState('');
  const [loadingCaixa, setLoadingCaixa] = useState(true);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const loadForecast = async () => {
    try {
      setLoadingForecast(true);
      const res = await axios.get('/api/forecast/7dias', { headers: authHeaders() });
      setForecast(res.data.forecast);
      setForecastMsg(res.data.message || '');
    } catch (err) {
      setForecastMsg(err.response?.data?.error || 'Erro ao carregar previsão.');
    } finally {
      setLoadingForecast(false);
    }
  };

  const loadEventos = async () => {
    try {
      setLoadingEventos(true);
      const res = await axios.get('/api/eventos', { headers: authHeaders() });
      setEventos(res.data.eventos || []);
      setEventMap(res.data.eventMap || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar eventos.');
    } finally {
      setLoadingEventos(false);
    }
  };

  const loadCaixa = async (dow) => {
    try {
      setLoadingCaixa(true);
      setCaixaMsg('');
      const res = await axios.get(`/api/controller-caixa?dow=${dow}`, { headers: authHeaders() });
      setCaixaHoras(res.data.horas || []);
      setCaixaMsg(res.data.message || '');
    } catch (err) {
      setCaixaMsg(err.response?.data?.error || 'Erro ao carregar cobertura de caixa.');
    } finally {
      setLoadingCaixa(false);
    }
  };

  useEffect(() => { loadForecast(); loadEventos(); }, []);
  useEffect(() => { loadCaixa(caixaDow); }, [caixaDow]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.data || !form.tipo || !form.nome) return;
    setSubmitting(true);
    setError('');
    try {
      await axios.post('/api/eventos/upsert', {
        data: form.data,
        tipo: form.tipo,
        nome: form.nome,
        fator: form.fator === '' ? undefined : form.fator,
      }, { headers: authHeaders() });
      setForm(EMPTY_FORM);
      await Promise.all([loadEventos(), loadForecast()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar evento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (data) => {
    try {
      await axios.post('/api/eventos/delete', { data }, { headers: authHeaders() });
      await Promise.all([loadEventos(), loadForecast()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao remover evento.');
    }
  };

  // Eventos manuais (cadastrados pelo cliente) sempre visíveis; feriados
  // automáticos ficam atrás de um "mostrar mais", senão a lista vira uma
  // tabela gigante de coisa que ninguém precisa conferir toda hora.
  const manualDates = new Set(eventos.map((ev) => ev.data));
  const autoEventos = Object.entries(eventMap)
    .filter(([data]) => !manualDates.has(data))
    .map(([data, ev]) => ({ data, tipo: ev.tipo, nome: ev.nome, fator: ev.fator, auto: true }))
    .sort((a, b) => a.data.localeCompare(b.data));
  const manuaisOrdenados = [...eventos].sort((a, b) => a.data.localeCompare(b.data));

  const containerStyle = {
    position: 'relative',
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
    filter: 'blur(6px)', pointerEvents: 'none', animation: 'ctl-breathe 7s ease-in-out infinite',
  };
  const gridStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    maskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
  };
  const contentStyle = { position: 'relative', maxWidth: '1100px', margin: '0 auto' };
  const eyebrowStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    margin: '0 0 14px', padding: '5px 12px', borderRadius: '999px',
    background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.22)',
    color: '#bcd8ff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em',
  };
  const dotStyle = { width: '6px', height: '6px', borderRadius: '50%', background: c.accent, boxShadow: `0 0 10px ${c.accent}`, animation: 'ctl-dot 1.8s ease-in-out infinite' };
  const titleStyle = {
    margin: '0 0 10px', fontSize: '34px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em',
    background: 'linear-gradient(180deg, #ffffff 0%, #b9d4ff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
  };
  const subtitleStyle = { margin: '0 0 30px', fontSize: '15px', color: c.muted, lineHeight: 1.5 };
  const panelStyle = {
    position: 'relative',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '18px', padding: '24px',
    boxShadow: '0 30px 80px -40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    marginBottom: '24px',
  };
  const panelHeadStyle = { marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' };
  const inputStyle = {
    padding: '10px 12px', borderRadius: '10px', fontSize: '13.5px', fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', color: c.text,
    outline: 'none', transition: 'border-color .2s, box-shadow .2s',
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div style={containerStyle}>
      <style>{styles}</style>
      <div style={arcStyle} />
      <div style={gridStyle} />

      <div style={contentStyle}>
        <div className="ctl-fade">
          <span style={eyebrowStyle}><span style={dotStyle} /> Controlador</span>
          <h2 style={titleStyle}>Comissão de decisão da escala</h2>
          <p style={subtitleStyle}>Previsão de demanda e calendário de eventos que orientam quantas pessoas escalar em cada dia.</p>
        </div>

        {/* ---- Previsão de demanda — 7 dias ---- */}
        <div className="ctl-fade ctl-panel" style={{ ...panelStyle, animationDelay: '.05s' }}>
          <div style={panelHeadStyle}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>Previsão de demanda — 7 dias</h3>
              <p style={{ margin: 0, fontSize: '13px', color: c.muted }}>Estimativa de faturamento com base no comportamento histórico da loja, considerando feriados e promoções.</p>
            </div>
            {forecast && (
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: c.faint,
              }}>
                {forecast.confianca === 'boa' ? 'Previsão consolidada' : forecast.confianca === 'media' ? 'Previsão em ajuste' : 'Previsão inicial'} · {forecast.totalDiasHistorico} dias de histórico
              </span>
            )}
          </div>

          {loadingForecast ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
          ) : !forecast ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {forecastMsg || 'Sem histórico de vendas suficiente para gerar a previsão ainda.'}
            </p>
          ) : (
            <div className="ctl-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {forecast.dias.map((dia) => {
                const isHoje = dia.data === hoje;
                const ev = dia.evento;
                const combinado = (dia.dowIndex || 1) * (dia.womFactor || 1);
                const pct = Math.round((combinado - 1) * 100);
                const tendencia = pct > 3 ? 'up' : pct < -3 ? 'down' : 'neutral';
                const tendenciaCor = tendencia === 'up' ? c.green : tendencia === 'down' ? c.red : c.faint;
                const tendenciaTexto = tendencia === 'neutral' ? 'Movimento normal' : `${pct > 0 ? '+' : ''}${pct}% que o normal`;
                const isFimDeSemana = dia.dow === 0 || dia.dow === 6;
                const accentCor = isHoje ? 'rgba(74,168,255,0.6)' : isFimDeSemana ? 'rgba(192,132,252,0.5)' : 'rgba(124,92,255,0.4)';
                return (
                  <div
                    key={dia.data}
                    className={`ctl-daycard ${isHoje ? 'today' : ''}`}
                    style={{
                      flex: '1 1 130px', minWidth: 130, padding: '14px 12px', borderRadius: 14,
                      background: isHoje ? 'linear-gradient(180deg, rgba(74,168,255,0.14), rgba(74,168,255,0.04))' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isHoje ? 'rgba(74,168,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      '--ctl-accent': accentCor,
                    }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: isHoje ? c.accent : c.muted }}>
                      {dia.diaSemana.slice(0, 3)}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 8 }}>
                      {new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.text, marginBottom: 6 }}>
                      {formatMoneyCompact(dia.previsao)}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: tendenciaCor }}>
                      {tendenciaTexto}
                    </div>
                    {ev && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: TIPO_INFO[ev.tipo]?.tone || c.accent }}>
                        {TIPO_INFO[ev.tipo]?.icon} {ev.nome}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Calendário de eventos ---- */}
        <div className="ctl-fade ctl-panel" style={{ ...panelStyle, animationDelay: '.1s', marginBottom: 0 }}>
          <div style={panelHeadStyle}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>Calendário de eventos</h3>
              <p style={{ margin: 0, fontSize: '13px', color: c.muted }}>Cadastre promoções, datas comemorativas e dias de pagamento. Feriados nacionais já entram sozinhos.</p>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <input
              className="ctl-input"
              type="date"
              style={{ ...inputStyle, flex: '1 1 150px' }}
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              required
            />
            <select
              className="ctl-input"
              style={{ ...inputStyle, flex: '1 1 190px' }}
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {TIPO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              className="ctl-input"
              type="text"
              placeholder="Nome do evento"
              maxLength={80}
              style={{ ...inputStyle, flex: '2 1 200px' }}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
            <input
              className="ctl-input"
              type="number"
              step="0.05"
              min="0"
              max="5"
              placeholder="Fator (opcional)"
              style={{ ...inputStyle, flex: '1 1 130px' }}
              value={form.fator}
              onChange={(e) => setForm({ ...form, fator: e.target.value })}
            />
            <button
              type="submit"
              className="ctl-btn"
              disabled={submitting}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', color: '#ffffff',
                background: 'linear-gradient(135deg, #6cc0ff, #3a7bff)',
              }}
            >
              {submitting ? 'Salvando...' : 'Adicionar'}
            </button>
          </form>

          {loadingEventos ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
          ) : manuaisOrdenados.length === 0 ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '10px 0 20px' }}>Nenhum evento manual cadastrado ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {manuaisOrdenados.map((ev) => (
                <div key={ev.id} className="ctl-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10 }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{TIPO_INFO[ev.tipo]?.icon || '📌'}</span>
                  <span style={{ fontSize: 13, color: c.faint, minWidth: 70 }}>{new Date(`${ev.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                  <span style={{ fontSize: 13.5, color: c.text, flex: 1 }}>{ev.nome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: TIPO_INFO[ev.tipo]?.tone || c.muted }}>×{Number(ev.fator).toFixed(2)}</span>
                  <button
                    onClick={() => handleDelete(ev.data)}
                    className="ctl-del"
                    title="Remover evento"
                    style={{
                      border: 'none', background: 'transparent', color: c.faint, cursor: 'pointer',
                      padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="ctl-toggle"
            onClick={() => setShowAutoEventos(!showAutoEventos)}
            style={{
              border: 'none', background: 'transparent', color: c.faint, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', padding: '8px 4px', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {showAutoEventos ? '▾' : '▸'} {showAutoEventos ? 'Ocultar' : 'Mostrar'} feriados nacionais automáticos ({autoEventos.length})
          </button>

          {showAutoEventos && (
            <div className="ctl-ferias-grid" style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {autoEventos
                .filter((ev) => ev.tipo === 'feriado')
                .map((feriado) => {
                  const vespera = autoEventos.find((v) => v.tipo === 'vespera' && v.nome === `Véspera ${feriado.nome}`);
                  return (
                    <div key={feriado.data} style={{
                      padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 2 }}>{feriado.nome}</div>
                      <div style={{ fontSize: 11.5, color: c.faint }}>
                        {new Date(`${feriado.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · loja fechada
                      </div>
                      {vespera && (
                        <div style={{ fontSize: 11.5, color: '#fbbf24', marginTop: 2 }}>
                          véspera {new Date(`${vespera.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · mais movimento
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ---- Controller de Frente de Caixa ---- */}
        <div className="ctl-fade ctl-panel" style={{ ...panelStyle, animationDelay: '.15s', marginBottom: 0, marginTop: 24 }}>
          <div style={panelHeadStyle}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700 }}>Controller de Frente de Caixa</h3>
              <p style={{ margin: 0, fontSize: '13px', color: c.muted }}>Compara quantos caixas seriam necessários com quantos estão escalados, hora a hora.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {DIAS_SEMANA.map((nome, idx) => (
              <button
                key={idx}
                type="button"
                className={`ctl-daytab ${caixaDow === idx ? 'active' : ''}`}
                onClick={() => setCaixaDow(idx)}
              >
                {nome.slice(0, 3)}
              </button>
            ))}
          </div>

          {loadingCaixa ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
          ) : caixaHoras.length === 0 ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {caixaMsg || `Sem dados suficientes para ${DIAS_SEMANA[caixaDow].toLowerCase()}.`}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {caixaHoras.map((h) => {
                const info = STATUS_INFO[h.status] || STATUS_INFO.adequado;
                return (
                  <div
                    key={h.hora}
                    className="ctl-hourrow"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, borderLeftColor: info.cor }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: c.text, minWidth: 52 }}>{h.hora}</span>
                    <span style={{ fontSize: 12.5, color: c.faint, minWidth: 100 }}>{h.clientes} clientes/h</span>
                    <span style={{ fontSize: 12.5, color: c.muted, flex: 1 }}>
                      {h.operadoresEscalados} escalado{h.operadoresEscalados === 1 ? '' : 's'} · {h.operadoresRecomendados} recomendado{h.operadoresRecomendados === 1 ? '' : 's'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: info.cor, whiteSpace: 'nowrap' }}>{info.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
