import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/* ============================================================
   Mercadológico — Escalágil
   Equivalente à aba "Setores" do EscalaON, só que no nosso caso os dados
   vêm mesmo é por mercadológico (grupo de produto: Açougue, Padaria,
   Hortifruti...), não por "setor" genérico — daí o nome da aba.
   Dashboard ICOS: venda média por dia, curva de demanda por dia da
   semana, e necessidade de pessoas por departamento (baseada em volume
   físico real — kg ou caixas repostas, não só R$).
   ============================================================ */

const STATUS_COLOR = {
  critico: '#f87171',
  atencao: '#fbbf24',
  adequado: '#34d399',
  'sem-benchmark': '#94a3b8',
  'sem-equipe': '#94a3b8',
};

const styles = `
  @keyframes merc-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes merc-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @keyframes merc-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  .merc-fade { animation: merc-fade-up .6s cubic-bezier(.22,.61,.36,1) both; }

  .merc-panel { position: relative; }
  .merc-panel::before {
    content: ''; position: absolute; inset: 0; border-radius: 18px; padding: 1px;
    background: linear-gradient(140deg, rgba(74,168,255,0.5), transparent 35%, transparent 65%, rgba(124,92,255,0.4));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .7;
  }

  .merc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

  .merc-carousel {
    display: flex; gap: 12px; overflow-x: auto;
    scroll-snap-type: x proximity; scrollbar-width: none; cursor: grab;
  }
  .merc-carousel::-webkit-scrollbar { display: none; }
  .merc-carousel.merc-dragging { cursor: grabbing; scroll-snap-type: none; user-select: none; }
  .merc-carousel-item { flex: 0 0 260px; scroll-snap-align: start; }

  .merc-card {
    position: relative; padding: 14px 16px; border-radius: 14px; overflow: hidden;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .merc-card::before {
    content: ''; position: absolute; inset: 0; border-radius: 14px; padding: 1px; opacity: 0;
    background: linear-gradient(150deg, var(--merc-accent, rgba(74,168,255,0.6)), transparent 55%, transparent 75%, var(--merc-accent, rgba(74,168,255,0.6)));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
    transition: opacity .25s ease;
  }
  .merc-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px -14px rgba(0,0,0,0.6); }
  .merc-card:hover::before { opacity: 1; }
`;

const c = { text: '#e8eef5', muted: '#94a3b8', faint: '#5b6880', accent: '#4aa8ff' };

function formatMoneyCompact(v) {
  const n = Number(v || 0);
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toFixed(0)}`;
}

const SETOR_STATS = { core: 5, biblioteca: 19, prioridadeInicial: 6, expansaoFutura: 13 };

const SETORES_PRIORITARIOS = [
  { nome: 'Frente de Caixa', destaque: '24 clientes/h', driver: 'clientes por hora', indicador: 'Clientes/hora', faixa: '18 a 30', foco: 'Fila, abandono, experiência do cliente e segurança do fechamento', detalhes: ['cupons por hora', 'itens por cupom', 'formas de pagamento', 'sangrias/troco'] },
  { nome: 'Açougue', destaque: '31 kg/h', driver: 'kg vendidos e kg processados', indicador: 'Kg/hora', faixa: '25 a 80', foco: 'Ruptura, perda, espera no balcão e margem', detalhes: ['kg vendidos', 'kg processados', 'bandejas', 'atendimento balcão'] },
  { nome: 'Hortifruti', destaque: '140 kg/h', driver: 'kg manipulados', indicador: 'Kg/hora', faixa: '80 a 250', foco: 'Disponibilidade, aparência da loja e quebra operacional', detalhes: ['kg vendidos', 'caixas recebidas', 'quebras', 'picos de abastecimento'] },
  { nome: 'Padaria', destaque: '32 kg/h', driver: 'kg produzidos e clientes atendidos', indicador: 'Kg/hora', faixa: '15 a 60', foco: 'Venda perdida, frescor, produção e atendimento', detalhes: ['kg produzidos', 'fornadas', 'clientes por hora', 'ruptura de pão quente'] },
  { nome: 'Reposição', destaque: '40 caixas/h', driver: 'caixas repostas', indicador: 'Caixas/hora', faixa: '25 a 60', foco: 'Ruptura, organização de loja e produtividade de apoio', detalhes: ['caixas repostas', 'SKUs corredor', 'peso/volume', 'ruptura'] },
];

const EXEMPLO_CALCULO = {
  setor: 'Açougue',
  volume: '1.200 kg no sábado',
  benchmark: '25 kg/h',
  horas: '48h',
  jornadaUtil: '7h úteis',
  resultado: '6,8 → 7 pessoas sugeridas',
  formula: '1.200 kg ÷ 25 kg/h = 48 horas · 48h ÷ 7h úteis = 6,8 pessoas',
};

const BENCHMARK_EVOLUCAO = [
  { faixa: 'R$ 1M a R$ 2M', valor: '31 kg/h', obs: 'Loja pequena/média, menor especialização' },
  { faixa: 'R$ 2M a R$ 4M', valor: '37 kg/h', obs: 'Volume permite melhor distribuição de tarefas' },
  { faixa: 'R$ 4M a R$ 8M', valor: '42 kg/h', obs: 'Ganho de escala e processos mais maduros' },
];

const PRIORIDADE_COLOR = { MVP: '#7dd3fc', Expansão: '#94a3b8', Opcional: '#5b6880' };

const BIBLIOTECA_SETORES = [
  { setor: 'Frente de Caixa', driver: 'clientes, tickets, itens', indicador: 'Clientes/hora', faixa: '18 a 30', prioridade: 'MVP' },
  { setor: 'Fiscal de Caixa', driver: 'checkouts supervisionados', indicador: 'Caixas supervisionados', faixa: '8 a 15', prioridade: 'Expansão' },
  { setor: 'Reposição Mercearia', driver: 'caixas repostas', indicador: 'Caixas/hora', faixa: '25 a 60', prioridade: 'MVP' },
  { setor: 'Reposição Bebidas', driver: 'volumes pesados', indicador: 'Caixas/hora', faixa: '15 a 40', prioridade: 'Expansão' },
  { setor: 'Hortifruti', driver: 'kg manipulados', indicador: 'Kg/hora', faixa: '80 a 250', prioridade: 'MVP' },
  { setor: 'Açougue Balcão', driver: 'kg vendidos', indicador: 'Kg/hora', faixa: '15 a 40', prioridade: 'MVP' },
  { setor: 'Açougue Produção', driver: 'kg processados', indicador: 'Kg/hora', faixa: '25 a 80', prioridade: 'MVP' },
  { setor: 'Açougue Bandejamento', driver: 'bandejas', indicador: 'Bandejas/hora', faixa: '40 a 120', prioridade: 'Expansão' },
  { setor: 'Frios', driver: 'kg fatiados', indicador: 'Kg/hora', faixa: '8 a 30', prioridade: 'Expansão' },
  { setor: 'Padaria Produção', driver: 'kg produzidos', indicador: 'Kg/hora', faixa: '15 a 60', prioridade: 'MVP' },
  { setor: 'Padaria Atendimento', driver: 'clientes', indicador: 'Clientes/hora', faixa: '20 a 60', prioridade: 'Expansão' },
  { setor: 'Confeitaria', driver: 'kg produzidos', indicador: 'Kg/hora', faixa: '5 a 20', prioridade: 'Expansão' },
  { setor: 'Rotisseria', driver: 'refeições', indicador: 'Refeições/hora', faixa: '20 a 80', prioridade: 'Expansão' },
  { setor: 'Recebimento', driver: 'volumes, pallets e NFs', indicador: 'Volumes/hora', faixa: '100 a 500', prioridade: 'Expansão' },
  { setor: 'Conferência', driver: 'volumes conferidos', indicador: 'Volumes/hora', faixa: '150 a 700', prioridade: 'Expansão' },
  { setor: 'Depósito', driver: 'pallets movimentados', indicador: 'Pallets/hora', faixa: '2 a 10', prioridade: 'Expansão' },
  { setor: 'Limpeza', driver: 'área', indicador: 'm²/hora', faixa: '300 a 1000', prioridade: 'Expansão' },
  { setor: 'Prevenção de Perdas', driver: 'área supervisionada', indicador: 'm² monitorados', faixa: '1000 a 5000', prioridade: 'Expansão' },
  { setor: 'E-commerce Picking', driver: 'pedidos', indicador: 'Pedidos/hora', faixa: '8 a 25', prioridade: 'Opcional' },
];

export default function Mercadologico() {
  const [dashboard, setDashboard] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const carouselRef = useRef(null);
  const dragState = useRef({ dragging: false, startX: 0, startScroll: 0, moved: false });

  const handleCarouselMouseDown = (e) => {
    const el = carouselRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.classList.add('merc-dragging');
  };
  const handleCarouselMouseMove = (e) => {
    const el = carouselRef.current;
    if (!el || !dragState.current.dragging) return;
    const delta = e.clientX - dragState.current.startX;
    if (Math.abs(delta) > 3) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - delta;
  };
  const endCarouselDrag = () => {
    const el = carouselRef.current;
    dragState.current.dragging = false;
    if (el) el.classList.remove('merc-dragging');
  };

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/mercadologico/dashboard', { headers: authHeaders() });
        setDashboard(res.data.dashboard || []);
        setMessage(res.data.message || '');
      } catch (err) {
        setMessage(err.response?.data?.error || 'Erro ao carregar dashboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
    filter: 'blur(6px)', pointerEvents: 'none', animation: 'merc-breathe 7s ease-in-out infinite',
  };
  const gridBgStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    maskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(700px 380px at 50% 0%, #000 0%, transparent 78%)',
  };
  const contentStyle = { position: 'relative', maxWidth: '1200px', margin: '0 auto' };
  const eyebrowStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    margin: '0 0 14px', padding: '5px 12px', borderRadius: '999px',
    background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.22)',
    color: '#bcd8ff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em',
  };
  const dotStyle = { width: '6px', height: '6px', borderRadius: '50%', background: c.accent, boxShadow: `0 0 10px ${c.accent}`, animation: 'merc-dot 1.8s ease-in-out infinite' };
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
  };

  return (
    <div style={containerStyle}>
      <style>{styles}</style>
      <div style={arcStyle} />
      <div style={gridBgStyle} />

      <div style={contentStyle}>
        <div className="merc-fade">
          <span style={eyebrowStyle}><span style={dotStyle} /> Mercadológico</span>
          <h2 style={titleStyle}>Carga operacional por departamento</h2>
          <p style={subtitleStyle}>Venda média por dia, curva de demanda por dia da semana e quantas pessoas cada departamento precisa — baseado em volume físico real (kg ou caixas), não só em R$.</p>
        </div>

        <div className="merc-fade merc-panel" style={panelStyle}>
          {loading ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '30px 0' }}>Carregando...</p>
          ) : dashboard.length === 0 ? (
            <p style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              {message || 'Sem histórico de venda por mercadológico ainda.'}
            </p>
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14,
                marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {[
                  { label: 'Setores analisados', valor: dashboard.length },
                  { label: 'Venda/dia (soma)', valor: formatMoneyCompact(dashboard.reduce((s, d) => s + d.vendaDia, 0)) },
                  { label: 'Colaboradores', valor: dashboard.reduce((s, d) => s + d.colaboradores, 0) },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10.5, color: c.faint, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.text }}>{item.valor}</div>
                  </div>
                ))}
              </div>

              <div className="merc-grid">
                {dashboard.map((d) => {
                  const cor = STATUS_COLOR[d.status] || c.muted;
                  const maxCurva = Math.max(...d.curvaDiaSemana, 1);
                  const un = d.operationalNeed ? d.operationalNeed.unidade.split('/')[0] : 'un';
                  const picoIndex = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].indexOf(d.picoDia);
                  const temEquipe = d.colaboradores > 0;
                  return (
                    <div key={d.setor} className="merc-card" style={{ '--merc-accent': cor }}>
                      {/* Cabeçalho: nome + status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.text, textTransform: 'capitalize' }}>
                          {d.setor.toLowerCase()}
                        </div>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 7, whiteSpace: 'nowrap',
                          color: cor, background: `${cor}1a`, border: `1px solid ${cor}55`,
                        }}>
                          {d.statusLabel}
                        </span>
                      </div>

                      {/* Hero: venda do dia */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: c.text }}>{formatMoneyCompact(d.vendaDia)}</span>
                        <span style={{ fontSize: 11.5, color: c.faint }}>/dia</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 12 }}>
                        {d.participacao}% da loja · {d.quantidadeDia.toLocaleString('pt-BR')} {un}/dia
                        {temEquipe && ` · ${d.colaboradores} colaborador${d.colaboradores === 1 ? '' : 'es'}`}
                      </div>

                      {/* Curva por dia da semana — compacta, só as barras */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22, marginBottom: 4 }}>
                        {d.curvaDiaSemana.map((v, i) => (
                          <div key={i} style={{
                            flex: 1, borderRadius: 3,
                            height: `${Math.max(5, (v / maxCurva) * 22)}px`,
                            background: i === picoIndex ? cor : 'rgba(74,168,255,0.3)',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 10.5, color: c.faint, marginBottom: 14 }}>Pico de venda: {d.picoDia}</div>

                      {/* Mensagem principal: necessidade operacional */}
                      {d.operationalNeed ? (
                        <div style={{
                          padding: '9px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, marginBottom: 10,
                          background: `${cor}12`, border: `1px solid ${cor}35`,
                        }}>
                          Precisa de <strong style={{ color: c.text }}>{d.operationalNeed.pessoasNecessarias}</strong> pessoa{d.operationalNeed.pessoasNecessarias === 1 ? '' : 's'}
                          {temEquipe && (
                            <> · saldo <strong style={{ color: d.operationalNeed.saldo < 0 ? '#f87171' : '#34d399' }}>{d.operationalNeed.saldo > 0 ? '+' : ''}{d.operationalNeed.saldo}</strong></>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: c.faint, marginBottom: 10 }}>Sem benchmark definido pra esse departamento.</div>
                      )}

                      {/* Equipe (só aparece se tiver alguém) */}
                      {temEquipe && (
                        <div style={{ fontSize: 11, color: c.muted, marginBottom: 8 }}>
                          {d.nomes.join(', ')}
                          {d.vendaPorColab !== null && ` · ${formatMoneyCompact(d.vendaPorColab)}/colab`}
                        </div>
                      )}

                      {/* Referência de benchmark — discreta, no rodapé */}
                      <div style={{ fontSize: 10.5, color: c.faint, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        Reposição: {d.matriz.caixasHora} cx/h · Margem: {d.matriz.margem}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {Object.entries({ critico: 'Alta carga', adequado: 'Equilibrado', atencao: 'Capacidade ociosa', 'sem-equipe': 'Sem equipe' }).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: c.muted }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[key] }} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Setores core — status do motor de dimensionamento */}
        <div className="merc-fade merc-panel" style={{ ...panelStyle, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: c.text }}>Cobertura do motor de dimensionamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Setores core', valor: SETOR_STATS.core, obs: 'Primeira versão do motor' },
              { label: 'Biblioteca total', valor: SETOR_STATS.biblioteca, obs: 'Setores mapeados' },
              { label: 'Prioridade inicial', valor: SETOR_STATS.prioridadeInicial, obs: 'Maior impacto operacional' },
              { label: 'Expansão futura', valor: SETOR_STATS.expansaoFutura, obs: 'Depois da base real' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10.5, color: c.faint, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.text, marginBottom: 2 }}>{item.valor}</div>
                <div style={{ fontSize: 11, color: c.muted }}>{item.obs}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5 setores prioritários da implantação */}
        <div className="merc-fade merc-panel" style={{ ...panelStyle, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: c.text }}>5 setores prioritários da implantação</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>Começar pequeno, medir rápido e substituir o benchmark inicial pelo benchmark real da base de clientes.</p>
          <div
            className="merc-carousel"
            ref={carouselRef}
            onMouseDown={handleCarouselMouseDown}
            onMouseMove={handleCarouselMouseMove}
            onMouseUp={endCarouselDrag}
            onMouseLeave={endCarouselDrag}
          >
            {SETORES_PRIORITARIOS.map((s) => (
              <div key={s.nome} className="merc-card merc-carousel-item" style={{ '--merc-accent': '#7dd3fc' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 2 }}>{s.nome}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#7dd3fc', marginBottom: 2 }}>{s.destaque}</div>
                <div style={{ fontSize: 11, color: c.faint, marginBottom: 12 }}>{s.driver}</div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)', marginBottom: 12,
                }}>
                  <span style={{ fontSize: 10.5, color: c.faint }}>{s.indicador}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{s.faixa}</span>
                </div>

                <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.5, marginBottom: 12 }}>{s.foco}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {s.detalhes.map((tag) => (
                    <span key={tag} style={{
                      fontSize: 10, color: '#bcd8ff', padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(74,168,255,0.1)', border: '1px solid rgba(74,168,255,0.22)',
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exemplo de cálculo */}
        <div className="merc-fade merc-panel" style={{ ...panelStyle, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: c.text }}>Exemplo de cálculo</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>Transforma volume previsto em horas e escala sugerida — {EXEMPLO_CALCULO.setor}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 14 }}>
            {[
              { label: 'Volume', valor: EXEMPLO_CALCULO.volume },
              { label: 'Benchmark', valor: EXEMPLO_CALCULO.benchmark },
              { label: 'Horas necessárias', valor: EXEMPLO_CALCULO.horas },
              { label: 'Jornada útil', valor: EXEMPLO_CALCULO.jornadaUtil },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10.5, color: c.faint, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{item.valor}</div>
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 18px', borderRadius: 12, marginBottom: 10,
            background: 'linear-gradient(120deg, rgba(52,211,153,0.14), rgba(74,168,255,0.06))',
            border: '1px solid rgba(52,211,153,0.35)',
          }}>
            <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: '#34d399', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10.5, color: c.faint, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Resultado sugerido</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>{EXEMPLO_CALCULO.resultado}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: c.faint }}>{EXEMPLO_CALCULO.formula}</div>
        </div>

        {/* Evolução do benchmark por faixa de faturamento */}
        <div className="merc-fade merc-panel" style={{ ...panelStyle, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: c.text }}>Evolução do benchmark</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>Após 90 dias, o sistema deixa de depender da faixa genérica: usa produtividade por hora como ponto de partida e calibra com dados reais por loja, comparando por cluster de faturamento.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {BENCHMARK_EVOLUCAO.map((item) => (
              <div key={item.faixa} className="merc-card" style={{ '--merc-accent': '#7dd3fc', display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <div style={{ width: 3, borderRadius: 4, background: '#7dd3fc', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: c.faint, marginBottom: 4 }}>{item.faixa}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#7dd3fc', marginBottom: 6 }}>{item.valor}</div>
                  <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.4 }}>{item.obs}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Biblioteca de setores */}
        <div className="merc-fade merc-panel" style={{ ...panelStyle, marginTop: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: c.text }}>Biblioteca de setores</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: c.muted, lineHeight: 1.5 }}>Matriz expandida para supermercados regionais. Use como ponto de partida, nunca como verdade final.</p>
          <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: '#0d1220' }}>
                  {['Setor', 'Driver', 'Indicador', 'Faixa', 'Prioridade'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: c.faint, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BIBLIOTECA_SETORES.map((row, i) => (
                  <tr key={row.setor} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '9px 14px', color: c.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{row.setor}</td>
                    <td style={{ padding: '9px 14px', color: c.muted }}>{row.driver}</td>
                    <td style={{ padding: '9px 14px', color: c.muted, whiteSpace: 'nowrap' }}>{row.indicador}</td>
                    <td style={{ padding: '9px 14px', color: c.text, whiteSpace: 'nowrap' }}>{row.faixa}</td>
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        color: PRIORIDADE_COLOR[row.prioridade], background: `${PRIORIDADE_COLOR[row.prioridade]}1a`,
                        border: `1px solid ${PRIORIDADE_COLOR[row.prioridade]}55`,
                      }}>{row.prioridade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
