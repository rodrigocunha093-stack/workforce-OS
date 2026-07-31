const express = require('express');
const pool = require('../db/postgres');
const { buildForecast7Dias } = require('../services/forecastEngine');
const { buildEventMap } = require('../services/eventosEngine');

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

// GET /api/forecast/7dias - Previsão de demanda dos próximos 7 dias,
// baseada no histórico de sales_data (já sincronizado pelo agente) e no
// calendário de eventos da empresa.
router.get('/7dias', requireAdmin, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;

    const salesResult = await pool.query(
      `SELECT data, SUM(valor_total) AS valor_total
       FROM sales_data
       WHERE company_id = $1
       GROUP BY data
       ORDER BY data ASC`,
      [companyId]
    );
    const rows = salesResult.rows.map((r) => ({ data: r.data.toISOString().slice(0, 10), valor_total: r.valor_total }));

    if (rows.length === 0) {
      return res.json({ forecast: null, message: 'Sem histórico de vendas suficiente para gerar a previsão.' });
    }

    const eventsResult = await pool.query(
      'SELECT data, tipo, nome, fator FROM demand_events WHERE company_id = $1',
      [companyId]
    );
    const eventos = eventsResult.rows.map((ev) => ({ ...ev, data: ev.data.toISOString().slice(0, 10) }));
    const eventMap = buildEventMap(eventos, new Date().getFullYear());

    const forecast = buildForecast7Dias(rows, eventMap);
    res.json({ forecast });
  } catch (err) {
    console.error('Erro ao gerar previsão de demanda:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
