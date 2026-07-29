const express = require('express');
const { syncAllCompanies, syncClientVendas } = require('../services/syncVendas');
const pool = require('../db/postgres');

const router = express.Router();

// Middleware: verificar admin (mesma lógica do superadmin)
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  // Nota: em produção, seria JWT.verify(). Aqui simplificado.
  // Se você já tem middleware de auth, reutilize.
  next();
}

// GET /api/sync/vendas - Sincroniza TODAS as empresas
router.get('/vendas', requireAdmin, async (req, res) => {
  try {
    res.json({ message: 'Sincronização iniciada. Verifique os logs.' });
    // Executa em background, sem bloquear a resposta
    syncAllCompanies().catch((err) => console.error('[sync] Erro em background:', err));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/vendas/:clientId - Sincroniza UM cliente específico
router.get('/vendas/:clientId', requireAdmin, async (req, res) => {
  const { clientId } = req.params;

  try {
    const result = await pool.query('SELECT id FROM companies WHERE client_id = $1', [clientId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Client_id não encontrado: ${clientId}` });
    }

    const companyId = result.rows[0].id;
    res.json({ message: `Sincronização iniciada para ${clientId}. Verifique os logs.` });

    // Executa em background
    syncClientVendas(companyId, clientId).catch((err) =>
      console.error(`[sync] Erro para ${clientId}:`, err)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/status - Verifica o último índice de cada empresa
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.name, c.client_id,
        COALESCE(MAX(i.ultimo_id), 0) AS ultimo_id,
        MAX(i.datahoraexecucao) AS ultima_execucao
      FROM companies c
      LEFT JOIN indices_vendas i ON i.company_id = c.id
      WHERE c.client_id IS NOT NULL
      GROUP BY c.id, c.name, c.client_id
      ORDER BY c.name
    `);

    res.json({ companies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
