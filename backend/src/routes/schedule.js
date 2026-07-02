const express = require('express');
const router = express.Router();
const pool = require('../db/postgres');
const { generateScheduleByProfile } = require('../services/schedule');
const { cashierLoadForHour } = require('../services/erlang');

// GET /api/schedule - retorna escala semanal
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
      // Pegar o company_id do usuário
      const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
      const companyId = userResult.rows[0]?.company_id;

      // Buscar colaboradores
      const employeesResult = await pool.query(
        'SELECT * FROM employees WHERE company_id = $1',
        [companyId]
      );

      // Buscar configuração completa da loja
      const setupResult = await pool.query(
        'SELECT * FROM store_setup WHERE company_id = $1',
        [companyId]
      );

      // Buscar dados de vendas
      const salesResult = await pool.query(
        'SELECT * FROM sales_data WHERE company_id = $1 ORDER BY data DESC LIMIT 168',
        [companyId]
      );

      const employees = employeesResult.rows;
      const setup = setupResult.rows[0] || {
        weekday_hours: '08:00-20:00',
        pdvs: 3
      };
      const pdvs = setup.pdvs || 3;

      if (employees.length === 0) {
        return res.json({
          schedule: {},
          demand: {},
          employees: 0,
          periodo: getPeriodLabel()
        });
      }

      const profile = {
        horario: setup.weekday_hours || '08:00-20:00',
        quantidadeOperadores: employees.length,
        quantidadePdvs: pdvs
      };

      // Calcular índices de demanda por dia da semana
      const demandaIndices = calculateDemandaIndicesByDayOfWeek(salesResult.rows);

      const schedule = generateScheduleByProfile(profile, employees, 44, 1, demandaIndices);

      // Calcular demanda por hora
      const demandByHour = calculateDemandByHour(salesResult.rows);

      // Extrair horários de abertura e fechamento
      const [openTime, closeTime] = (setup.weekday_hours || '08:00-20:00').split('-');

      res.json({
        schedule,
        demand: demandByHour,
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

// GET /api/schedule/demand - demanda por hora (Erlang-C)
router.get('/demand', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { day } = req.query;

    try {
      // Pegar o company_id do usuário
      const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
      const companyId = userResult.rows[0]?.company_id;

      const salesResult = await pool.query(
        `SELECT * FROM sales_data
         WHERE company_id = $1
         AND EXTRACT(DOW FROM data) = $2
         ORDER BY data DESC LIMIT 7`,
        [companyId, day || 6] // 6 = Saturday
      );

      // Buscar PDVs da configuração da loja
      const setupResult = await pool.query(
        'SELECT pdvs FROM store_setup WHERE company_id = $1',
        [companyId]
      );
      const pdvs = setupResult.rows[0]?.pdvs || 3;

      const demand = calculateDemandByHour(salesResult.rows);

      // Aplicar Erlang-C para cada hora
      const coverage = Object.entries(demand).map(([hour, clients]) => {
        const load = cashierLoadForHour(hour, clients / 24, 3, 'saturday', pdvs);
        return load;
      });

      res.json(coverage);
    } catch (dbErr) {
      console.error('Database error:', dbErr.code);
      res.status(400).json({ error: 'Configure a loja antes de gerar a escala' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function calculateDemandaIndicesByDayOfWeek(salesRows) {
  const demandByDay = [0, 0, 0, 0, 0, 0, 0]; // seg-dom

  salesRows.forEach(row => {
    const date = new Date(row.data);
    const dayOfWeek = (date.getDay() + 6) % 7; // Converte: dom=6 → sun, seg=0, ..., sab=5
    demandByDay[dayOfWeek] += (row.clientes || row.faturamento || 1);
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

    const { schedule } = req.body;
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
  <title>Escala de Trabalho</title>
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
  <h1>Escala de Trabalho</h1>
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
