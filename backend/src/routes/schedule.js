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
      // Buscar colaboradores
      const employeesResult = await pool.query(
        'SELECT * FROM employees WHERE user_id = $1',
        [userId]
      );

      // Buscar horários da loja
      const hoursResult = await pool.query(
        'SELECT * FROM store_hours WHERE user_id = $1',
        [userId]
      );

      // Buscar dados de vendas
      const salesResult = await pool.query(
        'SELECT * FROM sales_data WHERE user_id = $1 ORDER BY data DESC LIMIT 168',
        [userId]
      );

      const employees = employeesResult.rows;
      const hours = hoursResult.rows[0] || { open_time: '08:00', close_time: '20:00' };

      if (employees.length === 0) {
        return res.json({
          schedule: {},
          demand: {},
          employees: 0,
          periodo: getPeriodLabel()
        });
      }

      const profile = {
        horario: `${hours.open_time}-${hours.close_time}`,
        quantidadeOperadores: employees.length,
        quantidadePdvs: 3
      };

      const schedule = generateScheduleByProfile(profile, employees);

      // Calcular demanda por hora
      const demandByHour = calculateDemandByHour(salesResult.rows);

      res.json({
        schedule,
        demand: demandByHour,
        employees: employees.length,
        periodo: getPeriodLabel()
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

    await pool.query(
      'INSERT INTO schedules (user_id, week_start, schedule_data, status) VALUES ($1, $2, $3, $4)',
      [userId, weekStart, JSON.stringify(schedule), status || 'draft']
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
      const salesResult = await pool.query(
        `SELECT * FROM sales_data
         WHERE user_id = $1
         AND EXTRACT(DOW FROM data) = $2
         ORDER BY data DESC LIMIT 7`,
        [userId, day || 6] // 6 = Saturday
      );

      const demand = calculateDemandByHour(salesResult.rows);

      // Aplicar Erlang-C para cada hora
      const coverage = Object.entries(demand).map(([hour, clients]) => {
        const load = cashierLoadForHour(hour, clients / 24, 3, 'saturday', 3);
        return load;
      });

      res.json(coverage);
    } catch (dbErr) {
      console.error('Database error:', dbErr.code);
      res.status(500).json({ error: 'Não foi possível calcular demanda' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

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



module.exports = router;
