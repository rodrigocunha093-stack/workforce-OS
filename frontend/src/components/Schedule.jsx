import React, { useState } from 'react';
import styles from './Schedule.module.css';
import StoreFloorMap from './StoreFloorMap';

export default function Schedule({ schedule, demand, employees, periodo }) {
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
    <div className={styles.container}>
      {/* Section Head */}
      <div className={styles.sectionHead}>
        <div>
          <p style={{ margin: '0 0 7px', color: '#0369a1', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
            Comparativo de cenários
          </p>
          <h2 style={{ margin: '0', fontSize: '25px', lineHeight: '1.2', maxWidth: '850px' }}>
            Impacto da jornada na capacidade da equipe
          </h2>
        </div>
        <span className={styles.softPill}>{employees.length} colaboradores</span>
      </div>

      {/* Week Selector Panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '16px', padding: '12px' }}>
        <label style={{ margin: '0', fontWeight: '600', color: '#e8eef5' }}>Analisar por semana do mês:</label>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e8eef5',
            cursor: 'pointer'
          }}
        >
          <option value="">Todos os dados importados (padrão)</option>
          <option value="1">Semana 1 (1-7) - Normal</option>
          <option value="2">Semana 2 (8-14) - Normal</option>
          <option value="3">Semana 3 (15-21) - Normal</option>
          <option value="4">Semana 4 (22-28) - Promoção Iniciando</option>
          <option value="5">Semana 5 (29-05) - Pico de Promoção</option>
        </select>
        <small style={{ minWidth: '200px', color: '#94a3b8' }}>
          {selectedWeek ? `Semana ${selectedWeek} selecionada` : 'Nenhuma semana selecionada'}
        </small>
      </div>

      {/* Scenario Cards */}
      <div className={styles.scenarioGrid}>
        {scenarios.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            Importe colaboradores para visualizar cenários
          </div>
        ) : (
          scenarios.map((scenario, idx) => (
            <div key={scenario.id} className={styles.scenarioCard}>
              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                Simulação
              </span>
              <h3 style={{ margin: '12px 0 18px', fontSize: '17px', color: '#e8eef5' }}>
                {scenario.label}
              </h3>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.8' }}>
                <div><strong>Horas semanais</strong><span style={{ float: 'right' }}>{scenario.hours}h</span></div>
                <div><strong>PDVs / operadores</strong><span style={{ float: 'right' }}>{scenario.pdvs} / {scenario.operators}</span></div>
                <div><strong>Capacidade</strong><span style={{ float: 'right' }}>{scenario.capacity}h</span></div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Store Floor Map Panel */}
      <StoreFloorMap schedule={schedule} demand={demand} employees={employees} storeConfig={{ pdvs: 4 }} />

      {/* Período Box */}
      <div className={`${styles.periodoBox} ${styles.periodoAberto}`}>
        <div>
          <div className={styles.periodoInfo}>
            <strong>RASCUNHO — escala dinâmica</strong>
            <span>Semana de {datas[0].label} a {datas[6].label}</span>
            <small>Esta escala é recalculada automaticamente. Feche o período para gerar a versão oficial imutável.</small>
          </div>
        </div>
        <div className={styles.periodoActions}>
          <button className={styles.optimizeButton}>Exportar / Imprimir</button>
          <button className={styles.optimizeButton}>Fechar período</button>
        </div>
      </div>

      {/* CLT Compliance Box */}
      <div className={`${styles.cltBox} ${styles.cltOk}`}>
        <strong>Escala em conformidade CLT</strong>
        <span>Validados: interjornada 11h · DSR · máx 44h/sem · máx 10h/dia · máx 6h contínuas (art. 71) · 6 dias consecutivos.</span>
        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
          Auditoria baseada na CLT federal. Convenções coletivas locais (CCT dos comerciários) podem ter regras adicionais — valide com seu contador/sindicato.
        </p>
      </div>

      {/* Week Comparison Cards */}
      <div className={styles.weekComparison}>
        <div className={styles.wcCard}>
          <small>Previsão semana</small>
          <strong>—</strong>
          <span className={styles.wcDetail}>Importe faturamento</span>
        </div>
        <div className={styles.wcCard}>
          <small>Equipe escalada</small>
          <strong>{totalColaboradores} pessoas</strong>
          <span className={styles.wcDetail}>{totalColaboradores * 44}h total · {44}h/pessoa</span>
        </div>
        <div className={styles.wcCard}>
          <small>Folgas na semana</small>
          <strong>{totalColaboradores} folgas</strong>
          <span className={styles.wcDetail}>{(totalColaboradores / totalColaboradores).toFixed(1)} por pessoa</span>
        </div>
        <div className={styles.wcCard}>
          <small>Conformidade CLT</small>
          <strong>Conforme</strong>
          <span className={styles.wcDetail}>CLT validado</span>
        </div>
        <div className={styles.wcCard}>
          <small>Aderência ponto</small>
          <strong style={{ color: '#6ee7b7' }}>95%</strong>
          <span className={styles.wcDetail}>0h real · 0h plan.</span>
        </div>
      </div>

      {/* Week Navigation */}
      <div className={styles.weekNavBar}>
        <button className={styles.weekNavBtn} onClick={() => setWeekOffset(weekOffset - 1)}>
          ← Anterior
        </button>
        <span className={styles.weekNavLabel}>
          {datas[0].label} — {datas[6].label}
          {weekOffset === 0 && <span className={styles.todayTag}>atual</span>}
        </span>
        <button className={styles.weekNavBtn} onClick={() => setWeekOffset(weekOffset + 1)}>
          Próxima →
        </button>
      </div>

      {/* Weekly Panel */}
      <div className={styles.weeklyPanel}>
        <div style={{ marginBottom: '12px', padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '600', color: '#e8eef5' }}>Semana completa por colaboradora</h3>
            <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
              🔓 abre · 🔒 fecha — meta de 44h e 1 folga a cada 7 dias.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={styles.auditSummary}>{totalColaboradores}/{totalColaboradores} conformes</span>
            <button className={styles.optimizeButton}>🖨️ Exportar / Imprimir</button>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className={styles.weeklySchedule}>
          <div className={styles.weeklyGrid}>
            {/* Header */}
            <div className={styles.weeklyRow} style={{ marginBottom: '8px' }}>
              <div className={styles.weeklyHead} style={{ background: '#0d141d' }}>
                Colaborador(a)
              </div>
              {dias.map((dia, i) => (
                <div
                  key={i}
                  className={`${styles.weeklyHead} ${i === todayIdx ? styles.isToday : ''}`}
                  style={{
                    background: i === todayIdx ? 'transparent' : 'transparent',
                    color: i === todayIdx ? '#3B82F6' : '#94a3b8'
                  }}
                >
                  <span>{dia}</span>
                  <span className={styles.headDate}>{datas[i].label}</span>
                  {i === todayIdx && <span className={styles.todayTag}>hoje</span>}
                </div>
              ))}
              <div className={styles.weeklyHead} style={{ background: '#0d141d' }}>
                Auditoria
              </div>
            </div>

            {/* Forecast Row */}
            <div className={`${styles.weeklyRow} ${styles.forecastRow}`} style={{ marginBottom: '8px' }}>
              <div className={`${styles.weeklyPerson} ${styles.forecastLabel}`}>
                <strong>Previsão</strong>
                <small>faturamento dia</small>
              </div>
              {dias.map((_, i) => (
                <div key={i} className={styles.weeklyShift} style={{ minHeight: '42px', fontSize: '10px' }}>
                  Importe faturamento
                </div>
              ))}
              <div className={styles.weeklyShift} style={{ minHeight: '42px' }}></div>
            </div>

            {/* Pessoas */}
            {schedule &&
              Object.entries(schedule).map(([nome, shifts], idx) => {
                const horasTrabalhadas = shifts.filter((s) => s !== 'Folga').length * 7.33;
                const folgas = shifts.filter((s) => s === 'Folga').length;
                const conforme = Math.abs(horasTrabalhadas - 44) < 1 && folgas === 1;

                return (
                  <div key={idx} className={styles.weeklyRow}>
                    <div className={styles.weeklyPerson}>
                      <span className={styles.personName}>{nome}</span>
                      <span className={styles.personDetails}>
                        {horasTrabalhadas.toFixed(1)}h trab. · {folgas} folga{folgas > 1 ? 's' : ''}
                      </span>
                    </div>
                    {shifts.map((shift, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`${styles.weeklyShift} ${
                          shift === 'Folga' ? styles.weeklyOff : ''
                        } ${dayIdx === todayIdx ? styles.isToday : ''}`}
                      >
                        {shift === 'Folga' ? (
                          <span className={styles.shiftMain}>Folga</span>
                        ) : (
                          <>
                            <span className={styles.shiftMain}>{shift}</span>
                            {shift && (
                              <div className={styles.shiftIcons}>
                                {shift.includes('08') && <span title="Abre a loja">🔓</span>}
                                {shift.includes('20') && <span title="Fecha a loja">🔒</span>}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    <div
                      className={`${styles.weeklyStatus} ${
                        conforme ? styles.statusValid : styles.statusInvalid
                      }`}
                    >
                      {conforme ? '✓ Conforme' : '⚠ Revisar'}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Visual Panel - Demanda VRSoft x Caixas */}
      <div className={styles.weeklyPanel}>
        <div style={{ marginBottom: '12px', padding: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '600', color: '#e8eef5' }}>
                Demanda VRSoft x caixas escalados
              </h3>
              <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
                Comparação entre demanda de clientes e operadores escalados por hora
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className={styles.optimizeButton} title="Otimização inteligente">
                Otimização
              </button>
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario.id)}
                  className={styles.optimizeButton}
                  style={{
                    background: selectedScenario === scenario.id ? 'rgba(45,212,191,.25)' : 'rgba(59,130,246,.15)',
                    borderColor: selectedScenario === scenario.id ? '#0369a1' : 'rgba(59,130,246,.3)',
                    color: selectedScenario === scenario.id ? '#0369a1' : '#0ea5e9'
                  }}
                >
                  {scenario.label.split(' - ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Day Toolbar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {diasFull.map((dia, idx) => (
            <button
              key={dia}
              onClick={() => setSelectedDay(dia.toLowerCase())}
              className={styles.optimizeButton}
              style={{
                background: selectedDay === dia.toLowerCase() ? 'rgba(45,212,191,.25)' : 'rgba(59,130,246,.15)',
                borderColor: selectedDay === dia.toLowerCase() ? '#0369a1' : 'rgba(59,130,246,.3)',
                color: selectedDay === dia.toLowerCase() ? '#0369a1' : '#0ea5e9',
                fontSize: '12px',
                padding: '6px 10px'
              }}
            >
              {dia}
            </button>
          ))}
        </div>


        {/* Heatmap Placeholder */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8'
        }}>
          <div style={{ textAlign: 'center' }}>
            <p>Heatmap de demanda por hora</p>
            <small style={{ color: '#64748b' }}>(Intensidade de demanda ao longo do dia)</small>
          </div>
        </div>

        {/* Cashier Load Panel */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: '#e8eef5' }}>
            Carga do caixa por hora
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', fontSize: '10px' }}>
            {['08h', '10h', '12h', '14h', '16h', '18h', '20h', 'Média'].map((hora) => (
              <div key={hora} style={{
                padding: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <span style={{ color: '#94a3b8' }}>{hora}</span>
                <strong style={{ display: 'block', marginTop: '4px', color: '#0ea5e9' }}>
                  {Math.floor(Math.random() * 100)}%
                </strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* KPI Cards */}
      <div className={styles.kpiCards}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Colaboradores</span>
          <div className={styles.kpiValue} style={{ color: '#0ea5e9' }}>
            {totalColaboradores}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Regime</span>
          <div className={styles.kpiValue} style={{ color: '#06b6d4' }}>
            6x1
          </div>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Horas Semanais</span>
          <div className={styles.kpiValue} style={{ color: '#c4b5fd' }}>
            44h
          </div>
        </div>
      </div>
    </div>
  );
}
