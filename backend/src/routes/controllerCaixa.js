const express = require('express');
const pool = require('../db/postgres');
const { cashierLoadForHour } = require('../services/erlang');
const { generateGroupedSchedule } = require('../services/schedule');
const { countCaixaScheduledAtHour } = require('../services/scheduleCoverage');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// Mesma lógica de calculateDemandaIndicesByDayOfWeek (routes/schedule.js) —
// duplicada aqui porque não é exportada de lá. Índice de demanda por dia
// da semana (0=segunda..6=domingo), usado pra gerar a escala com o mesmo
// motor do /api/schedule.
function demandaIndicesByDayOfWeek(salesRows) {
  const demandByDay = [0, 0, 0, 0, 0, 0, 0];
  salesRows.forEach((row) => {
    const date = new Date(row.data);
    const dayOfWeek = (date.getDay() + 6) % 7; // dom=6, seg=0..sáb=5
    demandByDay[dayOfWeek] += Number(row.clientes || 1);
  });
  const total = demandByDay.reduce((a, b) => a + b, 1);
  const average = total / 7;
  return demandByDay.map((d) => (d > 0 ? d / average : 1.0));
}

// GET /api/controller-caixa?dow=6 - Comparação de caixas necessários ×
// escalados, por horário, pro dia da semana informado (dow: 0=domingo,
// 1=segunda..6=sábado, convenção SQL EXTRACT(DOW)). "Necessário" vem do
// modelo Erlang-C sobre o histórico real de vendas daquele dia da semana;
// "escalados" vem da mesma escala que o /api/schedule gera.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const dow = Number.isInteger(Number(req.query.dow)) ? Number(req.query.dow) : new Date().getDay();
    if (dow < 0 || dow > 6) {
      return res.status(400).json({ error: 'Parâmetro dow inválido (0-6).' });
    }

    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;

    const [employeesResult, setupResult, allSalesResult, hourSalesResult] = await Promise.all([
      pool.query(
        `SELECT e.*, m.nome AS setor
         FROM employees e
         LEFT JOIN mercadologicos m ON m.id = e.id_mercadologico
         WHERE e.company_id = $1
         ORDER BY e.id`,
        [companyId]
      ),
      pool.query('SELECT * FROM store_setup WHERE company_id = $1', [companyId]),
      pool.query('SELECT data, clientes FROM sales_data WHERE company_id = $1 AND data <= CURRENT_DATE ORDER BY data DESC LIMIT 500', [companyId]),
      pool.query(
        `SELECT EXTRACT(HOUR FROM hora)::int AS hora_num,
                AVG(clientes)::numeric AS media_clientes,
                AVG(CASE WHEN clientes > 0 THEN itens::numeric / clientes ELSE 0 END) AS media_itens_por_cliente
         FROM sales_data
         WHERE company_id = $1 AND data <= CURRENT_DATE AND EXTRACT(DOW FROM data) = $2
         GROUP BY hora_num
         ORDER BY hora_num ASC`,
        [companyId, dow]
      ),
    ]);

    const employees = employeesResult.rows;
    const setup = setupResult.rows[0];

    // Sem store_setup, ou faltando PDVs/horário de segunda-sexta = a
    // Implantação não foi preenchida o suficiente — não dá pra assumir
    // esses números, os defaults antigos eram só fallback da coluna, não
    // confirmação real de como a loja funciona.
    if (!setup || !setup.pdvs || !setup.weekday_hours) {
      return res.json({ horas: [], pdvLimit: null, message: 'Configure PDVs e horário de funcionamento na Implantação antes de ver o Controller de Caixa.' });
    }

    const pdvLimit = Number(setup.pdvs);

    if (employees.length === 0) {
      return res.json({ horas: [], pdvLimit, message: 'Cadastre colaboradores na Implantação pra ver a cobertura de caixa.' });
    }

    // Domingo tem regra própria: se a loja fecha, não há o que calcular;
    // se abre, precisa do horário de domingo especificamente configurado
    // (não dá pra reaproveitar o horário de segunda-sexta como fallback).
    if (dow === 0) {
      if (setup.sunday_operation === 'fechado') {
        return res.json({ horas: [], pdvLimit, message: 'A loja está configurada como fechada aos domingos.' });
      }
      if (!setup.sunday_hours) {
        return res.json({ horas: [], pdvLimit, message: 'Configure o horário de domingo na Implantação antes de ver a cobertura desse dia.' });
      }
    }

    if (hourSalesResult.rows.length === 0) {
      return res.json({ horas: [], pdvLimit, message: 'Sem histórico de vendas suficiente para esse dia da semana.' });
    }

    const dayType = dow === 6 ? 'saturday' : dow === 0 ? 'sunday' : 'weekday';
    const horarioStr = dow === 0 ? setup.sunday_hours
      : dow === 6 ? (setup.saturday_hours || setup.weekday_hours)
      : setup.weekday_hours;

    const demandaIndices = demandaIndicesByDayOfWeek(allSalesResult.rows);
    const profile = { horario: horarioStr, quantidadeOperadores: employees.length, quantidadePdvs: pdvLimit };
    const schedule = generateGroupedSchedule(profile, employees, 44, 1, demandaIndices);

    // generateScheduleByProfile: 0=segunda..5=sábado, 6=domingo.
    // dow (SQL): 0=domingo, 1=segunda..6=sábado.
    const scheduleDayIndex = dow === 0 ? 6 : dow - 1;

    const horas = hourSalesResult.rows
      .map((r) => {
        const clientes = Number(r.media_clientes) || 0;
        const itensPorCliente = Number(r.media_itens_por_cliente) || 0;
        const scheduledCashiers = countCaixaScheduledAtHour(schedule, employees, scheduleDayIndex, r.hora_num);
        return cashierLoadForHour(`${String(r.hora_num).padStart(2, '0')}:00`, clientes, itensPorCliente, scheduledCashiers, dayType, pdvLimit);
      })
      .filter(Boolean);

    res.json({ horas, pdvLimit, dow, dayType });
  } catch (err) {
    console.error('Erro ao calcular controller de caixa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
