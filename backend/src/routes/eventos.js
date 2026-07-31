const express = require('express');
const pool = require('../db/postgres');
const { buildEventMap, EVENTO_TIPO_FATOR } = require('../services/eventosEngine');

const router = express.Router();

// Calendário de eventos: uso da tela de Controlador, restrito a
// administradores da empresa do cliente (mesma regra da Implantação).
function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

async function getCompanyId(userId) {
  const result = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.company_id || null;
}

// GET /api/eventos - Lista os eventos cadastrados da empresa e o mapa
// combinado com os feriados nacionais fixos do ano atual.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const companyId = await getCompanyId(req.user.id);
    const result = await pool.query(
      'SELECT id, data, tipo, nome, fator FROM demand_events WHERE company_id = $1 ORDER BY data ASC',
      [companyId]
    );
    const eventMap = buildEventMap(result.rows, new Date().getFullYear());
    res.json({ eventos: result.rows, eventMap });
  } catch (err) {
    console.error('Erro ao listar eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/eventos/upsert - Cria ou atualiza um evento (uma linha por
// data, igual ao EscalaON). Se o fator não vier explícito, usa o padrão
// do tipo.
router.post('/upsert', requireAdmin, async (req, res) => {
  try {
    const { data, tipo, nome, fator } = req.body;
    if (!data || !tipo || !nome) {
      return res.status(400).json({ error: 'Data, tipo e nome são obrigatórios.' });
    }

    const companyId = await getCompanyId(req.user.id);
    const fatorFinal = fator !== undefined && fator !== null && fator !== ''
      ? Number(fator)
      : (EVENTO_TIPO_FATOR[tipo] || 1);

    const result = await pool.query(
      `INSERT INTO demand_events (company_id, data, tipo, nome, fator)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, data) DO UPDATE SET tipo = $3, nome = $4, fator = $5
       RETURNING id, data, tipo, nome, fator`,
      [companyId, data, tipo, nome, fatorFinal]
    );

    res.json({ evento: result.rows[0] });
  } catch (err) {
    console.error('Erro ao salvar evento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/eventos/delete - Remove um evento pela data.
router.post('/delete', requireAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Data é obrigatória.' });
    }

    const companyId = await getCompanyId(req.user.id);
    await pool.query('DELETE FROM demand_events WHERE company_id = $1 AND data = $2', [companyId, data]);
    res.json({ message: 'Evento removido.' });
  } catch (err) {
    console.error('Erro ao remover evento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
