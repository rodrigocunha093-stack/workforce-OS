const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/postgres');
const { logActivity } = require('../services/activityLog');
const { listSchedules, updateSchedule, triggerNow } = require('../services/syncScheduler');

const router = express.Router();

// Uso exclusivo da equipe interna Contagil: criação de novas empresas de
// clientes e do primeiro usuário admin de cada uma. O token vem do login
// separado em /api/platform-admin/login (tabela platform_admins, não
// users) e carrega role: 'platform_admin'.
async function requireSuperAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  if (req.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Acesso restrito à equipe Contagil.' });
  }
  try {
    // Usado como "performed_by" nos logs de auditoria abaixo.
    const adminResult = await pool.query('SELECT name FROM platform_admins WHERE id = $1', [req.user.id]);
    req.platformAdminName = adminResult.rows[0]?.name || req.user.email;
    next();
  } catch (err) {
    console.error('Erro ao verificar platform admin:', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
}

router.use(requireSuperAdmin);

// A tela de Sincronização (logs + agendamento) é restrita ao setor NPD
// dentro da própria equipe Contagil — nem todo platform_admin deve ver.
function requireNpd(req, res, next) {
  if (req.user.department !== 'NPD') {
    return res.status(403).json({ error: 'Acesso restrito ao setor NPD.' });
  }
  next();
}

// client_id precisa ser um slug: minúsculas, dígitos e hífens, sem espaço,
// sem ser puramente numérico (pra não ser confundido com o id da empresa).
function isValidClientId(value) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) return false;
  if (/^[0-9-]+$/.test(value)) return false;
  return true;
}

// GET /api/superadmin/companies - Lista todas as empresas da plataforma
router.get('/companies', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.client_id, c.created_at,
             COUNT(u.id)::int AS user_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ companies: result.rows });
  } catch (err) {
    console.error('Erro ao listar empresas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/companies - Cria uma nova empresa de cliente e o
// primeiro usuário admin dela. O client_id fica em branco aqui de
// propósito — é definido depois, na tela de Implantação, a partir do nome
// oficial da empresa que o admin do cliente configurar.
router.post('/companies', async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyName, clientId, adminName, adminEmail, adminPassword } = req.body;

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Nome da empresa, nome, email e senha do admin são obrigatórios.' });
    }

    if (clientId && !isValidClientId(clientId)) {
      return res.status(400).json({ error: 'client_id inválido: use apenas letras minúsculas, números e hífen, sem ser só números.' });
    }

    await client.query('BEGIN');

    const companyResult = await client.query(
      'INSERT INTO companies (name, client_id) VALUES ($1, $2) RETURNING id, name, client_id, created_at',
      [companyName, clientId || null]
    );
    const company = companyResult.rows[0];

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const userResult = await client.query(
      'INSERT INTO users (name, email, password_hash, company_id, is_admin) VALUES ($1, $2, $3, $4, true) RETURNING id, name, email, is_admin',
      [adminName, adminEmail, hashedPassword, company.id]
    );
    const adminUser = userResult.rows[0];

    await client.query('COMMIT');

    await logActivity({
      companyId: company.id,
      userId: adminUser.id,
      eventType: 'user_created',
      description: `${req.platformAdminName} (Contagil) criou a empresa "${company.name}" e o admin ${adminUser.name} (${adminUser.email})`,
      performedBy: req.platformAdminName,
    });

    res.status(201).json({
      message: 'Empresa e usuário admin criados com sucesso.',
      company,
      adminUser,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Já existe uma empresa ou usuário com esses dados.' });
    }
    console.error('Erro ao criar empresa:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/superadmin/companies/:id/client-id - Edita o client_id de uma
// empresa já cadastrada (usado quando o admin do cliente ainda não
// configurou pela Implantação, ou pra corrigir depois).
router.patch('/companies/:id/client-id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.body;

    if (!clientId || !isValidClientId(clientId)) {
      return res.status(400).json({ error: 'client_id inválido: use apenas letras minúsculas, números e hífen, sem ser só números.' });
    }

    const existing = await pool.query('SELECT id FROM companies WHERE client_id = $1 AND id != $2', [clientId, id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Esse client_id já está em uso por outra empresa.' });
    }

    const result = await pool.query(
      'UPDATE companies SET client_id = $1 WHERE id = $2 RETURNING id, name, client_id',
      [clientId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada.' });
    }

    res.json({ message: 'client_id atualizado com sucesso.', company: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar client_id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/companies/:id/users - Lista usuários de uma empresa
router.get('/companies/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, email, is_admin, ativo, created_at FROM users WHERE company_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Erro ao listar usuários:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/companies/:id/users - Cria um usuário para uma
// empresa existente. Diferente de /api/admin/users (que o próprio cliente
// usa), aqui a Contagil pode escolher se o novo usuário também é admin.
router.post('/companies/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, isAdmin } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, company_id, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, is_admin, ativo',
      [name, email, hashedPassword, id, !!isAdmin]
    );
    const newUser = result.rows[0];

    await logActivity({
      companyId: id,
      userId: newUser.id,
      eventType: 'user_created',
      description: `${req.platformAdminName} (Contagil) criou o usuário ${newUser.name} (${newUser.email})`,
      performedBy: req.platformAdminName,
    });

    res.status(201).json({ message: 'Usuário criado com sucesso.', user: newUser });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Já existe um usuário com esse email.' });
    }
    console.error('Erro ao criar usuário:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/superadmin/companies/:id - Exclui uma empresa e seus usuários
router.delete('/companies/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Buscar empresa antes de excluir para log
    const companyResult = await client.query(
      'SELECT id, name FROM companies WHERE id = $1',
      [id]
    );

    if (companyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Empresa não encontrada.'
      });
    }

    const company = companyResult.rows[0];


    // Remove usuários vinculados
    await client.query(
      'DELETE FROM users WHERE company_id = $1',
      [id]
    );


    // Remove empresa
    await client.query(
      'DELETE FROM companies WHERE id = $1',
      [id]
    );


    await client.query('COMMIT');


    await logActivity({
      companyId: id,
      userId: null,
      eventType: 'company_deleted',
      description: `${req.platformAdminName} (Contagil) excluiu a empresa "${company.name}"`,
      performedBy: req.platformAdminName,
    });


    res.json({
      message: 'Empresa excluída com sucesso.'
    });


  } catch (err) {

    await client.query('ROLLBACK');

    console.error('Erro ao excluir empresa:', err.message);

    res.status(500).json({
      error: err.message
    });

  } finally {
    client.release();
  }
});

// DELETE /api/superadmin/users/:id - Exclui um usuário de qualquer empresa
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name, email, company_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const deletedUser = result.rows[0];
    await logActivity({
      companyId: deletedUser.company_id,
      userId: null,
      eventType: 'user_deleted',
      description: `${req.platformAdminName} (Contagil) excluiu o usuário ${deletedUser.name} (${deletedUser.email})`,
      performedBy: req.platformAdminName,
    });

    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/superadmin/users/:id/toggle-ativo - Ativa/desativa um usuário
router.patch('/users/:id/toggle-ativo', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE users SET ativo = NOT ativo WHERE id = $1 RETURNING id, name, email, is_admin, ativo, company_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updatedUser = result.rows[0];
    await logActivity({
      companyId: updatedUser.company_id,
      userId: updatedUser.id,
      eventType: updatedUser.ativo ? 'user_activated' : 'user_deactivated',
      description: `${req.platformAdminName} (Contagil) ${updatedUser.ativo ? 'ativou' : 'desativou'} o usuário ${updatedUser.name} (${updatedUser.email})`,
      performedBy: req.platformAdminName,
    });

    res.json({ message: 'Status atualizado.', user: updatedUser });
  } catch (err) {
    console.error('Erro ao alterar status do usuário:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/companies/:id/logs - Logs de auditoria de qualquer
// empresa (a equipe Contagil pode ver de todas).
router.get('/companies/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, event_type, description, performed_by, created_at FROM activity_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 200',
      [id]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Erro ao listar logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== SINCRONIZAÇÃO: LOGS E AGENDAMENTO =====
// Restrito ao setor NPD, além do requireSuperAdmin já aplicado a todo o router.
router.use('/sync', requireNpd);

// GET /api/superadmin/sync/logs - Histórico de execuções dos jobs de
// sincronização (vendas, mercadologico, setores), com filtros opcionais.
router.get('/sync/logs', async (req, res) => {
  try {
    const { module, clientId, status, dateFrom, dateTo, limit } = req.query;
    const conditions = [];
    const params = [];

    if (module) {
      params.push(module);
      conditions.push(`stl.module = $${params.length}`);
    }
    if (clientId) {
      params.push(clientId);
      conditions.push(`stl.client_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`stl.status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`stl.created_at >= $${params.length}::date`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`stl.created_at < ($${params.length}::date + interval '1 day')`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    const result = await pool.query(
      `SELECT stl.id, stl.module, stl.client_id, stl.company_id, c.name AS company_name,
              stl.task_id, stl.status, stl.consulta_id, stl.message, stl.created_at
       FROM sync_task_logs stl
       LEFT JOIN companies c ON c.id = stl.company_id
       ${where}
       ORDER BY stl.created_at DESC
       LIMIT ${safeLimit}`,
      params
    );

    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Erro ao listar logs de sincronização:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/sync/schedules - Agendamento atual de cada módulo
router.get('/sync/schedules', async (req, res) => {
  try {
    const schedules = await listSchedules();
    res.json({ schedules });
  } catch (err) {
    console.error('Erro ao listar agendamentos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/superadmin/sync/schedules/:module - Atualiza o cron de um módulo
// e já reagenda o job em tempo real, sem precisar reiniciar o servidor.
router.put('/sync/schedules/:module', async (req, res) => {
  try {
    const { module } = req.params;
    const { cronExpression, enabled } = req.body;

    if (!cronExpression) {
      return res.status(400).json({ error: 'cronExpression é obrigatório.' });
    }

    await updateSchedule(module, cronExpression, enabled !== false);
    res.json({ message: 'Agendamento atualizado com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/superadmin/sync/run/:module - Disparo manual, fora do horário
// agendado. Bloqueia se já houver uma execução desse módulo em andamento
// (seja do cron, seja de outro disparo manual). Body opcional:
// { clientIds: ['cliente-a', 'cliente-b'] } — se omitido/vazio, roda pra
// todos os clientes.
router.post('/sync/run/:module', async (req, res) => {
  try {
    const { module } = req.params;
    const { clientIds } = req.body || {};
    triggerNow(module, Array.isArray(clientIds) ? clientIds : null);
    res.json({ message: 'Sincronização disparada. Acompanhe em Logs de sincronização.' });
  } catch (err) {
    if (err.code === 'ALREADY_RUNNING') {
      return res.status(409).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
