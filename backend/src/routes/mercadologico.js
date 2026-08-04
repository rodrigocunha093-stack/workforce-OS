const express = require('express');
const pool = require('../db/postgres');
const { buildMercadologicoDashboard } = require('../services/mercadologicoEngine');
const { isOperadorCaixa } = require('../services/scheduleCoverage');

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

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// GET /api/mercadologico/dashboard - ICOS: carga operacional por
// mercadológico, com venda média/dia, curva por dia da semana e
// necessidade de pessoas por departamento (baseada em volume real).
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = userResult.rows[0]?.company_id;

    const [salesResult, employeesResult] = await Promise.all([
      pool.query(
        `SELECT data, mercadologico_nome, venda, quantidade
         FROM sales_by_mercadologico
         WHERE company_id = $1 AND data <= CURRENT_DATE
         ORDER BY data ASC`,
        [companyId]
      ),
      pool.query(
        `SELECT e.name, e.cargo, m.nome AS setor
         FROM employees e
         LEFT JOIN mercadologicos m ON m.id = e.id_mercadologico
         WHERE e.company_id = $1`,
        [companyId]
      ),
    ]);

    if (salesResult.rows.length === 0) {
      return res.json({ dashboard: [], message: 'Sem histórico de venda por mercadológico ainda.' });
    }

    const rows = salesResult.rows.map((r) => ({
      ...r,
      data: r.data.toISOString().slice(0, 10),
    }));

    // Agrupa colaboradores (não-caixa) por departamento, pelo campo
    // `setor` do funcionário — conta e nomes, pra exibir quem está
    // atribuído a cada mercadológico.
    const employeesBySetor = new Map();
    employeesResult.rows.forEach((emp) => {
      if (isOperadorCaixa(emp)) return;
      if (!emp.setor) return;
      const key = normalizeKey(emp.setor);
      const atual = employeesBySetor.get(key) || { count: 0, nomes: [] };
      atual.count += 1;
      atual.nomes.push(emp.name);
      employeesBySetor.set(key, atual);
    });

    const dashboard = buildMercadologicoDashboard(rows, employeesBySetor);
    res.json({ dashboard });
  } catch (err) {
    console.error('Erro ao montar dashboard de mercadológico:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
