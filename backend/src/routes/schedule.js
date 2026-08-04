const express = require('express');
const router = express.Router();
const pool = require('../db/postgres');
const { generateGroupedSchedule, buildScheduleJustifications, parseStoreHours, checkComplianceCLT, mergeCltRules, CLT_FEDERAL_DEFAULTS } = require('../services/schedule');
const { cashierLoadForHour } = require('../services/erlang');
const { isOperadorCaixa, countCaixaScheduledAtHour } = require('../services/scheduleCoverage');
const { buildDemandIndices, adjustedDemand, weekOfMonth } = require('../services/forecastEngine');

// Segunda-feira da semana pedida (weekOffset em unidades de semana, 0 =
// semana atual) — mesma fórmula usada no front pra desenhar a grade, senão
// a previsão calculada aqui fica de uma semana e a grade mostrada de outra.
function mondayOfWeek(weekOffset) {
  const hoje = new Date();
  const diaSemana = (hoje.getDay() + 6) % 7; // seg=0..dom=6
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - diaSemana + weekOffset * 7);
  seg.setHours(12, 0, 0, 0);
  return seg;
}

// Previsão de faturamento REAL pra semana exibida (seg-dom), usando o
// mesmo motor de sazonalidade do Controlador (dia-da-semana × semana-do-
// mês) — antes essa linha só somava o histórico dos últimos 7 dias
// corridos, sempre igual não importa qual semana estava selecionada.
async function buildRevenueForecastForWeek(companyId, weekOffset) {
  const historico = await pool.query(
    `SELECT data, SUM(valor_total) AS valor_total
     FROM sales_data
     WHERE company_id = $1 AND data <= CURRENT_DATE
     GROUP BY data
     ORDER BY data DESC
     LIMIT 200`,
    [companyId]
  );
  // buildDemandIndices espera `data` como string 'YYYY-MM-DD' — o
  // node-postgres devolve coluna DATE como objeto Date, então sem essa
  // conversão toda a rota quebrava (new Date(dateObj + 'T12:00:00') vira
  // uma string inválida e o .getDay() dá NaN).
  const historicoRows = historico.rows.map((r) => ({
    ...r,
    data: r.data instanceof Date ? r.data.toISOString().slice(0, 10) : r.data,
  }));
  const indices = buildDemandIndices(historicoRows);
  if (!indices) return { revenueByDay: [], confianca: null };

  const seg = mondayOfWeek(weekOffset);
  const revenueByDay = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(seg);
    d.setDate(seg.getDate() + i);
    const dataStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const wom = weekOfMonth(dataStr);
    revenueByDay.push(Math.round(adjustedDemand(indices.baseMedia, indices, dow, wom, 1)));
  }
  return { revenueByDay, confianca: indices.confianca };
}

// Edição manual de turno — carrega os overrides salvos (schedule_overrides)
// pra semana exibida e sobrescreve o turno gerado automaticamente naquela
// célula específica. A escala continua sendo recalculada do zero toda vez
// (generateGroupedSchedule); os overrides são só o ajuste manual por cima.
async function loadScheduleOverrides(companyId, weekStartStr) {
  const result = await pool.query(
    'SELECT employee_name, day_index, shift_text FROM schedule_overrides WHERE company_id = $1 AND week_start = $2',
    [companyId, weekStartStr]
  );
  const byEmployee = {};
  result.rows.forEach((row) => {
    if (!byEmployee[row.employee_name]) byEmployee[row.employee_name] = {};
    byEmployee[row.employee_name][row.day_index] = row.shift_text;
  });
  return byEmployee;
}

function applyScheduleOverrides(schedule, overridesByEmployee) {
  const result = { ...schedule };
  Object.entries(overridesByEmployee).forEach(([nome, porDia]) => {
    if (!result[nome]) return;
    const shifts = [...result[nome]];
    Object.entries(porDia).forEach(([dayIndex, shiftText]) => {
      shifts[Number(dayIndex)] = shiftText;
    });
    result[nome] = shifts;
  });
  return result;
}

// Quando tem mais operador de caixa escalado do que PDV disponível, o
// excedente não fica ocioso — vira sugestão de reforço em embalagem (pico
// de venda) ou reposição (demanda moderada), igual ao projeto modelo
// (server.js:4852-4864 — atividadeSecundaria).
function buildActivitySuggestionByDay(totalOperadoresCaixa, pdvs, demandaIndices) {
  const excedentes = Math.max(0, totalOperadoresCaixa - pdvs);
  if (excedentes === 0) return [null, null, null, null, null, null, null];
  return demandaIndices.map((fatorTotal) => {
    const isPico = fatorTotal >= 1.1;
    return {
      excedentes,
      pdvs,
      operadores: totalOperadoresCaixa,
      atividade: isPico ? 'embalagem' : 'reposicao',
      motivo: isPico
        ? 'Pico de vendas — operadores excedentes auxiliam no empacotamento para acelerar o fluxo de clientes'
        : 'Demanda moderada — operadores excedentes reforçam reposição para reduzir ruptura de gôndola',
    };
  });
}

// Confere os campos da Implantação que são obrigatórios pra gerar a
// escala/demanda, e retorna quais estão faltando (pra avisar exatamente
// o que a pessoa precisa preencher, em vez de uma mensagem genérica).
function missingSetupFields(setup) {
  const missing = [];
  if (!setup?.pdvs) missing.push('a quantidade de PDVs (checkouts)');
  if (!setup?.weekday_hours) missing.push('o horário de segunda a sexta');
  return missing;
}

// "a, b e c" em vez de "a, b, c" — lê melhor numa frase.
function joinNatural(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

// GET /api/schedule - retorna escala semanal
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
      const weekOffset = Number.isFinite(Number(req.query.weekOffset)) ? Math.trunc(Number(req.query.weekOffset)) : 0;

      // Pegar o company_id do usuário
      const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
      const companyId = userResult.rows[0]?.company_id;

      // Buscar colaboradores — join com mercadologicos pra trazer o nome do
      // setor (id_mercadologico é só o FK; scheduleGroupKey precisa do nome).
      const employeesResult = await pool.query(
        `SELECT e.*, m.nome AS setor
         FROM employees e
         LEFT JOIN mercadologicos m ON m.id = e.id_mercadologico
         WHERE e.company_id = $1
         ORDER BY e.id`,
        [companyId]
      );

      // Buscar configuração completa da loja
      const setupResult = await pool.query(
        'SELECT * FROM store_setup WHERE company_id = $1',
        [companyId]
      );

      // Buscar dados de vendas
      const salesResult = await pool.query(
        'SELECT * FROM sales_data WHERE company_id = $1 AND data <= CURRENT_DATE ORDER BY data DESC LIMIT 168',
        [companyId]
      );

      const employees = employeesResult.rows;
      const setup = setupResult.rows[0];

      // Sem Implantação preenchida (ou faltando PDVs/horário), não dá pra
      // gerar uma escala real — os defaults antigos (08:00-20:00, 3 PDVs)
      // eram inventados e geravam uma escala inteira em cima de dado falso.
      const missing = missingSetupFields(setup);
      if (missing.length > 0) {
        return res.status(400).json({ error: `Falta informar ${joinNatural(missing)} na tela de Implantação.` });
      }

      const pdvs = setup.pdvs;

      if (employees.length === 0) {
        return res.json({
          schedule: {},
          demand: {},
          employees: 0,
          periodo: getPeriodLabel()
        });
      }

      const profile = {
        horario: setup.weekday_hours,
        quantidadeOperadores: employees.length,
        quantidadePdvs: pdvs
      };

      // Calcular índices de demanda por dia da semana
      const demandaIndices = calculateDemandaIndicesByDayOfWeek(salesResult.rows);

      const scheduleGerada = generateGroupedSchedule(profile, employees, 44, 1, demandaIndices);

      // Aplica edições manuais salvas (schedule_overrides) só na semana
      // exibida — a escala "atual" reflete o que o gestor de fato ajustou;
      // os cenários de transição (5x2) continuam 100% simulados, já que
      // representam um regime diferente, não a semana real publicada.
      const weekStartStr = mondayOfWeek(weekOffset).toISOString().slice(0, 10);
      const overridesByEmployee = await loadScheduleOverrides(companyId, weekStartStr);
      const schedule = applyScheduleOverrides(scheduleGerada, overridesByEmployee);

      const justifications = buildScheduleJustifications(employees, schedule, parseStoreHours(profile.horario));

      // Auditoria CLT real (interjornada 11h, DSR, máx 44h/semana, máx
      // 10h/dia, máx 6 dias consecutivos) — antes a caixa "Escala em
      // conformidade CLT" era só texto fixo, sem checar nada de verdade.
      const complianceViolations = checkComplianceCLT(schedule, setup.clt_rules);

      // Cenários de redução de jornada (6x1 -> 5x2) — mesma escala real,
      // recalculada com targetHours/targetDaysOff diferentes. No 5x2 o
      // domingo passa a ser folga fixa em vez de rodízio (ver schedule.js).
      const scenarios = {
        atual: { label: '6x1 - 44h', targetHours: 44, targetDaysOff: 1, schedule },
        transicao: {
          label: '5x2 - 42h',
          targetHours: 42,
          targetDaysOff: 2,
          schedule: generateGroupedSchedule(profile, employees, 42, 2, demandaIndices),
        },
        final: {
          label: '5x2 - 40h',
          targetHours: 40,
          targetDaysOff: 2,
          schedule: generateGroupedSchedule(profile, employees, 40, 2, demandaIndices),
        },
      };

      // Calcular demanda por hora
      const demandByHour = calculateDemandByHour(salesResult.rows);

      // Extrair horários de abertura e fechamento
      const [openTime, closeTime] = (setup.weekday_hours || '08:00-20:00').split('-');

      // Horário por dia real (seg-sex, sábado e domingo têm horários
      // próprios na Implantação) — antes só o weekday_hours ia pro front,
      // então a Planta da Loja usava o mesmo horário pra todo dia da
      // semana, inclusive domingo com horário reduzido.
      const parseRange = (str) => {
        if (!str) return null;
        const [o, c] = str.split('-');
        return { openTime: o, closeTime: c };
      };
      const weekdayRange = parseRange(setup.weekday_hours) || { openTime: '08:00', closeTime: '20:00' };
      const saturdayRange = parseRange(setup.saturday_hours) || weekdayRange;
      const sundayClosed = setup.sunday_operation === 'fechado';
      const sundayRange = sundayClosed ? null : (parseRange(setup.sunday_hours) || weekdayRange);
      // índice 0=segunda..6=domingo, igual ao array `schedule`
      const storeHoursByDay = [
        weekdayRange, weekdayRange, weekdayRange, weekdayRange, weekdayRange,
        saturdayRange,
        sundayRange,
      ];

      const totalOperadoresCaixa = employees.filter(isOperadorCaixa).length;

      // Previsão real pra semana exibida (usa sazonalidade dia-da-semana ×
      // semana-do-mês quando há histórico suficiente; cai pro cálculo
      // simples de média histórica quando não há dado o bastante).
      const forecastSemana = await buildRevenueForecastForWeek(companyId, weekOffset);
      const revenueByDay = forecastSemana.revenueByDay.length
        ? forecastSemana.revenueByDay
        : calculateRevenueByDayOfWeek(salesResult.rows);

      res.json({
        schedule,
        scenarios,
        justifications,
        demand: demandByHour,
        revenueByDay,
        forecastConfianca: forecastSemana.confianca,
        weekOffset,
        weekStart: weekStartStr,
        overrides: overridesByEmployee,
        complianceViolations,
        cltRules: mergeCltRules(setup.clt_rules),
        activitySuggestionByDay: buildActivitySuggestionByDay(totalOperadoresCaixa, pdvs, demandaIndices),
        storeHoursByDay,
        sundayClosed,
        employees: employees.length,
        periodo: getPeriodLabel(),
        storeHours: {
          openTime: openTime || '08:00',
          closeTime: closeTime || '20:00',
          pdvs
        }
      });
    } catch (dbErr) {
      console.log('Database error:', dbErr.code);
      res.json({
        schedule: {},
        demand: {},
        employees: 0,
        periodo: 'Sem dados'
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedule/save - salva a escala gerada
router.post('/save', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { schedule, status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const weekStart = getWeekStart();

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    await pool.query(
      'INSERT INTO schedules (company_id, week_start, schedule_data, status) VALUES ($1, $2, $3, $4)',
      [companyId, weekStart, JSON.stringify(schedule), status || 'draft']
    );

    res.json({ success: true, message: 'Escala salva' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/override - edita manualmente o turno de um colaborador
// num dia específico de uma semana específica (replica a edição de turno do
// projeto modelo). Não mexe na lógica de geração — só sobrescreve a célula
// exibida/exportada daquela semana.
router.put('/override', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { employeeName, weekStart, dayIndex, shiftText } = req.body;
    if (!employeeName || !weekStart || dayIndex === undefined || !shiftText) {
      return res.status(400).json({ error: 'employeeName, weekStart, dayIndex e shiftText são obrigatórios' });
    }
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return res.status(400).json({ error: 'dayIndex inválido (0-6)' });
    }

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    await pool.query(
      `INSERT INTO schedule_overrides (company_id, employee_name, week_start, day_index, shift_text, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (company_id, employee_name, week_start, day_index)
       DO UPDATE SET shift_text = $5, created_by = $6, updated_at = now()`,
      [companyId, employeeName, weekStart, dayIndex, shiftText, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedule/override - remove a edição manual, voltando a célula
// pro que a geração automática calcularia.
router.delete('/override', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { employeeName, weekStart, dayIndex } = req.body;
    if (!employeeName || !weekStart || dayIndex === undefined) {
      return res.status(400).json({ error: 'employeeName, weekStart e dayIndex são obrigatórios' });
    }

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    await pool.query(
      'DELETE FROM schedule_overrides WHERE company_id = $1 AND employee_name = $2 AND week_start = $3 AND day_index = $4',
      [companyId, employeeName, weekStart, dayIndex]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedule/clt-rules - regras CLT/CCT configuradas pela empresa
// (com defaults federais aplicados pra regra que ainda não foi customizada)
router.get('/clt-rules', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const setupResult = await pool.query('SELECT clt_rules FROM store_setup WHERE company_id = $1', [companyId]);
    res.json({ cltRules: mergeCltRules(setupResult.rows[0]?.clt_rules), defaults: CLT_FEDERAL_DEFAULTS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/schedule/clt-rules - salva customização das regras CLT/CCT
router.put('/clt-rules', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { cltRules } = req.body;
    if (!cltRules || typeof cltRules !== 'object') {
      return res.status(400).json({ error: 'cltRules é obrigatório' });
    }

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    await pool.query('UPDATE store_setup SET clt_rules = $1 WHERE company_id = $2', [JSON.stringify(cltRules), companyId]);

    res.json({ success: true, cltRules: mergeCltRules(cltRules) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// índice 0=segunda..6=domingo (mesma convenção de generateScheduleByProfile)
const DEMAND_HEATMAP_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

// Heatmap real de utilização de caixa por dia×hora (0=segunda..6=domingo),
// usado pelo StoreFloorMap. Antes essa rota só calculava UM dia (sempre
// sábado, com "14 itens/cliente" e "3 caixas" chumbados no código,
// ignorando o `day` pedido) e o front tentava ler `demand[dia][hora]` num
// resultado que era só uma lista plana — o valor nunca batia e a planta
// caía sempre no fallback fixo de 50% de demanda. Agora cada dia usa seu
// dayType real (weekday/saturday/sunday), o histórico real daquele dia da
// semana, e a contagem real de operadores de caixa escalados naquela hora.
async function buildWeeklyDemandHeatmap(companyId) {
  const employeesResult = await pool.query(
    `SELECT e.*, m.nome AS setor FROM employees e LEFT JOIN mercadologicos m ON m.id = e.id_mercadologico WHERE e.company_id = $1 ORDER BY e.id`,
    [companyId]
  );
  const setupResult = await pool.query('SELECT * FROM store_setup WHERE company_id = $1', [companyId]);
  const employees = employeesResult.rows;
  const setup = setupResult.rows[0];

  if (!setup?.pdvs || !setup?.weekday_hours || employees.length === 0) return null;

  const salesResult = await pool.query(
    'SELECT * FROM sales_data WHERE company_id = $1 AND data <= CURRENT_DATE ORDER BY data DESC LIMIT 500',
    [companyId]
  );
  const demandaIndices = calculateDemandaIndicesByDayOfWeek(salesResult.rows);
  const profile = { horario: setup.weekday_hours, quantidadeOperadores: employees.length, quantidadePdvs: setup.pdvs };
  const schedule = generateGroupedSchedule(profile, employees, 44, 1, demandaIndices);

  const heatmap = {};
  for (let scheduleDay = 0; scheduleDay < 7; scheduleDay++) {
    const dow = scheduleDay === 6 ? 0 : scheduleDay + 1; // SQL DOW: 0=domingo..6=sábado
    const dayKey = DEMAND_HEATMAP_DAY_KEYS[scheduleDay];

    if (dow === 0 && setup.sunday_operation === 'fechado') {
      heatmap[dayKey] = {};
      continue;
    }

    const dayType = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : 'weekday';
    const hourSalesResult = await pool.query(
      `SELECT EXTRACT(HOUR FROM hora)::int AS hora_num,
              AVG(clientes)::numeric AS media_clientes,
              AVG(CASE WHEN clientes > 0 THEN itens::numeric / clientes ELSE 0 END) AS media_itens_por_cliente
       FROM sales_data
       WHERE company_id = $1 AND data <= CURRENT_DATE AND EXTRACT(DOW FROM data) = $2
       GROUP BY hora_num
       ORDER BY hora_num ASC`,
      [companyId, dow]
    );

    const dayHeatmap = {};
    hourSalesResult.rows.forEach((r) => {
      const clientes = Number(r.media_clientes) || 0;
      const itensPorCliente = Number(r.media_itens_por_cliente) || 0;
      const scheduledCashiers = countCaixaScheduledAtHour(schedule, employees, scheduleDay, r.hora_num);
      const load = cashierLoadForHour(
        `${String(r.hora_num).padStart(2, '0')}:00`, clientes, itensPorCliente, scheduledCashiers, dayType, setup.pdvs
      );
      if (load) dayHeatmap[`${String(r.hora_num).padStart(2, '0')}:00`] = Math.min(1.6, load.utilizacao / 100);
    });
    heatmap[dayKey] = dayHeatmap;
  }

  return heatmap;
}

// GET /api/schedule/demand - heatmap real de demanda de caixa por dia×hora
router.get('/demand', async (req, res) => {
  try {
    const userId = req.user?.id;

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const heatmap = await buildWeeklyDemandHeatmap(companyId);
    if (!heatmap) {
      return res.status(400).json({ error: 'Configure PDVs, horário e colaboradores na Implantação antes de ver a demanda.' });
    }

    res.json(heatmap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Faturamento real por dia da semana (soma de valor_total do histórico já
// sincronizado) — não precisa de nenhuma importação manual: a venda já
// vem do sync automático (sales_data), então o faturamento é só somar.
function calculateRevenueByDayOfWeek(salesRows) {
  const revenueByDay = [0, 0, 0, 0, 0, 0, 0]; // seg-dom
  salesRows.forEach((row) => {
    const date = new Date(row.data);
    const dayOfWeek = (date.getDay() + 6) % 7;
    revenueByDay[dayOfWeek] += Number(row.valor_total) || 0;
  });
  return revenueByDay;
}

function calculateDemandaIndicesByDayOfWeek(salesRows) {
  const demandByDay = [0, 0, 0, 0, 0, 0, 0]; // seg-dom

  salesRows.forEach(row => {
    const date = new Date(row.data);
    const dayOfWeek = (date.getDay() + 6) % 7; // Converte: dom=6 → sun, seg=0, ..., sab=5
    // Nunca fabrica "1" pra linha sem clientes/faturamento — isso inflava
    // artificialmente dias com dado ausente, distorcendo a distribuição de
    // horas da escala em cima de um número que não existe de verdade.
    const valor = Number(row.clientes) || Number(row.faturamento) || 0;
    demandByDay[dayOfWeek] += valor;
  });

  // Calcula índices normalizados (1.0 = média)
  const totalDemand = demandByDay.reduce((a, b) => a + b, 1); // +1 para evitar divisão por zero
  const averageDemand = totalDemand / 7;

  return demandByDay.map(demand => {
    return demand > 0 ? demand / averageDemand : 1.0;
  });
}

function calculateDemandByHour(salesRows) {
  const demand = {};

  for (let h = 6; h < 20; h++) {
    const hourStr = `${String(h).padStart(2, '0')}:00`;
    const count = salesRows.filter(row => {
      const time = new Date(`2000-01-01T${row.hora}`);
      return time.getHours() === h;
    }).length;

    demand[hourStr] = count || 0;
  }

  return demand;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getPeriodLabel() {
  const d = new Date();
  const week = Math.ceil(d.getDate() / 7);
  return `Semana ${week} do mês`;
}

// POST /api/schedule/status - Marcar revisado/rascunho
router.post('/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { status } = req.body;
    const validStatuses = ['rascunho', 'revisado', 'publicado', 'realizado'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const now = new Date().toISOString();
    const email = req.user.email;

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      `INSERT INTO schedule_workflow (company_id, status, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id) DO UPDATE SET status = $2, updated_at = $3
       RETURNING *`,
      [companyId, status, now]
    );

    if (status === 'revisado') {
      await pool.query(
        `UPDATE schedule_workflow SET reviewed_at = $1, reviewed_by = $2 WHERE company_id = $3`,
        [now, email, companyId]
      );
    }

    res.json({ ok: true, workflow: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// POST /api/schedule/fechar - Fechar período (criar snapshot imutável)
router.post('/fechar', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { dataInicio, dataFim } = req.body;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'Informe data início e fim' });
    }

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    // Busca escala atual para capturar snapshot
    const scheduleResult = await pool.query(
      'SELECT * FROM schedules WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1',
      [companyId]
    );

    const now = new Date().toISOString();
    const email = req.user.email;

    // Atualiza workflow para publicado
    await pool.query(
      `UPDATE schedule_workflow SET status = 'publicado', published_at = $1, published_by = $2 WHERE company_id = $3`,
      [now, email, companyId]
    );

    res.json({ ok: true, message: 'Escala publicada com sucesso' });
  } catch (err) {
    console.error('Erro ao fechar período:', err);
    res.status(500).json({ error: 'Erro ao fechar período' });
  }
});

// POST /api/schedule/export - Exporta escala em HTML
router.post('/export', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { schedule, setor } = req.body;
    if (!schedule) return res.status(400).json({ error: 'Escala obrigatória' });

    const diasAbr = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    // Monta tabela HTML
    const rows = Object.entries(schedule).map(([nome, shifts]) => {
      if (!Array.isArray(shifts)) return '';
      return `<tr>
        <td class="nm">${nome}</td>
        ${shifts.map(s => {
          const cleanShift = (s || '').toString().replace(/\s·\s/g, '<br>');
          return `<td class="${s === 'Folga' ? 'fg' : ''}">${cleanShift}</td>`;
        }).join('')}
      </tr>`;
    }).join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Escala de Trabalho${setor ? ` - ${setor}` : ''}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 13px; color: #555; margin: 4px 0 16px; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 8px 4px; text-align: center; }
    th { background: #0d7d6f; color: #fff; font-weight: 700; }
    td.nm { text-align: left; font-weight: 700; white-space: nowrap; }
    td.fg { background: #f1f1f1; color: #999; }
    .ft { margin-top: 16px; font-size: 10px; color: #888; }
    button { padding: 10px 16px; background: #0d7d6f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    button:hover { background: #0a6b62; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>Escala de Trabalho${setor ? ` — ${setor}` : ''}</h1>
  <h2>Gerado em ${new Date().toLocaleDateString('pt-BR')}</h2>

  <table>
    <thead><tr><th>Colaborador</th>${diasAbr.map(d => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="ft">🔓 abre · 🔒 fecha · Folga = descanso. Documento gerado automaticamente — confira a conformidade CLT antes de afixar.</p>
  <button onclick="window.print()">Imprimir / Salvar PDF</button>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Erro ao exportar:', err);
    res.status(500).json({ error: 'Erro ao exportar escala' });
  }
});

module.exports = router;
