const tabs = document.querySelectorAll('.sidebar button');
let authState = { authenticated: false, user: null };

// Toggle de tema claro/escuro (alinhado à Contagil). Persiste em localStorage.
(function initTheme() {
  const saved = localStorage.getItem('taotimo-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  function applyIcon() {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
  }
  function bind() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    applyIcon();
    btn.onclick = () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('taotimo-theme', next);
      applyIcon();
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

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
  if (!value || value === 'Folga') return 0;
  // Lê o sufixo de horas trabalhadas: "06-14 · 8h" ou "07-11/14-18 · 8h"
  const m = value.match(/·\s*(\d+)h(?:(\d+))?/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  // Formato antigo "8h:30"
  const old = value.match(/(\d+)h(?::(\d+))$/);
  if (old) return Number(old[1]) + Number(old[2] || 0) / 60;
  return 0;
}

function formatWorkedHours(value) {
  const totalMin = Math.round(Number(value || 0) * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
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

let opsPeriod = 'dia';

function renderOpsDashboard(data) {
  const el = document.getElementById('opsDashboard');
  if (!el) return;
  const ops = data.operationalDashboard;
  if (!ops) { el.innerHTML = '<div class="summary-empty"><strong>Importe vendas para ativar o painel</strong><span>Importe vendas VRSoft e/ou mercadológico na aba Implantação.</span></div>'; return; }

  const periodoLabel = { dia: 'por dia', semana: 'por semana', mes: 'por mês' }[opsPeriod];
  const fat = ops.faturamento[opsPeriod];
  const fc = ops.frenteCaixa;
  const hc = ops.headcount;
  const hcColor = hc.status === 'baixo' ? 'ops-bad' : hc.status === 'alto' ? 'ops-warn' : 'ops-ok';

  el.innerHTML = `
    <div class="ops-kpis">
      <article class="ops-kpi ops-primary">
        <small>Faturamento ${periodoLabel}</small>
        <strong>${money(fat)}</strong>
        <span>fonte: ${ops.fonteFat}</span>
      </article>
      <article class="ops-kpi ${hcColor}">
        <small>Dimensionamento da equipe</small>
        <strong>${hc.atual} <span class="ops-vs">/ ~${hc.ideal} ideal</span></strong>
        <span>${hc.status === 'baixo' ? '⚠️ Abaixo do ideal' : hc.status === 'alto' ? 'Acima do ideal' : '✓ Dentro do ideal'} (1 colab. / R$33-40k)</span>
      </article>
      <article class="ops-kpi">
        <small>Pico de fluxo (caixa)</small>
        <strong>${fc.clientesPicoHora}<span class="ops-vs">/h às ${fc.horaPico}</span></strong>
        <span>${fc.checkoutsPico} checkouts no pico · ${fc.operadoresCaixa} operadores</span>
      </article>
      <article class="ops-kpi">
        <small>Ticket médio</small>
        <strong>${money(fc.ticketMedio)}</strong>
        <span>${fc.clientesDia} clientes/dia · TMA ${fc.tmaMin}min</span>
      </article>
    </div>

    <div class="ops-grid">
      <article class="ops-card">
        <h4>👤 Frente de Caixa</h4>
        <div class="ops-row"><span>Clientes/hora (meta)</span><b>${fc.clientesPorHora}</b></div>
        <div class="ops-row"><span>Pico observado</span><b>${fc.clientesPicoHora}/h às ${fc.horaPico}</b></div>
        <div class="ops-row ${fc.checkoutsPico > fc.operadoresCaixa ? 'ops-row-bad' : ''}"><span>Checkouts no pico</span><b>${fc.checkoutsPico} (tem ${fc.operadoresCaixa})</b></div>
        <div class="ops-row"><span>Faturamento/checkout·hora</span><b>${money(fc.fatCheckoutHora)}</b></div>
      </article>
      <article class="ops-card">
        <h4>📦 Dimensionamento Global</h4>
        <div class="ops-row"><span>Faturamento/mês</span><b>${money(ops.faturamento.mes)}</b></div>
        <div class="ops-row"><span>Equipe ideal (faixa)</span><b>${hc.idealMin} a ${hc.idealMax}</b></div>
        <div class="ops-row"><span>Equipe atual</span><b>${hc.atual}</b></div>
        <div class="ops-row ${hcColor === 'ops-bad' ? 'ops-row-bad' : ''}"><span>Status</span><b>${hc.status === 'baixo' ? 'Subdimensionado' : hc.status === 'alto' ? 'Superdimensionado' : 'Equilibrado'}</b></div>
      </article>
      <article class="ops-card ops-alerts">
        <h4>🚨 Alertas inteligentes</h4>
        ${ops.alertas.map(a => `<div class="ops-alert ops-alert-${a.nivel}">${a.texto}</div>`).join('')}
      </article>
    </div>

    ${ops.perdas ? `
    <div class="ops-section-title">📉 Perdas e gargalos estimados (${periodoLabel === 'por dia' ? 'projeção mensal' : 'mês'})</div>
    <div class="ops-kpis">
      <article class="ops-kpi ops-loss">
        <small>Ruptura estimada de gôndola</small>
        <strong>${ops.perdas.rupturaEstimada}%</strong>
        <span>meta < ${ops.perdas.rupturaMeta}% · impacto ${money(ops.perdas.impactoRuptura)}/mês</span>
      </article>
      <article class="ops-kpi ops-loss">
        <small>Perda por validade/quebra</small>
        <strong>${money(ops.perdas.perdaValidade)}</strong>
        <span>~1,75% do faturamento/mês</span>
      </article>
      <article class="ops-kpi ops-loss">
        <small>Abandono por fila</small>
        <strong>${money(ops.perdas.abandonoFila)}</strong>
        <span>${ops.perdas.abandonoFila ? 'filas no pico > 8min' : 'sem fila crítica detectada'}</span>
      </article>
      <article class="ops-kpi ops-loss-total">
        <small>Perda total potencial</small>
        <strong>${money(ops.perdas.totalPerdas)}</strong>
        <span>oportunidade de recuperação/mês</span>
      </article>
    </div>` : ''}

    ${ops.multifuncionalidade && ops.multifuncionalidade.horasCriticas.length ? `
    <div class="ops-section-title">🔄 Multifuncionalidade planejada</div>
    <div class="ops-card ops-multi">
      <p class="note">Horários onde o caixa precisa de reforço (checkouts &gt; operadores). Treine repositores leves para cobrir.</p>
      <div class="ops-multi-hours">
        ${ops.multifuncionalidade.horasCriticas.map(h => `<span class="ops-hour-chip">${h.hora}: ${h.clientes} cli → ${h.checkouts} caixas</span>`).join('')}
      </div>
      <div class="ops-multi-sug">
        <b>Reforço sugerido:</b> +${ops.multifuncionalidade.reforcoNecessario} operador(es) no pico.
        ${ops.multifuncionalidade.repositoresLeves.length
          ? `Candidatos (repositores leves): ${ops.multifuncionalidade.repositoresLeves.slice(0,5).join(', ')}.`
          : 'Cadastre repositores de perfumaria/bazar/bebidas para sugerir candidatos.'}
      </div>
    </div>` : ''}

    ${ops.tendencia && ops.tendencia.length > 1 ? `
    <div class="ops-section-title">📈 Tendência de faturamento (${ops.tendencia.length} dias)</div>
    <div class="ops-card ops-trend">
      <div class="ops-trend-bars">
        ${(() => { const max = Math.max(...ops.tendencia.map(t => t.valor)); return ops.tendencia.map(t => {
          const h = max ? Math.max(4, Math.round(t.valor / max * 100)) : 4;
          const dia = t.data.slice(8, 10) + '/' + t.data.slice(5, 7);
          return `<div class="ops-trend-bar-wrap" title="${dia}: ${money(t.valor)}"><div class="ops-trend-bar" style="height:${h}%"></div></div>`;
        }).join(''); })()}
      </div>
      <div class="ops-trend-foot"><span>${ops.tendencia[0].data.slice(8,10)}/${ops.tendencia[0].data.slice(5,7)}</span><span>${ops.tendencia[ops.tendencia.length-1].data.slice(8,10)}/${ops.tendencia[ops.tendencia.length-1].data.slice(5,7)}</span></div>
    </div>` : ''}

    ${data.forecast ? `
    <div class="ops-section-title">🔮 Previsão dos próximos 7 dias (sazonalidade)</div>
    <div class="ops-grid">
      <article class="ops-card">
        <h4>Previsão por dia</h4>
        ${data.forecast.proximos.map(p => `<div class="ops-row"><span>${p.diaSemana} ${p.data.slice(8,10)}/${p.data.slice(5,7)}</span><b>${money(p.previsao)}</b></div>`).join('')}
      </article>
      <article class="ops-card">
        <h4>Índice de sazonalidade</h4>
        ${data.forecast.sazonalidade.filter(s=>s.valor>0).map(s => `<div class="ops-row"><span>${s.dia}</span><b>${s.indice}x ${s.indice>1.1?'🔥':s.indice<0.9?'🔻':''}</b></div>`).join('')}
        <div class="ops-row" style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px"><span>Pico</span><b>${data.forecast.picoDiaSemana.dia}</b></div>
      </article>
      <article class="ops-card">
        <h4>Eventos com impacto</h4>
        ${data.forecast.eventos.map(e => `<div class="ops-row"><span>${e.tipo} <small style="color:#64748b">(${e.regra})</small></span><b>+${Math.round((e.fator-1)*100)}%</b></div>`).join('')}
      </article>
    </div>` : ''}

    ${data.bancoHoras && data.bancoHoras.length ? `
    <div class="ops-section-title">⏱️ Banco de horas (escala vs contrato)</div>
    <div class="ops-card">
      <div class="banco-grid">
        ${data.bancoHoras.slice(0, 12).map(b => `
          <div class="banco-item ${b.saldo > 0 ? 'banco-pos' : 'banco-neg'}">
            <strong>${b.nome}</strong>
            <span>${b.trabalhadas}h / ${b.contrato}h</span>
            <b>${b.saldo > 0 ? '+' : ''}${b.saldo}h</b>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="ops-section-title">🎲 Simulador What-if</div>
    <div class="ops-card ops-whatif">
      <div class="whatif-controls">
        <label>Variação de equipe <input type="number" id="wfEquipe" value="0" step="1"> colaborador(es)</label>
        <label>Variação de faturamento <input type="number" id="wfFat" value="0" step="5">%</label>
        <label>Custo/colaborador <input type="number" id="wfCusto" value="2700" step="100">R$/mês</label>
        <button id="wfBtn" class="optimize-button save-optimization" type="button">Simular</button>
      </div>
      <div id="wfResult" class="whatif-result"></div>
    </div>
  `;

  // Handler What-if
  const wfBtn = document.getElementById('wfBtn');
  if (wfBtn) {
    wfBtn.onclick = async () => {
      const res = document.getElementById('wfResult');
      res.innerHTML = '<span class="note">Calculando...</span>';
      try {
        const r = await fetch('/api/whatif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          deltaEquipe: Number(document.getElementById('wfEquipe').value) || 0,
          deltaFatPct: Number(document.getElementById('wfFat').value) || 0,
          custoColaborador: Number(document.getElementById('wfCusto').value) || 2700
        }) });
        const d = await r.json();
        if (!d.ok) { res.innerHTML = `<span class="note">${d.error}</span>`; return; }
        const s = d.simulado, b = d.base;
        res.innerHTML = `
          <div class="wf-cards">
            <div class="wf-card"><small>Equipe</small><b>${b.equipe} → ${s.equipe}</b><span>ideal: ${s.ideal}</span></div>
            <div class="wf-card"><small>Cobertura</small><b class="${s.cobertura<85?'wf-bad':s.cobertura>115?'wf-warn':'wf-ok'}">${s.cobertura}%</b><span>do dimensionamento</span></div>
            <div class="wf-card"><small>Custo folha</small><b>${money(s.custoFolha)}</b><span>${s.deltaCusto>=0?'+':''}${money(s.deltaCusto)}</span></div>
            <div class="wf-card"><small>Ruptura estimada</small><b class="${s.rupturaEstimada>7?'wf-bad':'wf-ok'}">${s.rupturaEstimada}%</b><span>perda ${money(s.perdaRuptura)}/mês</span></div>
          </div>
          <div class="wf-verdict">${s.cobertura >= 85 && s.cobertura <= 115
            ? '✅ Dimensionamento equilibrado neste cenário.'
            : s.cobertura < 85
              ? `⚠️ Subdimensionado: faltam ~${s.ideal - s.equipe} colaboradores. Perda de ruptura sobe para ${money(s.perdaRuptura)}/mês.`
              : `🔵 Superdimensionado: ${s.equipe - s.ideal} acima do ideal. Avaliar produtividade ou realocação.`}</div>
        `;
      } catch (e) { res.innerHTML = '<span class="note">Erro ao simular.</span>'; }
    };
  }

  // Seletor de período
  document.querySelectorAll('#opsPeriodSwitch .ops-period-btn').forEach(btn => {
    btn.onclick = () => {
      opsPeriod = btn.dataset.period;
      document.querySelectorAll('#opsPeriodSwitch .ops-period-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderOpsDashboard(data);
    };
  });
}

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
  const rows = data.taOtimoBenchmark || [];
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
      value: (authenticated && source.mode !== 'demo') ? 'Supabase ativo' : 'Base demonstrativa',
      detail: (authenticated && source.mode !== 'demo') ? 'Dados reais da empresa persistidos' : 'Faça login para usar os dados da sua loja',
      tone: (authenticated && source.mode !== 'demo') ? 'ready' : 'watch'
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

function renderSetorDashboard(data) {
  const el = document.getElementById('setorDashboard');
  if (!el) return;
  const dash = data.setorDashboard || [];
  if (!dash.length) {
    el.innerHTML = '<div class="summary-empty"><strong>Importe vendas por mercadológico</strong><span>Na aba Implantação (painel 4), suba o arquivo de vendas por departamento para liberar os KPIs inteligentes de cada setor.</span></div>';
    return;
  }
  const statusColor = { sobrecarga: 'st-high', folga: 'st-low', equilibrado: 'st-ok', 'sem-equipe': 'st-none' };
  const totalVendaDia = dash.reduce((s, d) => s + d.vendaDia, 0);

  el.innerHTML = `
    <div class="icos-summary">
      <div><small>Setores analisados</small><strong>${dash.length}</strong></div>
      <div><small>Venda/dia (setores)</small><strong>${money(totalVendaDia)}</strong></div>
      <div><small>Colaboradores</small><strong>${dash.reduce((s, d) => s + d.colaboradores, 0)}</strong></div>
    </div>
    <div class="icos-grid">
      ${dash.map(d => `
        <article class="icos-card ${statusColor[d.status] || ''}">
          <div class="icos-card-head">
            <strong>${d.setor}</strong>
            <span class="icos-status">${d.statusLabel}</span>
          </div>
          <div class="icos-bigval">${money(d.vendaDia)}<small>/dia</small></div>
          <div class="icos-metrics">
            <div><small>Participação</small><b>${d.participacao}%</b></div>
            <div><small>Colaboradores</small><b>${d.colaboradores || '—'}</b></div>
            <div><small>Itens/dia</small><b>${d.itensDia.toLocaleString('pt-BR')}</b></div>
            <div><small>Venda/colab.</small><b>${d.colaboradores ? money(d.vendaPorColab) : '—'}</b></div>
            <div><small>Itens/colab.</small><b>${d.colaboradores ? d.itensPorColab.toLocaleString('pt-BR') : '—'}</b></div>
            <div><small>Pico semanal</small><b>${d.picoDia || '—'}</b></div>
          </div>
          ${d.curvaDiaSemana && d.curvaDiaSemana.some(v => v > 0) ? `
          <div class="icos-curva">
            <small>Carga por dia da semana</small>
            <div class="icos-bars">
              ${['D','S','T','Q','Q','S','S'].map((lbl, i) => {
                const max = Math.max(...d.curvaDiaSemana);
                const h = max ? Math.max(6, Math.round(d.curvaDiaSemana[i] / max * 100)) : 6;
                const isPico = d.curvaDiaSemana[i] === max && max > 0;
                return `<div class="icos-bar-wrap" title="${lbl}: ${money(d.curvaDiaSemana[i])}"><div class="icos-bar ${isPico?'pico':''}" style="height:${h}%"></div><span>${lbl}</span></div>`;
              }).join('')}
            </div>
          </div>` : ''}
          ${d.matriz ? `<div class="icos-matriz"><span title="Produtividade física de reposição">📦 ${d.matriz.caixasHora} cx/h</span><span title="Margem bruta de referência">💰 ${d.matriz.margem}</span></div><div class="icos-foco">${d.matriz.foco}</div>` : ''}
          ${d.nomes && d.nomes.length ? `<div class="icos-team">${d.nomes.slice(0, 6).map(n => `<span>${n}</span>`).join('')}${d.nomes.length > 6 ? `<span>+${d.nomes.length - 6}</span>` : ''}</div>` : '<div class="icos-team empty">Sem equipe cadastrada neste setor</div>'}
        </article>
      `).join('')}
    </div>
    <div class="icos-legend">
      <span class="st-high">● Alta carga</span>
      <span class="st-ok">● Equilibrado</span>
      <span class="st-low">● Capacidade ociosa</span>
      <span class="st-none">● Sem equipe</span>
    </div>
  `;
}

function renderSectorEngine(data) {
  renderSetorDashboard(data);
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
  const selectedScenario = getSelectedCashierScenario(data);
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
  const weeklyPeople = selectedScenario.people;
  const availableWorkers = Object.values(weeklyPeople).filter((shifts) => shifts[dayIndex] !== 'Folga').length;
  const pdvs = window.currentSummary?.storeConfig?.pdvs || 99;
  const baseRows = cfg.rows.map((row) => {
    const workers = countWorkersAtHourLabel(weeklyPeople, dayIndex, row.hora);
    const demanda = Math.max(Number(row.demanda || 0), 1);
    return {
      ...row,
      [currentCoverageScenario]: Math.min(workers, availableWorkers, pdvs, demanda)
    };
  });
  const effectiveRows = applyCoverageAdjustment(baseRows, currentCoverageScenario, availableWorkers);
  const evaluated = effectiveRows.map((row) => ({ row, status: coverageStatus(row, currentCoverageScenario) }));
  const known = evaluated.filter((item) => item.row.demanda !== null);
  const deficits = known.filter((item) => item.status.balance < 0).length;
  const maximumDeficit = known.reduce((maximum, item) => Math.max(maximum, item.status.deficitPercent || 0), 0);
  const covered = known.filter((item) => item.status.balance === 0).length;
  const surplus = known.reduce((total, item) => total + Math.max(0, item.status.balance), 0);
  const adjustedHours = known.filter((item) => item.row.ajusteAutomatico).length;
  const pdvBottlenecks = known.filter((item) => queueFromLoad(item.row.cargaCaixa, item.row[currentCoverageScenario]).bottleneck).length;

  document.getElementById('coverageNote').textContent = `${cfg.source} · confianca ${cfg.confidence}.${selectedScenario.optimized ? ' Escala individual sincronizada com a otimizacao de cobertura.' : ''}${coverageAdjustmentMode ? ' Recalculo ativo: cobre criticos ate o limite de PDVs e equipe.' : ''}`;
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
  const scenario = getSelectedCashierScenario(data);
  const lojaClose = parseLojaHora((data.client?.profile?.horarioSegSex)).close;
  const staff = Object.entries(scenario.people).map(([nome, shifts]) => {
    const shift = shifts[dayIndex];
    if (!shift || shift === 'Folga') return { nome, status: 'Folga', perfil: 'Folga semanal', inicio: null, fim: null, intervalo: null, horas: 0 };
    const b = shiftBounds(shift);
    const plan = getShiftIntervalPlan(shift);
    const perfil = b && b.end >= lojaClose ? 'Fechamento' : b && b.start <= 7 ? 'Abertura' : 'Intermediario';
    return {
      nome, status: 'Trabalhando', perfil,
      inicio: plan?.start || shift.split('·')[0].trim().split('-')[0],
      fim: plan?.end || shift.split('·')[0].trim().split('-').slice(-1)[0],
      intervalo: plan?.intervalLabel || 'Sem intervalo',
      horas: plan?.horas || ''
    };
  });
  const weeklyHours = Object.fromEntries(Object.keys(scenario.people).map((nome) => [nome, scenario.targetHours]));
  const working = staff.filter((person) => person.status === 'Trabalhando');
  const off = staff.filter((person) => person.status === 'Folga');
  document.getElementById('staffScheduleNote').textContent = currentCoverageScenario === 'atual'
    ? `${data.dailyCoverage[currentCoverageDay].label} - formacao-base atual 6x1 44h${scenario.optimized ? ' · com intervalos realocados pela otimizacao' : ''}.`
    : `${data.dailyCoverage[currentCoverageDay].label} · formacao individual ${scenario.label}${scenario.optimized ? ' · sincronizada com a otimizacao' : ''}; intervalos aplicados pela regra CLT e ajuste operacional.`;
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

let weeklyScheduleSetorFilter = '';
let weeklyScheduleCargoFilter = '';

// Extrai início e fim de um turno ("06:00-13:20·7h20" ou "06:00-10:00/14:00-18:00·8h")
function hhToNum(s) { const p = String(s).split(':'); const h = Number(p[0]); return isNaN(h) ? NaN : h + (Number(p[1] || 0) / 60); }
function hmToMinutes(str) {
  const m = String(str || '').match(/(\d{1,2})(?::(\d{2}))?/);
  return m ? (Number(m[1]) * 60) + Number(m[2] || 0) : null;
}
function minutesToHM(total) {
  const safe = Math.max(0, Math.round(total));
  const hh = Math.floor(safe / 60) % 24;
  const mm = safe % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function getLegalIntervalMinutes(workedHours) {
  if (workedHours > 6) return 60;
  if (workedHours > 4) return 15;
  return 0;
}
function getShiftIntervalPlan(shift) {
  if (!shift || shift === 'Folga') return null;
  const [periodoRaw, horasRaw = ''] = String(shift).split('·').map((part) => part.trim());
  const horas = horasRaw || '';
  // Normaliza qualquer hora para HH:MM (turnos antigos vinham como "07-15")
  const hm = (v) => { const m = hmToMinutes(v); return m === null ? v : minutesToHM(m); };
  if (periodoRaw.includes('/')) {
    const [bloco1, bloco2] = periodoRaw.split('/');
    const [i1, f1] = bloco1.split('-').map(hm);
    const [i2, f2] = bloco2.split('-').map(hm);
    return {
      display: `${i1}-${f1}/${i2}-${f2}`,
      start: i1,
      end: f2,
      intervalLabel: `${f1}-${i2}`,
      hasInterval: true,
      horas
    };
  }

  const worked = parseHours(shift);
  const [ini, fimOriginal] = periodoRaw.split('-');
  const startMin = hmToMinutes(ini);
  const endMin = hmToMinutes(fimOriginal);
  if (startMin === null || endMin === null) {
    return { display: periodoRaw, start: ini, end: fimOriginal, intervalLabel: 'Sem intervalo', hasInterval: false, horas };
  }

  const iniLabel = minutesToHM(startMin);
  const fimLabel = minutesToHM(endMin);
  const legalIntervalMin = getLegalIntervalMinutes(worked);
  if (!legalIntervalMin) {
    return { display: `${iniLabel}-${fimLabel}`, start: iniLabel, end: fimLabel, intervalLabel: 'Sem intervalo', hasInterval: false, horas };
  }

  const workedMin = Math.round(worked * 60);
  const rawSpanMin = endMin - startMin;
  const explicitIntervalMin = Math.max(0, rawSpanMin - workedMin);
  const intervaloMin = explicitIntervalMin >= legalIntervalMin ? explicitIntervalMin : legalIntervalMin;
  const endReal = explicitIntervalMin >= legalIntervalMin ? endMin : endMin + intervaloMin;
  const beforeBase = Math.round((workedMin / 2) / 5) * 5;
  const minAntes = worked > 6 ? 180 : 120;
  const maxAntes = worked > 6 ? 340 : workedMin; // 5h40 (6h CLT art.71 - 20min buffer)
  const minDepois = 120;
  const beforeMin = Math.min(maxAntes, Math.max(minAntes, Math.min(beforeBase, workedMin - minDepois)));
  const intervalStart = startMin + beforeMin;
  const intervalEnd = intervalStart + intervaloMin;
  return {
    display: `${iniLabel}-${minutesToHM(intervalStart)}/${minutesToHM(intervalEnd)}-${minutesToHM(endReal)}`,
    start: iniLabel,
    end: minutesToHM(endReal),
    intervalLabel: `${minutesToHM(intervalStart)}-${minutesToHM(intervalEnd)}`,
    hasInterval: true,
    horas
  };
}

function getSelectedCashierScenario(data) {
  const fechada = data.escalaFechada;
  const usarFechada = Boolean(fechada) && window._verRascunho !== true;
  const scenarioBase = usarFechada
    ? {
        usarFechada: true,
        people: fechada.caixaPeople || fechada.people || {},
        label: fechada.cenarioLabel,
        fullLabel: `${fechada.cenarioLabel} · ${fechada.label}`,
        targetHours: (data.weeklyScenarioSchedule?.[currentCoverageScenario]?.targetHours) || 44,
        targetDaysOff: (data.weeklyScenarioSchedule?.[currentCoverageScenario]?.targetDaysOff) || 1
      }
    : (() => {
        const full = data.fullSchedule && data.fullSchedule[currentCoverageScenario];
        const scenario = full || data.weeklyScenarioSchedule[currentCoverageScenario];
        return {
          usarFechada: false,
          people: scenario?.people || {},
          label: scenario?.label || '',
          fullLabel: scenario?.label || '',
          targetHours: scenario?.targetHours || 44,
          targetDaysOff: scenario?.targetDaysOff || 1
        };
      })();

  if (scenarioHasOptimization(data, currentCoverageScenario)) {
    const targets = buildCoverageTargets(data, currentCoverageScenario, scenarioBase.people);
    return {
      ...scenarioBase,
      people: optimizePeopleAgainstCoverage(scenarioBase.people, targets),
      optimized: true
    };
  }
  return scenarioBase;
}

function shiftBlocksFromDisplay(shift) {
  const plan = getShiftIntervalPlan(shift);
  if (!plan) return [];
  return plan.display
    .split('/')
    .map((block) => {
      const [ini, fim] = block.split('-');
      const start = hmToMinutes(ini);
      const end = hmToMinutes(fim);
      return start === null || end === null ? null : { start, end };
    })
    .filter(Boolean);
}

function countWorkersAtHourLabel(people, dayIndex, hourLabel) {
  const [startStr, endStr] = String(hourLabel).split('-');
  const faixaStart = Number(startStr) * 60;
  const faixaEnd = Number(endStr) * 60;
  let count = 0;
  Object.values(people || {}).forEach((shifts) => {
    const shift = shifts?.[dayIndex];
    if (!shift || shift === 'Folga') return;
    const blocks = shiftBlocksFromDisplay(shift);
    if (blocks.some((block) => block.start < faixaEnd && block.end > faixaStart)) {
      count++;
    }
  });
  return count;
}

function rowAdjustmentFlag(row, scenario) {
  return Boolean(row?.[`${scenario}AjusteAutomatico`] ?? row?.ajusteAutomatico);
}

function scenarioHasOptimization(data, scenario) {
  if (coverageAdjustmentMode) return true;
  return Object.values(data.dailyCoverage || {}).some((day) =>
    (day.rows || []).some((row) => rowAdjustmentFlag(row, scenario))
  );
}

function shiftHourLabelToMinutes(label) {
  const [ini, fim] = String(label || '').split('-');
  const start = hmToMinutes(ini);
  const end = hmToMinutes(fim);
  return start === null || end === null ? null : { start, end };
}

function buildCoverageTargets(data, scenario, people) {
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const targets = {};
  dayKeys.forEach((dayKey, dayIndex) => {
    const cfg = data.dailyCoverage?.[dayKey];
    if (!cfg || cfg.closed) return;
    const availableWorkers = Object.values(people || {}).filter((shifts) => shifts[dayIndex] !== 'Folga').length;
    const baseRows = (cfg.rows || []).map((row) => ({
      ...row,
      [scenario]: Math.min(countWorkersAtHourLabel(people, dayIndex, row.hora), availableWorkers)
    }));
    const effectiveRows = coverageAdjustmentMode ? applyCoverageAdjustment(baseRows, scenario, availableWorkers) : baseRows;
    targets[dayKey] = Object.fromEntries(effectiveRows.map((row) => [row.hora, Number(row[scenario] || 0)]));
  });
  return targets;
}

function shiftBreakMetadata(shift) {
  if (!shift || shift === 'Folga') return null;
  const workedHours = parseHours(shift);
  const intervalMin = getLegalIntervalMinutes(workedHours);
  if (intervalMin !== 60) return null;
  const plan = getShiftIntervalPlan(shift);
  if (!plan || !plan.hasInterval) return null;
  const intervalRange = shiftHourLabelToMinutes(plan.intervalLabel);
  const start = hmToMinutes(plan.start);
  const end = hmToMinutes(plan.end);
  if (!intervalRange || start === null || end === null) return null;
  if ((intervalRange.end - intervalRange.start) !== 60) return null;
  const earliest = Math.max(start + 180, Math.ceil(start / 60) * 60);
  const latest = Math.min(end - 180, Math.floor((end - 60) / 60) * 60);
  return {
    start,
    end,
    workedHours,
    breakStart: intervalRange.start,
    breakEnd: intervalRange.end,
    earliestBreakStart: earliest,
    latestBreakStart: latest
  };
}

function buildShiftWithBreak(meta, breakStart) {
  return `${minutesToHM(meta.start)}-${minutesToHM(breakStart)}/${minutesToHM(breakStart + 60)}-${minutesToHM(meta.end)} · ${formatWorkedHours(meta.workedHours)}`;
}

function optimizePeopleAgainstCoverage(people, targetsByDay) {
  const preview = JSON.parse(JSON.stringify(people || {}));
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  dayKeys.forEach((dayKey, dayIndex) => {
    const targets = targetsByDay[dayKey];
    if (!targets) return;

    const workers = Object.entries(preview)
      .map(([nome, shifts]) => {
        const shift = shifts[dayIndex];
        const meta = shiftBreakMetadata(shift);
        return meta ? { nome, shifts, meta } : null;
      })
      .filter(Boolean);
    if (!workers.length) return;

    const currentCounts = {};
    Object.keys(targets).forEach((hora) => {
      currentCounts[hora] = countWorkersAtHourLabel(preview, dayIndex, hora);
    });

    const breakHourOf = (worker) => `${String(Math.floor(worker.meta.breakStart / 60)).padStart(2, '0')}-${String(Math.floor(worker.meta.breakStart / 60) + 1).padStart(2, '0')}`;
    const feasibleHours = (worker) => {
      const hours = [];
      for (let start = worker.meta.earliestBreakStart; start <= worker.meta.latestBreakStart; start += 60) {
        hours.push(`${String(Math.floor(start / 60)).padStart(2, '0')}-${String(Math.floor(start / 60) + 1).padStart(2, '0')}`);
      }
      return hours;
    };

    Object.keys(targets).forEach((hourLabel) => {
      while ((currentCounts[hourLabel] || 0) < (targets[hourLabel] || 0)) {
        const candidates = workers.filter((worker) => breakHourOf(worker) === hourLabel);
        if (!candidates.length) break;

        let moved = false;
        for (const worker of candidates) {
          const options = feasibleHours(worker)
            .filter((candidateHour) => candidateHour !== hourLabel)
            .map((candidateHour) => {
              const candidateTarget = targets[candidateHour] ?? 0;
              const candidateCurrent = currentCounts[candidateHour] ?? 0;
              return {
                candidateHour,
                surplus: candidateCurrent - candidateTarget
              };
            })
            .filter((candidate) => candidate.surplus > 0)
            .sort((a, b) => b.surplus - a.surplus);

          if (!options.length) continue;
          const chosen = options[0].candidateHour;
          const chosenStart = Number(chosen.split('-')[0]) * 60;
          currentCounts[hourLabel] = (currentCounts[hourLabel] || 0) + 1;
          currentCounts[chosen] = (currentCounts[chosen] || 0) - 1;
          worker.meta.breakStart = chosenStart;
          worker.meta.breakEnd = chosenStart + 60;
          worker.shifts[dayIndex] = buildShiftWithBreak(worker.meta, chosenStart);
          moved = true;
          break;
        }

        if (!moved) break;
      }
    });
  });

  return preview;
}
function shiftBounds(shift) {
  if (!shift || shift === 'Folga') return null;
  const blocks = shift.split('·')[0].trim().split('/');
  const first = blocks[0].split('-');
  const last = blocks[blocks.length - 1].split('-');
  const start = hhToNum(first[0]);
  const end = hhToNum(last[1]);
  return (isNaN(start) || isNaN(end)) ? null : { start, end };
}
function renderShiftWithInterval(shift, badge = '') {
  if (!shift || shift === 'Folga') return shift;
  const plan = getShiftIntervalPlan(shift);
  if (!plan) return shift;

  return `
    <span class="shift-main">${plan.display}${badge}</span>
    <small class="shift-meta">${plan.hasInterval ? `int. ${plan.intervalLabel}` : 'Sem intervalo'}${plan.horas ? ` · ${plan.horas}` : ''}</small>
  `;
}
function parseLojaHora(str) {
  const m = String(str || '').match(/(\d{1,2}):?\d{0,2}\s*-\s*(\d{1,2}):?\d{0,2}/);
  return m ? { open: Number(m[1]), close: Number(m[2]) } : { open: 7, close: 19 };
}

// ===== PLANTA ISOMÉTRICA DA LOJA =====
let _floorDay = null, _floorHour = 8, _floorPlaying = false, _floorTimer = null;
function renderStoreFloorMap(data) {
  const el = document.getElementById('storeFloorMap');
  if (!el) return;
  const profile = (data.client && data.client.profile) || {};
  const source = getSelectedCashierScenario(data);
  const setorMap = data.employeeSetorMap || {};
  const cargoMap = data.employeeCargoMap || {};
  const people = Object.entries(source.people).map(([n, s]) => ({ nome: n, shifts: s }));
  if (!people.length) { el.innerHTML = ''; return; }

  const pdvs = Number(profile.quantidadePdvs || data.storeConfig?.pdvs || 4);
  const lojaSegSex = parseLojaHora(profile.horarioSegSex);
  const lojaSab = parseLojaHora(profile.horarioSabado);
  const lojaDom = parseLojaHora(profile.horarioDomingo);
  const lojaPorDia = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSab, lojaDom];

  const now = new Date();
  if (_floorDay === null) _floorDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const loja = lojaPorDia[_floorDay];
  if (_floorHour < loja.open || _floorHour >= loja.close) _floorHour = loja.open;

  const DAYS = ['Seg','Ter','Qua','Qui','Sex','Sab','Dom'];
  const ZC = {checkout:'#2563eb',gondola:'#16a34a',acougue:'#dc2626',padaria:'#ea580c',hortifruti:'#65a30d',frios:'#0891b2',comercial:'#9333ea',recebimento:'#78350f',escritorio:'#6366f1',outro:'#6b7280'};
  const ZL = {checkout:'Frente de loja',gondola:'Mercearia',acougue:'Acougue',padaria:'Padaria',hortifruti:'Hortifruti',frios:'Frios',comercial:'Comercial',recebimento:'Recebimento',escritorio:'Administrativo',outro:'Outros'};

  function zoneOf(nome) {
    const s = ((setorMap[nome]||'')+(cargoMap[nome]||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if (s.includes('acougue')||s.includes('carnes')) return 'acougue';
    if (s.includes('padaria')||s.includes('confeitaria')) return 'padaria';
    if (s.includes('hortifruti')||s.includes('frutas')) return 'hortifruti';
    if (s.includes('frios')||s.includes('laticinio')) return 'frios';
    if (s.includes('recebimento')||s.includes('estoque')||s.includes('deposito')||s.includes('doca')||s.includes('descarga')) return 'recebimento';
    if (s.includes('administrativo')||s.includes('admin')||s.includes('escritorio')||s.includes('rh')||s.includes('financeiro')||s.includes('contabil')||s.includes('dp')||s.includes('departamento pessoal')) return 'escritorio';
    if (s.includes('mercearia')||s.includes('gondola')||s.includes('repositor')||s.includes('repos')) return 'gondola';
    if (s.includes('comercial')||s.includes('gerente')||s.includes('fiscal')) return 'comercial';
    if (s.includes('caixa')||s.includes('frente')||s.includes('operador')) return 'checkout';
    if (!s) return 'checkout';
    return 'outro';
  }
  function parseRanges(sh) {
    if (!sh || sh === 'Folga') return null;
    const c = sh.split('·')[0].trim().split('/');
    const r = [];
    c.forEach(b => { const p = b.split('-'); const s = parseInt(p[0]), e = parseInt(p[1]); if (!isNaN(s) && !isNaN(e)) r.push({s,e}); });
    return r.length ? r : null;
  }
  function isWorking(p, h) { const r = parseRanges(p.shifts[_floorDay]); return r ? r.some(x => h >= x.s && h < x.e) : false; }
  function isOnBreak(p, h) { const r = parseRanges(p.shifts[_floorDay]); if (!r || r.length < 2) return false; return h >= r[0].e && h < r[1].s; }

  const TW = 56, TH = 28;
  function isoX(gx,gy) { return 340 + (gx - gy) * TW / 2; }
  function isoY(gx,gy) { return 60 + (gx + gy) * TH / 2; }
  function isoRect(gx,gy,gw,gh,fill,stroke,op) {
    const pts = [[gx,gy],[gx+gw,gy],[gx+gw,gy+gh],[gx,gy+gh]].map(([x,y]) => isoX(x,y)+','+isoY(x,y)).join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke||'none'}" stroke-width="0.5" opacity="${op||1}"/>`;
  }
  function isoBox(gx,gy,gw,gh,h,f,d,e) {
    const top = [[gx,gy],[gx+gw,gy],[gx+gw,gy+gh],[gx,gy+gh]].map(([x,y]) => isoX(x,y)+','+(isoY(x,y)-h)).join(' ');
    const front = [[gx,gy+gh],[gx+gw,gy+gh]].map(([x,y]) => isoX(x,y)+','+(isoY(x,y)-h)).join(' ')+' '+[[gx+gw,gy+gh],[gx,gy+gh]].map(([x,y]) => isoX(x,y)+','+isoY(x,y)).join(' ');
    const side = [isoX(gx+gw,gy)+','+(isoY(gx+gw,gy)-h), isoX(gx+gw,gy+gh)+','+(isoY(gx+gw,gy+gh)-h), isoX(gx+gw,gy+gh)+','+isoY(gx+gw,gy+gh), isoX(gx+gw,gy)+','+isoY(gx+gw,gy)].join(' ');
    return `<polygon points="${top}" fill="${f}" stroke="${d}" stroke-width="0.5"/><polygon points="${front}" fill="${d}" stroke="${e}" stroke-width="0.3"/><polygon points="${side}" fill="${e}" stroke="${e}" stroke-width="0.3"/>`;
  }
  function isoLabel(gx,gy,txt,col,sz) { return `<text x="${isoX(gx,gy)}" y="${isoY(gx,gy)}" text-anchor="middle" fill="${col}" font-size="${sz||10}" font-weight="500" style="font-family:inherit">${txt}</text>`; }
  function isoWorker(gx,gy,color,name,id,zl,sh,brk) {
    const x = isoX(gx,gy), y = isoY(gx,gy);
    const ini = name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
    const c = brk ? '#9e9e9e' : color;
    let s = `<g class="floor-worker" data-n="${name}" data-z="${zl}" data-s="${sh}" data-brk="${brk?1:0}" style="cursor:pointer">`;
    s += `<ellipse cx="${x}" cy="${y+2}" rx="8" ry="4" fill="rgba(0,0,0,.15)"/>`;
    s += `<rect x="${x-6}" y="${y-16}" width="12" height="12" rx="2" fill="${c}" stroke="rgba(255,255,255,.5)" stroke-width="0.5"/>`;
    s += `<circle cx="${x}" cy="${y-22}" r="5" fill="${c}" stroke="rgba(255,255,255,.5)" stroke-width="0.5"/>`;
    s += `<text x="${x}" y="${y-14}" text-anchor="middle" fill="#fff" font-size="6" font-weight="500" style="font-family:inherit">${ini}</text>`;
    s += `<text x="${x}" y="${y+12}" text-anchor="middle" fill="var(--color-text-secondary)" font-size="7" style="font-family:inherit">${name.split(' ')[0]}</text>`;
    if (brk) s += `<text x="${x}" y="${y-28}" text-anchor="middle" font-size="10">&#9749;</text>`;
    s += '</g>';
    return s;
  }

  function buildSvg() {
    const dk = matchMedia('(prefers-color-scheme:dark)').matches;
    const flA = dk?'#2a2520':'#f5e6c8', flB = dk?'#252018':'#eedbb5';
    const wC = dk?'#1a2530':'#d5e8f5', wD = dk?'#15202a':'#c0d8ea';
    const shC = dk?'#3a3530':'#c4a882', shD = dk?'#2d2820':'#a88c66', shE = dk?'#221e18':'#8c7050';
    const ctC = dk?'#1a4a2a':'#4caf50', ctD = dk?'#144020':'#388e3c', ctE = dk?'#0e3018':'#2e7d32';
    const frC = dk?'#1a3545':'#80d8ff', frD = dk?'#15303e':'#40c4ff', frE = dk?'#102530':'#00b0ff';
    const mtC = dk?'#451a1a':'#ef9a9a', mtD = dk?'#3a1515':'#e57373', mtE = dk?'#2e1010':'#c62828';
    const bkC = dk?'#453520':'#ffe0b2', bkD = dk?'#3a2a18':'#ffcc80', bkE = dk?'#2e2010':'#ffa726';

    let h = '';
    for (let gx=0;gx<12;gx++) for (let gy=0;gy<12;gy++) h += isoRect(gx,gy,1,1,(gx+gy)%2===0?flA:flB,dk?'rgba(255,255,255,.03)':'rgba(0,0,0,.05)');
    const wTL=isoX(0,0)+','+isoY(0,0), wTR=isoX(12,0)+','+isoY(12,0);
    h += `<polygon points="${isoX(0,0)},${isoY(0,0)-40} ${isoX(12,0)},${isoY(12,0)-40} ${wTR} ${wTL}" fill="${wC}" stroke="${wD}" stroke-width="0.5"/>`;
    h += `<polygon points="${isoX(0,0)},${isoY(0,0)-40} ${wTL} ${isoX(0,12)},${isoY(0,12)} ${isoX(0,12)},${isoY(0,12)-40}" fill="${wD}" stroke="${wD}" stroke-width="0.5"/>`;

    h += isoBox(0.5,0.5,3,1.5,12,mtC,mtD,mtE) + isoLabel(2,1.5,'ACOUGUE','#fff',8);
    h += isoBox(4,0.5,3,1.5,12,bkC,bkD,bkE) + isoLabel(5.5,1.5,'PADARIA',dk?'#2e2010':'#5d4037',8);
    h += isoBox(7.5,0.5,4,1.2,14,frC,frD,frE) + isoLabel(9.5,1.3,'FRIOS',dk?'#102530':'#01579b',8);
    h += isoBox(0.3,2.5,1.5,3,10,'#558b2f','#33691e','#1b5e20') + isoLabel(1,4.2,'HORTI',dk?'#aed581':'#fff',7);
    for (let row=0;row<3;row++) {
      const gy = 3+row*2.2;
      h += isoBox(2.5,gy,7,0.8,10,shC,shD,shE);
      for (let p=0;p<6;p++) h += isoRect(3+p*0.9,gy+0.15,0.7,0.5,['#e57373','#64b5f6','#fff176','#81c784','#ce93d8','#ffb74d'][p],null,0.6);
    }
    h += isoLabel(6,5,'MERCEARIA',dk?'rgba(255,255,255,.4)':'rgba(0,0,0,.3)',9);
    h += isoBox(10,3,1.5,4,16,frC,frD,frE) + isoLabel(10.8,5.5,'BEBIDAS',dk?'#b3e5fc':'#01579b',7);

    // Recebimento (doca) — fundo direito, atrás do salão
    const rcC = dk?'#3d2a1a':'#d7ccc8', rcD = dk?'#2e1f12':'#bcaaa4', rcE = dk?'#1e150c':'#8d6e63';
    h += isoBox(10,0,2,2.5,10,rcC,rcD,rcE);
    h += isoLabel(11,1.5,'RECEBIM.',dk?'#d7ccc8':'#4e342e',7);
    // Plataforma de descarga
    h += isoRect(11.2,0,0.8,0.4,dk?'#555':'#9e9e9e','rgba(0,0,0,.2)',0.7);
    h += `<text x="${isoX(11.6,0.2)}" y="${isoY(11.6,0.2)-6}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="7" style="font-family:inherit">&#128666;</text>`;

    // Escritório (administrativo) — separado do salão, canto superior direito
    const ofC = dk?'#1e1b4b':'#c7d2fe', ofD = dk?'#1a1740':'#a5b4fc', ofE = dk?'#151030':'#818cf8';
    h += isoBox(13.5,1,2.5,2,14,ofC,ofD,ofE);
    h += isoLabel(14.8,2.3,'ESCRITORIO',dk?'#c7d2fe':'#3730a3',7);
    // Porta conectando ao salão
    h += `<line x1="${isoX(13.5,2)}" y1="${isoY(13.5,2)-7}" x2="${isoX(12.5,2.5)}" y2="${isoY(12.5,2.5)}" stroke="${dk?'rgba(255,255,255,.15)':'rgba(0,0,0,.1)'}" stroke-width="1" stroke-dasharray="4,3"/>`;
    // Ícones de mesa no escritório
    h += isoRect(14,1.5,0.6,0.4,dk?'#2d2760':'#9fa8da',null,0.5);
    h += isoRect(15,1.5,0.6,0.4,dk?'#2d2760':'#9fa8da',null,0.5);

    const active = people.filter(p => isWorking(p, _floorHour));
    const checkoutW = active.filter(p => zoneOf(p.nome) === 'checkout').length;
    const activePdvs = Math.min(checkoutW, pdvs);
    const pdvSp = Math.min(2.5, 10 / pdvs), pdvSt = (12 - pdvs * pdvSp) / 2;
    for (let i = 0; i < pdvs; i++) {
      const gx = pdvSt + i * pdvSp; const act = i < activePdvs;
      h += isoBox(gx, 9.5, pdvSp*0.8, 1.5, 8, act?ctC:'#555', act?ctD:'#444', act?ctE:'#333');
      h += isoBox(gx+0.2, 9.8, 0.5, 0.4, 12, act?'#222':'#444', act?'#111':'#333', '#000');
      if (act) h += isoLabel(gx+pdvSp*0.4, 10.8, 'PDV '+(i+1), dk?'#a5d6a7':'#fff', 6);
    }
    h += isoLabel(6,11.8,'FRENTE DE LOJA',dk?'rgba(255,255,255,.35)':'rgba(0,0,0,.25)',9);
    h += `<text x="${isoX(6,12)}" y="${isoY(6,12)+17}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="9" style="font-family:inherit"><tspan style="font-size:14px">&#8593;</tspan> ENTRADA</text>`;

    const byZone = {};
    active.forEach(p => { const z = zoneOf(p.nome); (byZone[z] = byZone[z] || []).push(p); });
    const zonePos = {checkout:{gx:[2,10],gy:[9,10]},gondola:{gx:[3,9],gy:[3,8]},acougue:{gx:[0.5,3],gy:[0.5,2]},padaria:{gx:[4,7],gy:[0.5,2]},frios:{gx:[8,11],gy:[0.5,2]},hortifruti:{gx:[0.3,2],gy:[3,5.5]},comercial:{gx:[0.5,3],gy:[6,8]},recebimento:{gx:[10.3,11.8],gy:[0.3,2]},escritorio:{gx:[13.8,15.5],gy:[1.3,2.5]},outro:{gx:[4,7],gy:[6,8]}};
    Object.entries(byZone).forEach(([z, workers]) => {
      const pos = zonePos[z] || zonePos.outro;
      workers.forEach((w, i) => {
        const t = workers.length > 1 ? i / (workers.length - 1) : 0.5;
        const gx = pos.gx[0] + t * (pos.gx[1] - pos.gx[0]);
        const gy = pos.gy[0] + 0.3 + (workers.length > 3 ? (i%2)*0.8 : 0);
        h += isoWorker(gx, gy, ZC[z]||ZC.outro, w.nome, 'fw'+i, ZL[z]||z, w.shifts[_floorDay], isOnBreak(w, _floorHour));
      });
    });

    const folga = people.filter(p => !p.shifts[_floorDay] || p.shifts[_floorDay]==='Folga').length;
    const breaks = people.filter(p => isOnBreak(p, _floorHour)).length;
    const noEscritorio = (byZone.escritorio||[]).length;
    const noRecebimento = (byZone.recebimento||[]).length;
    const noSalao = active.length - noEscritorio - noRecebimento;
    return { svg: h, active: active.length, total: people.length, activePdvs, folga, breaks, noSalao, noEscritorio, noRecebimento, formation: Object.entries(byZone).filter(([z])=>z!=='escritorio').map(([z,w])=>`${w.length}`).join('-') || '0' };
  }

  function render() {
    const lojaH = lojaPorDia[_floorDay];
    const r = buildSvg();
    const hh = Math.floor(_floorHour), mm = Math.round((_floorHour-hh)*60);
    const timeStr = String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    const pct = ((_floorHour - lojaH.open) / (lojaH.close - lojaH.open)) * 100;

    let pipHtml = '';
    people.forEach((p,pi) => {
      const rr = parseRanges(p.shifts[_floorDay]); if (!rr) return;
      const c = ZC[zoneOf(p.nome)] || '#888';
      rr.forEach(x => {
        const l = ((x.s-lojaH.open)/(lojaH.close-lojaH.open))*100;
        const w = ((x.e-x.s)/(lojaH.close-lojaH.open))*100;
        pipHtml += `<div style="position:absolute;left:${l}%;width:${w}%;background:${c};top:${(pi/people.length)*100}%;height:${Math.max(3,100/people.length)}%;opacity:.2;border-radius:2px"></div>`;
      });
    });

    const zones = [...new Set(people.map(p => zoneOf(p.nome)))];
    const legendHtml = zones.map(z => `<span style="margin-right:10px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${ZC[z]};vertical-align:middle;margin-right:3px"></span>${ZL[z]||z}</span>`).join('') + `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#9e9e9e;vertical-align:middle;margin-right:3px"></span>Intervalo</span>`;

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <span style="font-size:16px;font-weight:500;color:var(--color-text-primary)"><i class="ti ti-building-store" style="font-size:18px;margin-right:4px"></i>Planta da loja</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button id="floorPlayBtn" type="button" style="background:transparent;border:0.5px solid var(--color-border-secondary);border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer;color:var(--color-text-secondary)"><i class="ti ti-player-play"></i> Simular</button>
          <div id="floorDayBtns" style="display:flex;gap:3px">${DAYS.map((d,i) => `<button class="floor-day-btn" data-d="${i}" style="background:${i===_floorDay?'var(--color-background-info)':'transparent'};color:${i===_floorDay?'var(--color-text-info)':'var(--color-text-secondary)'};border:0.5px solid ${i===_floorDay?'var(--color-border-info)':'var(--color-border-secondary)'};border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer">${d}</button>`).join('')}</div>
        </div>
      </div>
      <div style="position:relative;width:100%;background:var(--color-background-secondary);border-radius:12px;overflow:hidden">
        <svg viewBox="0 0 820 480" style="display:block;width:100%">${r.svg}</svg>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:14px;font-weight:500;text-align:center;color:var(--color-text-primary);margin-bottom:4px">${timeStr}</div>
        <div id="floorTimeline" style="position:relative;height:24px;background:var(--color-background-secondary);border-radius:8px;cursor:pointer;overflow:hidden">
          ${pipHtml}
          <div id="floorTlHandle" style="position:absolute;top:-2px;width:3px;height:28px;background:var(--color-text-primary);border-radius:2px;left:${pct}%;transform:translateX(-1px);cursor:grab;z-index:5"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-tertiary);margin-top:2px">
          <span>${String(lojaH.open).padStart(2,'0')}:00</span><span>${String(lojaH.close).padStart(2,'0')}:00</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:8px">
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-building-store" style="margin-right:3px"></i>No salao</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.noSalao}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-device-desktop" style="margin-right:3px"></i>PDVs</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.activePdvs} / ${pdvs}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-building" style="margin-right:3px"></i>Escritorio</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.noEscritorio}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-truck-delivery" style="margin-right:3px"></i>Recebimento</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.noRecebimento}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-coffee" style="margin-right:3px"></i>Intervalo</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.breaks}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-calendar-off" style="margin-right:3px"></i>Folga</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.folga}</p></div>
        <div style="background:var(--color-background-secondary);border-radius:8px;padding:8px 10px"><p style="font-size:11px;color:var(--color-text-secondary);margin:0"><i class="ti ti-users" style="margin-right:3px"></i>Total ativos</p><p style="font-size:17px;font-weight:500;margin:2px 0 0;color:var(--color-text-primary)">${r.active} / ${r.total}</p></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;font-size:11px;color:var(--color-text-secondary)">${legendHtml}</div>
    `;

    // Event: day buttons
    el.querySelectorAll('.floor-day-btn').forEach(b => b.addEventListener('click', () => {
      _floorDay = parseInt(b.dataset.d);
      const newLoja = lojaPorDia[_floorDay];
      if (_floorHour < newLoja.open || _floorHour >= newLoja.close) _floorHour = newLoja.open;
      render();
    }));

    // Event: timeline drag
    const tl = document.getElementById('floorTimeline');
    const hdl = document.getElementById('floorTlHandle');
    if (tl && hdl) {
      let drag = false;
      function updTl(cx) {
        const rect = tl.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
        const lojaH2 = lojaPorDia[_floorDay];
        _floorHour = Math.round((lojaH2.open + p * (lojaH2.close - lojaH2.open)) * 2) / 2;
        _floorHour = Math.max(lojaH2.open, Math.min(lojaH2.close - 0.5, _floorHour));
        render();
      }
      hdl.addEventListener('mousedown', e => { drag = true; e.preventDefault(); });
      tl.addEventListener('click', e => updTl(e.clientX));
      document.addEventListener('mousemove', e => { if (drag) updTl(e.clientX); });
      document.addEventListener('mouseup', () => { drag = false; });
      hdl.addEventListener('touchstart', e => { drag = true; e.preventDefault(); });
      document.addEventListener('touchmove', e => { if (drag) updTl(e.touches[0].clientX); });
      document.addEventListener('touchend', () => { drag = false; });
    }

    // Event: play button
    const playBtn = document.getElementById('floorPlayBtn');
    if (playBtn) playBtn.addEventListener('click', () => {
      if (_floorPlaying) { _floorPlaying = false; clearInterval(_floorTimer); render(); return; }
      _floorPlaying = true;
      const lojaH2 = lojaPorDia[_floorDay];
      _floorHour = lojaH2.open;
      _floorTimer = setInterval(() => {
        _floorHour += 0.5;
        if (_floorHour >= lojaH2.close) { _floorPlaying = false; clearInterval(_floorTimer); }
        render();
      }, 400);
      render();
    });

    // Event: worker tooltips
    el.querySelectorAll('.floor-worker').forEach(w => {
      w.addEventListener('mouseenter', () => {
        const n = w.dataset.n, z = w.dataset.z, s = w.dataset.s, brk = w.dataset.brk === '1';
        const tip = document.createElement('div');
        tip.className = 'floor-tooltip-pop';
        tip.style.cssText = 'position:fixed;background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:8px;padding:6px 10px;font-size:11px;color:var(--color-text-primary);pointer-events:none;z-index:999;white-space:nowrap;line-height:1.4';
        tip.innerHTML = `<strong>${n}</strong><br><span style="color:var(--color-text-secondary)">${z}</span><br>${brk?'<span style="color:var(--color-text-warning)">Em intervalo</span>':s}`;
        document.body.appendChild(tip);
        const rect = w.getBoundingClientRect();
        tip.style.left = (rect.left + rect.width/2 - tip.offsetWidth/2) + 'px';
        tip.style.top = (rect.top - tip.offsetHeight - 4) + 'px';
        w._tip = tip;
      });
      w.addEventListener('mouseleave', () => { if (w._tip) { w._tip.remove(); w._tip = null; } });
    });
  }

  render();
}

function renderWeeklySchedule(data) {
  const profile = (data.client && data.client.profile) || {};
  const lojaSegSex = parseLojaHora(profile.horarioSegSex);
  const lojaSab = parseLojaHora(profile.horarioSabado);
  const lojaDom = parseLojaHora(profile.horarioDomingo);
  const lojaPorDia = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSab, lojaDom];
  const source = getSelectedCashierScenario(data);
  const fechada = data.escalaFechada;
  const usarFechada = source.usarFechada;
  const setorMap = usarFechada ? (fechada.setorMap || {}) : (data.employeeSetorMap || {});
  const cargoMap = usarFechada ? (fechada.cargoMap || {}) : (data.employeeCargoMap || {});
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let people = Object.entries(source.people);

  // Setores disponíveis
  const setores = [...new Set(people.map(([nome]) => setorMap[nome] || 'Sem setor'))];

  // Aplicar filtro de setor
  if (weeklyScheduleSetorFilter) {
    people = people.filter(([nome]) => (setorMap[nome] || 'Sem setor') === weeklyScheduleSetorFilter);
  }
  // Cargos disponíveis (dentro do setor filtrado, se houver)
  const cargos = [...new Set(people.map(([nome]) => cargoMap[nome] || 'Sem cargo'))];
  // Aplicar filtro de cargo
  if (weeklyScheduleCargoFilter) {
    people = people.filter(([nome]) => (cargoMap[nome] || 'Sem cargo') === weeklyScheduleCargoFilter);
  }

  const audits = people.map(([nome, shifts]) => ({
    nome,
    hours: shifts.reduce((sum, shift) => sum + parseHours(shift), 0),
    daysOff: shifts.filter((shift) => shift === 'Folga').length
  }));
  const valid = audits.filter((audit) => Math.abs(audit.hours - source.targetHours) < 0.01 && audit.daysOff === source.targetDaysOff).length;
  const jv = data.jornadaVariavel;
  const jvTxt = (jv && jv.ativa)
    ? ` &nbsp;<span style="color:#5eead4">📊 jornada otimizada por demanda (${jv.pesos.filter(p => p.peso >= 1.15).map(p => p.dia).join('/') || 'sex/sáb'} reforçados)</span>`
    : '';
  document.getElementById('weeklyScheduleNote').innerHTML = `${source.label}: meta de ${source.targetHours}h e ${source.targetDaysOff} folga${source.targetDaysOff > 1 ? 's' : ''} a cada 7 dias.${source.optimized ? ' &nbsp;<span style="color:#f59e0b">⚡ semana individual ajustada pela rotina Tá Ótimo</span>' : ''} &nbsp;<span style="opacity:.8">🔓 abre · 🔒 fecha</span>${jvTxt}`;
  document.getElementById('weeklyAuditSummary').innerHTML = `
    <span class="${valid === audits.length ? 'weekly-ok' : 'weekly-bad'}">${valid}/${audits.length} conformes</span>
  `;

  // Chips de filtro por setor
  const setorChips = setores.length > 1 ? `
    <div class="setor-filter weekly-setor-filter">
      <span class="filter-label">Setor:</span>
      <button class="setor-chip ${!weeklyScheduleSetorFilter?'active':''}" data-wsetor="">Todos (${Object.keys(source.people).length})</button>
      ${setores.map(s => {
        const count = Object.keys(source.people).filter(n => (setorMap[n]||'Sem setor')===s).length;
        return `<button class="setor-chip ${weeklyScheduleSetorFilter===s?'active':''}" data-wsetor="${s}">${s} (${count})</button>`;
      }).join('')}
    </div>` : '';

  // Chips de filtro por cargo (dos colaboradores visíveis após o filtro de setor)
  const cargoChips = cargos.length > 1 ? `
    <div class="setor-filter weekly-cargo-filter">
      <span class="filter-label">Cargo:</span>
      <button class="cargo-chip ${!weeklyScheduleCargoFilter?'active':''}" data-wcargo="">Todos</button>
      ${cargos.map(c => {
        const count = Object.entries(source.people).filter(([n]) => (cargoMap[n]||'Sem cargo')===c && (!weeklyScheduleSetorFilter || (setorMap[n]||'Sem setor')===weeklyScheduleSetorFilter)).length;
        return `<button class="cargo-chip ${weeklyScheduleCargoFilter===c?'active':''}" data-wcargo="${c}">${c} (${count})</button>`;
      }).join('')}
    </div>` : '';

  const periodoBox = `
    <div class="periodo-box ${usarFechada ? 'periodo-fechado' : 'periodo-aberto'}">
      ${usarFechada ? `
        <div class="periodo-info">
          <strong>🔒 PERÍODO FECHADO — escala oficial</strong>
          <span>${fechada.label} · ${fechada.cenarioLabel} · fechado por ${fechada.fechadoPor} em ${new Date(fechada.fechadoEm).toLocaleDateString('pt-BR')}</span>
          <small>Esta escala está congelada. Mudanças no cadastro NÃO a alteram.</small>
        </div>
        <div class="periodo-actions">
          <button id="verRascunhoBtn" class="optimize-button" type="button">Ver rascunho atual</button>
          <button id="reabrirBtn" class="optimize-button" type="button">Reabrir período</button>
        </div>
      ` : `
        <div class="periodo-info">
          <strong>📝 RASCUNHO ${fechada ? '(há um período fechado vigente)' : '— escala dinâmica'}</strong>
          <span>Esta escala é recalculada automaticamente. Feche o período para gerar a versão oficial imutável.</span>
        </div>
        <div class="periodo-actions">
          ${fechada ? '<button id="verFechadaBtn" class="optimize-button" type="button">Ver escala oficial</button>' : ''}
          <button id="fecharPeriodoBtn" class="optimize-button save-optimization" type="button">🔒 Fechar período</button>
        </div>
      `}
    </div>`;

  // FASE 1: Compliance CLT
  const compliance = usarFechada ? (fechada.compliance || []) : ((data.complianceCLT && data.complianceCLT[currentCoverageScenario]) || []);
  const complianceBox = `
    <div class="clt-box ${compliance.length ? 'clt-bad' : 'clt-ok'}">
      <strong>${compliance.length ? '⚠️ ' + compliance.length + ' colaborador(es) com alerta CLT' : '✅ Escala em conformidade CLT'}</strong>
      ${compliance.length ? `<div class="clt-list">${compliance.slice(0, 8).map(c => `<div><b>${c.nome}:</b> ${c.violacoes.join(' · ')}</div>`).join('')}${compliance.length > 8 ? `<div>+${compliance.length - 8} outros</div>` : ''}</div>` : '<span>Validados: interjornada 11h · DSR · máx 44h/sem · máx 10h/dia · máx 6h contínuas (art. 71) · 6 dias consecutivos.</span>'}
      <small style="display:block;margin-top:6px;opacity:.65">Auditoria baseada na CLT federal. Convenções coletivas locais (CCT dos comerciários) podem ter regras adicionais — valide com seu contador/sindicato.</small>
    </div>`;

  // Índice do dia de HOJE na semana exibida (p/ destaque visual)
  const todayIdx = (() => {
    const cal = data.calendarioSemana;
    if (!cal || !cal.dias) return -1;
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return cal.dias.findIndex(x => x.data === iso);
  })();

  document.getElementById('weeklySchedule').innerHTML = `
    ${periodoBox}
    ${complianceBox}
    ${setorChips}
    ${cargoChips}
    ${(() => {
      const cal = data.calendarioSemana;
      if (!cal || !cal.temFeriado) return '';
      const fer = cal.dias.filter(d => d.feriado);
      return `<div class="clt-box clt-bad" style="margin-bottom:8px"><strong>📅 Feriado nesta semana:</strong> ${fer.map(f => `${f.feriado} (${f.label})`).join(' · ')} — revise demanda e escala do dia.</div>`;
    })()}
    <div class="weekly-grid">
    <div class="weekly-row weekly-head"><span>Colaborador(a)</span>${days.map((day, di) => {
      const diaCal = data.calendarioSemana?.dias?.[di];
      const dataLabel = diaCal ? `<small class="head-date">${diaCal.label}${diaCal.feriado ? ' 🎉' : ''}</small>` : '';
      return `<span class="${di === todayIdx ? 'is-today' : ''}" title="${diaCal?.feriado || (di === todayIdx ? 'Hoje' : '')}">${day}${di === todayIdx ? ' <em class="today-tag">hoje</em>' : ''}${dataLabel}</span>`;
    }).join('')}<span>Auditoria</span></div>
    ${people.map(([nome, shifts]) => {
      const audit = audits.find((item) => item.nome === nome);
      const ok = Math.abs(audit.hours - source.targetHours) < 0.01 && audit.daysOff === source.targetDaysOff;
      const setor = setorMap[nome] || 'Sem setor';
      const workedLabel = Math.abs(audit.hours - source.targetHours) < 0.01
        ? formatWorkedHours(source.targetHours)
        : `${formatWorkedHours(audit.hours)} prev.`;
      return `
        <div class="weekly-row">
          <span class="weekly-person"><strong>${nome}</strong><small>${setor} · ${workedLabel} trabalhadas · ${audit.daysOff} folga${audit.daysOff > 1 ? 's' : ''}</small></span>
          ${shifts.map((shift, dayIdx) => {
            const b = shiftBounds(shift);
            const lh = lojaPorDia[dayIdx];
            let badge = '';
            if (b && lh) {
              const abre = b.start <= lh.open;
              const fecha = b.end >= lh.close;
              if (abre) badge += '<span class="shift-icon abre" title="Abre a loja">🔓</span>';
              if (fecha) badge += '<span class="shift-icon fecha" title="Fecha a loja">🔒</span>';
            }
            return `<span class="weekly-shift ${shift === 'Folga' ? 'weekly-off' : shift.includes('08-12') ? 'weekly-sunday' : ''} ${dayIdx === todayIdx ? 'is-today' : ''}">${renderShiftWithInterval(shift, badge)}</span>`;
          }).join('')}
          <span class="weekly-status ${ok ? 'valid' : 'invalid'}">${ok ? 'Conforme' : 'Revisar'}</span>
        </div>
      `;
    }).join('')}
    </div>
  `;

  // FASE 1: Handlers de fechar/reabrir/ver período
  const fecharBtn = document.getElementById('fecharPeriodoBtn');
  if (fecharBtn) {
    fecharBtn.onclick = async () => {
      // Sugere a semana corrente (segunda a domingo)
      const hoje = new Date();
      const diaSemana = (hoje.getDay() + 6) % 7; // seg=0
      const seg = new Date(hoje); seg.setDate(hoje.getDate() - diaSemana);
      const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
      const fmt = d => d.toISOString().slice(0, 10);
      const ini = prompt('Data INÍCIO do período (AAAA-MM-DD):', fmt(seg));
      if (!ini) return;
      const fim = prompt('Data FIM do período (AAAA-MM-DD):', fmt(dom));
      if (!fim) return;
      fecharBtn.disabled = true; fecharBtn.textContent = 'Fechando...';
      try {
        const r = await fetch('/api/escala/fechar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cenario: currentCoverageScenario, dataInicio: ini, dataFim: fim })
        });
        const d = await r.json();
        if (d.ok) { showToast('Período fechado! Escala oficial congelada.'); window._verRascunho = false; window.location.reload(); }
        else { showToast(d.error || 'Erro ao fechar período.'); fecharBtn.disabled = false; fecharBtn.textContent = '🔒 Fechar período'; }
      } catch (e) { showToast('Erro de conexão.'); fecharBtn.disabled = false; fecharBtn.textContent = '🔒 Fechar período'; }
    };
  }
  const reabrirBtn = document.getElementById('reabrirBtn');
  if (reabrirBtn) {
    reabrirBtn.onclick = async () => {
      if (!confirm('Reabrir o período? A escala volta a ser recalculada dinamicamente (a versão atual vai para o histórico).')) return;
      try {
        const r = await fetch('/api/escala/reabrir', { method: 'POST' });
        const d = await r.json();
        if (d.ok) { showToast('Período reaberto.'); window._verRascunho = false; window.location.reload(); }
        else showToast(d.error || 'Erro.');
      } catch (e) { showToast('Erro de conexão.'); }
    };
  }
  const verRascunhoBtn = document.getElementById('verRascunhoBtn');
  if (verRascunhoBtn) verRascunhoBtn.onclick = () => { window._verRascunho = true; renderWeeklySchedule(data); };
  const verFechadaBtn = document.getElementById('verFechadaBtn');
  if (verFechadaBtn) verFechadaBtn.onclick = () => { window._verRascunho = false; renderWeeklySchedule(data); };

  // FASE 1: Exportar/imprimir escala
  const exportBtn = document.getElementById('exportSchedule');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const empresa = (data.client && data.client.profile && data.client.profile.empresa) || 'Loja';
      const loja = (data.client && data.client.profile && data.client.profile.loja) || '';
      const dias2 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      const rows = Object.entries(source.people).map(([nome, shifts]) => {
        const setor = setorMap[nome] || '';
        return `<tr><td class="nm">${nome}<small>${setor}</small></td>${shifts.map(s => `<td class="${s === 'Folga' ? 'fg' : ''}">${s.replace(' · ', '<br>')}</td>`).join('')}</tr>`;
      }).join('');
      const win = window.open('', '_blank');
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Escala — ${empresa}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#111}
          h1{font-size:20px;margin:0}h2{font-size:13px;color:#555;margin:4px 0 16px;font-weight:400}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th,td{border:1px solid #ccc;padding:6px 4px;text-align:center}
          th{background:#0d7d6f;color:#fff}
          td.nm{text-align:left;font-weight:700;white-space:nowrap}
          td.nm small{display:block;font-weight:400;color:#777;font-size:9px}
          td.fg{background:#f1f1f1;color:#999}
          .ft{margin-top:16px;font-size:10px;color:#888}
          @media print{button{display:none}}
        </style></head><body>
        <h1>Escala de Trabalho — ${empresa}${loja ? ' · ' + loja : ''}</h1>
        <h2>${source.label} · gerado pelo TáÓtimo! em ${new Date().toLocaleDateString('pt-BR')}</h2>
        <table><thead><tr><th>Colaborador</th>${dias2.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
        <p class="ft">🔓 abre · 🔒 fecha · Folga = descanso. Documento gerado automaticamente — confira a conformidade CLT antes de afixar.</p>
        <button onclick="window.print()" style="margin-top:16px;padding:10px 20px;background:#0d7d6f;color:#fff;border:none;border-radius:6px;cursor:pointer">Imprimir / Salvar PDF</button>
        </body></html>`);
      win.document.close();
    };
  }

  // Handlers dos chips
  document.querySelectorAll('#weeklySchedule .setor-chip').forEach(chip => {
    chip.onclick = () => {
      weeklyScheduleSetorFilter = chip.dataset.wsetor;
      weeklyScheduleCargoFilter = ''; // reseta cargo ao trocar de setor
      renderWeeklySchedule(data);
    };
  });
  document.querySelectorAll('#weeklySchedule .cargo-chip').forEach(chip => {
    chip.onclick = () => {
      weeklyScheduleCargoFilter = chip.dataset.wcargo;
      renderWeeklySchedule(data);
    };
  });
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

// Espelha o mapeamento do backend: mercadológico (m2) -> setor operacional
const MERC_SETOR_FRONT = {
  'acougue': 'Açougue', 'carnes': 'Açougue',
  'padaria': 'Padaria', 'panificacao': 'Padaria', 'confeitaria': 'Padaria',
  'flv': 'Hortifruti', 'hortifruti': 'Hortifruti',
  'frios e laticineos': 'Frios e Laticínios', 'frios e laticinios': 'Frios e Laticínios', 'frios': 'Frios e Laticínios', 'laticinios': 'Frios e Laticínios',
  'ilhas e congelados': 'Congelados', 'congelados': 'Congelados', 'ilhas': 'Congelados',
  'peixaria': 'Peixaria', 'pescados': 'Peixaria',
  'bazar': 'Mercearia', 'bebidas': 'Mercearia', 'cereais': 'Mercearia',
  'limpeza': 'Mercearia', 'mercearia doce': 'Mercearia', 'mercearia salgada': 'Mercearia',
  'perfumaria e higiene pessoal': 'Mercearia', 'perfumaria': 'Mercearia', 'higiene': 'Mercearia'
};
function mercParaSetorFront(merc) {
  const k = String(merc || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MERC_SETOR_FRONT[k] || merc || 'Outros';
}
function setorDerivadoDeMercs(mercs) {
  if (!mercs || !mercs.length) return '';
  const setores = mercs.map(mercParaSetorFront);
  const freq = {};
  setores.forEach(s => { freq[s] = (freq[s] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

function openMercadologicoSelector(idx, data) {
  const emp = managedEmployees[idx];
  const opts = data.mercadologicosM2 || [];
  const sel = new Set(Array.isArray(emp.mercadologicos) ? emp.mercadologicos : []);

  let overlay = document.getElementById('mercSelectorOverlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'mercSelectorOverlay';
  overlay.className = 'merc-overlay';
  overlay.innerHTML = `
    <div class="merc-modal">
      <div class="merc-modal-head">
        <strong>Mercadológicos de ${emp.nome || 'colaborador'}</strong>
        <span>Marque os grupos que este colaborador atende. O setor operacional é definido automaticamente.</span>
      </div>
      <div class="merc-modal-list">
        ${opts.map(m => `
          <label class="merc-opt">
            <input type="checkbox" value="${m}" ${sel.has(m) ? 'checked' : ''}>
            <span>${m}</span>
          </label>
        `).join('')}
      </div>
      <div class="merc-modal-actions">
        <button id="mercCancel" type="button" class="secondary-button">Cancelar</button>
        <button id="mercConfirm" type="button" class="optimize-button save-optimization">Confirmar seleção</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#mercCancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector('#mercConfirm').onclick = () => {
    const marcados = [...overlay.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value);
    managedEmployees[idx].mercadologicos = marcados;
    // Preenche o setor automaticamente com o setor operacional derivado
    if (marcados.length) {
      managedEmployees[idx].setor = setorDerivadoDeMercs(marcados);
    }
    overlay.remove();
    renderEmployeesManager(data);
  };
}

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
      mercadologicos: Array.isArray(e.mercadologicos) ? e.mercadologicos : [],
      horasSemanais: e.horasSemanais || 44,
      salario: e.salario || 0,
      turno: e.turno || 'flexivel',
      podeDomingo: e.podeDomingo !== false,
      folgaPreferencial: e.folgaPreferencial || ''
    }));
  }

  const turnoOpts = [['flexivel','Flexível'],['abertura','Abertura'],['intermediario','Intermediário'],['fechamento','Fechamento']];
  const folgaOpts = [['','Sem preferência'],['segunda','Segunda'],['terca','Terça'],['quarta','Quarta'],['quinta','Quinta'],['domingo','Domingo']];

  // Resumo e filtro por setor
  const setores = [...new Set(managedEmployees.map(e => (e.setor || 'Sem setor').trim() || 'Sem setor'))];
  if (typeof window.empFilterSetor === 'undefined') window.empFilterSetor = '';
  const filtro = window.empFilterSetor;
  const filtered = managedEmployees
    .map((e, originalIdx) => ({ e, originalIdx }))
    .filter(({ e }) => !filtro || (e.setor || 'Sem setor').trim() === filtro);

  const setorResumo = setores.map(s => {
    const count = managedEmployees.filter(e => ((e.setor||'Sem setor').trim()||'Sem setor') === s).length;
    return `<button class="setor-chip ${filtro===s?'active':''}" data-setor="${s}">${s} (${count})</button>`;
  }).join('');

  el.innerHTML = `
    <div class="setor-filter">
      <button class="setor-chip ${!filtro?'active':''}" data-setor="">Todos (${managedEmployees.length})</button>
      ${setorResumo}
    </div>
    <div class="emp-table">
      <div class="emp-row emp-head">
        <span>Nome</span><span>Cargo</span><span>Setor</span><span>Horas</span><span>Salário</span>
        <span>Turno preferencial</span><span>Folga pref.</span><span>Dom.</span><span></span>
      </div>
      ${filtered.map(({ e, originalIdx: i }) => {
        const temMerc = data.mercadologicosM2 && data.mercadologicosM2.length;
        const mercSel = Array.isArray(e.mercadologicos) ? e.mercadologicos : [];
        const setorCell = `
          <div class="setor-cell">
            <input data-i="${i}" data-f="setor" value="${(e.setor||'').replace(/"/g,'&quot;')}" placeholder="Setor" list="setoresList">
            ${temMerc ? `<button class="merc-select-btn ${mercSel.length?'has-sel':''}" data-merc-btn="${i}" type="button" title="${mercSel.length ? mercSel.join(', ') : 'Selecionar mercadológicos'}">📦${mercSel.length ? ' '+mercSel.length : ''}</button>` : ''}
          </div>`;
        return `
        <div class="emp-row">
          <input data-i="${i}" data-f="nome" value="${(e.nome||'').replace(/"/g,'&quot;')}" placeholder="Nome">
          <input data-i="${i}" data-f="cargo" value="${(e.cargo||'').replace(/"/g,'&quot;')}" placeholder="Cargo">
          ${setorCell}
          <input data-i="${i}" data-f="horasSemanais" type="number" min="1" max="168" value="${e.horasSemanais||44}">
          <input data-i="${i}" data-f="salario" type="number" min="0" step="50" value="${e.salario||0}">
          <select data-i="${i}" data-f="turno">
            ${turnoOpts.map(([v,l]) => `<option value="${v}" ${e.turno===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <select data-i="${i}" data-f="folgaPreferencial">
            ${folgaOpts.map(([v,l]) => `<option value="${v}" ${e.folgaPreferencial===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <label class="emp-domingo"><input data-i="${i}" data-f="podeDomingo" type="checkbox" ${e.podeDomingo!==false?'checked':''}></label>
          <button class="emp-remove" data-i="${i}" type="button" title="Remover">✕</button>
        </div>
      `;}).join('')}
    </div>
    <datalist id="setoresList">
      ${(data.mercadologicosM2 && data.mercadologicosM2.length)
        ? data.mercadologicosM2.map(m => `<option value="${m}">`).join('')
        : '<option value="Caixa"><option value="Açougue"><option value="Balcão"><option value="Administrativo"><option value="Padaria"><option value="Hortifruti"><option value="Estoque"><option value="Limpeza">'}
      <option value="Administrativo"><option value="Caixa">
    </datalist>
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
  // Botão de seleção de mercadológicos (multi-seleção)
  el.querySelectorAll('.merc-select-btn').forEach(btn => {
    btn.onclick = () => openMercadologicoSelector(Number(btn.dataset.mercBtn), data);
  });
  // Filtro por setor
  el.querySelectorAll('.setor-chip').forEach(chip => {
    chip.onclick = () => {
      window.empFilterSetor = chip.dataset.setor;
      renderEmployeesManager(data);
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
    managedEmployees.push({ nome: '', sexo: 'feminino', cargo: 'Operador de Caixa', setor: 'Caixa', mercadologicos: [], horasSemanais: 44, salario: 0, turno: 'flexivel', podeDomingo: true, folgaPreferencial: '' });
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

function renderMercadologicoResumo(data) {
  const el = document.getElementById('mercResumo');
  if (!el) return;
  const resumo = data.mercadologicoResumo || [];
  if (!resumo.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="merc-resumo-head">📊 Vendas importadas por setor (${resumo.length} setores)</div>
    <div class="merc-resumo-grid">
      ${resumo.map(s => `
        <div class="merc-resumo-card">
          <strong>${s.setor}</strong>
          <span>${money(s.vendaLiquida)} · ${s.dias} dias</span>
          <small>${money(s.vendaMediaDia)}/dia · ${s.qtdItens.toLocaleString('pt-BR')} itens</small>
        </div>
      `).join('')}
    </div>
  `;
}

// Detecta decimal BR (vírgula) ou US (ponto). Ex.: "755.20" -> 755.2; "1.234,56" -> 1234.56
function parseFlexNumber(value) {
  let s = String(value || '').trim();
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  // só ponto (ou nenhum) -> já é decimal US
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseMercadologicoCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['Arquivo vazio.'] };
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(delim).map(normalizeHeader);
  const pos = {
    data: headers.findIndex(h => h === 'data'),
    m1: headers.findIndex(h => ['descricao_m1', 'm1', 'grupo', 'grupo_m1', 'nivel1'].includes(h)),
    m2: headers.findIndex(h => ['descricao_m2', 'm2', 'mercadologico', 'departamento', 'setor', 'categoria', 'subgrupo', 'nivel2'].includes(h)),
    itens: headers.findIndex(h => ['qtd_itens', 'itens', 'qtditens'].includes(h)),
    unid: headers.findIndex(h => ['qtd_unidades', 'qtd_vendida', 'quantidade', 'qtde', 'unidades'].includes(h)),
    valor: headers.findIndex(h => ['valor_total', 'venda_liquida', 'valor', 'venda', 'faturamento', 'total'].includes(h)),
    cupons: headers.findIndex(h => ['cupons', 'transacoes', 'tickets'].includes(h))
  };
  // m2 é o mercadológico principal; se não houver m2, usa m1
  const mercCol = pos.m2 >= 0 ? pos.m2 : pos.m1;
  if (pos.data < 0 || mercCol < 0 || pos.valor < 0) {
    return { rows: [], errors: ['Faltam colunas: data, descricao_m2 (mercadológico) e valor_total.'] };
  }
  const rows = [], errors = [];
  lines.slice(1).forEach((line, i) => {
    const c = line.split(delim).map(x => x.trim().replace(/^"|"$/g, ''));
    const data = normalizeDate(c[pos.data]);
    const merc = c[mercCol];
    if (!data || !merc) { errors.push(`Linha ${i + 2} inválida.`); return; }
    rows.push({
      data,
      grupoM1: pos.m1 >= 0 ? c[pos.m1] : '',
      mercadologico: merc,
      vendaLiquida: parseFlexNumber(c[pos.valor]),
      qtdItens: pos.itens >= 0 ? parseFlexNumber(c[pos.itens]) : 0,
      qtdeVendida: pos.unid >= 0 ? parseFlexNumber(c[pos.unid]) : 0,
      cupons: pos.cupons >= 0 ? parseFlexNumber(c[pos.cupons]) : 0
    });
  });
  return { rows, errors };
}

function renderOnboarding(data) {
  renderCompanyInfo();
  renderEmployeesManager(data);
  renderMercadologicoResumo(data);
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
  if (data.userRole === 'gestor') return; // Gestor não passa pela trava de onboarding
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

    // Gestor abre direto no painel de gestão ao logar
    btn.click();
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
    // Dados reais = conectado ao Supabase (postgresql OU rest) com usuário logado.
    // Só é "demonstrativa" quando não há login (dados-modelo).
    const dadosReais = authState.authenticated && source.mode !== 'demo';
    const sourceStatus = document.getElementById('dataSourceStatus');
    sourceStatus.textContent = dadosReais ? 'Supabase · dados reais da empresa' : 'Base demonstrativa (faça login para ver seus dados)';
    sourceStatus.className = dadosReais ? 'source-connected' : 'source-demo';
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
    safeRender('painel operacional', () => renderOpsDashboard(data));
    safeRender('indicadores', () => renderKpis(data.scenarios, data.metadata));
    safeRender('prontidao enterprise', () => renderEnterpriseReadiness(data));
    safeRender('forca semanal', () => renderMonthlyWeekAnalysis(data));
    safeRender('benchmark', () => renderBenchmark(data));
    safeRender('setores', () => renderSectorEngine(data));
    safeRender('cenarios', () => renderScenarios(data.scenarios, data.metadata));
    safeRender('cobertura', () => renderCoverage(data));
    safeRender('planta loja', () => renderStoreFloorMap(data));
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
        const applyData = (d, label) => {
          window.currentSummary = d;
          safeRender('indicadores', () => renderKpis(d.scenarios, d.metadata));
          safeRender('cenarios', () => renderScenarios(d.scenarios, d.metadata));
          safeRender('semana colaboradora', () => renderWeeklySchedule(d));
          safeRender('cobertura', () => renderCoverage(d));
          safeRender('forca semanal', () => renderMonthlyWeekAnalysis(d));
          if (weekInfo) weekInfo.textContent = label;
        };
        if (!weekNumber) {
          applyData(data, 'Mostrando todos os dados importados');
        } else {
          if (weekInfo) weekInfo.textContent = 'Carregando semana...';
          try {
            const response = await fetch(`/api/summary/week/${weekNumber}`);
            const weekData = await response.json();
            if (weekData.error) { weekInfo.textContent = 'Erro: ' + weekData.error; return; }
            const lbl = weekData.metadata?.semanaLabel
              ? `${weekData.metadata.semanaLabel} • ${weekData.metadata.demandaMediaSemana || ''}`
              : `Semana ${weekNumber}`;
            applyData(weekData, lbl);
          } catch (error) {
            console.error('Erro ao carregar dados da semana:', error);
            if (weekInfo) weekInfo.textContent = 'Erro ao carregar dados da semana';
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
        optimizeButton.textContent = coverageAdjustmentMode ? 'Voltar à escala original' : 'Otimização IA · TáÓtimo!';
        if (saveOptimizationButton) saveOptimizationButton.hidden = !coverageAdjustmentMode;
        renderCoverage(data);
        renderWeeklySchedule(data);
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

    // === IMPORTAÇÃO MERCADOLÓGICO ===
    let pendingMercRows = [];
    const mercInput = document.getElementById('mercCsvInput');
    if (mercInput) {
      mercInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const parsed = parseMercadologicoCsv(await file.text());
        pendingMercRows = parsed.rows;
        const setores = [...new Set(parsed.rows.map(r => r.mercadologico))];
        const dias = [...new Set(parsed.rows.map(r => r.data))];
        document.getElementById('confirmMercImport').disabled = parsed.rows.length < 1;
        document.getElementById('mercImportPreview').innerHTML = `
          <strong>${parsed.rows.length} linhas válidas</strong>
          <span>${setores.length} grupos mercadológicos · ${dias.length} dias · ${parsed.errors.length} rejeições</span>
          ${parsed.rows.length < 1 ? '<small>Verifique as colunas: data, mercadologico, venda_liquida.</small>' : '<small>Pronto para importar.</small>'}
        `;
      };
    }
    const confirmMerc = document.getElementById('confirmMercImport');
    if (confirmMerc) {
      confirmMerc.onclick = async () => {
        const res = await fetch('/api/import-mercadologico', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: pendingMercRows })
        });
        const result = await res.json();
        if (!res.ok) return showToast(result.error || 'Erro ao importar mercadológico.');
        showToast(`${result.imported} linhas importadas em ${result.setores.length} setores. Atualizando...`);
        setTimeout(() => window.location.reload(), 1000);
      };
    }
    const downloadMerc = document.getElementById('downloadMercTemplate');
    if (downloadMerc) {
      downloadMerc.onclick = () => {
        const csv = 'data;descricao_m1;descricao_m2;qtd_itens;qtd_unidades;valor_total\n2026-06-01;PERECIVEIS;ACOUGUE;167;127.965;4027.33\n2026-06-01;PERECIVEIS;PADARIA;91;182.000;789.08\n2026-06-01;PERECIVEIS;FLV;34;36.160;450.54\n2026-06-01;PERECIVEIS;FRIOS E LATICINEOS;312;337.554;3374.62\n2026-06-01;MERCEARIA;MERCEARIA DOCE;958;1223.000;7479.78\n2026-06-01;MERCEARIA;LIMPEZA;351;476.000;2694.76\n';
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        link.download = 'modelo-vendas-mercadologico.csv';
        link.click();
        URL.revokeObjectURL(link.href);
      };
    }

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
