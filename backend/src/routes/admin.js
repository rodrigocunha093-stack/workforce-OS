const express = require('express');
const crypto = require('crypto');
const pool = require('../db/postgres');

const router = express.Router();

// Middleware para verificar se o usuário é administrador
// Para este MVP, consideramos que qualquer usuário autenticado pode gerenciar sua própria empresa
async function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Não autenticado. Faça login para acessar.' });
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

    // Obter informações da empresa (sem retornar o hash da API key)
    const companyResult = await pool.query(
      'SELECT id, name, created_at FROM companies WHERE id = $1',
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

    // Gerar uma API key aleatória e fazer hash
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const result = await pool.query(
      'INSERT INTO companies (name, api_key_hash) VALUES ($1, $2) RETURNING id, name, created_at',
      [name, apiKeyHash]
    );

    const company = result.rows[0];

    res.status(201).json({
      message: 'Empresa criada com sucesso.',
      company: {
        id: company.id,
        name: company.name,
        created_at: company.created_at,
      },
      api_key: apiKey, // Retornar a chave apenas uma vez na criação
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

// GET /api/admin/companies/:id/api-keys - Obter informações da API key (sem retornar o hash)
router.get('/companies/:id/api-keys', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem permissão para acessar esta empresa
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].company_id !== parseInt(id)) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar as API keys desta empresa.' });
    }

    // Retornar apenas informações sobre a existência da API key, sem o hash
    const result = await pool.query(
      'SELECT id, name, created_at FROM companies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({
      company: result.rows[0],
      message: 'A empresa possui uma API key ativa. Use a rota de regeneração para obter uma nova chave.',
    });
  } catch (err) {
    console.error('Erro ao obter API keys:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/companies/:id/api-keys/regenerate - Regenerar API key
router.post('/companies/:id/api-keys/regenerate', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem permissão para regenerar a API key desta empresa
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].company_id !== parseInt(id)) {
      return res.status(403).json({ error: 'Você não tem permissão para regenerar a API key desta empresa.' });
    }

    // Gerar uma nova API key e fazer hash
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const result = await pool.query(
      'UPDATE companies SET api_key_hash = $1 WHERE id = $2 RETURNING id, name, created_at',
      [apiKeyHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({
      message: 'API key regenerada com sucesso.',
      company: result.rows[0],
      api_key: apiKey, // Retornar a chave apenas uma vez
      warning: 'Guarde esta chave em um local seguro. Ela não será exibida novamente.',
    });
  } catch (err) {
    console.error('Erro ao regenerar API key:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
