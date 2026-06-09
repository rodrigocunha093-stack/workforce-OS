const tabs = document.querySelectorAll('.sidebar button');
let authState = { authenticated: false, user: null };
console.log('App loaded with weekly scenarios - v2.1');

tabs.forEach((button) => {
  button.onclick = () => {
    tabs.forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  };
});

function statusClass(value) {
  if (value === 'OK' || value === 'Nao') return 'ok';
  if (value === 'Atencao' || value === 'Media') return 'warn';
  return 'bad';
}

function pill(value) {
  return `<span class="pill ${statusClass(value)}">${value}</span>`;
}

function heatClass(value) {
  if (value <= 1) return 'heat-low';
  if (value === 2) return 'heat-good';
  if (value === 3) return 'heat-high';
  return 'heat-peak';
}

function percent(value, max) {
  if (!max) return 0;
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)));
}

function parseHours(value) {
  if (value === 'Folga') return 0;
  const match = value.match(/(\d+)h(:(\d+))$/);
  if (!match) return 0;
  return Number(match[1]) + Number(match[2] || 0) / 60;
}

let currentCoverageDay = 'monday';
let currentCoverageScenario = 'atual';
let coverageAdjustmentMode = false;

const dayTypeLabels = {
  monday: 'segunda',
  tuesday: 'terça',
  wednesday: 'quarta',
  thursday: 'quinta',
  friday: 'sexta',
  saturday: 'sábado',
  sunday: 'domingo'
};

function renderKpis(scenarios, metadata) {
  const base = scenarios[0];
  const transition = scenarios[1];
  const final = scenarios[2];
  const operators = base.operadores || 0;
  const items = [
    { label: 'Demanda de caixa semanal', value: `${base.caixaNecessario}h`, tone: 'teal', detail: `${metadata.diasComVenda} dias importados` },
    { label: 'Capacidade contratual semanal', value: `${base.capacidade}h`, tone: 'blue', detail: `${operators} operadores x 44h` },
    { label: 'Perda 42h', value: `${base.capacidade - transition.capacidade}h`, tone: 'amber', detail: 'Impacto em apoio operacional' },
    { label: 'Perda 40h', value: `${base.capacidade - final.capacidade}h`, tone: 'red', detail: 'Segunda fase da mudança' },
  ];

  document.getElementById('kpis').innerHTML = items.map((item) => `
    <article class="kpi ${item.tone}">
      <small>${item.label}</small>
      <strong>${item.value}</strong>
      <span>${item.detail}</span>
    </article>
  `).join('');
}

function renderMonthlyWeekAnalysis(data) {
  const weeks = data.monthlyWeekAnalysis || [];
  if (!weeks.length) {
    document.getElementById('weeklyMonthAnalysis').innerHTML = '<div class="summary-empty"><strong>Sem leitura semanal ainda</strong><span>Importe vendas com data para comparar as semanas do mes.</span></div>';
    return;
  }
  const strongest = weeks.reduce((best, item) => (!best || item.caixaHoraSemanaEquivalente > best.caixaHoraSemanaEquivalente ? item : best), null);
  const headcountRisk = weeks.filter((item) => item.auxiliar40h < 0).length;
  document.getElementById('weeklyMonthAnalysis').innerHTML = `
    <div class="weekly-strength-summary">
      <article><small>Semanas lidas</small><strong>${weeks.length}</strong><span>${data.metadata.periodoAmostra}</span></article>
      <article><small>Pico semanal</small><strong>${strongest.caixaHoraSemanaEquivalente}h</strong><span>${strongest.label}</span></article>
      <article class="${headcountRisk ? 'summary-bad' : 'summary-ok'}"><small>Quadro de caixa</small><strong>${headcountRisk ? 'Revisar' : 'Mantem'}</strong><span>${headcountRisk ? `${headcountRisk} semana(s) acima de 40h` : 'Mudanca fica na folga operacional'}</span></article>
    </div>
    ${weeks.map((item) => `
      <article class="weekly-strength-card ${item.auxiliar40h < 0 ? 'risk' : 'safe'}">
        <div class="weekly-strength-top">
          <strong>${item.label}</strong>
          <span>${item.periodLabel}</span>
        </div>
        <div class="weekly-strength-metrics">
          <div><small>Dias observados</small><strong>${item.observedDays}</strong></div>
          <div><small>Caixa-hora equiv.</small><strong>${item.caixaHoraSemanaEquivalente}h</strong></div>
          <div><small>Cupons medio/dia</small><strong>${item.cuponsMediosDia}</strong></div>
          <div><small>Venda media/dia</small><strong>${money(item.vendaMediaDia)}</strong></div>
        </div>
        <div class="weekly-strength-support">
          <span>Auxiliar 44h <b>${item.auxiliar44h}h</b></span>
          <span>Auxiliar 42h <b>${item.auxiliar42h}h</b></span>
          <span>Auxiliar 40h <b>${item.auxiliar40h}h</b></span>
        </div>
        <p>${item.auxiliar40h < 0 ? 'Semana forte o bastante para pressionar a operacao de caixa no cenario 40h.' : 'Sem indicio de contratacao para caixa; a variacao aparece principalmente nas horas livres para apoio.'}</p>
      </article>
    `).join('')}
  `;
}

function renderScenarios(scenarios, metadata) {
  const maxCapacity = Math.max(...scenarios.map((scenario) => scenario.capacidade));
  const pdvs = window.currentSummary?.storeConfig?.pdvs || scenarios[0]?.pdvs || 0;

  document.getElementById('scenarioCards').innerHTML = scenarios.map((scenario) => {
    const auxiliary = scenario.capacidade - scenario.caixaNecessario;
    return `
      <article class="scenario-card">
        <div class="scenario-top">
          <span>${scenario.tipo}</span>
          <span class="pill warn">Simulação</span>
        </div>
        <h3>${scenario.cenario}</h3>
        <div class="metric-row"><span>Horas semanais</span><strong>${scenario.horasSemanais}h</strong></div>
        <div class="metric-row"><span>PDVs / operadores</span><strong>${pdvs} / ${scenario.operadores}</strong></div>
        <div class="metric-row"><span>Capacidade</span><strong>${scenario.capacidade}h</strong></div>
        <div class="meter"><i style="width:${percent(scenario.capacidade, maxCapacity)}%"></i></div>
        <div class="split-metrics">
          <div><small>Caixa · semana referência</small><strong>${scenario.caixaNecessario}h</strong></div>
          <div><small>Auxiliares</small><strong>${auxiliary}h</strong></div>
        </div>
      </article>
    `;
  }).join('');
}

function renderBenchmark(data) {
  const rows = data.blueYonderBenchmark || [];
  document.getElementById('benchmarkGrid').innerHTML = rows.map((row) => `
    <article class="benchmark-card">
      <div><strong>${row.pilar}</strong><span class="benchmark-status">${row.nossoStatus}</span></div>
      <p>${row.evidencia}</p>
      <small>${row.proximoPasso}</small>
    </article>
  `).join('');
}

function renderEnterpriseReadiness(data) {
  const source = data.dataSource || { mode: 'demo', connected: false };
  const authenticated = Boolean(authState?.authenticated);
  const maturity = data.client?.maturity || { score: data.metadata?.confianca || 0, stage: 'Diagnostico operacional' };
  const salesDays = Number(data.metadata?.diasComVenda || 0);
  const readiness = [
    {
      label: 'Base de dados',
      value: source.mode === 'postgresql' ? 'PostgreSQL ativo' : 'Local seguro',
      detail: source.mode === 'postgresql' ? 'Persistencia pronta para operacao assistida' : 'Conta isolada com migracao preparada',
      tone: source.mode === 'postgresql' ? 'ready' : 'watch'
    },
    {
      label: 'Historico de vendas',
      value: `${salesDays} dias`,
      detail: salesDays >= 56 ? 'Base robusta para variacoes de calendario' : salesDays >= 28 ? 'Base boa para diagnostico gerencial' : 'Base inicial; ampliar semanas melhora a previsao',
      tone: salesDays >= 28 ? 'ready' : 'watch'
    },
    {
      label: 'Seguranca da conta',
      value: authenticated ? 'Ativa' : 'Demonstração',
      detail: authenticated ? 'Sessao protegida, historico e backup habilitados' : 'A conta libera ambiente proprio para o cliente',
      tone: authenticated ? 'ready' : 'watch'
    },
    {
      label: 'Nivel de decisao',
      value: maturity.stage || 'Diagnostico operacional',
      detail: `Confianca atual ${data.metadata?.confianca || 0}%`,
      tone: (maturity.score || 0) >= 70 ? 'ready' : 'watch'
    }
  ];
  const panel = document.getElementById('enterpriseReadiness');
  if (!panel) return;
  panel.innerHTML = readiness.map((item) => `
    <article class="enterprise-card ${item.tone}">
      <small>${item.label}</small>
      <strong>${item.value}</strong>
      <span>${item.detail}</span>
    </article>
  `).join('');
}

function renderSectorEngine(data) {
  const engine = data.sectorEngine || { coreSectors: [], library: [], example: {}, evolution: [] };
  const core = engine.coreSectors || [];
  const library = engine.library || [];
  const mvpCount = library.filter((item) => item.prioridade === 'MVP').length;
  const expansionCount = library.length - mvpCount;
  document.getElementById('sectorKpis').innerHTML = [
    ['Setores core', core.length, 'Primeira versao do motor'],
    ['Biblioteca total', library.length, 'Setores mapeados'],
    ['Prioridade inicial', mvpCount, 'Maior impacto operacional'],
    ['Expansao futura', expansionCount, 'Depois da base real']
  ].map(([label, value, detail]) => `<article><small>${label}</small><strong>${value}</strong><span>${detail}</span></article>`).join('');

  document.getElementById('coreSectors').innerHTML = core.map((sector) => `
    <article class="core-sector-card">
      <div class="sector-card-head">
        <span>${sector.setor}</span>
        <b>${sector.benchmarkInicial} ${sector.unidade}</b>
      </div>
      <h3>${sector.driver}</h3>
      <div class="sector-range"><small>${sector.indicador}</small><strong>${sector.faixa}</strong></div>
      <p>${sector.impacto}</p>
      <div class="sector-data-needs">
        ${sector.dadosNecessarios.map((item) => `<em>${item}</em>`).join('')}
      </div>
    </article>
  `).join('');

  const example = engine.example || {};
  document.getElementById('sectorExample').innerHTML = `
    <div class="example-formula">
      <span>${example.setor || 'Setor'}</span>
      <strong>${example.pessoasSugeridas || 0} pessoas sugeridas</strong>
      <p>${example.formula || ''}</p>
    </div>
    <div class="example-steps">
      <div><small>Volume</small><b>${example.volume || 0} ${example.unidade || ''}</b></div>
      <div><small>Benchmark</small><b>${example.benchmark || 0} kg/h</b></div>
      <div><small>Horas necessarias</small><b>${example.horasNecessarias || 0}h</b></div>
      <div><small>Jornada util</small><b>${example.jarnadaUtil || 0}h</b></div>
    </div>
  `;

  document.getElementById('benchmarkEvolution').innerHTML = `
    <p>${engine.principle || ''}</p>
    ${engine.evolution.map((row) => `
      <div class="evolution-row">
        <span>${row.cluster}</span>
        <strong>${row.acougueKgHora} kg/h</strong>
        <small>${row.leitura}</small>
      </div>
    `).join('')}
  `;

  document.getElementById('sectorLibrary').innerHTML = `
    <div class="sector-library-row sector-library-head"><span>Setor</span><span>Driver</span><span>Indicador</span><span>Faixa</span><span>Uso</span></div>
    ${library.map((item) => `
      <div class="sector-library-row">
        <span><strong>${item.setor}</strong></span>
        <span>${item.driver}</span>
        <span>${item.indicador}</span>
        <span>${item.faixa}</span>
        <span class="sector-priority ${item.prioridade.toLowerCase()}">${item.prioridade}</span>
      </div>
    `).join('')}
  `;
}

function coverageStatus(row, scenario) {
  if (row.demanda === null) return { label: 'Aguardando vendas', className: 'unknown', balance: null };
  const balance = row[scenario] - row.demanda;
  if (balance < 0) {
    const deficitPercent = Math.round((Math.abs(balance) / row.demanda) * 100);
    const risk = deficitPercent >= 50 ? 'Critico' : deficitPercent >= 25 ? 'Alto' : 'Moderado';
    return { label: `${risk} · ${deficitPercent}%`, className: 'deficit', balance, deficitPercent, risk };
  }
  if (balance === 0) return { label: 'Coberto', className: 'covered', balance };
  if (row.hora === '18-19') return { label: 'Fechamento seguro', className: 'secure', balance };
  return { label: 'Disponível para apoio', className: 'surplus', balance };
}

function queueFromLoad(load, scheduled) {
  if (!load) return { label: 'Sem dados', className: 'unknown', minutes: 0, bottleneck: false };
  const capacityMinutes = Math.max(1, Number(scheduled || 0)) * 60;
  const overflow = Math.max(0, Number(load.minutosNecessarios || 0) - capacityMinutes);
  const utilization = Math.round(Math.min(200, (Number(load.minutosNecessarios || 0) / capacityMinutes) * 100));
  const minutes = overflow
    ? Number(Math.min(15, overflow / Math.max(1, Number(load.clientes || 1)) * 4).toFixed(1))
    : Number(Math.max(0.5, utilization / 100 * 1.8).toFixed(1));
  const pdvs = window.currentSummary?.storeConfig?.pdvs || 0;
  const bottleneck = Boolean(load.limitadoPorPdvs && scheduled >= pdvs && overflow > 0);
  if (bottleneck) return { label: 'Gargalo PDV', className: 'queue-bottleneck', minutes, bottleneck, utilization };
  if (minutes <= 2) return { label: 'Baixa', className: 'queue-low', minutes, bottleneck, utilization };
  if (minutes <= 5) return { label: 'Media', className: 'queue-medium', minutes, bottleneck, utilization };
  if (minutes <= 10) return { label: 'Alta', className: 'queue-high', minutes, bottleneck, utilization };
  return { label: 'Critica', className: 'queue-critical', minutes, bottleneck, utilization };
}

function applyCoverageAdjustment(rows, scenario, availableWorkers) {
  const pdvs = window.currentSummary?.storeConfig?.pdvs || 3;
  if (!coverageAdjustmentMode) return rows;
  return rows.map((row) => {
    if (!row.cargaCaixa || row.demanda === null) return row;
    const target = Math.min(
      pdvs,
      availableWorkers,
      Math.max(
        Number(row.demanda || 0),
        Number(row.cargaCaixa.operadoresRecomendados || 0),
        Number(row[scenario] || 0)
      )
    );
    return {
      ...row,
      [scenario]: Math.max(Number(row[scenario] || 0), target),
      ajusteAutomatico: target > Number(row[scenario] || 0)
    };
  });
}

function renderCashierLoadPanel(rows, scenario) {
  const panel = document.getElementById('cashierLoadPanel');
  if (!panel) return;
  const known = rows.filter((row) => row.cargaCaixa);
  if (!known.length) {
    panel.innerHTML = '';
    return;
  }

  const totalMinutes = known.reduce((total, row) => total + row.cargaCaixa.minutosNecessarios, 0);
  const peakCalculated = known.reduce((max, row) => Math.max(max, row.cargaCaixa.operadoresCalculados || row.cargaCaixa.operadoresRecomendados), 0);
  const peakPossible = known.reduce((max, row) => Math.max(max, row.cargaCaixa.operadoresRecomendados), 0);
  const queueEvaluations = known.map((row) => ({ row, queue: queueFromLoad(row.cargaCaixa, row[scenario]) }));
  const criticalQueues = queueEvaluations.filter((item) => ['Alta', 'Critica'].includes(item.queue.label)).length;
  const pdvBottlenecks = queueEvaluations.filter((item) => item.queue.bottleneck).length;
  const adjustedHours = known.filter((row) => row.ajusteAutomatico).length;
  const pdvs = window.currentSummary?.storeConfig?.pdvs || 0;

  panel.innerHTML = `
    <div class="icoc-head">
      <div>
        <p class="eyebrow">ICOC - indice de carga operacional de caixa</p>
        <h3>Carga real estimada por hora</h3>
        <p class="note">Calculado = minutos necessarios / 60 com margem de 10%. Quando o arquivo traz horainicio/horatermino, os minutos passam a ser reais.</p>
      </div>
      <div class="icoc-kpis">
        <div><small>Minutos de caixa</small><strong>${totalMinutes}</strong></div>
        <div><small>Pico calculado</small><strong>${peakCalculated}</strong></div>
        <div><small>Pico possivel</small><strong>${peakPossible}${pdvs ? `/${pdvs}` : ''}</strong></div>
        <div class="${criticalQueues ? 'summary-bad' : 'summary-ok'}"><small>Criticos ajustaveis</small><strong>${criticalQueues}</strong></div>
        <div class="${pdvBottlenecks ? 'summary-bad' : 'summary-ok'}"><small>Gargalos PDV</small><strong>${pdvBottlenecks}</strong></div>
        <div><small>Horas recalculadas</small><strong>${adjustedHours}</strong></div>
      </div>
    </div>
    <div class="icoc-table">
      <div class="icoc-row icoc-header">
        <span>Hora</span><span>Clientes</span><span>Itens/cupom</span><span>Min/cupom</span><span>Compra</span><span>Pagamento</span><span>Minutos</span><span>Calculado</span><span>Possivel</span><span>Escalado</span><span>Fila</span>
      </div>
      ${known.map((row) => {
        const load = row.cargaCaixa;
        const scheduled = row[scenario];
        const queue = queueFromLoad(load, scheduled);
        const recClass = load.operadoresRecomendados > scheduled ? 'deficit' : load.operadoresRecomendados < scheduled ? 'surplus' : 'covered';
        return `
          <div class="icoc-row">
            <span class="coverage-hour">${row.hora}</span>
            <span>${load.clientes}</span>
            <span>${load.itensMedios}</span>
            <span>${load.tempoMedioMin}</span>
            <span>${load.classeCompra}</span>
            <span>${load.formaPagamento}</span>
            <span>${load.minutosNecessarios}${load.minutosOrigem === 'real' ? ' real' : ''}</span>
            <span class="coverage-balance ${load.limitadoPorPdvs ? 'deficit' : recClass}">${load.operadoresCalculados || load.operadoresRecomendados}</span>
            <span class="coverage-balance ${recClass}">${load.operadoresRecomendados}${load.limitadoPorPdvs ? ' PDV' : ''}</span>
            <span>${scheduled}${row.ajusteAutomatico ? ' ajustado' : ''}</span>
            <span class="queue-pill ${queue.className}">${queue.label} · ${queue.minutes}min</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCoverage(data) {
  const cfg = data.dailyCoverage[currentCoverageDay];
  if (cfg.closed) {
    document.getElementById('coverageNote').textContent = `${cfg.source} · ${cfg.note}`;
    document.getElementById('coverageSummary').innerHTML = `
      <div class="summary-empty"><strong>Loja fechada neste dia</strong><span>Sem exigência de vendas, escala de caixa ou cobertura operacional.</span></div>
    `;
    document.getElementById('coverageHeatmap').innerHTML = `
      <div class="coverage-row coverage-head">
        <span>Hora</span><span>Demanda VRSoft</span><span>Caixas ativos</span><span>Saldo</span><span>Risco / status</span>
      </div>
      <div class="coverage-row">
        <span class="coverage-hour">Dia fechado</span>
        <span class="coverage-number">—</span>
        <span class="coverage-number">0</span>
        <span class="coverage-balance covered">0</span>
        <span class="coverage-status covered">Não aplicável</span>
      </div>
    `;
    renderCashierLoadPanel([], currentCoverageScenario);
    renderStaffSchedule(data);
    return;
  }
  const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(currentCoverageDay);
  const weeklyPeople = data.weeklyScenarioSchedule[currentCoverageScenario].people;
  const availableWorkers = Object.values(weeklyPeople).filter((shifts) => shifts[dayIndex] !== 'Folga').length;
  const baseRows = cfg.rows.map((row) => ({
    ...row,
    [currentCoverageScenario]: Math.min(Number(row[currentCoverageScenario]), availableWorkers)
  }));
  const effectiveRows = applyCoverageAdjustment(baseRows, currentCoverageScenario, availableWorkers);
  const evaluated = effectiveRows.map((row) => ({ row, status: coverageStatus(row, currentCoverageScenario) }));
  const known = evaluated.filter((item) => item.row.demanda !== null);
  const deficits = known.filter((item) => item.status.balance < 0).length;
  const maximumDeficit = known.reduce((maximum, item) => Math.max(maximum, item.status.deficitPercent || 0), 0);
  const covered = known.filter((item) => item.status.balance === 0).length;
  const surplus = known.reduce((total, item) => total + Math.max(0, item.status.balance), 0);
  const adjustedHours = known.filter((item) => item.row.ajusteAutomatico).length;
  const pdvBottlenecks = known.filter((item) => queueFromLoad(item.row.cargaCaixa, item.row[currentCoverageScenario]).bottleneck).length;

  document.getElementById('coverageNote').textContent = `${cfg.source} · confianca ${cfg.confidence}.${coverageAdjustmentMode ? ' Recalculo ativo: cobre criticos ate o limite de PDVs e equipe.' : ''}`;
  document.getElementById('coverageSummary').innerHTML = known.length ? `
    <div><small>Equipe trabalhando</small><strong>${availableWorkers}</strong></div>
    <div><small>Horas avaliadas</small><strong>${known.length}</strong></div>
    <div class="${deficits ? 'summary-bad' : 'summary-ok'}"><small>Deficits</small><strong>${deficits}${deficits ? ` - ate ${maximumDeficit}%` : ''}</strong></div>
    <div><small>Cobertura exata</small><strong>${covered}</strong></div>
    <div><small>Caixas-hora para apoio</small><strong>${surplus}</strong></div>
    <div><small>Recalculadas</small><strong>${adjustedHours}</strong></div>
    <div class="${pdvBottlenecks ? 'summary-bad' : 'summary-ok'}"><small>Gargalo PDV</small><strong>${pdvBottlenecks}</strong></div>
  ` : `
    <div class="summary-empty"><strong>Sem dados de venda para este dia</strong><span>Importe o movimento VRSoft antes de validar a formacao.</span></div>
  `;

  document.getElementById('coverageHeatmap').innerHTML = `
    <div class="coverage-row coverage-head">
      <span>Hora</span><span>Demanda VRSoft</span><span>Caixas ativos</span><span>Saldo</span><span>Risco / status</span>
    </div>
    ${evaluated.map(({ row, status }) => `
      <div class="coverage-row">
        <span class="coverage-hour">${row.hora}</span>
        <span class="coverage-number">${row.demanda === null ? '-' : row.demanda}</span>
        <span class="coverage-number">${row[currentCoverageScenario]}${row.ajusteAutomatico ? ' *' : ''}</span>
        <span class="coverage-balance ${status.className}">${status.balance === null ? '-' : `${status.balance > 0 ? '+' : ''}${status.balance}`}</span>
        <span class="coverage-status ${status.className}">${status.label}</span>
      </div>
    `).join('')}
  `;
  renderCashierLoadPanel(effectiveRows, currentCoverageScenario);
  renderStaffSchedule(data);
}

function renderStaffSchedule(data) {
  const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(currentCoverageDay);
  const scenario = data.weeklyScenarioSchedule[currentCoverageScenario];
  const staff = currentCoverageScenario === 'atual'
    ? data.staffSchedule[currentCoverageDay]
    : Object.entries(scenario.people).map(([nome, shifts]) => {
      const shift = shifts[dayIndex];
      if (shift === 'Folga') return { nome, status: 'Folga', perfil: 'Folga do cenário 5x2', inicio: null, fim: null, intervalo: null, horas: 0 };
      const [period, hours] = shift.split(' · ');
      const [inicio, fim] = period.split('-');
      const perfil = fim === '19' ? 'Fechamento' : Number(inicio.split(':')[0]) <= 7 ? 'Abertura' : 'Intermediario';
      return {
        nome,
        status: 'Trabalhando',
        perfil,
        inicio,
        fim,
        intervalo: period === '08-12' ? 'Sem intervalo' : '1h escalonado',
        horas: hours.replace('h', 'h')
      };
    });
  const weeklyHours = Object.fromEntries(Object.keys(scenario.people).map((nome) => [nome, scenario.targetHours]));
  const working = staff.filter((person) => person.status === 'Trabalhando');
  const off = staff.filter((person) => person.status === 'Folga');
  document.getElementById('staffScheduleNote').textContent = currentCoverageScenario === 'atual'
    ? `${data.dailyCoverage[currentCoverageDay].label} - formacao-base atual 6x1 44h.`
    : `${data.dailyCoverage[currentCoverageDay].label} · formacao individual ${scenario.label}; intervalos serão posicionados pela otimização horária.`;
  document.getElementById('staffDaySummary').innerHTML = `
    <span class="working-summary">${working.length} trabalhando</span>
    <span class="off-summary">${off.length} de folga</span>
  `;
  document.getElementById('staffSchedule').innerHTML = staff.map((person) => `
    <article class="staff-card ${person.status === 'Folga' ? 'off' : 'working'}">
      <div class="staff-person">
        <span>${person.nome.slice(0, 1)}</span>
        <div><strong>${person.nome}</strong><small>${person.perfil} · semana ${weeklyHours[person.nome]}h</small></div>
        <b>${person.status}</b>
      </div>
      ${person.status === 'Trabalhando' ? `
        <div class="staff-times">
          <div><small>Entrada</small><strong>${person.inicio}</strong></div>
          <div><small>Saída</small><strong>${person.fim}</strong></div>
          <div><small>Intervalo</small><strong>${person.intervalo}</strong></div>
          <div><small>Horas</small><strong>${String(person.horas).includes('h') ? person.horas : `${person.horas}h`}</strong></div>
        </div>
        <div class="shift-track">
          <span class="shift-presence"></span>
          ${person.intervalo !== 'Sem intervalo' ? '<i title="Intervalo"></i>' : ''}
        </div>
      ` : '<p class="off-message">Sem jarnada prevista neste dia.</p>'}
    </article>
  `).join('');
}

function renderWeeklySchedule(data) {
  const scenario = data.weeklyScenarioSchedule[currentCoverageScenario];
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const people = Object.entries(scenario.people);
  const audits = people.map(([nome, shifts]) => ({
    nome,
    hours: shifts.reduce((sum, shift) => sum + parseHours(shift), 0),
    daysOff: shifts.filter((shift) => shift === 'Folga').length
  }));
  const valid = audits.filter((audit) => Math.abs(audit.hours - scenario.targetHours) < 0.01 && audit.daysOff === scenario.targetDaysOff).length;
  document.getElementById('weeklyScheduleNote').textContent = `${scenario.label}: meta de ${scenario.targetHours}h e ${scenario.targetDaysOff} folga${scenario.targetDaysOff > 1 ? 's' : ''} a cada 7 dias.`;
  document.getElementById('weeklyAuditSummary').innerHTML = `
    <span class="${valid === audits.length ? 'weekly-ok' : 'weekly-bad'}">${valid}/${audits.length} conformes</span>
  `;
  document.getElementById('weeklySchedule').innerHTML = `
    <div class="weekly-row weekly-head"><span>Colaboradora</span>${days.map((day) => `<span>${day}</span>`).join('')}<span>Auditoria</span></div>
    ${people.map(([nome, shifts]) => {
      const audit = audits.find((item) => item.nome === nome);
      const ok = Math.abs(audit.hours - scenario.targetHours) < 0.01 && audit.daysOff === scenario.targetDaysOff;
      return `
        <div class="weekly-row">
          <span class="weekly-person"><strong>${nome}</strong><small>${audit.hours.toFixed(0)}h - ${audit.daysOff} folga${audit.daysOff > 1 ? 's' : ''}</small></span>
          ${shifts.map((shift) => `<span class="weekly-shift ${shift === 'Folga' ? 'weekly-off' : shift.includes('08-12') ? 'weekly-sunday' : ''}">${shift}</span>`).join('')}
          <span class="weekly-status ${ok ? 'valid' : 'invalid'}">${ok ? 'Conforme' : 'Revisar'}</span>
        </div>
      `;
    }).join('')}
  `;
}

function renderSunday(rotation) {
  if (!rotation.length) {
    document.getElementById('sundayGrid').innerHTML = `
      <article class="sunday-card">
        <div class="date-block">
          <small>Domingo</small>
          <strong>Fechado</strong>
        </div>
        <div>
          <span class="label">Regra</span>
          <p>Sem escala dominical obrigatória para a loja configurada como fechada.</p>
          <em>Se a loja abrir parte dos domingos, configure em Implantacao e importe apenas os domingos abertos.</em>
        </div>
      </article>
    `;
    return;
  }
  document.getElementById('sundayGrid').innerHTML = rotation.map((day, index) => `
    <article class="sunday-card">
      <div class="date-block">
        <small>Domingo ${index + 1}</small>
        <strong>${day.data}</strong>
      </div>
      <div>
        <span class="label">Folga</span>
        <p>${Array.isArray(day.folga) ? day.folga.join(', ') : day.folga}</p>
      </div>
      <div>
        <span class="label">Trabalhando</span>
        <p>${day.trabalhando.join(', ')}</p>
      </div>
      <em>${day.alerta}</em>
    </article>
  `).join('');
}

function renderAudit(audit) {
  document.getElementById('auditCards').innerHTML = audit.map((person) => `
    <article class="audit-card">
      <div class="audit-head">
        <div>
          <small>${person.sexo}</small>
          <h3>${person.nome}</h3>
        </div>
        ${pill(person.status)}
      </div>
      <div class="audit-stats">
        <div><small>Dias trab.</small><strong>${person.diasTrabalho}</strong></div>
        <div><small>Folgas</small><strong>${person.folgas}</strong></div>
        <div><small>Dom. trab.</small><strong>${person.domingosTrabalhados}</strong></div>
        <div><small>Horas mes</small><strong>${person.horasMes}</strong></div>
      </div>
      <div class="meter slim"><i style="width:${percent(Number(person.horasMes), 176)}%"></i></div>
    </article>
  `).join('');
}

function renderCommission(review) {
  document.getElementById('commissionSummary').innerHTML = `
    <article class="commission-score">
      <small>Índice de prontidão</small>
      <strong>${review.score}</strong>
      <span>${review.status}</span>
    </article>
    <div class="commission-dimensions">
      ${review.dimensions.map((dimension) => `
        <div>
          <span><b>${dimension.nome}</b><small>${dimension.responsavel}</small></span>
          <i><emestyle="width:${dimension.score}%"></em></i>
          <strong>${dimension.score}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderActions(actions, priority = 'all') {
  const visible = priority === 'all' ? actions : actions.filter((action) => action.prioridade === priority);
  document.getElementById('actions').innerHTML = visible.map((action, index) => `
    <article class="action-card ${action.prioridade}">
      <div class="action-top">
        <span>${action.prioridade}</span>
        <small>${action.especialista}</small>
      </div>
      <h3>${action.tipo}</h3>
      <p class="action-diagnosis">${action.diagnostico}</p>
      <div class="action-recommendation"><small>Orientação da comissão</small><strong>${action.recomendacao}</strong></div>
      <dl>
        <div><dt>Gatilho</dt><dd>${action.gatilho}</dd></div>
        <div><dt>Impacto</dt><dd>${action.impacto}</dd></div>
        <div><dt>Indicador</dt><dd>${action.metrica}</dd></div>
      </dl>
      <div class="action-footer"><span>Base: ${action.referencia}</span><button data-action-index="${index}">Criar plano de ação</button></div>
    </article>
  `).join('');
  document.querySelectorAll('[data-action-index]').forEach((button) => {
    button.onclick = () => showToast('Plano de ação criado no rascunho da escala.');
  });
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function calculateFinance(data, assumptions) {
  const monthlyCostPerPerson = assumptions.salarioBaseMensal * (1 + assumptions.encargosPercentual / 100) + assumptions.beneficiosMensais;
  const teamMonthlyCost = monthlyCostPerPerson * assumptions.quantidadeOperadores;
  const monthlyRevenue = assumptions.faturamentoSemanaReferencia * assumptions.semanasPorMes;
  const base = data.scenarios[0];
  const baseAuxiliary = (base.capacidade - base.caixaNecessario) * assumptions.semanasPorMes;

  const scenarios = data.scenarios.map((scenario) => {
    const monthlyCapacity = scenario.capacidade * assumptions.semanasPorMes;
    const monthlyCashDemand = scenario.caixaNecessario * assumptions.semanasPorMes;
    const monthlyAuxiliary = Math.max(0, monthlyCapacity - monthlyCashDemand);
    const hourlyCost = monthlyCapacity ? teamMonthlyCost / monthlyCapacity : 0;
    const lostAuxiliary = Math.max(0, baseAuxiliary - monthlyAuxiliary);
    return {
      ...scenario,
      monthlyCapacity,
      monthlyAuxiliary,
      hourlyCost,
      lostAuxiliary,
      lostCapacityValue: lostAuxiliary * hourlyCost,
      directSavings: 0,
      coveragePercent: scenario.capacidade ? Math.round((scenario.caixaNecessario / scenario.capacidade) * 100) : 0
    };
  });
  return { monthlyCostPerPerson, teamMonthlyCost, monthlyRevenue, scenarios };
}

function renderFinance(data) {
  const assumptions = data.financial.assumptions;
  const result = calculateFinance(data, assumptions);
  const payrollPercent = result.monthlyRevenue ? result.teamMonthlyCost / result.monthlyRevenue * 100 : 0;
  const marginValue = result.monthlyRevenue * assumptions.margemBrutaPercentual / 100;

  document.getElementById('financeKpis').innerHTML = [
    ['Custo mensal da equipe', money(result.teamMonthlyCost), 'Salário, benefícios e encargos'],
    ['Custo anual estimado', money(result.teamMonthlyCost * 12), 'Sem horas extras ou adicionais'],
    ['Folha / faturamento', `${payrollPercent.toFixed(1)}%`, 'Somente as quatro operadoras'],
    ['Margem bruta de referência', money(marginValue), `${assumptions.margemBrutaPercentual}% do faturamento informado`]
  ].map(([label, value, detail]) => `<article><small>${label}</small><strong>${value}</strong><span>${detail}</span></article>`).join('');

  document.getElementById('financeScenarios').innerHTML = result.scenarios.map((scenario, index) => `
    <article class="finance-scenario ${index === 0 ? 'base' : ''}">
      <div class="finance-scenario-head"><div><small>${scenario.tipo}</small><h3>${scenario.cenario}</h3></div><span>${scenario.coveragePercent}% capacidade dedicada ao caixa</span></div>
      <div class="finance-metrics">
        <div><small>Custo mensal</small><strong>${money(result.teamMonthlyCost)}</strong></div>
        <div><small>Custo por hora disponivel</small><strong>${money(scenario.hourlyCost)}</strong></div>
        <div><small>Horas auxiliares/mes</small><strong>${Math.round(scenario.monthlyAuxiliary)}h</strong></div>
        <div><small>Capacidade auxiliar perdida</small><strong>${Math.round(scenario.lostAuxiliary)}h</strong></div>
      </div>
      <div class="finance-impact ${scenario.lostAuxiliary ? 'negative' : 'neutral'}">
        <span>Economia direta comprovada</span><strong>${money(scenario.directSavings)}</strong>
        <small>${scenario.lostAuxiliary ? `Custo de oportunidade estimado: ${money(scenario.lostCapacityValue)}/mes` : 'Cenario-base para comparacao'}</small>
      </div>
    </article>
  `).join('');

  const final = result.scenarios[2];
  document.getElementById('financeDecision').innerHTML = `
    <div class="finance-decision">
      <strong>Não reconhecer economia salarial na mudança para 40h sem evidência real.</strong>
      <p>A equipe continua custando aproximadamente <b>${money(result.teamMonthlyCost)}/mes</b>, porém perde <b>${Math.round(final.lostAuxiliary)} horas auxiliares mensais</b>. Antes de contratar, medir tarefas nao realizadas, horas extras, filas e cobertura do fechamento.</p>
      <div><span>Contratação indicada agora: <b>nao</b></span><span>Economia comprovada: <b>${money(0)}</b></span><span>Risco a monitorar: <b>capacidade auxiliar</b></span></div>
    </div>
  `;

  renderOptimizationSavings(data);
}

function renderOptimizationSavings(data) {
  const el = document.getElementById('optimizationSavings');
  if (!el) return;
  const s = data.optimizationSavings;
  if (!s) {
    el.innerHTML = '<div class="summary-empty"><strong>Importe vendas para calcular economia</strong><span>A análise compara como a loja operou (caixas abertos) com o cenário otimizado pela demanda real.</span></div>';
    return;
  }

  const positiveSavings = s.economia.valorMes > 0;
  el.innerHTML = `
    <div class="savings-hero ${positiveSavings ? 'savings-positive' : 'savings-neutral'}">
      <div class="savings-main">
        <small>Economia mensal potencial</small>
        <strong>${money(s.economia.valorMes)}</strong>
        <span>${money(s.economia.valorAno)}/ano · ${s.economia.percentual}% de redução em caixas-hora</span>
      </div>
      <div class="savings-badge">${s.periodo}</div>
    </div>

    <div class="savings-compare">
      <article class="savings-card actual">
        <small>📊 Como a loja OPEROU</small>
        <strong>${s.operacaoReal.caixasHoraMes.toLocaleString('pt-BR')}h</strong>
        <span>operadoras-hora/mês</span>
        <div class="savings-cost">${money(s.operacaoReal.custoMes)}/mês</div>
      </article>
      <div class="savings-arrow">→</div>
      <article class="savings-card optimal">
        <small>✨ Operação OTIMIZADA</small>
        <strong>${s.operacaoOtimizada.caixasHoraMes.toLocaleString('pt-BR')}h</strong>
        <span>operadoras-hora/mês</span>
        <div class="savings-cost">${money(s.operacaoOtimizada.custoMes)}/mês</div>
      </article>
    </div>

    ${s.rotacaoExcessiva ? `
    <div class="savings-insight">
      <strong>⚠️ Rotação excessiva detectada</strong>
      <p>Em ${s.rotacaoExcessiva} faixas horárias, mais operadoras passaram pela frente de caixa do que os ${s.pdvs} PDVs disponíveis. Isso indica troca de turno, intervalos e rotação durante o expediente — cada operadora que loga no PDV gera custo/hora, mesmo trabalhando parte da hora.</p>
    </div>` : ''}

    <div class="savings-detail-head">Comparativo por faixa horária (média de operadoras ativas)</div>
    <div class="savings-hourly">
      <div class="savings-hour-row savings-hour-head">
        <span>Hora</span><span>Operou</span><span>Ótimo</span><span>Diferença</span>
      </div>
      ${s.hourlyComparison.map(h => `
        <div class="savings-hour-row">
          <span>${h.hora}</span>
          <span>${h.atualMedia}${h.atualMedia > s.pdvs ? ' ⚠️' : ''}</span>
          <span>${h.otimoMedia}</span>
          <span class="${h.diferenca > 0 ? 'savings-excess' : h.diferenca < 0 ? 'savings-deficit' : 'savings-ok'}">${h.diferenca > 0 ? '+' : ''}${h.diferenca}</span>
        </div>
      `).join('')}
    </div>

    <div class="savings-footnote">
      <small>💡 <b>Como funciona:</b> O VRSoft registra cada operadora que emitiu cupom na hora (operadoras únicas, não caixas simultâneos). Com ${s.pdvs} PDVs, valores acima de ${s.pdvs} (⚠️) indicam rotação/troca de turno. Custo por operadora-hora = ${money(s.custoHora)}. A economia vem de dedicar operadoras a períodos cheios em vez de rotação dispersa, mantendo a cobertura da demanda real.</small>
    </div>
  `;
}

function resilienceAnalysis(resilience, absentName = null) {
  const available = resilience.people.filter((person) => person.nome !== absentName);
  const skills = resilience.skills.map((skill) => {
    const qualified = available.filter((person) => Number(person.skills[skill.id] || 0) >= resilience.rules.nivelApto);
    const gap = Math.max(0, skill.minimo - qualified.length);
    const status = gap > 0 ? 'critical' : qualified.length === skill.minimo ? 'concentrated' : 'resilient';
    return { ...skill, qualified, gap, status };
  });
  return {
    skills,
    critical: skills.filter((skill) => skill.status === 'critical'),
    concentrated: skills.filter((skill) => skill.status === 'concentrated'),
    resilient: skills.filter((skill) => skill.status === 'resilient')
  };
}

function renderAbsenceResult(data, absentName) {
  const result = resilienceAnalysis(data.resilience, absentName);
  const target = document.getElementById('absenceResult');
  document.querySelectorAll('.absence-buttons button').forEach((button) => {
    button.classList.toggle('active', button.dataset.absent === absentName);
  });
  const riskClass = result.critical.length ? 'critical' : result.concentrated.length ? 'warning' : 'healthy';
  const headline = result.critical.length
    ? `Ausencia de ${absentName} cria ${result.critical.length} lacuna(s) critica(s)`
    : `Ausencia de ${absentName} mantém os mínimes operacionais`;
  target.innerHTML = `
    <div class="absence-verdict ${riskClass}">
      <small>Cenário simulado</small>
      <strong>${headline}</strong>
      <span>${result.critical.length ? 'Escala nao deve ser publicada sem substituicao habilitada.' : 'Operacao possivel, mas exige redistribuicao e acompanhamento.'}</span>
    </div>
    <div class="absence-skill-list">
      ${result.skills.map((skill) => `
        <div class="${skill.status}">
          <span>${skill.nome}</span>
          <strong>${skill.qualified.length}/${skill.minimo}</strong>
          <small>${skill.status === 'critical' ? 'Abaixo do minimo' : skill.status === 'concentrated' ? 'Sem reserva' : 'Com reserva'}</small>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResilience(data) {
  const resilience = data.resilience;
  if (!resilience.people.length) {
    document.getElementById('resilienceKpis').innerHTML = '<article><small>Status</small><strong>0</strong><span>Importe a equipe para iniciar a analise.</span></article>';
    document.getElementById('skillMatrix').innerHTML = '<div class="summary-empty"><strong>Equipe nao importada</strong><span>Cadastre a loja e importe os colaboradores na Area de Implantacao.</span></div>';
    document.getElementById('absenceButtons').innerHTML = '';
    document.getElementById('absenceResult').innerHTML = '';
    document.getElementById('resilienceActions').innerHTML = '';
    return;
  }
  const base = resilienceAnalysis(resilience);
  const simulations = resilience.people.map((person) => ({
    nome: person.nome,
    result: resilienceAnalysis(resilience, person.nome)
  }));
  const highRiskAbsences = simulations.filter((simulation) => simulation.result.critical.length).length;
  const validated = resilience.people.filter((person) => person.validado).length;

  document.getElementById('resilienceKpis').innerHTML = [
    ['Competências mapeadas', resilience.skills.length, 'Premissas iniciais'],
    ['Conhecimentos concentrados', base.concentrated.length, 'No minimo, sem pessoa reserva'],
    ['Ausencias com risco crítico', highRiskAbsences, `De ${resilience.people.length} simulações`],
    ['Perfis validados', `${validated}/${resilience.people.length}`, 'Validar com gerente e RH']
  ].map(([label, value, detail], index) => `
    <article class="${index === 2 && highRiskAbsences ? 'risk' : ''}">
      <small>${label}</small><strong>${value}</strong><span>${detail}</span>
    </article>
  `).join('');

  document.getElementById('skillMatrix').innerHTML = `
    <div class="skill-matrix-hint">💡 Clique em cada nível para editar: 1 (Treinar) → 2 (Apta) → 3 (Referência). Clique em "Pendente" para validar.</div>
    <div class="skill-row skill-head"><span>Colaboradora</span>${resilience.skills.map((skill) => `<span title="${skill.criticidade}">${skill.nome}</span>`).join('')}<span>Validação</span></div>
    ${resilience.people.map((person, personIdx) => `
      <div class="skill-row">
        <strong>${person.nome}</strong>
        ${resilience.skills.map((skill) => {
          const level = Number(person.skills[skill.id] || 0);
          const label = level === 3 ? 'Referencia' : level === 2 ? 'Apta' : 'Treinar';
          return `<span class="skill-level level-${level} editable-skill" data-person="${personIdx}" data-skill="${skill.id}" title="${label} (clique para mudar)" style="cursor:pointer">${level}</span>`;
        }).join('')}
        <span class="validation-status ${person.validado ? 'validated' : 'pending'} editable-validation" data-person="${personIdx}" style="cursor:pointer">${person.validado ? 'Validado' : 'Pendente'}</span>
      </div>
    `).join('')}
    <div class="skill-matrix-actions">
      <button id="saveSkillMatrix" class="optimize-button save-optimization">Salvar competências</button>
    </div>
  `;

  // Tornar células editáveis
  document.querySelectorAll('.editable-skill').forEach((cell) => {
    cell.onclick = () => {
      const personIdx = Number(cell.dataset.person);
      const skillId = cell.dataset.skill;
      const current = Number(resilience.people[personIdx].skills[skillId] || 0);
      const next = current >= 3 ? 1 : current + 1;
      resilience.people[personIdx].skills[skillId] = next;
      renderResilience(data);
    };
  });
  document.querySelectorAll('.editable-validation').forEach((cell) => {
    cell.onclick = () => {
      const personIdx = Number(cell.dataset.person);
      resilience.people[personIdx].validado = !resilience.people[personIdx].validado;
      renderResilience(data);
    };
  });
  const saveSkillBtn = document.getElementById('saveSkillMatrix');
  if (saveSkillBtn) {
    saveSkillBtn.onclick = async () => {
      try {
        const response = await fetch('/api/save-skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ people: resilience.people })
        });
        const result = await response.json();
        if (result.ok) {
          showToast('Competências salvas com sucesso!');
          saveSkillBtn.textContent = 'Salvo ✓';
          saveSkillBtn.disabled = true;
          setTimeout(() => { saveSkillBtn.textContent = 'Salvar competências'; saveSkillBtn.disabled = false; }, 3000);
        } else {
          showToast('Erro: ' + (result.error || 'tente novamente'));
        }
      } catch (error) {
        showToast('Erro ao salvar competências.');
      }
    };
  }

  document.getElementById('absenceButtons').innerHTML = resilience.people
    .map((person) => `<button data-absent="${person.nome}">${person.nome}</button>`)
    .join('');
  document.querySelectorAll('.absence-buttons button').forEach((button) => {
    button.onclick = () => renderAbsenceResult(data, button.dataset.absent);
  });
  renderAbsenceResult(data, resilience.people[0].nome);

  const concentrated = base.concentrated.map((skill) => skill.nome);
  document.getElementById('resilienceActions').innerHTML = `
    <article>
      <span class="action-order">01</span>
      <div><strong>Validar a matriz com gerente e RH</strong><p>Confirmar quem pode abrir, fechar, realizar sangria e liderar ocorrências. Nenhuma aptidão deve virar regra definitiva sem evidência.</p></div>
      <b>Prazo: 7 dias</b>
    </article>
    <article>
      <span class="action-order">02</span>
      <div><strong>Criar pessoas reserva para funcoes criticas</strong><p>${concentrated.length ? `Prioridade atual: ${concentrated.join(', ')}.` : 'A equipe ja possui reserva para todas as funcoes mapeadas.'}</p></div>
      <b>Prazo: ${resilience.rules.treinamentoPrazoDias} dias</b>
    </article>
    <article>
      <span class="action-order">03</span>
      <div><strong>Bloquear escala frágil</strong><p>Ao registrar falta, férias ou afastamento, impedir publicação se abertura, fechamento ou caixa ficarem abaixo do minimo habilitado.</p></div>
      <b>Automatizar</b>
    </article>
    <article>
      <span class="action-order">04</span>
      <div><strong>Contratar somente após testar capacitação</strong><p>A matriz atual recomenda desenvolver cobertura interna primeiro. Contratação passa a ser indicada quando a lacuna permanece após treinamento e remanejamento.</p></div>
      <b>Decisão: treinar</b>
    </article>
  `;
}

function renderDecisionMemory(data) {
  const memory = data.decisionMemory;
  document.getElementById('operatingPrinciples').innerHTML = memory.principles.map((principle, index) => `
    <article>
      <span>0${index + 1}</span>
      <div><strong>${principle.nome}</strong><p>${principle.adaptacao}</p></div>
    </article>
  `).join('');

  document.getElementById('decisionMemories').innerHTML = memory.recommendations.map((item) => `
    <article class="memory-card">
      <div class="memory-head">
        <div><small>${item.status}</small><h3>${item.decisao}</h3></div>
        <div class="confidence-score"><strong>${item.confidence}%</strong><span>confianca</span></div>
      </div>
      <div class="confidence-track"><i style="width:${item.confidence}%"></i></div>
      <div class="memory-data">
        <small>Dados utilizados</small>
        <div>${item.dados.map((value) => `<span>${value}</span>`).join('')}</div>
      </div>
      <div class="memory-calculation">
        <small>Memória de cálculo</small>
        <code>${item.formula}</code>
        <strong>${item.resultado}</strong>
      </div>
      <div class="memory-footer">
        <p><b>Limitação:</b> ${item.limitacao}</p>
        <p><b>Próxima ação:</b> ${item.proximaAcao}</p>
      </div>
    </article>
  `).join('');
}

let pendingSalesRows = [];
let pendingEmployees = [];

function normalizeHeader(value) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
}

function normalizeDate(value) {
  const clean = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function parseDecimal(value) {
  return Number(String(value || '0').replace(/\./g, '').replace(',', '.'));
}

function hourBucketFromTime(value) {
  const hour = Number(String(value || '').slice(0, 2));
  if (Number.isNaN(hour)) return null;
  const next = hour + 1;
  return {
    inicio: `${String(hour).padStart(2, '0')}:00`,
    fim: `${String(next).padStart(2, '0')}:00`
  };
}

function minutesBetween(start, end) {
  const parse = (value) => {
    const [hour, minute, second = 0] = String(value || '').split(':').map(Number);
    if ([hour, minute].some(Number.isNaN)) return null;
    return hour * 60 + minute + second / 60;
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) return 0;
  const diff = endMinutes - startMinutes;
  return diff > 120 ? 0 : diff;
}

function parseSalesCsv(text, fallbackDate = '', representedDays = 1) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ['Arquivo sem linhas de dados.'] };
  const daysDivisor = Math.max(1, Number(representedDays || 1));
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const detailedAliases = {
    data: ['data'],
    cupom: ['numerocupom', 'numero_cupom', 'n_cupom', 'cupom'],
    operador: ['matricula', 'operador'],
    horaInicio: ['horainicio', 'hora_inicio'],
    horaTermino: ['horatermino', 'hora_termino', 'hora_fim'],
    qtdItens: ['qtd_itens', 'qtde_itens', 'itens'],
    qtdUnidades: ['qtd_unidades', 'qtde_unidades', 'qtde._vendida', 'qtde_vendida'],
    valorCupom: ['valor_cupom', 'venda_liquida', 'valor_liquido']
  };
  const detailedPositions = Object.fromEntries(Object.entries(detailedAliases).map(([key, options]) => [key, headers.findIndex((header) => options.includes(header))]));
  const isDetailedFile = ['data', 'horaInicio', 'horaTermino', 'qtdItens', 'valorCupom'].every((key) => detailedPositions[key] >= 0);
  if (isDetailedFile) {
    const grouped = {};
    const errors = [];
    lines.slice(1).forEach((line, index) => {
      const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const data = normalizeDate(cells[detailedPositions.data]);
      const bucket = hourBucketFromTime(cells[detailedPositions.horaInicio]);
      const qtdItens = parseDecimal(cells[detailedPositions.qtdItens]);
      const qtdUnidades = detailedPositions.qtdUnidades >= 0 ? parseDecimal(cells[detailedPositions.qtdUnidades]) : qtdItens;
      const valorCupom = parseDecimal(cells[detailedPositions.valorCupom]);
      const minutosAtendimento = minutesBetween(cells[detailedPositions.horaInicio], cells[detailedPositions.horaTermino]);
      if (!data || !bucket || Number.isNaN(qtdItens) || Number.isNaN(valorCupom)) {
        errors.push(`Linha ${index + 2} inválida.`);
        return;
      }
      const key = `${data}|${bucket.inicio}|${bucket.fim}`;
      grouped[key] ||= {
        data,
        horaInicio: bucket.inicio,
        horaFim: bucket.fim,
        cupons: 0,
        vendaLiquida: 0,
        qtdeVendida: 0,
        qtdItens: 0,
        minutosAtendimento: 0,
        operadores: new Set(),
        modeloOrigem: 'vrsoft_detalhado'
      };
      grouped[key].cupons += 1;
      grouped[key].vendaLiquida += valorCupom;
      grouped[key].qtdeVendida += qtdUnidades;
      grouped[key].qtdItens += qtdItens;
      grouped[key].minutosAtendimento += minutosAtendimento;
      if (detailedPositions.operador >= 0 && cells[detailedPositions.operador]) grouped[key].operadores.add(cells[detailedPositions.operador]);
    });
    const rows = Object.values(grouped).map((row) => ({
      ...row,
      vendaLiquida: Number(row.vendaLiquida.toFixed(2)),
      qtdeVendida: Number(row.qtdeVendida.toFixed(3)),
      qtdItens: Number(row.qtdItens.toFixed(0)),
      itensMedios: row.cupons ? Number((row.qtdItens / row.cupons).toFixed(2)) : 0,
      minutosAtendimento: Number(row.minutosAtendimento.toFixed(2)),
      operadores: row.operadores.size,
      diasRepresentados: 1
    })).sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
    return { rows, errors, model: 'vrsoft_detalhado', sourceCoupons: lines.length - 1, representedDays: new Set(rows.map((row) => row.data)).size };
  }
  const couponAliases = {
    cupom: ['nº_cupom', 'n_cupom', 'no_cupom', 'cupom', 'numero_cupom'],
    quantidade: ['qtde._vendida', 'qtde_vendida', 'quantidade_vendida', 'quantidade', 'itens'],
    vendaLiquida: ['venda_liquida', 'vendaliquida', 'valor_liquido'],
    horario: ['horario', 'hora'],
    operador: ['operador'],
    nome: ['nome']
  };
  const couponPositions = Object.fromEntries(Object.entries(couponAliases).map(([key, options]) => [key, headers.findIndex((header) => options.includes(header))]));
  const isCouponFile = couponPositions.horario >= 0 && couponPositions.quantidade >= 0 && couponPositions.vendaLiquida >= 0;
  if (isCouponFile) {
    const data = normalizeDate(fallbackDate);
    if (!data) return { rows: [], errors: ['Arquivo cupom a cupom sem coluna de data. Informe a data do arquivo antes de importar.'] };
    const grouped = {};
    const errors = [];
    lines.slice(1).forEach((line, index) => {
      const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const bucket = hourBucketFromTime(cells[couponPositions.horario]);
      const quantidade = parseDecimal(cells[couponPositions.quantidade]);
      const vendaLiquida = parseDecimal(cells[couponPositions.vendaLiquida]);
      if (!bucket || Number.isNaN(quantidade) || Number.isNaN(vendaLiquida)) {
        errors.push(`Linha ${index + 2} inválida.`);
        return;
      }
      const key = `${data}|${bucket.inicio}|${bucket.fim}`;
      grouped[key] ||= {
        data,
        horaInicio: bucket.inicio,
        horaFim: bucket.fim,
        cupons: 0,
        vendaLiquida: 0,
        qtdeVendida: 0,
        operadores: new Set(),
        modeloOrigem: 'cupom_vrsoft'
      };
      grouped[key].cupons += 1;
      grouped[key].vendaLiquida += vendaLiquida;
      grouped[key].qtdeVendida += quantidade;
      if (couponPositions.operador >= 0 && cells[couponPositions.operador]) grouped[key].operadores.add(cells[couponPositions.operador]);
    });
    const rows = Object.values(grouped).map((row) => ({
      ...row,
      cupons: Number((row.cupons / daysDivisor).toFixed(2)),
      vendaLiquida: Number((row.vendaLiquida / daysDivisor).toFixed(2)),
      qtdeVendida: Number((row.qtdeVendida / daysDivisor).toFixed(3)),
      itensMedios: row.cupons ? Number((row.qtdeVendida / row.cupons).toFixed(2)) : 0,
      operadores: row.operadores.size,
      diasRepresentados: daysDivisor
    })).sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
    return { rows, errors, model: 'cupom_vrsoft', representedDays: daysDivisor, sourceCoupons: lines.length - 1 };
  }
  const aliases = {
    data: ['data', 'data_referencia'],
    horaInicio: ['hora_inicio', 'horainicio'],
    horaFim: ['hora_fim', 'horafim', 'hora_termino'],
    cupons: ['cupons', 'quantidade_cupons', 'qtde_cupom', 'qtd_cupom'],
    vendaLiquida: ['venda_liquida', 'vendaliquida', 'valor_liquido']
  };
  const positions = Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, headers.findIndex((header) => options.includes(header))]));
  const missing = Object.entries(positions).filter(([, index]) => index < 0).map(([key]) => key);
  if (missing.length) return { rows: [], errors: [`Colunas ausentes: ${missing.join(', ')}.`] };
  const rows = [];
  const errors = [];
  lines.slice(1).forEach((line, index) => {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row = {
      data: normalizeDate(cells[positions.data]),
      horaInicio: cells[positions.horaInicio].slice(0, 5),
      horaFim: cells[positions.horaFim].slice(0, 5),
      cupons: parseDecimal(cells[positions.cupons]),
      vendaLiquida: parseDecimal(cells[positions.vendaLiquida]),
      modeloOrigem: 'hora'
    };
    if (!row.data || !/^\d{2}:\d{2}$/.test(row.horaInicio) || !/^\d{2}:\d{2}$/.test(row.horaFim) || Number.isNaN(row.cupons)) {
      errors.push(`Linha ${index + 2} inválida.`);
    } else {
      rows.push(row);
    }
  });
  return { rows, errors };
}

function parseEmployeesCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ['Arquivo sem colaboradores.'] };
  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const required = ['nome', 'sexo', 'cargo', 'setor', 'horas_semanais', 'salario'];
  const positions = Object.fromEntries(required.map((key) => [key, headers.indexOf(key)]));
  const missing = required.filter((key) => positions[key] < 0);
  if (missing.length) return { rows: [], errors: [`Colunas ausentes: ${missing.join(', ')}.`] };
  const rows = [];
  const errors = [];
  lines.slice(1).forEach((line, index) => {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row = {
      nome: cells[positions.nome],
      sexo: cells[positions.sexo],
      cargo: cells[positions.cargo],
      setor: cells[positions.setor],
      horasSemanais: Number(String(cells[positions.horas_semanais] || '').replace(',', '.')),
      salario: Number(String(cells[positions.salario] || '').replace(/\./g, '').replace(',', '.'))
    };
    if (!row.nome || !row.horasSemanais) errors.push(`Linha ${index + 2} inválida.`);
    else rows.push(row);
  });
  return { rows, errors };
}

async function renderCompanyInfo() {
  const el = document.getElementById('companyInfo');
  if (!el) return;
  try {
    const res = await fetch('/api/company/info');
    const info = await res.json();
    if (!info.ok) { el.innerHTML = '<p class="note">Faça login para ver a equipe.</p>'; return; }
    const roleLabel = info.role === 'admin' ? 'Administrador' : 'Membro';
    const isAdmin = info.role === 'admin';
    el.innerHTML = `
      <div class="company-code-box">
        <div class="company-code-main">
          <small>CÓDIGO DA EMPRESA</small>
          <div class="company-code-value">
            <strong id="orgCodeText">${info.orgCode || '—'}</strong>
            <button id="copyOrgCode" class="optimize-button" type="button">Copiar</button>
          </div>
          <span>Identificador da sua empresa nos relatórios.</span>
        </div>
        <div class="company-role-badge">${roleLabel}</div>
      </div>

      ${isAdmin ? `
      <div class="add-member-box">
        <small>ADICIONAR USUÁRIO SECUNDÁRIO</small>
        <p class="note">Crie acessos para sua equipe. Eles compartilharão os mesmos dados desta empresa.</p>
        <div class="add-member-form">
          <input id="newMemberName" placeholder="Nome do colaborador" autocomplete="off">
          <input id="newMemberEmail" type="email" placeholder="email@empresa.com" autocomplete="off">
          <input id="newMemberPassword" type="text" placeholder="Senha (mín. 8 caracteres)" autocomplete="off">
          <button id="addMemberBtn" class="optimize-button save-optimization" type="button">+ Criar usuário</button>
        </div>
        <small id="addMemberMsg" class="add-member-msg"></small>
      </div>` : ''}

      <div class="company-members">
        <small>MEMBROS DA EQUIPE (${info.members.length})</small>
        ${info.members.map(m => `
          <div class="company-member-row">
            <strong>${m.name}</strong>
            <span>${m.email}</span>
            <span class="member-role ${m.role === 'admin' ? 'admin' : ''}">${m.role === 'admin' ? 'Admin' : 'Membro'}</span>
          </div>
        `).join('')}
      </div>
    `;
    const copyBtn = document.getElementById('copyOrgCode');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(info.orgCode);
        copyBtn.textContent = 'Copiado ✓';
        setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 2000);
      };
    }
    const addBtn = document.getElementById('addMemberBtn');
    if (addBtn) {
      addBtn.onclick = async () => {
        const name = document.getElementById('newMemberName').value.trim();
        const email = document.getElementById('newMemberEmail').value.trim();
        const password = document.getElementById('newMemberPassword').value;
        const msg = document.getElementById('addMemberMsg');
        if (!name || !email || password.length < 8) {
          msg.textContent = 'Preencha nome, e-mail e senha (mín. 8 caracteres).';
          msg.className = 'add-member-msg error';
          return;
        }
        addBtn.disabled = true;
        addBtn.textContent = 'Criando...';
        try {
          const res = await fetch('/api/company/add-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
          });
          const result = await res.json();
          if (result.ok) {
            msg.textContent = `✓ Usuário ${email} criado! Senha: ${password} (anote e entregue ao colaborador).`;
            msg.className = 'add-member-msg success';
            document.getElementById('newMemberName').value = '';
            document.getElementById('newMemberEmail').value = '';
            document.getElementById('newMemberPassword').value = '';
            setTimeout(renderCompanyInfo, 1500);
          } else {
            msg.textContent = result.error || 'Erro ao criar usuário.';
            msg.className = 'add-member-msg error';
          }
        } catch (e) {
          msg.textContent = 'Erro de conexão.';
          msg.className = 'add-member-msg error';
        }
        addBtn.disabled = false;
        addBtn.textContent = '+ Criar usuário';
      };
    }
  } catch (error) {
    el.innerHTML = '<p class="note">Não foi possível carregar a equipe.</p>';
  }
}

let managedEmployees = [];

function renderEmployeesManager(data) {
  const el = document.getElementById('employeesManager');
  if (!el) return;
  // Inicializa com a lista atual (do servidor) na primeira renderização
  if (!managedEmployees.length && data.client && data.client.employeesList) {
    managedEmployees = data.client.employeesList.map(e => ({
      nome: e.nome || '',
      sexo: e.sexo || 'feminino',
      cargo: e.cargo || 'Operador de Caixa',
      setor: e.setor || 'Caixa',
      horasSemanais: e.horasSemanais || 44,
      salario: e.salario || 0,
      turno: e.turno || 'flexivel',
      podeDomingo: e.podeDomingo !== false,
      folgaPreferencial: e.folgaPreferencial || ''
    }));
  }

  const turnoOpts = [['flexivel','Flexível'],['abertura','Abertura'],['intermediario','Intermediário'],['fechamento','Fechamento']];
  const folgaOpts = [['','Sem preferência'],['segunda','Segunda'],['terca','Terça'],['quarta','Quarta'],['quinta','Quinta'],['domingo','Domingo']];

  el.innerHTML = `
    <div class="emp-table">
      <div class="emp-row emp-head">
        <span>Nome</span><span>Cargo</span><span>Horas</span><span>Salário</span>
        <span>Turno preferencial</span><span>Folga pref.</span><span>Domingo</span><span></span>
      </div>
      ${managedEmployees.map((e, i) => `
        <div class="emp-row">
          <input data-i="${i}" data-f="nome" value="${(e.nome||'').replace(/"/g,'&quot;')}" placeholder="Nome">
          <input data-i="${i}" data-f="cargo" value="${(e.cargo||'').replace(/"/g,'&quot;')}" placeholder="Cargo">
          <input data-i="${i}" data-f="horasSemanais" type="number" min="1" max="168" value="${e.horasSemanais||44}">
          <input data-i="${i}" data-f="salario" type="number" min="0" step="50" value="${e.salario||0}">
          <select data-i="${i}" data-f="turno">
            ${turnoOpts.map(([v,l]) => `<option value="${v}" ${e.turno===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <select data-i="${i}" data-f="folgaPreferencial">
            ${folgaOpts.map(([v,l]) => `<option value="${v}" ${e.folgaPreferencial===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <label class="emp-domingo"><input data-i="${i}" data-f="podeDomingo" type="checkbox" ${e.podeDomingo!==false?'checked':''}> Sim</label>
          <button class="emp-remove" data-i="${i}" type="button" title="Remover">✕</button>
        </div>
      `).join('')}
    </div>
    <div class="emp-actions">
      <button id="empAddBtn" class="secondary-button" type="button">+ Adicionar colaborador</button>
      <button id="empSaveBtn" class="optimize-button save-optimization" type="button">Salvar equipe (${managedEmployees.length})</button>
    </div>
    <small id="empMsg" class="emp-msg"></small>
  `;

  // Editar campos (inputs e selects)
  el.querySelectorAll('input[data-i], select[data-i]').forEach(inp => {
    inp.onchange = () => {
      const i = Number(inp.dataset.i);
      const f = inp.dataset.f;
      if (f === 'podeDomingo') {
        managedEmployees[i][f] = inp.checked;
      } else if (f === 'horasSemanais' || f === 'salario') {
        managedEmployees[i][f] = Number(inp.value);
      } else {
        managedEmployees[i][f] = inp.value;
      }
    };
  });
  // Remover
  el.querySelectorAll('.emp-remove').forEach(btn => {
    btn.onclick = () => {
      managedEmployees.splice(Number(btn.dataset.i), 1);
      renderEmployeesManager(data);
    };
  });
  // Adicionar
  document.getElementById('empAddBtn').onclick = () => {
    managedEmployees.push({ nome: '', sexo: 'feminino', cargo: 'Operador de Caixa', setor: 'Caixa', horasSemanais: 44, salario: 0, turno: 'flexivel', podeDomingo: true, folgaPreferencial: '' });
    renderEmployeesManager(data);
  };
  // Salvar
  document.getElementById('empSaveBtn').onclick = async () => {
    const msg = document.getElementById('empMsg');
    const valid = managedEmployees.filter(e => (e.nome || '').trim().length >= 2);
    if (!valid.length) { msg.textContent = 'Adicione ao menos um colaborador com nome.'; msg.className = 'emp-msg error'; return; }
    try {
      const res = await fetch('/api/employees/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: valid })
      });
      const result = await res.json();
      if (result.ok) {
        msg.textContent = `✓ ${result.total} colaboradores salvos. Atualizando escala...`;
        msg.className = 'emp-msg success';
        setTimeout(() => window.location.reload(), 1200);
      } else {
        msg.textContent = result.error || 'Erro ao salvar.';
        msg.className = 'emp-msg error';
      }
    } catch (e) {
      msg.textContent = 'Erro de conexão.';
      msg.className = 'emp-msg error';
    }
  };
}

function renderOnboarding(data) {
  renderCompanyInfo();
  renderEmployeesManager(data);
  const client = data.client || { profile: {}, onboarding: {} };
  const profile = client.profile || {};
  const onboarding = client.onboarding || {};
  const maturity = client.maturity || { score: 0, stage: 'Implantacao', blockers: [], strengths: [] };
  const importedTypes = onboarding.operationalDayTypesImported || 0;
  const requiredTypes = onboarding.operationalDayTypes || 6;
  const missingTypes = (onboarding.missingOperationalDayTypes || []).map((key) => dayTypeLabels[key] || key).join(', ');
  const initialReady = onboarding.profileComplete && onboarding.employeesImported && onboarding.salesImported;
  const operationalReady = importedTypes >= requiredTypes;
  const steps = [
    { done: onboarding.profileComplete, label: 'Loja configurada', detail: profile.loja || 'Informe os dados da operação' },
    { done: onboarding.employeesImported, label: 'Equipe importada', detail: onboarding.employeesImported ? `${onboarding.employees} colaboradores` : 'Importe as operadoras' },
    { done: onboarding.salesImported, label: 'Vendas importadas', detail: onboarding.salesImported ? `${onboarding.salesRows} faixas - ${onboarding.salesDays} dias` : 'Importe o CSV por hora' },
    { done: onboarding.salesDays >= 7, label: 'Semana minima', detail: onboarding.salesDays >= 7 ? 'Primeiro diagnostico liberado' : `${onboarding.salesDays || 0}/7 dias importados` },
    { done: onboarding.salesDays >= 56, label: 'Base recomendada', detail: onboarding.salesDays >= 56 ? 'Confianca ampliada' : `${onboarding.salesDays || 0}/56 dias recomendados` }
  ];
  const minimumWeekIndex = steps.findIndex((step) => step.label.includes('Semana'));
  if (minimumWeekIndex >= 0) {
    steps.splice(
      minimumWeekIndex,
      1,
      { done: initialReady, label: 'Diagnostico inicial', detail: initialReady ? 'Liberado com base parcial e confianca sinalizada' : 'Basta importar ao menos um movimento valido' },
      { done: operationalReady, label: 'Tipos de dia operacionais', detail: operationalReady ? `${importedTypes}/${requiredTypes} tipos cobertos` : `${importedTypes}/${requiredTypes} tipos - faltam: ${missingTypes || 'movimento'}` }
    );
  }
  const completed = steps.filter((step) => step.done).length;
  document.getElementById('onboardingBadge').textContent = initialReady ? 'Diagnostico inicial liberado' : 'Implantacao incompleta';
  document.getElementById('onboardingBadge').className = `soft-pill ${initialReady ? '' : 'amber-bg'}`;
  document.getElementById('onboardingProgress').innerHTML = `
    <div><strong>${completed}/${steps.length}</strong><span>etapas concluídas</span></div>
    <span><i style="width:${completed / steps.length * 100}%"></i></span>
    <p>${initialReady ? 'O cliente ja pode analisar um primeiro diagnostico. Dias fechados nao bloqueiam a leitura; dias abertos ausentes reduzem a confianca.' : 'Configure a loja, importe a equipe e ao menos um dia de venda para liberar a analise inicial.'}</p>
  `;
  document.getElementById('readinessChecklist').innerHTML = steps.map((step) => `
    <div class="${step.done ? 'ready' : 'pending'}"><b>${step.done ? 'OK' : 'Pendente'}</b><strong>${step.label}</strong><span>${step.detail}</span></div>
  `).join('');
  document.getElementById('pilotMaturity').innerHTML = `
    <div class="maturity-score">
      <strong>${maturity.score}</strong>
      <span><b>${maturity.stage}</b><i style="width:${maturity.score}%"></i></span>
    </div>
    <div class="maturity-lists">
      <div>
        <small>Forças atuais</small>
        ${(maturity.strengths.length ? maturity.strengths : ['Aguardando configuracao inicial']).map((item) => `<p>${item}</p>`).join('')}
      </div>
      <div>
        <small>Próximas exigências</small>
        ${(maturity.blockers.length ? maturity.blockers : ['Pronto para operação assistida']).map((item) => `<p>${item}</p>`).join('')}
      </div>
    </div>
  `;
  document.getElementById('setupCompany').value = profile.empresa || '';
  document.getElementById('setupStore').value = profile.loja || '';
  document.getElementById('setupTaxRegime').value = profile.regimeTributario || 'Lucro Real';
  document.getElementById('setupPdvs').value = profile.quantidadePdvs || data.storeConfig?.pdvs || 3;
  document.getElementById('setupOperators').value = profile.quantidadeOperadores || 4;
  document.getElementById('setupWeekdayHours').value = profile.horarioSegSex || '07:00-19:00';
  document.getElementById('setupSaturdayHours').value = profile.horarioSabado || '06:00-19:00';
  document.getElementById('setupSundayOperation').value = profile.domingoOperacao || (String(profile.horarioDomingo || '').toLowerCase() === 'fechado' ? 'fechado' : 'aberto');
  document.getElementById('setupClosedSundays').value = Number(profile.domingosFechadosMes || 0);
  document.getElementById('setupSundayHours').value = profile.horarioDomingo || '08:00-12:00';
}

function activityLabel(action) {
  const labels = {
    'Conta criada': 'Conta',
    'Login realizado': 'Acesso',
    'Logout realizado': 'Acesso',
    'Configuração da loja atualizada': 'Loja',
    'Vendas importadas': 'Vendas',
    'Equipe importada': 'Equipe'
  };
  return labels[action] || 'Atividade';
}

async function renderAccountActivity() {
  const response = await fetch('/api/account/activity');
  if (!response.ok) return;
  const result = await response.json();
  document.getElementById('accountSecuritySummary').innerHTML = `
    <div><small>Sessão</small><strong>Protegida</strong><span>Cookie HttpOnly · 12 horas</span></div>
    <div><small>Senha</small><strong>Hash forte</strong><span>Senha original nao é armazenada</span></div>
    <div><small>Backups da conta</small><strong>${result.backups}</strong><span>Até 20 versões recentes</span></div>
    <div><small>Persistencia principal</small><strong>${result.persistence.ready ? 'PostgreSQL pronto' : 'Local protegida'}</strong><span>${result.persistence.ready ? `${result.persistence.users} usuario(s) migrado(s)` : 'Migracao disponivel sem interromper o piloto'}</span></div>
  `;
  document.getElementById('accountActivity').innerHTML = result.activities.length ? result.activities.map((activity) => `
    <div><b>${activityLabel(activity.action)}</b><strong>${activity.action}</strong><span>${new Date(activity.at).toLocaleString('pt-BR')}</span></div>
  `).join('') : '<div class="activity-empty"><strong>Nenhuma atividade registrada</strong><span>As próximas ações aparecerão aqui.</span></div>';
}

function renderCapacityChart(scenarios, metadata) {
  const base = scenarios[0];
  const max = base.capacidade;
  const rows = [
    { label: 'Demanda de caixa', value: base.caixaNecessario, detail: `${metadata.diasComVenda} dias de venda`, tone: 'teal' },
    { label: 'Capacidade 6x1 44h', value: base.capacidade, detail: '1 semana contratual', tone: 'blue' },
    { label: 'Capacidade 5x2 42h', value: scenarios[1].capacidade, detail: '1 semana contratual', tone: 'amber' },
    { label: 'Capacidade 5x2 40h', value: scenarios[2].capacidade, detail: '1 semana contratual', tone: 'red' },
  ];
  document.getElementById('capacityChart').innerHTML = rows.map((row) => `
    <div class="chart-row">
      <div><strong>${row.label}</strong><small>${row.detail}</small></div>
      <span><i class="${row.tone}" style="width:${percent(row.value, max)}%"></i></span>
      <b>${row.value}h</b>
    </div>
  `).join('');
}

function renderLossBreakdown() {
  const items = [
    { label: 'Organização e reposição leve', value: 6, tone: 'teal' },
    { label: 'Apoio no fechamento', value: 4, tone: 'red' },
    { label: 'Atendimento e embalagem', value: 3, tone: 'blue' },
    { label: 'Compensações e cobertura', value: 3, tone: 'amber' },
  ];
  document.getElementById('lossBreakdown').innerHTML = `
    <div class="loss-total"><strong>16h</strong><span>semanais a redistribuir</span></div>
    ${items.map((item) => `
      <div class="loss-row"><span><i class="${item.tone}" style="width:${percent(item.value, 6)}%"></i></span><b>${item.value}h</b><small>${item.label}</small></div>
    `).join('')}
  `;
}

function calendarDayKey(day) {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][(day - 1) % 7];
}

function dayIntelligence(data, day) {
  const key = calendarDayKey(day);
  const cfg = data.dailyCoverage[key];
  if (cfg.closed) {
    return { key, cfg, rows: [], deficits: 0, surplus: 0, score: 100, health: 'good', known: true, closed: true };
  }
  const rows = cfg.rows.filter((row) => row.demanda !== null);
  const deficits = rows.filter((row) => row.atual < row.demanda).length;
  const surplus = rows.reduce((sum, row) => sum + Math.max(0, row.atual - row.demanda), 0);
  const known = rows.length > 0;
  const score = known ? Math.max(35, 100 - deficits * 28 - surplus * 2 - (cfg.confidence === 'baixa' ? 15 : 0)) : 38;
  const health = !known ? 'unknown' : deficits ? 'bad' : score < 80 ? 'warn' : 'good';
  return { key, cfg, rows, deficits, surplus, score, health, known };
}

function openDayDrawer(data, day) {
  const info = dayIntelligence(data, day);
  const event = data.calendarEvents.find((item) => Number(item.date.slice(-2)) === day);
  const sunday = data.sundayRotation.find((item) => Number(item.data.slice(-2)) === day);
  const suggestion = !info.known
    ? 'Importar vendas VRSoft deste dia antes de publicar a escala.'
    : info.closed
      ? 'Loja configurada como fechada. Nao exigir venda, escala de caixa ou compensacao dominical para este dia.'
    : info.deficits
      ? `Nao assumir o risco automaticamente. O maior deficit representa ${Math.max(...info.rows.map((row) => row.atual < row.demanda ? Math.round(((row.demanda - row.atual) / row.demanda) * 100) : 0))}% da necessidade. Primeiro mover intervalos; depois ajustar entrada e saida.`
      : info.surplus
        ? `Direcionar ${info.surplus} caixas-hora disponiveis para organizacao, embalagem e atendimento.`
        : 'Manter a formacao proposta e acompanhar o ponto realizado.';
  document.getElementById('dayDrawerContent').innerHTML = `
    <p class="eyebrow">Análise diária</p>
    <h2>${String(day).padStart(2, '0')}/06/2026 · ${info.cfg.label}</h2>
    <div class="drawer-score ${info.health}"><strong>${info.score}</strong><span>Qualidade da escala</span></div>
    <div class="drawer-stats">
      <div><small>Confianca</small><strong>${info.cfg.confidence}</strong></div>
      <div><small>Deficits</small><strong>${info.deficits}</strong></div>
      <div><small>Horas de apoio</small><strong>${info.surplus}</strong></div>
      <div><small>Conformidade</small><strong>Pré-validada</strong></div>
    </div>
    ${event ? `<div class="drawer-event"><small>${event.type}</small><strong>${event.label}</strong></div>` : ''}
    ${sunday ? `<div class="drawer-event"><small>Revezamento</small><strong>Trabalhando: ${sunday.trabalhando.join(', ')}</strong><span>Folga: ${sunday.folga.join(', ')}</span></div>` : ''}
    <div class="drawer-suggestion">
      <small>Sugestão do controlador</small>
      <p>${suggestion}</p>
      <div><button class="simulate-action">Simular</button><button class="apply-action">Aplicar sugestão</button></div>
    </div>
    <div class="drawer-flow"><span class="done">Rascunho</span><span class="done">Simulada</span><span>Publicada</span><span>Realizada</span><span>Auditada</span></div>
  `;
  document.getElementById('dayDrawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  document.getElementById('dayDrawer').setAttribute('aria-hidden', 'false');
  document.querySelector('.simulate-action').onclick = () => showToast(`Simulação do dia ${day}/06 concluída sem alterar a escala.`);
  document.querySelector('.apply-action').onclick = () => showToast(`Sugestão do dia ${day}/06 aplicada no rascunho.`);
}

function renderCalendar(data) {
  const rotation = data.sundayRotation;
  const sundays = new Map(rotation.map((day) => [Number(day.data.slice(-2)), day]));
  const events = new Map(data.calendarEvents.map((event) => [Number(event.date.slice(-2)), event]));
  const headers = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const cells = [];
  for (let day = 1; day <= 30; day += 1) {
    const sunday = sundays.get(day);
    const event = events.get(day);
    const info = dayIntelligence(data, day);
    cells.push(`
      <button class="calendar-day ${info.health} ${sunday ? 'sunday' : ''}" data-calendar-day="${day}">
        <div><strong>${day}</strong><b>${info.score}</b></div>
        <span>${info.closed ? 'Loja fechada' : info.known ? `${info.deficits} deficit - ${info.surplus}h apoio` : 'Sem vendas importadas'}</span>
        <small>${event ? event.label : info.closed ? 'Sem escala dominical' : sunday ? '2 trabalhando - 2 folgas' : info.cfg.label}</small>
      </button>
    `);
  }
  document.getElementById('monthCalendar').innerHTML = `
    ${headers.map((header) => `<b class="calendar-head">${header}</b>`).join('')}
    ${cells.join('')}
  `;
  document.querySelectorAll('[data-calendar-day]').forEach((button) => {
    button.onclick = () => openDayDrawer(data, Number(button.dataset.calendarDay));
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function openAuthDialog(mode = 'login') {
  document.getElementById('authDialog').classList.add('open');
  document.getElementById('authBackdrop').classList.add('open');
  document.getElementById('authDialog').setAttribute('aria-hidden', 'false');
  if (mode === 'register' && !document.getElementById('registerInvite').value) {
    document.getElementById('registerInvite').value = 'PILOTO-CX-2026';
  }
  document.querySelector(`[data-auth-mode="${mode}"]`).click();
}

function closeAuthDialog() {
  document.getElementById('authDialog').classList.remove('open');
  document.getElementById('authBackdrop').classList.remove('open');
  document.getElementById('authDialog').setAttribute('aria-hidden', 'true');
  document.getElementById('authError').textContent = '';
}

function openPasswordDialog() {
  document.getElementById('passwordDialog').classList.add('open');
  document.getElementById('authBackdrop').classList.add('open');
  document.getElementById('passwordDialog').setAttribute('aria-hidden', 'false');
}

function closePasswordDialog() {
  document.getElementById('passwordDialog').classList.remove('open');
  document.getElementById('authBackdrop').classList.remove('open');
  document.getElementById('passwordDialog').setAttribute('aria-hidden', 'true');
  document.getElementById('passwordError').textContent = '';
  document.getElementById('passwordChangeForm').reset();
}

function renderAuthState() {
  document.getElementById('openLogin').hidden = authState.authenticated;
  document.getElementById('openRegister').hidden = authState.authenticated;
  document.getElementById('accountMenu').hidden = !authState.authenticated;
  document.getElementById('accountName').textContent = authState.user?.name || '';
  const setup = document.querySelector('[data-tab="implantacao"]');
  setup.textContent = authState.authenticated ? '10 Implantacao' : '10 Area do cliente';
}

function applyClientAccess(data) {
  if (!authState.authenticated) return;
  const onboarding = data.client.onboarding || {};
  const ready = onboarding.profileComplete && onboarding.employeesImported && onboarding.salesImported;
  if (ready) return;
  document.querySelectorAll('.sidebar button').forEach((button) => {
    if (button.dataset.tab === 'implantacao') return;
    button.classList.add('locked');
    button.onclick = () => {
      showToast('Complete a implantação para liberar esta analise.');
      document.querySelector('[data-tab="implantacao"]').click();
    };
  });
  document.querySelector('[data-tab="implantacao"]').click();
}

function configureAuth() {
  document.getElementById('openLogin').onclick = () => openAuthDialog('login');
  document.getElementById('openRegister').onclick = () => openAuthDialog('register');
  document.getElementById('closeAuthDialog').onclick = closeAuthDialog;
  document.getElementById('authBackdrop').onclick = () => {
    closeAuthDialog();
    closePasswordDialog();
  };
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('[data-auth-mode]').forEach((item) => item.classList.toggle('active', item === button));
      document.getElementById('loginForm').hidden = button.dataset.authMode !== 'login';
      document.getElementById('registerForm').hidden = button.dataset.authMode !== 'register';
      document.getElementById('authError').textContent = '';
    };
  });
  document.getElementById('loginForm').onsubmit = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value }) });
    const result = await response.json();
    if (!response.ok) return document.getElementById('authError').textContent = result.error;
    window.location.reload();
  };
  document.getElementById('registerForm').onsubmit = async (event) => {
    event.preventDefault();
    const companyEl = document.getElementById('registerCompany');
    const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('registerName').value, email: document.getElementById('registerEmail').value, inviteCode: document.getElementById('registerInvite').value, companyCode: companyEl ? companyEl.value : '', password: document.getElementById('registerPassword').value }) });
    const result = await response.json();
    if (!response.ok) return document.getElementById('authError').textContent = result.error;
    // Se criou nova empresa, mostra o código gerado antes de entrar
    if (result.orgCode && result.role === 'admin') {
      alert('✅ Empresa criada!\n\nSeu CÓDIGO DA EMPRESA é:\n\n' + result.orgCode + '\n\nGuarde e compartilhe com sua equipe para que acessem os mesmos dados. Você também encontra esse código na aba Implantação.');
    }
    window.location.reload();
  };
  document.getElementById('logoutButton').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };
  document.getElementById('closePasswordDialog').onclick = closePasswordDialog;
}

configureAuth();

const MODULE_TAB_MAP = {
  1: 'diagnostico', 2: 'cenarios', 3: 'domingo', 4: 'auditoria', 5: 'acoes',
  6: 'financeiro', 7: 'resiliencia', 8: 'setores', 9: 'memoria', 10: 'implantacao'
};

function applyEnabledModules(data) {
  // Gestor vê tudo; clientes veem só os módulos liberados
  if (data.userRole === 'gestor') return;
  const enabled = Array.isArray(data.enabledModules) ? data.enabledModules : [1,2,3,4,5,6,7,8,9,10];
  Object.entries(MODULE_TAB_MAP).forEach(([id, tab]) => {
    const btn = document.querySelector(`.sidebar button[data-tab="${tab}"]`);
    if (!btn) return;
    if (enabled.includes(Number(id))) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  });
}

async function renderGestorPanel(data) {
  // Só renderiza para gestor
  const existing = document.getElementById('gestorTabBtn');
  if (data.userRole !== 'gestor') { if (existing) existing.remove(); return; }

  // Adicionar botão na sidebar se não existir
  if (!existing) {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.createElement('button');
    btn.id = 'gestorTabBtn';
    btn.dataset.tab = 'gestor';
    btn.innerHTML = '<span>★</span> Gestor';
    btn.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    btn.style.marginTop = '8px';
    sidebar.appendChild(btn);

    // Criar seção da aba gestor se não existir
    if (!document.getElementById('gestor')) {
      const main = document.querySelector('main');
      const section = document.createElement('section');
      section.id = 'gestor';
      section.className = 'tab';
      section.innerHTML = `
        <div class="section-head">
          <div><p class="eyebrow">Painel do Gestor do Produto</p>
          <h2>Controle de módulos por empresa</h2></div>
          <span class="soft-pill">Super-admin</span>
        </div>
        <div class="panel"><div id="gestorOrgs"></div></div>
      `;
      main.appendChild(section);
    }

    btn.onclick = () => {
      document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('gestor').classList.add('active');
      loadGestorOrgs();
    };
  }
}

async function loadGestorOrgs() {
  const el = document.getElementById('gestorOrgs');
  if (!el) return;
  el.innerHTML = '<p class="note">Carregando empresas...</p>';
  try {
    const res = await fetch('/api/gestor/orgs');
    const info = await res.json();
    if (!info.ok) { el.innerHTML = `<p class="note">${info.error}</p>`; return; }
    el.innerHTML = info.orgs.map(org => `
      <div class="gestor-org-card">
        <div class="gestor-org-head">
          <div>
            <strong>${org.empresa}${org.loja ? ' · ' + org.loja : ''}</strong>
            <span>${org.adminEmail} · ${org.orgCode || ''}</span>
          </div>
          <button class="optimize-button save-optimization gestor-save" data-org="${org.orgId}" type="button">Salvar módulos</button>
        </div>
        <div class="gestor-modules">
          ${info.modules.map(m => `
            <label class="gestor-module-toggle">
              <input type="checkbox" data-org="${org.orgId}" data-mod="${m.id}" ${org.enabledModules.includes(m.id) ? 'checked' : ''}>
              <span>${m.id}. ${m.nome}</span>
            </label>
          `).join('')}
        </div>
        <small class="gestor-msg" id="gestorMsg-${org.orgId}"></small>
      </div>
    `).join('');

    el.querySelectorAll('.gestor-save').forEach(btn => {
      btn.onclick = async () => {
        const orgId = btn.dataset.org;
        const mods = [...el.querySelectorAll(`input[data-org="${orgId}"]:checked`)].map(i => Number(i.dataset.mod));
        const msg = document.getElementById('gestorMsg-' + orgId);
        try {
          const r = await fetch('/api/gestor/set-modules', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, modules: mods })
          });
          const result = await r.json();
          if (result.ok) {
            msg.textContent = `✓ Salvo: ${result.enabledModules.length} módulos ativos.`;
            msg.className = 'gestor-msg success';
          } else {
            msg.textContent = result.error; msg.className = 'gestor-msg error';
          }
        } catch (e) { msg.textContent = 'Erro.'; msg.className = 'gestor-msg error'; }
      };
    });
  } catch (e) {
    el.innerHTML = '<p class="note">Erro ao carregar empresas.</p>';
  }
}

function safeRender(label, renderFn) {
  try {
    renderFn();
    return true;
  } catch (error) {
    console.error(`Erro ao renderizar ${label}:`, error);
    return false;
  }
}

Promise.all([fetch('/api/summary').then((response) => response.json()), fetch('/api/auth/status').then((response) => response.json())])
  .then(([data, authentication]) => {
    window.currentSummary = data;
    authState = authentication || { authenticated: false, user: null };
    const source = data.dataSource || { mode: 'demo' };
    const sourceStatus = document.getElementById('dataSourceStatus');
    sourceStatus.textContent = source.mode === 'postgresql' ? `PostgreSQL - ${source.database}` : 'Ambiente local seguro - base demonstrativa';
    sourceStatus.className = source.mode === 'postgresql' ? 'source-connected' : 'source-demo';
    safeRender('estado de login', renderAuthState);
    safeRender('modulos', () => applyEnabledModules(data));
    safeRender('gestor', () => renderGestorPanel(data));
    if (!authState.authenticated) {
      document.querySelector('[data-tab="implantacao"]').onclick = (event) => {
        event.stopPropagation();
        openAuthDialog('register');
      };
    }
    safeRender('acesso do cliente', () => applyClientAccess(data));
    safeRender('indicadores', () => renderKpis(data.scenarios, data.metadata));
    safeRender('prontidao enterprise', () => renderEnterpriseReadiness(data));
    safeRender('forca semanal', () => renderMonthlyWeekAnalysis(data));
    safeRender('benchmark', () => renderBenchmark(data));
    safeRender('setores', () => renderSectorEngine(data));
    safeRender('cenarios', () => renderScenarios(data.scenarios, data.metadata));
    safeRender('cobertura', () => renderCoverage(data));
    safeRender('semana colaboradora', () => renderWeeklySchedule(data));
    safeRender('domingos', () => renderSunday(data.sundayRotation));
    safeRender('auditoria', () => renderAudit(data.audit));
    safeRender('acoes', () => renderActions(data.controllerActions));
    safeRender('comissao', () => renderCommission(data.commissionReview));
    safeRender('premissas financeiras', () => {
      document.getElementById('taxRegimeInput').value = data.financial.assumptions.regimeTributario || 'Não informado';
      ['salaryInput', 'benefitsInput', 'burdenInput', 'revenueInput', 'marginInput'].forEach((id, index) => {
        const keys = ['salarioBaseMensal', 'beneficiosMensais', 'encargosPercentual', 'faturamentoSemanaReferencia', 'margemBrutaPercentual'];
        document.getElementById(id).value = data.financial.assumptions[keys[index]];
      });
    });
    safeRender('financeiro', () => renderFinance(data));
    safeRender('resiliencia', () => renderResilience(data));
    safeRender('memoria de decisao', () => renderDecisionMemory(data));

    // Configurar seletor de semana
    const weekSelector = document.getElementById('weekSelector');
    const weekInfo = document.getElementById('weekInfo');
    if (weekSelector) {
      weekSelector.addEventListener('change', async (event) => {
        const weekNumber = event.target.value;
        if (!weekNumber) {
          // Usar dados padrão
          window.currentSummary = data;
          safeRender('indicadores', () => renderKpis(data.scenarios, data.metadata));
          safeRender('cenarios', () => renderScenarios(data.scenarios, data.metadata));
          safeRender('cobertura', () => renderCoverage(data));
          weekInfo.textContent = 'Mostrando todos os dados importados';
        } else {
          try {
            const response = await fetch(`/api/summary/week/${weekNumber}`);
            const weekData = await response.json();
            window.currentSummary = weekData;
            safeRender('indicadores', () => renderKpis(weekData.scenarios, weekData.metadata));
            safeRender('cenarios', () => renderScenarios(weekData.scenarios, weekData.metadata));
            safeRender('cobertura', () => renderCoverage(weekData));
            const weekInfo = document.getElementById('weekInfo');
            if (weekInfo && weekData.metadata?.demandaMediaSemana) {
              weekInfo.textContent = `${weekData.metadata.semanaLabel} • Demanda: ${weekData.metadata.demandaMediaSemana}`;
            }
          } catch (error) {
            console.error('Erro ao carregar dados da semana:', error);
            weekInfo.textContent = 'Erro ao carregar dados da semana';
          }
        }
      });
    }

    if (authState.authenticated) {
      safeRender('implantacao', () => renderOnboarding(data));
      safeRender('atividade da conta', renderAccountActivity);
      document.getElementById('exportAccountData').onclick = () => {
        const link = document.createElement('a');
        link.href = '/api/account/export';
        link.click();
        showToast('Exportação da conta iniciada.');
        setTimeout(renderAccountActivity, 500);
      };
      document.getElementById('openPasswordChange').onclick = openPasswordDialog;
      document.getElementById('passwordChangeForm').onsubmit = async (event) => {
        event.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        if (newPassword !== document.getElementById('confirmNewPassword').value) {
          document.getElementById('passwordError').textContent = 'A confirmação nao corresponde à nova senha.';
          return;
        }
        const response = await fetch('/api/account/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
        const result = await response.json();
        if (!response.ok) return document.getElementById('passwordError').textContent = result.error;
        closePasswordDialog();
        showToast('Senha alterada. Outras sessões foram encerradas.');
        renderAccountActivity();
      };
    }
    safeRender('grafico capacidade', () => renderCapacityChart(data.scenarios, data.metadata));
    safeRender('perdas', renderLossBreakdown);
    safeRender('calendario', () => renderCalendar(data));

    safeRender('cabecalho diagnostico', () => {
      document.getElementById('conclusion').textContent = data.metadata.diasComVenda >= 7 ? 'A base atual indica cobertura de caixa suficiente nos cenarios simulados, mas ainda exige validacao de CCT, ponto e tarefas auxiliares.' : 'A amostra ainda e parcial. O sistema libera diagnostico inicial, mas recomenda importar os tipos de dia abertos antes de publicar escala.';
      document.getElementById('lastImport').textContent = data.metadata.ultimaImportacao;
      document.getElementById('samplePeriod').textContent = `${data.metadata.periodoAmostra} · ${data.metadata.diasComVenda} dias`;
      document.getElementById('confidenceValue').textContent = `${data.metadata.confianca}% - media`;
      document.getElementById('confidenceBar').style.width = `${data.metadata.confianca}%`;
    });

    document.querySelectorAll('.day-filter').forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll('.day-filter').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        currentCoverageDay = button.dataset.day;
        renderCoverage(data);
      };
    });

    document.querySelectorAll('.scenario-filter-button').forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll('.scenario-filter-button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        currentCoverageScenario = button.dataset.scenario;
        renderCoverage(data);
        renderWeeklySchedule(data);
      };
    });

    const optimizeButton = document.getElementById('optimizeCoverage');
    const saveOptimizationButton = document.getElementById('saveOptimization');
    if (optimizeButton) {
      optimizeButton.onclick = () => {
        coverageAdjustmentMode = !coverageAdjustmentMode;
        optimizeButton.classList.toggle('active', coverageAdjustmentMode);
        optimizeButton.textContent = coverageAdjustmentMode ? 'Voltar à escala original' : 'Otimização IA · Blue Yonder';
        if (saveOptimizationButton) saveOptimizationButton.hidden = !coverageAdjustmentMode;
        renderCoverage(data);
        showToast(coverageAdjustmentMode
          ? 'Otimização IA aplicada: déficits cobertos respeitando PDVs e equipe disponível.'
          : 'Escala original restaurada.');
      };
    }
    if (saveOptimizationButton) {
      saveOptimizationButton.onclick = async () => {
        if (!coverageAdjustmentMode) return;
        // Coletar dados otimizados de todos os dias
        const optimizedCoverage = {};
        Object.keys(data.dailyCoverage).forEach((dayKey) => {
          const cfg = data.dailyCoverage[dayKey];
          if (cfg.closed) return;
          const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(dayKey);
          const weeklyPeople = data.weeklyScenarioSchedule[currentCoverageScenario].people;
          const availableWorkers = Object.values(weeklyPeople).filter((shifts) => shifts[dayIndex] !== 'Folga').length;
          const baseRows = cfg.rows.map((row) => ({
            ...row,
            [currentCoverageScenario]: Math.min(Number(row[currentCoverageScenario]), availableWorkers)
          }));
          const adjustedRows = applyCoverageAdjustment(baseRows, currentCoverageScenario, availableWorkers);
          optimizedCoverage[dayKey] = adjustedRows.map((row) => ({
            hora: row.hora,
            atual: row[currentCoverageScenario],
            ajusteAutomatico: row.ajusteAutomatico
          }));
        });
        try {
          const response = await fetch('/api/save-optimization', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario: currentCoverageScenario, optimizedCoverage })
          });
          const result = await response.json();
          if (result.ok) {
            showToast('Otimização salva! Próximo acesso já carregará a escala otimizada.');
            saveOptimizationButton.disabled = true;
            saveOptimizationButton.textContent = 'Otimização salva ✓';
            setTimeout(() => {
              saveOptimizationButton.disabled = false;
              saveOptimizationButton.textContent = 'Salvar otimização';
            }, 3000);
          } else {
            showToast('Erro ao salvar: ' + (result.error || 'tente novamente'));
          }
        } catch (error) {
          showToast('Erro ao salvar otimização.');
        }
      };
    }

    document.getElementById('generateSchedule').onclick = () => {
      showToast('Proposta gerada. Revise as quatro ações pendentes no Controlador.');
      setTimeout(() => document.querySelector('[data-tab="acoes"]').click(), 900);
    };

    document.querySelectorAll('.action-filter').forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll('.action-filter').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderActions(data.controllerActions, button.dataset.priority);
      };
    });

    document.getElementById('recalculateFinance').onclick = () => {
      data.financial.assumptions.salarioBaseMensal = Number(document.getElementById('salaryInput').value);
      data.financial.assumptions.beneficiosMensais = Number(document.getElementById('benefitsInput').value);
      data.financial.assumptions.encargosPercentual = Number(document.getElementById('burdenInput').value);
      data.financial.assumptions.faturamentoSemanaReferencia = Number(document.getElementById('revenueInput').value);
      data.financial.assumptions.margemBrutaPercentual = Number(document.getElementById('marginInput').value);
      renderFinance(data);
      showToast('Impacto financeiro recalculado com as novas premissas.');
    };

    document.getElementById('storeSetupForm').onsubmit = async (event) => {
      event.preventDefault();
      const profile = {
        empresa: document.getElementById('setupCompany').value.trim(),
        loja: document.getElementById('setupStore').value.trim(),
        cnpj: '',
        regimeTributario: document.getElementById('setupTaxRegime').value,
        quantidadePdvs: Number(document.getElementById('setupPdvs').value),
        quantidadeOperadores: Number(document.getElementById('setupOperators').value),
        horarioSegSex: document.getElementById('setupWeekdayHours').value.trim(),
        horarioSabado: document.getElementById('setupSaturdayHours').value.trim(),
        domingoOperacao: document.getElementById('setupSundayOperation').value,
        domingosFechadosMes: Number(document.getElementById('setupClosedSundays').value || 0),
        horarioDomingo: document.getElementById('setupSundayOperation').value === 'fechado' ? 'fechado' : document.getElementById('setupSundayHours').value.trim()
      };
      const response = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }) });
      if (!response.ok) return showToast('Não foi possivel salvar a configuracao.');
      data.client.profile = profile;
      data.client.onboarding.profileComplete = true;
      renderOnboarding(data);
      showToast('Configuração da loja salva.');
    };

    document.getElementById('salesCsvInput').onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const parsed = parseSalesCsv(
        await file.text(),
        document.getElementById('salesImportDate').value,
        document.getElementById('salesImportDays').value
      );
      pendingSalesRows = parsed.rows;
      document.getElementById('confirmSalesImport').disabled = !parsed.rows.length;
      const avgItems = parsed.rows.length
        ? (parsed.rows.reduce((total, row) => total + Number(row.itensMedios || 0), 0) / parsed.rows.filter((row) => row.itensMedios).length || 0).toFixed(1)
        : '0';
      document.getElementById('importPreview').innerHTML = `
        <strong>${parsed.rows.length} linhas validas</strong>
        <span>${parsed.model === 'vrsoft_detalhado' ? 'VRSoft detalhado' : parsed.model === 'cupom_vrsoft' ? 'Cupom a cupom VRSoft' : 'Venda por hora'} · ${new Set(parsed.rows.map((row) => row.data)).size} dias · ${parsed.errors.length} rejeições</span>
        ${parsed.model === 'vrsoft_detalhado' ? `<small>${parsed.sourceCoupons} cupons de origem. O sistema usará minutos reais de atendimento, itens por cupom e valor por faixa horária.</small>` : ''}
        ${parsed.model === 'cupom_vrsoft' ? `<small>${parsed.sourceCoupons} cupons de origem. Média calculada sobre ${parsed.representedDays} dia(s). Itens/quantidade média por cupom: ${avgItems}.</small>` : ''}
        ${parsed.errors.length ? `<small>${parsed.errors.slice(0, 3).join(' ')}</small>` : '<small>Arquivo pronto para importacao.</small>'}
      `;
    };

    document.getElementById('employeesCsvInput').onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const parsed = parseEmployeesCsv(await file.text());
      pendingEmployees = parsed.rows;
      document.getElementById('confirmEmployeesImport').disabled = parsed.rows.length < 1;
      document.getElementById('employeesImportPreview').innerHTML = `
        <strong>${parsed.rows.length} colaboradores validos</strong>
        <span>${parsed.rows.filter((row) => normalizeHeader(row.setor) === 'caixa').length} identificados no setor Caixa · ${parsed.errors.length} rejeições</span>
        ${parsed.rows.length < 1 ? '<small>Importe ao menos uma operadora válida.</small>' : '<small>Arquivo pronto para importacao.</small>'}
      `;
    };

    document.getElementById('confirmEmployeesImport').onclick = async () => {
      const response = await fetch('/api/import-employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: pendingEmployees }) });
      const result = await response.json();
      if (!response.ok) return showToast(result.error || 'Não foi possivel importar a equipe.');
      showToast(`${result.imported} colaboradores importados. Atualizando escala.`);
      setTimeout(() => window.location.reload(), 900);
    };

    document.getElementById('confirmSalesImport').onclick = async () => {
      const response = await fetch('/api/import-sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: pendingSalesRows }) });
      const result = await response.json();
      if (!response.ok) return showToast(result.error || 'Não foi possivel importar o arquivo.');
      showToast(`${result.imported} linhas importadas. Atualizando diagnostico.`);
      setTimeout(() => window.location.reload(), 900);
    };

    document.getElementById('downloadCsvTemplate').onclick = () => {
      const csv = 'id;id_loja;data;numerocupom;matricula;horainicio;horatermino;qtd_itens;qtd_unidades;valor_cupom\n747336;1;2026-05-01;153678;200001;07:11:17;07:11:44;1;1.000;29.99\n747337;1;2026-05-01;153679;200001;07:13:25;07:14:13;1;1.000;18.99\n747338;1;2026-05-01;153680;200001;07:21:21;07:21:53;3;2.094;18.02\n';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'modelo-vendas-vrsoft-detalhado.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    };

    document.getElementById('downloadEmployeesTemplate').onclick = () => {
      const csv = 'nome;sexo;cargo;setor;horas_semanais;salario\nLucila;Feminino;Operadora de Caixa;Caixa;44;1650\nEdvania;Feminino;Operadora de Caixa;Caixa;44;1650\nSamara;Feminino;Operadora de Caixa;Caixa;44;1650\nJane;Feminino;Operadora de Caixa;Caixa;44;1650\n';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'modelo-equipe-caixa.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    };

    const closeDrawer = () => {
      document.getElementById('dayDrawer').classList.remove('open');
      document.getElementById('drawerBackdrop').classList.remove('open');
      document.getElementById('dayDrawer').setAttribute('aria-hidden', 'true');
    };
    document.getElementById('closeDayDrawer').onclick = closeDrawer;
    document.getElementById('drawerBackdrop').onclick = closeDrawer;
  })
  .catch((error) => {
    console.error(error);
    const sourceStatus = document.getElementById('dataSourceStatus');
    if (sourceStatus) {
      sourceStatus.textContent = 'Erro ao carregar dados - recarregue a pagina';
      sourceStatus.className = 'source-error';
    }
    showToast('Erro ao carregar dados do dashboard.');
  });
