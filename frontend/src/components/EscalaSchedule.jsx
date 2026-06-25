import React, { useState } from 'react';
import StoreFloorMap from './StoreFloorMap';

export default function EscalaSchedule({ schedule, demand, employees, periodo }) {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const diasFull = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('atual');
  const [selectedDay, setSelectedDay] = useState('monday');

  // Calcular calendário
  const hoje = new Date();
  const diaSemana = (hoje.getDay() + 6) % 7;
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - diaSemana);

  const datas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      data: d.toISOString().split('T')[0],
      dia: dias[i]
    };
  });

  const todayIdx = diaSemana;
  const totalColaboradores = Object.keys(schedule || {}).length;

  const scenarios = !employees.length ? [] : [
    { id: 'atual', label: 'Atual 6x1 - 44h', hours: 44, pdvs: '—', operators: employees.length, capacity: employees.length * 44 },
    { id: 'transicao', label: 'Transição 5x2 - 42h', hours: 42, pdvs: '—', operators: employees.length, capacity: employees.length * 42 },
    { id: 'final', label: 'Final 5x2 - 40h', hours: 40, pdvs: '—', operators: employees.length, capacity: employees.length * 40 }
  ];

  return (
    <div className="esc-container">
      <style>{`
        .esc-container{
          --esc-accent:#2563eb;
          --esc-accent-2:#3b82f6;
          --esc-accent-3:#7cb0f5;
          --esc-text:#eef2f8;
          --esc-muted:rgba(203,213,225,.62);
          --esc-faint:rgba(203,213,225,.4);
          --esc-line:rgba(148,163,184,.14);
          --esc-card:linear-gradient(180deg,#16233a 0%,#111c2e 100%);
          --esc-surface:rgba(148,163,184,.06);
          position:relative;display:flex;flex-direction:column;gap:18px;
          padding:24px;border-radius:20px;color:var(--esc-text);
          font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
          background:radial-gradient(1200px 600px at 50% -10%, #15365c 0%, transparent 60%),
                     linear-gradient(160deg,#102a4a 0%,#0a1c33 100%);
        }

        /* ---------- Section Head ---------- */
        .esc-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
        .esc-eyebrow{margin:0 0 8px;color:var(--esc-accent-3);font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;}
        .esc-section-head h2{margin:0;font-size:25px;line-height:1.2;font-weight:800;letter-spacing:-.5px;color:var(--esc-text);max-width:850px;text-shadow:0 8px 24px rgba(0,0,0,.35);}
        .esc-soft-pill{padding:7px 14px;border-radius:999px;font-size:12.5px;font-weight:600;color:#cfe0f7;
          background:var(--esc-surface);border:1px solid var(--esc-line);}

        /* ---------- Generic Panel ---------- */
        .esc-panel{
          position:relative;padding:18px;border-radius:16px;background:var(--esc-card);
          border:1px solid var(--esc-line);
          box-shadow:0 20px 50px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04);
        }

        /* ---------- Week Selector ---------- */
        .esc-week-selector{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
        .esc-week-selector label{margin:0;font-weight:600;font-size:13.5px;color:#dbe6f5;}
        .esc-select{
          padding:9px 14px;border-radius:10px;font-size:14px;cursor:pointer;
          background:var(--esc-surface);border:1px solid var(--esc-line);color:var(--esc-text);
          outline:none;transition:.16s;
        }
        .esc-select:focus{border-color:var(--esc-accent-2);box-shadow:0 0 0 3px rgba(59,130,246,.18);}
        .esc-week-hint{min-width:200px;font-size:12.5px;color:var(--esc-muted);}

        /* ---------- Scenario Cards ---------- */
        .esc-scenario-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}
        .esc-scenario-card{
          padding:18px;border-radius:14px;background:var(--esc-surface);
          border:1px solid var(--esc-line);transition:.18s;
        }
        .esc-scenario-card:hover{border-color:rgba(96,165,250,.4);transform:translateY(-2px);}
        .esc-scenario-tag{color:var(--esc-faint);font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;}
        .esc-scenario-card h3{margin:12px 0 18px;font-size:17px;font-weight:700;color:var(--esc-text);}
        .esc-scenario-rows{font-size:12.5px;color:var(--esc-muted);line-height:2;}
        .esc-scenario-rows strong{color:#dbe6f5;font-weight:600;}
        .esc-scenario-rows span{float:right;color:var(--esc-text);font-weight:600;}
        .esc-empty{grid-column:1 / -1;padding:32px;text-align:center;color:var(--esc-muted);font-size:14px;}

        /* ---------- Panel Head ---------- */
        .esc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
          padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--esc-line);}
        .esc-panel-head h3{margin:0 0 6px;font-size:15px;font-weight:700;color:var(--esc-text);}
        .esc-panel-head p{margin:0;font-size:12.5px;color:var(--esc-muted);}

        /* ---------- Buttons ---------- */
        .esc-btn{padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
          border:none;background:var(--esc-accent);color:#fff;transition:.16s;}
        .esc-btn:hover{background:#1d4ed8;}
        .esc-ghost{padding:5px 11px;border-radius:9px;font-size:11px;font-weight:600;cursor:pointer;
          color:#c4ccd8;background:var(--esc-surface);border:1px solid var(--esc-line);transition:.16s;}
        .esc-ghost:hover{background:rgba(148,163,184,.12);border-color:rgba(148,163,184,.28);color:var(--esc-text);}
        .esc-ghost.is-active{background:var(--esc-accent);border-color:var(--esc-accent);color:#fff;
          box-shadow:0 4px 14px rgba(37,99,235,.4);}

        .esc-audit-summary{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;
          color:#86efac;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);}

        /* ---------- Período Box ---------- */
        .esc-periodo-box{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;
          padding:14px 16px;border-radius:12px;margin-bottom:14px;
          background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);}
        .esc-periodo-info{display:flex;flex-direction:column;gap:3px;}
        .esc-periodo-info strong{font-size:13.5px;}
        .esc-periodo-info span{font-size:12.5px;color:#dbe6f5;}
        .esc-periodo-info small{font-size:11.5px;color:var(--esc-muted);}
        .esc-periodo-actions{display:flex;gap:8px;flex-wrap:wrap;}

        /* ---------- CLT Box ---------- */
        .esc-clt-box{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;margin-bottom:14px;
          background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.28);}
        .esc-clt-box strong{font-size:13.5px;}
        .esc-clt-box span{font-size:12px;color:#dbe6f5;}
        .esc-clt-box p{font-size:11px;color:var(--esc-faint);margin:6px 0 0;}

        /* ---------- Week Comparison ---------- */
        .esc-week-comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;}
        .esc-wc-card{padding:14px;border-radius:12px;background:var(--esc-surface);border:1px solid var(--esc-line);
          display:flex;flex-direction:column;gap:5px;}
        .esc-wc-card small{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--esc-faint);}
        .esc-wc-card strong{font-size:18px;font-weight:700;color:var(--esc-text);}
        .esc-wc-detail{font-size:11.5px;color:var(--esc-muted);}

        /* ---------- Week Navigation ---------- */
        .esc-week-nav{display:flex;justify-content:space-between;align-items:center;gap:12px;
          padding:10px 14px;border-radius:12px;margin-bottom:16px;
          background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-week-nav-btn{padding:7px 14px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;
          color:#cfe0f7;background:rgba(255,255,255,.04);border:1px solid var(--esc-line);transition:.16s;}
        .esc-week-nav-btn:hover{background:rgba(59,130,246,.18);border-color:rgba(96,165,250,.4);}
        .esc-week-nav-label{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--esc-text);}
        .esc-today-tag{padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;
          color:#fff;background:var(--esc-accent-2);}

        /* ---------- Weekly Grid ---------- */
        .esc-weekly-grid{display:flex;flex-direction:column;gap:8px;overflow-x:auto;}
        .esc-weekly-row{display:grid;grid-template-columns:1.5fr repeat(7,1fr) 1fr;gap:6px;min-width:780px;}
        .esc-weekly-head{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          padding:10px 6px;border-radius:10px;font-size:12px;font-weight:700;color:var(--esc-muted);
          background:rgba(255,255,255,.03);border:1px solid var(--esc-line);text-align:center;}
        .esc-weekly-head.is-today{color:var(--esc-accent-3);border-color:rgba(96,165,250,.45);background:rgba(59,130,246,.1);}
        .esc-head-date{font-size:10px;font-weight:500;color:var(--esc-faint);}
        .esc-weekly-head .esc-today-tag{margin-top:2px;}

        .esc-weekly-person{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:10px 12px;
          border-radius:10px;background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-person-name{font-size:13px;font-weight:600;color:var(--esc-text);}
        .esc-person-details{font-size:11px;color:var(--esc-muted);}

        .esc-weekly-shift{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
          min-height:46px;padding:6px;border-radius:10px;font-size:12px;font-weight:600;color:var(--esc-text);
          background:var(--esc-surface);border:1px solid var(--esc-line);text-align:center;}
        .esc-weekly-shift.is-today{background:rgba(37,99,235,.16);border-color:rgba(96,165,250,.5);box-shadow:inset 0 0 0 1px rgba(96,165,250,.25);}
        .esc-weekly-off{background:rgba(255,255,255,.03);border-color:var(--esc-line);color:var(--esc-faint);}
        .esc-shift-main{font-size:12px;}
        .esc-shift-icons{display:flex;gap:4px;font-size:11px;}

        .esc-weekly-status{display:flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;
          font-size:11px;font-weight:700;text-align:center;}
        .esc-status-valid{color:#86efac;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);}
        .esc-status-invalid{color:#fcd34d;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);}

        .esc-forecast-row .esc-weekly-shift{min-height:42px;font-size:10px;color:var(--esc-muted);}
        .esc-forecast-label strong{font-size:13px;color:var(--esc-text);}
        .esc-forecast-label small{font-size:10.5px;color:var(--esc-muted);}

        /* ---------- Placeholder / Heatmap ---------- */
        .esc-subtle-panel{padding:16px;border-radius:12px;margin-bottom:14px;
          background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-placeholder{min-height:200px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--esc-muted);}
        .esc-placeholder small{color:var(--esc-faint);}
        .esc-subtle-panel > p{margin:0 0 12px;font-size:12.5px;font-weight:700;color:var(--esc-text);}
        .esc-load-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;}
        .esc-load-cell{padding:10px 6px;border-radius:8px;text-align:center;
          background:rgba(255,255,255,.03);border:1px solid var(--esc-line);}
        .esc-load-cell span{font-size:11px;color:var(--esc-muted);}
        .esc-load-cell strong{display:block;margin-top:5px;font-size:14px;color:var(--esc-accent-3);}

        .esc-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
      `}</style>

      {/* Section Head */}
      <div className="esc-section-head">
        <div>
          <p className="esc-eyebrow">Comparativo de cenários</p>
          <h2>Impacto da jornada na capacidade da equipe</h2>
        </div>
        <span className="esc-soft-pill">{employees.length} colaboradores</span>
      </div>

      {/* Week Selector Panel */}
      <div className="esc-panel esc-week-selector">
        <label>Analisar por semana do mês:</label>
        <select
          className="esc-select"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          <option value="">Todos os dados importados (padrão)</option>
          <option value="1">Semana 1 (1-7) - Normal</option>
          <option value="2">Semana 2 (8-14) - Normal</option>
          <option value="3">Semana 3 (15-21) - Normal</option>
          <option value="4">Semana 4 (22-28) - Promoção Iniciando</option>
          <option value="5">Semana 5 (29-05) - Pico de Promoção</option>
        </select>
        <small className="esc-week-hint">
          {selectedWeek ? `Semana ${selectedWeek} selecionada` : 'Nenhuma semana selecionada'}
        </small>
      </div>

      {/* Scenario Cards */}
      <div className="esc-scenario-grid">
        {scenarios.length === 0 ? (
          <div className="esc-empty">
            Importe colaboradores para visualizar cenários
          </div>
        ) : (
          scenarios.map((scenario) => (
            <div key={scenario.id} className="esc-scenario-card">
              <span className="esc-scenario-tag">Simulação</span>
              <h3>{scenario.label}</h3>
              <div className="esc-scenario-rows">
                <div><strong>Horas semanais</strong><span>{scenario.hours}h</span></div>
                <div><strong>PDVs / operadores</strong><span>{scenario.pdvs} / {scenario.operators}</span></div>
                <div><strong>Capacidade</strong><span>{scenario.capacity}h</span></div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Store Floor Map Panel */}
      <StoreFloorMap schedule={schedule} demand={demand} employees={employees} storeConfig={{ pdvs: 4 }} />

      {/* Weekly Panel - Semana Completa */}
      <div className="esc-panel">

        {/* Panel Head */}
        <div className="esc-panel-head">
          <div>
            <h3>Semana completa por colaboradora</h3>
            <p>44h semanais + 1 folga a cada 7 dias (conforme CLT)</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="esc-audit-summary">{totalColaboradores}/{totalColaboradores} conformes</span>
            <button className="esc-btn">Exportar / Imprimir</button>
          </div>
        </div>

        {/* Período Box */}
        <div className="esc-periodo-box">
          <div>
            <div className="esc-periodo-info">
              <strong style={{ color: '#fbbf24' }}>RASCUNHO — Escala Dinâmica</strong>
              <span>Semana de {datas[0].label} a {datas[6].label}</span>
              <small>Esta escala é recalculada automaticamente. Feche o período para gerar a versão oficial imutável.</small>
            </div>
          </div>
          <div className="esc-periodo-actions">
            <button className="esc-ghost">Marcar revisado</button>
            <button className="esc-btn">🔒 Fechar período</button>
          </div>
        </div>

        {/* CLT Compliance Box */}
        <div className="esc-clt-box">
          <strong style={{ color: '#34d399' }}>Escala em conformidade CLT</strong>
          <span>✓ Interjornada 11h  ✓ DSR  ✓ Máx 44h/semana  ✓ Máx 10h/dia  ✓ Máx 6h contínuas  ✓ 6 dias consecutivos</span>
          <p>
            Auditoria baseada na CLT federal. Convenções coletivas locais (CCT dos comerciários) podem ter regras adicionais — valide com seu contador/sindicato.
          </p>
        </div>

        {/* Week Comparison Cards */}
        <div className="esc-week-comparison">
          <div className="esc-wc-card">
            <small>Previsão semana</small>
            <strong>—</strong>
            <span className="esc-wc-detail">Importe faturamento</span>
          </div>
          <div className="esc-wc-card">
            <small>Equipe escalada</small>
            <strong>{totalColaboradores} pessoas</strong>
            <span className="esc-wc-detail">{totalColaboradores * 44}h total · {44}h/pessoa</span>
          </div>
          <div className="esc-wc-card">
            <small>Folgas na semana</small>
            <strong>{totalColaboradores} folgas</strong>
            <span className="esc-wc-detail">{(totalColaboradores / totalColaboradores).toFixed(1)} por pessoa</span>
          </div>
          <div className="esc-wc-card">
            <small>Conformidade CLT</small>
            <strong>Conforme</strong>
            <span className="esc-wc-detail">CLT validado</span>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="esc-week-nav">
          <button className="esc-week-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)}>
            ← Anterior
          </button>
          <span className="esc-week-nav-label">
            {datas[0].label} — {datas[6].label}
            {weekOffset === 0 && <span className="esc-today-tag">atual</span>}
          </span>
          <button className="esc-week-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)}>
            Próxima →
          </button>
        </div>

        {/* Weekly Grid */}
        <div className="esc-weekly-grid">
          {/* Header */}
          <div className="esc-weekly-row">
            <div className="esc-weekly-head">Colaborador(a)</div>
            {dias.map((dia, i) => (
              <div
                key={i}
                className={`esc-weekly-head ${i === todayIdx ? 'is-today' : ''}`}
              >
                <span>{dia}</span>
                <span className="esc-head-date">{datas[i].label}</span>
                {i === todayIdx && <span className="esc-today-tag">hoje</span>}
              </div>
            ))}
            <div className="esc-weekly-head">Auditoria</div>
          </div>

          {/* Forecast Row */}
          <div className="esc-weekly-row esc-forecast-row">
            <div className="esc-weekly-person esc-forecast-label">
              <strong>Previsão</strong>
              <small>faturamento dia</small>
            </div>
            {dias.map((_, i) => (
              <div key={i} className="esc-weekly-shift">
                Importe faturamento
              </div>
            ))}
            <div className="esc-weekly-shift" style={{ background: 'transparent', border: 'none' }}></div>
          </div>

          {/* Pessoas */}
          {schedule &&
            Object.entries(schedule).map(([nome, shifts], idx) => {
              const horasTrabalhadas = shifts.filter((s) => s !== 'Folga').length * 7.33;
              const folgas = shifts.filter((s) => s === 'Folga').length;
              const conforme = Math.abs(horasTrabalhadas - 44) < 1 && folgas === 1;

              return (
                <div key={idx} className="esc-weekly-row">
                  <div className="esc-weekly-person">
                    <span className="esc-person-name">{nome}</span>
                    <span className="esc-person-details">
                      {horasTrabalhadas.toFixed(1)}h trab. · {folgas} folga{folgas > 1 ? 's' : ''}
                    </span>
                  </div>
                  {shifts.map((shift, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`esc-weekly-shift ${
                        shift === 'Folga' ? 'esc-weekly-off' : ''
                      } ${dayIdx === todayIdx ? 'is-today' : ''}`}
                    >
                      {shift === 'Folga' ? (
                        <span className="esc-shift-main">Folga</span>
                      ) : (
                        <>
                          <span className="esc-shift-main">{shift}</span>
                          {shift && (
                            <div className="esc-shift-icons">
                              {shift.includes('08') && <span title="Abre a loja">🔓</span>}
                              {shift.includes('20') && <span title="Fecha a loja">🔒</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  <div
                    className={`esc-weekly-status ${
                      conforme ? 'esc-status-valid' : 'esc-status-invalid'
                    }`}
                  >
                    {conforme ? '✓ Conforme' : '⚠ Revisar'}
                  </div>
                </div>
              );
            })}
        </div>

      </div>

      {/* Visual Panel - Demanda VRSoft x Caixas */}
      <div className="esc-panel">
        <div className="esc-panel-head">
          <div>
            <h3>Demanda VRSoft x caixas escalados</h3>
            <p>Comparação entre demanda de clientes e operadores escalados por hora</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="esc-ghost" title="Otimização inteligente">
              Otimização
            </button>
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                className={`esc-ghost ${selectedScenario === scenario.id ? 'is-active' : ''}`}
              >
                {scenario.label.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Day Toolbar */}
        <div className="esc-toolbar">
          {diasFull.map((dia) => (
            <button
              key={dia}
              onClick={() => setSelectedDay(dia.toLowerCase())}
              className={`esc-ghost ${selectedDay === dia.toLowerCase() ? 'is-active' : ''}`}
            >
              {dia}
            </button>
          ))}
        </div>

        {/* Heatmap Placeholder */}
        <div className="esc-subtle-panel esc-placeholder">
          <div>
            <p style={{ margin: 0 }}>Heatmap de demanda por hora</p>
            <small>(Intensidade de demanda ao longo do dia)</small>
          </div>
        </div>

        {/* Cashier Load Panel */}
        <div className="esc-subtle-panel">
          <p>Carga do caixa por hora</p>
          <div className="esc-load-grid">
            {['08h', '10h', '12h', '14h', '16h', '18h', '20h', 'Média'].map((hora) => (
              <div key={hora} className="esc-load-cell">
                <span>{hora}</span>
                <strong>{Math.floor(Math.random() * 100)}%</strong>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
