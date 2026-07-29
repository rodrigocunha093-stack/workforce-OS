const express = require('express');
const pool = require('../db/postgres');

const router = express.Router();

// Esta área é de uso exclusivo da equipe interna Contagil (configuração de
// clientes, geração de client_id para os agentes). Exige usuário admin.
async function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Não autenticado. Faça login para acessar.' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// GET /api/admin/companies - Listar todas as empresas (apenas para super admin)
// Por enquanto, retorna a empresa do usuário autenticado
router.get('/companies', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obter a empresa do usuário
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const companyId = userResult.rows[0].company_id;

    // Obter informações da empresa, incluindo client_id (usado na
    // configuração do agente)
    const companyResult = await pool.query(
      'SELECT id, name, client_id, created_at FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({ companies: companyResult.rows });
  } catch (err) {
    console.error('Erro ao listar empresas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/companies - Criar nova empresa (apenas para super admin)
// Por enquanto, permite criar uma empresa associada ao usuário
router.post('/companies', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
    }

    const result = await pool.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING id, name, created_at',
      [name]
    );

    const company = result.rows[0];

    res.status(201).json({
      message: 'Empresa criada com sucesso.',
      company: {
        id: company.id,
        name: company.name,
        created_at: company.created_at,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Uma empresa com esse nome já existe.' });
    }
    console.error('Erro ao criar empresa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/companies/:id - Editar empresa
router.put('/companies/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Nome da empresa é obrigatório.' });
    }

    // Verificar se o usuário tem permissão para editar esta empresa
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].company_id !== parseInt(id)) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta empresa.' });
    }

    const result = await pool.query(
      'UPDATE companies SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({
      message: 'Empresa atualizada com sucesso.',
      company: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Uma empresa com esse nome já existe.' });
    }
    console.error('Erro ao atualizar empresa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/companies/:id - Deletar empresa
router.delete('/companies/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem permissão para deletar esta empresa
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].company_id !== parseInt(id)) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta empresa.' });
    }

    const result = await pool.query(
      'DELETE FROM companies WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({
      message: 'Empresa deletada com sucesso.',
      company: result.rows[0],
    });
  } catch (err) {
    console.error('Erro ao deletar empresa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/companies/:id/client-id - Obter o client_id usado para
// configurar o agente do cliente (AGENTE-VR). Uso interno da equipe Contagil.
router.get('/companies/:id/client-id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem permissão para acessar esta empresa
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].company_id !== parseInt(id)) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar esta empresa.' });
    }

    const result = await pool.query(
      'SELECT id, name, client_id, created_at FROM companies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({ company: result.rows[0] });
  } catch (err) {
    console.error('Erro ao obter client_id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
