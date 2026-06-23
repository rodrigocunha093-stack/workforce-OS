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
      return res.json(getDemoSchedule());
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
      console.log('Database unavailable for demand, returning demo data:', dbErr.code);
      res.json(getDemoDemand());
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

function getDemoSchedule() {
  return {
    schedule: {
      'Maria': [
        '08:00-16:00',
        '08:00-16:00',
        'Folga',
        '08:00-16:00',
        '08:00-16:00',
        '10:00-18:00',
        'Folga'
      ],
      'João': [
        '12:00-20:00',
        '12:00-20:00',
        '12:00-20:00',
        'Folga',
        '12:00-20:00',
        '12:00-20:00',
        'Folga'
      ]
    },
    demand: {
      '06:00': 10,
      '10:00': 85,
      '14:00': 45,
      '18:00': 60
    },
    periodo: 'Demonstração'
  };
}

function getDemoDemand() {
  return [
    { hora: '08:00', clientes: 5, tempoMedioMin: 2.5, filaMin: 0.5, utilizacao: 25 },
    { hora: '09:00', clientes: 15, tempoMedioMin: 3.2, filaMin: 1.2, utilizacao: 45 },
    { hora: '10:00', clientes: 25, tempoMedioMin: 4.1, filaMin: 2.1, utilizacao: 65 },
    { hora: '11:00', clientes: 35, tempoMedioMin: 5.8, filaMin: 3.5, utilizacao: 85 },
    { hora: '12:00', clientes: 40, tempoMedioMin: 7.2, filaMin: 4.8, utilizacao: 95 },
    { hora: '13:00', clientes: 30, tempoMedioMin: 5.5, filaMin: 3.2, utilizacao: 75 },
    { hora: '14:00', clientes: 20, tempoMedioMin: 4.0, filaMin: 2.0, utilizacao: 55 },
    { hora: '15:00', clientes: 25, tempoMedioMin: 4.5, filaMin: 2.5, utilizacao: 65 },
    { hora: '16:00', clientes: 35, tempoMedioMin: 6.0, filaMin: 3.8, utilizacao: 85 },
    { hora: '17:00', clientes: 45, tempoMedioMin: 8.0, filaMin: 5.2, utilizacao: 95 },
    { hora: '18:00', clientes: 40, tempoMedioMin: 7.0, filaMin: 4.5, utilizacao: 90 },
    { hora: '19:00', clientes: 30, tempoMedioMin: 5.2, filaMin: 3.0, utilizacao: 75 }
  ];
}

module.exports = router;
