require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db/postgres');
const { logActivity } = require('./services/activityLog');
const { syncAllCompanies: syncVendas } = require('./services/syncVendas');
const { syncAllCompanies: syncMercadologico } = require('./services/syncMercadologico');
const { syncAllCompanies: syncSetores } = require('./services/syncSetores');
const { resolveConsulta } = require('./services/syncQueue');
const { initSchedulers } = require('./services/syncScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // payloads em lote podem ser maiores

// Middleware de autenticação (JWT)
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.user = decoded;
    } catch (err) {
      console.error('Token inválido:', err.message);
    }
  }

  next();
});

// Middleware que bloqueia rotas restritas ao admin da empresa do cliente.
// A tela de Implantação e as rotas que ela usa não devem ser acessíveis
// pelo cliente final, apenas por quem configura a conta.
function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

// Middleware simples: qualquer usuário do cliente autenticado (comum ou
// admin), usado nas rotas de autoatendimento do próprio perfil.
function requireAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

// Gera um client_id a partir do nome da empresa (slug), garantindo
// unicidade ao anexar um sufixo numérico em caso de colisão.
function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueClientId(companyName) {
  const base = slugify(companyName) || 'empresa';
  let candidate = base;
  let suffix = 1;

  while (true) {
    const result = await pool.query('SELECT id FROM companies WHERE client_id = $1', [candidate]);
    if (result.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// Identifica a empresa pelo client_id vindo do envelope do agente
async function identifyCompanyByClientId(clientId) {
  try {
    const result = await pool.query(
      'SELECT id FROM companies WHERE client_id = $1',
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (err) {
    console.error('Erro ao identificar empresa pelo client_id:', err.message);
    return null;
  }
}

// ===== ROTAS DE AUTENTICAÇÃO =====
// Não existe mais cadastro público: contas de cliente são criadas pela
// Contagil (rota /api/superadmin/companies) ou por um admin da própria
// empresa adicionando teammates (rota /api/admin/users).

app.post('/api/auth/login', async (req, res) => {
  console.log('[auth/login] body recebido:', JSON.stringify(req.body, null, 2));
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await logActivity({
        companyId: user.company_id,
        userId: user.id,
        eventType: 'login_failed',
        description: `Tentativa de login com senha incorreta para ${user.email}`,
        performedBy: user.name,
      });
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    if (!user.ativo) {
      await logActivity({
        companyId: user.company_id,
        userId: user.id,
        eventType: 'login_blocked',
        description: `Tentativa de login de usuário desativado (${user.email})`,
        performedBy: user.name,
      });
      return res.status(403).json({ error: 'Usuário desativado. Fale com o administrador da sua empresa.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    await logActivity({
      companyId: user.company_id,
      userId: user.id,
      eventType: 'login_success',
      description: `${user.name} fez login`,
      performedBy: user.name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company_id: user.company_id,
        is_admin: user.is_admin,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PERFIL (autoatendimento) =====
// Qualquer usuário logado pode ver/editar seu próprio nome e senha.

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.company_id, u.is_admin, c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/me', requireAuth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Trocar senha exige confirmar a senha atual, por segurança.
    let newPasswordHash = null;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Informe sua senha atual para definir uma nova.' });
      }
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }
      newPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         password_hash = COALESCE($2, password_hash)
       WHERE id = $3
       RETURNING id, name, email, company_id, is_admin`,
      [name || null, newPasswordHash, req.user.id]
    );

    const updatedUser = result.rows[0];

    if (newPasswordHash) {
      await logActivity({
        companyId: updatedUser.company_id,
        userId: updatedUser.id,
        eventType: 'password_changed',
        description: `${updatedUser.name} alterou a própria senha`,
        performedBy: updatedUser.name,
      });
    }

    res.json({ message: 'Perfil atualizado com sucesso.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/platform-admin/login - Login exclusivo da equipe interna
// Contagil, separado da tabela de usuários do cliente. Usa a mesma chave
// JWT_SECRET, mas o token carrega role: 'platform_admin' — só isso dá
// acesso às rotas /api/superadmin/*.
app.post('/api/platform-admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM platform_admins WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'platform_admin', department: admin.department },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, department: admin.department } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS ADMINISTRATIVAS (equipe Contagil) =====

const superadminRouter = require('./routes/superadmin');
app.use('/api/superadmin', superadminRouter);

// ===== ROTAS ADMINISTRATIVAS (admin da empresa do cliente) =====

const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// ===== ROTAS DO CONTROLADOR (calendário de eventos, forecast, etc.) =====

const eventosRouter = require('./routes/eventos');
app.use('/api/eventos', eventosRouter);

const forecastRouter = require('./routes/forecast');
app.use('/api/forecast', forecastRouter);

const controllerCaixaRouter = require('./routes/controllerCaixa');
app.use('/api/controller-caixa', controllerCaixaRouter);

const mercadologicoRouter = require('./routes/mercadologico');
app.use('/api/mercadologico', mercadologicoRouter);

// ===== ROTAS DE SINCRONIZAÇÃO =====

const syncVendasRouter = require('./routes/syncVendas');
app.use('/api/sync', syncVendasRouter);

// POST /api/admin/users - Admin da empresa cria um teammate, sempre
// atrelado automaticamente ao mesmo company_id de quem está criando.
// Só a equipe Contagil (rota /api/superadmin) pode criar usuários admin —
// por isso is_admin aqui é sempre false, não é aceito do body.
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // O JWT não carrega company_id (pode ficar desatualizado se o usuário
    // for movido de empresa), então buscamos sempre do banco.
    const requesterResult = await pool.query('SELECT name, company_id FROM users WHERE id = $1', [req.user.id]);
    const requester = requesterResult.rows[0];

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, company_id, is_admin) VALUES ($1, $2, $3, $4, false) RETURNING id, name, email, company_id, is_admin',
      [name, email, hashedPassword, requester?.company_id]
    );

    const newUser = result.rows[0];
    await logActivity({
      companyId: newUser.company_id,
      userId: newUser.id,
      eventType: 'user_created',
      description: `${requester?.name} criou o usuário ${newUser.name} (${newUser.email})`,
      performedBy: requester?.name,
    });

    res.status(201).json({ message: 'Usuário criado com sucesso.', user: newUser });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Já existe um usuário com esse email.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users - Lista os usuários da própria empresa do admin.
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const requesterResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = requesterResult.rows[0]?.company_id;

    const result = await pool.query(
      'SELECT id, name, email, is_admin, ativo, created_at FROM users WHERE company_id = $1 ORDER BY created_at ASC',
      [companyId]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id - Admin apaga um usuário, mas só da própria
// empresa (nunca de outra) e nunca a própria conta.
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    }

    const requesterResult = await pool.query('SELECT name, company_id FROM users WHERE id = $1', [req.user.id]);
    const requester = requesterResult.rows[0];

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 AND company_id = $2 RETURNING id, name, email',
      [id, requester?.company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado nesta empresa.' });
    }

    const deletedUser = result.rows[0];
    await logActivity({
      companyId: requester.company_id,
      userId: null,
      eventType: 'user_deleted',
      description: `${requester.name} excluiu o usuário ${deletedUser.name} (${deletedUser.email})`,
      performedBy: requester.name,
    });

    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/logs - Logs de auditoria, restritos à própria empresa do
// admin (diferente da versão em /api/superadmin, que vê qualquer empresa).
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const requesterResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [req.user.id]);
    const companyId = requesterResult.rows[0]?.company_id;

    const result = await pool.query(
      'SELECT id, event_type, description, performed_by, created_at FROM activity_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 200',
      [companyId]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS DE ESCALA =====

const scheduleRouter = require('./routes/schedule');
app.use('/api/schedule', scheduleRouter);

// ===== ROTAS DE COLABORADORES =====
// Usadas apenas pela tela de Implantação, restrita a administradores.

app.get('/api/employees', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      `SELECT e.*, m.nome AS setor, m.zona_mapa AS zona_mapa
       FROM employees e
       LEFT JOIN mercadologicos m ON m.id = e.id_mercadologico
       WHERE e.company_id = $1`,
      [companyId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Um cargo que contenha "caixa" ou "operador" já identifica a pessoa como
// operador de frente de caixa (mesma regra do isOperadorCaixa do backend
// de agendamento) — nesse caso o setor é preenchido automaticamente como
// "Caixa", sem o admin precisar criar ou escolher esse setor manualmente.
function isCargoCaixa(cargo) {
  // "operador" sozinho é ambíguo demais (Operador de Loja, Operador de
  // Frios não são caixa) — só "caixa" no cargo é sinal confiável.
  return /caixa/i.test(cargo || '');
}

// Garante que existe um mercadológico "Caixa" pra essa empresa (criado sob
// demanda, com erp_id nulo — igual a qualquer setor manual) e devolve o id.
async function ensureCaixaSetor(companyId) {
  const existing = await pool.query(
    "SELECT id FROM mercadologicos WHERE company_id = $1 AND LOWER(nome) = 'caixa'",
    [companyId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await pool.query(
    "INSERT INTO mercadologicos (company_id, nome) VALUES ($1, 'CAIXA') RETURNING id",
    [companyId]
  );
  return created.rows[0].id;
}

function normalizeKeyServer(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Cargo -> palavra-chave a procurar no nome do mercadológico do cliente.
// Só entram aqui cargos que já identificam um departamento específico sem
// ambiguidade (ex: "Açougueiro" só pode ser Açougue). Cargos genéricos como
// "Repositor" sozinho, sem dizer de quê, ficam de fora de propósito — não
// tem como saber se é Mercearia Doce, Salgada, Seca, Bebidas etc.
const SETOR_KEYWORD_MAP = [
  [/a[cç]ougueiro|a[cç]ougue/i, 'acougue'],
  [/padeiro|padaria/i, 'padaria'],
  [/hortifruti/i, 'hortifruti'],
  [/bebidas/i, 'bebidas'],
  [/confeiteiro|confeitaria/i, 'confeitaria'],
  [/peixeiro|peixaria/i, 'peixaria'],
  [/frios/i, 'frios'],
  [/laticin/i, 'laticin'],
  [/limpeza/i, 'limpeza'],
  [/bazar/i, 'bazar'],
  [/perfumaria/i, 'perfumaria'],
  [/higien/i, 'higien'],
  [/rotisser/i, 'rotisser'],
];

// Tenta inferir o setor a partir do cargo: primeiro checa se é operador de
// caixa (regra própria, sempre resolve pra "Caixa"); senão procura uma
// palavra-chave de departamento específico no cargo e busca, entre os
// mercadológicos reais do cliente, um único que bata — se achar mais de um
// (ex: cargo "Repositor" batendo em várias mercearias) ou nenhum, não
// vincula automaticamente, pra não adivinhar errado.
async function inferSetorIdFromCargo(companyId, cargo) {
  if (isCargoCaixa(cargo)) return ensureCaixaSetor(companyId);

  const match = SETOR_KEYWORD_MAP.find(([re]) => re.test(cargo || ''));
  if (!match) return null;
  const keyword = match[1];

  const all = await pool.query('SELECT id, nome FROM mercadologicos WHERE company_id = $1', [companyId]);
  const candidates = all.rows.filter((m) => normalizeKeyServer(m.nome).includes(keyword));
  return candidates.length === 1 ? candidates[0].id : null;
}

// Importação de equipe via CSV feita pelo próprio admin na tela de
// Implantação (diferente do /api/employees/batch, que é usado pelo agente
// interno com autenticação por client_id). Aceita um array de linhas já
// parseadas no front e insere todas de uma vez.
app.post('/api/employees/import', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma linha para importar.' });
    }

    const inserted = [];
    for (const row of rows) {
      if (!row.nome) continue;
      const idMercadologico = await inferSetorIdFromCargo(companyId, row.cargo);
      const result = await pool.query(
        `INSERT INTO employees (company_id, name, cpf, sexo, cargo, horas_semanais, salario, id_mercadologico)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [companyId, row.nome, row.cpf || null, row.sexo || null, row.cargo || null, row.horas_semanais || null, row.salario || null, idMercadologico]
      );
      inserted.push(result.rows[0]);
    }

    res.json({ inserted: inserted.length, employees: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista os mercadológicos (departamentos) reais do cliente, sincronizados
// do ERP dele — usada pra montar o seletor de setor em Gerenciar Dados
// Importados, em vez de deixar o texto livre bater errado com o catálogo.
app.get('/api/mercadologicos', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      'SELECT id, nome, erp_id, zona_mapa FROM mercadologicos WHERE company_id = $1 ORDER BY nome',
      [companyId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zonas válidas do mapa 3D (StoreFloorMap) — usadas tanto pra validar a
// escolha do admin quanto pro fallback heurístico continuar funcionando
// quando o mercadológico ainda não tem zona_mapa configurada.
const ZONAS_MAPA_VALIDAS = ['acougue', 'padaria', 'hortifruti', 'frios', 'loja', 'recebimento', 'escritorio', 'comercial', 'checkout'];

// Admin escolhe explicitamente em qual "prédio" do mapa 3D aquele
// mercadológico conta — substitui a adivinhação por palavra-chave.
app.put('/api/mercadologicos/:id/zona', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const zona = req.body.zona_mapa || null;
    if (zona !== null && !ZONAS_MAPA_VALIDAS.includes(zona)) {
      return res.status(400).json({ error: `Zona inválida. Use uma de: ${ZONAS_MAPA_VALIDAS.join(', ')}.` });
    }

    const result = await pool.query(
      'UPDATE mercadologicos SET zona_mapa = $1 WHERE id = $2 AND company_id = $3 RETURNING id, nome, zona_mapa',
      [zona, req.params.id, companyId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Setor não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permite ao admin cadastrar manualmente um setor que não existe no
// catálogo sincronizado do ERP (ex: "Caixa", que é função operacional, não
// departamento de produto, então nunca vem do sync de mercadológico).
// erp_id fica null pra diferenciar de um mercadológico sincronizado.
app.post('/api/mercadologicos', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Informe o nome do setor.' });

    const existing = await pool.query(
      'SELECT id, nome, erp_id FROM mercadologicos WHERE company_id = $1 AND LOWER(nome) = LOWER($2)',
      [companyId, nome]
    );
    if (existing.rows[0]) return res.json(existing.rows[0]);

    const result = await pool.query(
      'INSERT INTO mercadologicos (company_id, nome) VALUES ($1, $2) RETURNING id, nome, erp_id',
      [companyId, nome]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Só permite apagar setores cadastrados manualmente pelo admin (erp_id
// nulo) — nunca um mercadológico sincronizado do ERP, que é fonte de
// verdade externa e seria recriado no próximo sync mesmo assim.
app.delete('/api/mercadologicos/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const check = await pool.query(
      'SELECT id, erp_id FROM mercadologicos WHERE id = $1 AND company_id = $2',
      [req.params.id, companyId]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Setor não encontrado.' });
    if (check.rows[0].erp_id !== null) {
      return res.status(403).json({ error: 'Esse setor vem do seu sistema de vendas e não pode ser removido por aqui.' });
    }

    await pool.query('UPDATE employees SET id_mercadologico = NULL WHERE id_mercadologico = $1', [req.params.id]);
    await pool.query('DELETE FROM mercadologicos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const {
      name, nome, cpf, sexo, cargo, id_mercadologico, horas_semanais, salario,
      turno, papel_operacional, proficiencia, setores_aptos, restricoes, folga_preferencial, pode_domingo,
    } = req.body;

    // Se o cargo (novo ou já existente) indicar operador de caixa e essa
    // requisição não escolheu um setor explicitamente, atribui "Caixa"
    // automaticamente — o admin não precisa lembrar de fazer isso na mão.
    // `id_mercadologico` distingue "não veio no body" (undefined, mantém o
    // valor atual) de "veio null" (o admin escolheu 'Sem setor' de propósito
    // e o valor deve ser limpo de verdade) — por isso não usa COALESCE aqui.
    const current = await pool.query('SELECT id_mercadologico, cargo, setores_aptos FROM employees WHERE id = $1 AND company_id = $2', [req.params.id, companyId]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado.' });

    let finalIdMercadologico = id_mercadologico;
    if (id_mercadologico === undefined) {
      const cargoEfetivo = cargo ?? current.rows[0].cargo;
      const inferido = await inferSetorIdFromCargo(companyId, cargoEfetivo);
      finalIdMercadologico = inferido ?? current.rows[0].id_mercadologico;
    }

    // "Setores aptos" nasce incluindo o próprio setor recém-atribuído — o
    // resto (cross-training) o gestor adiciona manualmente depois.
    let finalSetoresAptos = setores_aptos;
    if (setores_aptos === undefined && finalIdMercadologico && finalIdMercadologico !== current.rows[0].id_mercadologico) {
      const setorRow = await pool.query('SELECT nome FROM mercadologicos WHERE id = $1', [finalIdMercadologico]);
      const nomeSetor = setorRow.rows[0]?.nome;
      const existentes = current.rows[0].setores_aptos || [];
      finalSetoresAptos = nomeSetor && !existentes.includes(nomeSetor) ? [...existentes, nomeSetor] : existentes;
    }

    // proficiência não tem default: só grava quando vier explicitamente no
    // body (mesmo vazio, pra permitir limpar de propósito) — por isso usa
    // um CASE com flag em vez de COALESCE (que trataria null como "não
    // informado" e nunca deixaria limpar o campo).
    const proficienciaProvided = proficiencia !== undefined;
    const proficienciaFinal = proficiencia || null;

    const result = await pool.query(
      `UPDATE employees SET
         name = COALESCE($1, name),
         cpf = COALESCE($2, cpf),
         sexo = COALESCE($3, sexo),
         cargo = COALESCE($4, cargo),
         id_mercadologico = $5,
         horas_semanais = COALESCE($6, horas_semanais),
         salario = COALESCE($7, salario),
         turno = COALESCE($8, turno),
         papel_operacional = COALESCE($9, papel_operacional),
         proficiencia = CASE WHEN $10 THEN $11 ELSE proficiencia END,
         setores_aptos = COALESCE($12, setores_aptos),
         restricoes = COALESCE($13, restricoes),
         folga_preferencial = COALESCE($14, folga_preferencial),
         pode_domingo = COALESCE($15, pode_domingo)
       WHERE id = $16 AND company_id = $17
       RETURNING *`,
      [
        name || nome, cpf, sexo, cargo, finalIdMercadologico ?? null, horas_semanais, salario,
        turno, papel_operacional, proficienciaProvided, proficienciaFinal, finalSetoresAptos, restricoes, folga_preferencial, pode_domingo,
        req.params.id, companyId,
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    await pool.query('DELETE FROM employees WHERE id = $1 AND company_id = $2', [req.params.id, companyId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', requireAdmin, async (req, res) => {
  console.log('[employees] body recebido:', JSON.stringify(req.body, null, 2));
  try {
    const userId = req.user?.id;
    const { name, cargo, setor, turno, desempenho, pode_domingo } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      'INSERT INTO employees (company_id, name, cargo, id_setor, turno, desempenho, pode_domingo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [companyId, name, cargo, setor, turno, desempenho, pode_domingo !== false]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS DE INGESTÃO EM LOTE (AGENTE INTERNO) =====
//
// Estas rotas recebem arrays de registros enviados por um agente que roda
// dentro da rede do cliente (não passa pelo fluxo de login/JWT). O agente
// sempre envia user_id = 1, mas aceitamos um user_id explícito por item
// como fallback de segurança caso isso mude no futuro.

const DEFAULT_USER_ID = 1;

// Insere um array de objetos numa tabela usando um único INSERT em lote,
// dentro de uma transação. `columns` define a ordem das colunas no SQL;
// `mapRow` extrai os valores de cada item do array na mesma ordem.
async function bulkInsert(client, table, columns, rows, mapRow) {
  const valuesSql = [];
  const params = [];
  let paramIndex = 1;

  for (const row of rows) {
    const values = mapRow(row);
    const placeholders = values.map(() => `$${paramIndex++}`);
    valuesSql.push(`(${placeholders.join(', ')})`);
    params.push(...values);
  }

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${valuesSql.join(', ')}
    RETURNING id
  `;

  return client.query(sql, params);
}

// Insere linhas de sales_data somando nos valores existentes quando já há
// um registro pra mesma empresa+data+hora (constraint UNIQUE), em vez de
// criar uma linha duplicada. Necessário porque o agente reenvia vendas
// incrementais dentro da mesma hora em capturas sucessivas.
//
// Linhas repetidas dentro do MESMO lote (mesma empresa+data+hora) também são
// somadas antes do INSERT, porque o Postgres não permite que um ON CONFLICT
// DO UPDATE afete a mesma linha duas vezes num único comando.
async function upsertSalesData(client, companyId, records) {
  const merged = new Map();
  for (const r of records) {
    const key = `${r.data}|${r.hora}`;
    const existing = merged.get(key);
    if (existing) {
      existing.clientes += r.clientes;
      existing.itens += r.itens;
      existing.valor_total += r.valor_total;
    } else {
      merged.set(key, { ...r });
    }
  }

  const valuesSql = [];
  const params = [];
  let paramIndex = 1;

  for (const r of merged.values()) {
    valuesSql.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    params.push(companyId, r.data, r.hora, r.clientes, r.itens, r.valor_total);
  }

  const sql = `
    INSERT INTO sales_data (company_id, data, hora, clientes, itens, valor_total)
    VALUES ${valuesSql.join(', ')}
    ON CONFLICT (company_id, data, hora) DO UPDATE SET
      clientes = sales_data.clientes + EXCLUDED.clientes,
      itens = sales_data.itens + EXCLUDED.itens,
      valor_total = sales_data.valor_total + EXCLUDED.valor_total
    RETURNING id
  `;

  return client.query(sql, params);
}

// O agente agora envia o ENVELOPE COMPLETO (depois da correção de
// serialização no lado Python), no formato:
//
// {
//   id: "...",
//   type: "RESULT_DATA" | "RESULT_DONE" | "RESULT_ERROR" | ...,
//   payload: { ... conteúdo específico de cada tipo ... },
//   timestamp: "...",
//   correlation_id: "...",
//   agent_id: "..."
// }
//
// Para RESULT_DATA, payload é { execution_id, page_number, columns, rows, ... }.
// Para RESULT_DONE, payload é { execution_id, total_rows, total_pages }.
// Para RESULT_ERROR, payload é { execution_id, message }.
//
// Mantemos compatibilidade com corpos "nus" (sem envelope) também, caso
// algum chamador antigo ainda mande direto um array ou { columns, rows }.
function extractEnvelope(body) {
  if (body && typeof body === 'object' && typeof body.type === 'string' && body.payload) {
    return { type: body.type.toUpperCase(), payload: body.payload };
  }
  return { type: null, payload: body };
}

// `columns`/`rows` -> lista de objetos { nome: valor }. Aceita também um
// array de objetos já pronto.
function normalizeBatchPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.columns) && Array.isArray(payload.rows)) {
    return payload.rows.map((row) => {
      const obj = {};
      payload.columns.forEach((colName, i) => {
        obj[colName] = row[i];
      });
      return obj;
    });
  }

  return null;
}

// ---- POST /api/sales_data ----
app.post('/api/sales_data', async (req, res) => {
  const { type, payload } = extractEnvelope(req.body);

  // Extrair client_id do envelope e validar ANTES de logar/processar
  // qualquer dado de negócio (evita expor dados de vendas de agentes
  // não identificados nos logs do servidor).
  const clientId = req.body.client_id || payload?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'client_id não fornecido no envelope.' });
  }

  const company = await identifyCompanyByClientId(clientId);
  if (!company) {
    console.warn(`[sales_data] client_id desconhecido, requisição rejeitada: ${clientId}`);
    return res.status(404).json({ error: `Nenhuma empresa encontrada para o client_id: ${clientId}` });
  }
  req.company = company;

  // Job desse client_id concluído no agente: libera a vaga na fila de sync
  // pra que o próximo job enfileirado (se houver) possa ser disparado.
  resolveConsulta(req.body.consulta_id || payload?.consulta_id);

  // Discriminar pelo task_id: pode ser 'venda' ou 'indices-escala-vendas'
  const taskId = payload?.task_id;

  // Se for a tarefa de índice, extrai o MAX(id) e grava em indices_vendas
  if (taskId === 'indices-escala-vendas') {
    const records = normalizeBatchPayload(payload);
    if (records.length > 0 && records[0].max !== undefined) {
      const maxId = records[0].max;
      try {
        await pool.query(
          'INSERT INTO indices_vendas (company_id, ultimo_id) VALUES ($1, $2) ON CONFLICT (company_id) DO UPDATE SET ultimo_id = $2, datahoraexecucao = NOW()',
          [req.company.id, Number(maxId)]
        );
        return res.status(200).json({ message: 'Índice de vendas registrado com sucesso.' });
      } catch (err) {
        console.error('[sales_data] Erro ao gravar índice:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(200).json({ message: 'Nenhum índice pra registrar.' });
  }

  // Se for a tarefa de vendas, continua no fluxo normal de sales_data
  if (taskId !== 'venda') {
    console.warn(`[sales_data] task_id desconhecido: ${taskId}`);
    return res.status(400).json({ error: `Task ID não suportado: ${taskId}` });
  }

  // Mensagens de controle do agente: apenas confirmar recebimento,
  // não há nada a inserir nelas.
  if (type && type.includes('DONE')) {
    return res.status(200).json({
      message: 'Execução concluída (recebido).',
      total_rows: payload?.total_rows,
    });
  }

  if (type && type.includes('ERROR')) {
    console.error('[sales_data] Agente reportou erro de execução:', payload?.message);
    return res.status(200).json({ message: 'Erro do agente registrado nos logs.' });
  }

  const records = normalizeBatchPayload(payload);

  if (!records) {
    console.error('[sales_data] 400 - formato não reconhecido. payload recebido:', payload);
    return res.status(400).json({
      error: 'Formato de payload não reconhecido. Esperado array de objetos ou { columns, rows }.',
    });
  }

  // Página vazia é situação normal (ex.: query sem resultados, ou página
  // final sem linhas) — não é erro do cliente.
  if (records.length === 0) {
    return res.status(200).json({ message: 'Nenhum registro nesta página.', inserted: 0 });
  }

  // Validação básica de cada registro antes de tocar no banco.
  // Atenção: usar === undefined/null em vez de !valor, porque hora=0 e
  // clientes=0 são valores válidos (e "falsy" em JS).
  const errors = [];
  records.forEach((r, idx) => {
    if (r.data === undefined || r.data === null) errors.push(`Item ${idx}: campo "data" é obrigatório.`);
    if (r.hora === undefined || r.hora === null) errors.push(`Item ${idx}: campo "hora" é obrigatório.`);
    if (r.clientes === undefined || r.clientes === null) errors.push(`Item ${idx}: campo "clientes" é obrigatório.`);
    if (r.itens === undefined || r.itens === null) errors.push(`Item ${idx}: campo "itens" é obrigatório.`);
    if (r.valor_total === undefined || r.valor_total === null) errors.push(`Item ${idx}: campo "valor_total" é obrigatório.`);
  });

  if (errors.length > 0) {
    // Antes, esse motivo só ia pro agente (na resposta), nunca aparecia
    // aqui no terminal do backend — por isso o 400 parecia "sem causa".
    console.error('[sales_data] 400 - registros inválidos:', errors);
    return res.status(400).json({ error: 'Registros inválidos.', details: errors });
  }

  // A query SQL usa EXTRACT(HOUR FROM ...), que retorna um número (0-23),
  // não um horário. A coluna no banco é TIME, então convertemos aqui.
  // Se "hora" já vier como string "HH:MM:SS" (outro formato de query),
  // passamos direto sem alterar.
  function toTimeValue(hora) {
    if (typeof hora === 'number') {
      const h = String(Math.trunc(hora)).padStart(2, '0');
      return `${h}:00:00`;
    }
    return hora;
  }

  // SUM(quantidade) na query pode vir fracionário (ex: "436.233", itens
  // vendidos por peso), mas a coluna "itens" no banco é INTEGER.
  // Por decisão de negócio: truncar pra baixo (sempre arredondar para menos).
  function toItensInteger(itens) {
    const num = typeof itens === 'string' ? parseFloat(itens) : itens;
    return Math.floor(num);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalized = records.map((r) => ({
      data: r.data,
      hora: toTimeValue(r.hora),
      clientes: r.clientes,
      itens: toItensInteger(r.itens),
      valor_total: r.valor_total,
    }));

    const result = await upsertSalesData(client, req.company.id, normalized);

    // O job `indices-escala-vendas` executa SELECT MAX(id) e retorna o
    // resultado como "max_id" no payload. Gravamos aqui pra usar na
    // próxima execução de vendas como id_inicio (WHERE id > ultimo_id).
    const maxId = req.body.max_id ?? payload?.max_id;
    if (maxId !== undefined && maxId !== null) {
      await client.query(
        'INSERT INTO indices_vendas (company_id, ultimo_id) VALUES ($1, $2)',
        [req.company.id, Number(maxId)]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${result.rowCount} registro(s) de vendas processado(s) com sucesso.`,
      inserted: result.rowCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao inserir sales_data em lote:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- POST /api/employees (lote) ----
// Body esperado: array de objetos
// [{ user_id, name, cargo, setor, turno, proficiencia, pode_domingo,
//    folga_preferencial, desempenho }, ...]
//
// Observação: já existe um POST /api/employees acima para inserção
// individual via usuário autenticado (JWT). Como o agente interno envia
// LOTES e não tem token, usamos uma rota separada para não conflitar
// com aquele fluxo.
app.post('/api/employees/batch', async (req, res) => {
  const { type, payload } = extractEnvelope(req.body);

  // Extrair client_id do envelope e validar ANTES de logar/processar
  // qualquer dado de negócio.
  const clientId = req.body.client_id || payload?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'client_id não fornecido no envelope.' });
  }

  const company = await identifyCompanyByClientId(clientId);
  if (!company) {
    console.warn(`[employees/batch] client_id desconhecido, requisição rejeitada: ${clientId}`);
    return res.status(404).json({ error: `Nenhuma empresa encontrada para o client_id: ${clientId}` });
  }
  req.company = company;

  console.log('[employees/batch] body recebido:', JSON.stringify(req.body, null, 2));

  if (type && type.includes('DONE')) {
    return res.status(200).json({
      message: 'Execução concluída (recebido).',
      total_rows: payload?.total_rows,
    });
  }

  if (type && type.includes('ERROR')) {
    console.error('[employees/batch] Agente reportou erro de execução:', payload?.message);
    return res.status(200).json({ message: 'Erro do agente registrado nos logs.' });
  }

  const records = normalizeBatchPayload(payload);

  if (!records) {
    console.error('[employees/batch] 400 - formato não reconhecido. payload recebido:', payload);
    return res.status(400).json({
      error: 'Formato de payload não reconhecido. Esperado array de objetos ou { columns, rows }.',
    });
  }

  if (records.length === 0) {
    return res.status(200).json({ message: 'Nenhum registro nesta página.', inserted: 0 });
  }

  const errors = [];
  records.forEach((r, idx) => {
    if (!r.name) errors.push(`Item ${idx}: campo "name" é obrigatório.`);
    if (!r.cargo) errors.push(`Item ${idx}: campo "cargo" é obrigatório.`);
    if (!r.setor) errors.push(`Item ${idx}: campo "setor" é obrigatório.`);
    if (!r.turno) errors.push(`Item ${idx}: campo "turno" é obrigatório.`);
  });

  if (errors.length > 0) {
    console.error('[employees/batch] 400 - registros inválidos:', errors);
    return res.status(400).json({ error: 'Registros inválidos.', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await bulkInsert(
      client,
      'employees',
      [
        'user_id',
        'name',
        'cargo',
        'setor',
        'proficiencia',
        'turno',
        'pode_domingo',
        'folga_preferencial',
        'desempenho',
      ],
      records,
      (r) => [
        r.user_id ?? DEFAULT_USER_ID,
        r.name,
        r.cargo,
        r.setor,
        r.proficiencia ?? null,
        r.turno,
        r.pode_domingo ?? false,
        r.folga_preferencial ?? null,
        r.desempenho ?? null,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${result.rowCount} colaborador(es) inserido(s) com sucesso.`,
      inserted: result.rowCount,
      ids: result.rows.map((row) => row.erp_id),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao inserir employees em lote:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- POST /api/setores/batch ----
// Body esperado: array de objetos [{ nome, corredor }, ...]
app.post('/api/setores/batch', async (req, res) => {
  const { type, payload } = extractEnvelope(req.body);

  // Extrair client_id do envelope e validar ANTES de logar/processar
  // qualquer dado de negócio.
  const clientId = req.body.client_id || payload?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'client_id não fornecido no envelope.' });
  }

  const company = await identifyCompanyByClientId(clientId);
  if (!company) {
    console.warn(`[setores/batch] client_id desconhecido, requisição rejeitada: ${clientId}`);
    return res.status(404).json({ error: `Nenhuma empresa encontrada para o client_id: ${clientId}` });
  }
  req.company = company;

  resolveConsulta(req.body.consulta_id || payload?.consulta_id);

  if (type && type.includes('DONE')) {
    return res.status(200).json({
      message: 'Execução concluída (recebido).',
      total_rows: payload?.total_rows,
    });
  }

  if (type && type.includes('ERROR')) {
    console.error('[setores/batch] Agente reportou erro de execução:', payload?.message);
    return res.status(200).json({ message: 'Erro do agente registrado nos logs.' });
  }

  const records = normalizeBatchPayload(payload);

  if (!records) {
    console.error('[setores/batch] 400 - formato não reconhecido. payload recebido:', payload);
    return res.status(400).json({
      error: 'Formato de payload não reconhecido. Esperado array de objetos ou { columns, rows }.',
    });
  }

  if (records.length === 0) {
    return res.status(200).json({ message: 'Nenhum registro nesta página.', inserted: 0 });
  }

  const errors = [];
  records.forEach((r, idx) => {
    if (!r.nome) errors.push(`Item ${idx}: campo "nome" é obrigatório.`);
  });

  if (errors.length > 0) {
    console.error('[setores/batch] 400 - registros inválidos:', errors);
    return res.status(400).json({ error: 'Registros inválidos.', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await bulkInsert(
      client,
      'setores',
      ['company_id', 'nome', 'erp_id'],
      records,
      (r) => [
        req.company.id,
        r.nome,
        r.erp_id ?? null,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${result.rowCount} setor(es) inserido(s) com sucesso.`,
      inserted: result.rowCount,
      ids: result.rows.map((row) => row.erp_id),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao inserir setores em lote:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- POST /api/vendas-mercadologico/batch ----
// Body esperado: array de objetos
// [{ data, mercadologico_id, mercadologico_nome, quantidade, venda }, ...]
// Vem da task "vendas-por-mercadologico" (consulta a tabela venda + produto
// no VRSoft do cliente, com quantidade física real). Alimenta o dashboard
// ICOS da aba Setores/Mercadológico. Upsert (não insert simples) porque a
// venda do dia pode ser corrigida retroativamente — reenviar o mesmo dia
// deve atualizar, não duplicar.
app.post('/api/vendas-mercadologico/batch', async (req, res) => {
  const { type, payload } = extractEnvelope(req.body);

  const clientId = req.body.client_id || payload?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'client_id não fornecido no envelope.' });
  }

  const company = await identifyCompanyByClientId(clientId);
  if (!company) {
    console.warn(`[vendas-mercadologico/batch] client_id desconhecido, requisição rejeitada: ${clientId}`);
    return res.status(404).json({ error: `Nenhuma empresa encontrada para o client_id: ${clientId}` });
  }
  req.company = company;

  resolveConsulta(req.body.consulta_id || payload?.consulta_id);

  if (type && type.includes('DONE')) {
    return res.status(200).json({
      message: 'Execução concluída (recebido).',
      total_rows: payload?.total_rows,
    });
  }

  if (type && type.includes('ERROR')) {
    console.error('[vendas-mercadologico/batch] Agente reportou erro de execução:', payload?.message);
    return res.status(200).json({ message: 'Erro do agente registrado nos logs.' });
  }

  const records = normalizeBatchPayload(payload);

  if (!records) {
    console.error('[vendas-mercadologico/batch] 400 - formato não reconhecido. payload recebido:', payload);
    return res.status(400).json({
      error: 'Formato de payload não reconhecido. Esperado array de objetos ou { columns, rows }.',
    });
  }

  if (records.length === 0) {
    return res.status(200).json({ message: 'Nenhum registro nesta página.', inserted: 0 });
  }

  const errors = [];
  records.forEach((r, idx) => {
    if (!r.data) errors.push(`Item ${idx}: campo "data" é obrigatório.`);
    if (!r.mercadologico_nome) errors.push(`Item ${idx}: campo "mercadologico_nome" é obrigatório.`);
    if (r.venda === undefined || r.venda === null) errors.push(`Item ${idx}: campo "venda" é obrigatório.`);
  });

  if (errors.length > 0) {
    console.error('[vendas-mercadologico/batch] 400 - registros inválidos:', errors);
    return res.status(400).json({ error: 'Registros inválidos.', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    for (const r of records) {
      await client.query(
        `INSERT INTO sales_by_mercadologico (company_id, data, erp_mercadologico_id, mercadologico_nome, quantidade, venda)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, mercadologico_nome, data) DO UPDATE SET
           venda = $6,
           quantidade = $5,
           erp_mercadologico_id = $3`,
        [req.company.id, r.data, r.mercadologico_id ?? null, r.mercadologico_nome, r.quantidade ?? 0, r.venda]
      );
      inserted += 1;
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `${inserted} registro(s) de venda por mercadológico processado(s) com sucesso.`,
      inserted,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao inserir venda por mercadológico em lote:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- POST /api/mercadologicos/batch ----
// Body esperado: array de objetos [{ nome }, ...]
app.post('/api/mercadologicos/batch', async (req, res) => {
  const { type, payload } = extractEnvelope(req.body);

  // Extrair client_id do envelope e validar ANTES de logar/processar
  // qualquer dado de negócio.
  const clientId = req.body.client_id || payload?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'client_id não fornecido no envelope.' });
  }

  const company = await identifyCompanyByClientId(clientId);
  if (!company) {
    console.warn(`[mercadologicos/batch] client_id desconhecido, requisição rejeitada: ${clientId}`);
    return res.status(404).json({ error: `Nenhuma empresa encontrada para o client_id: ${clientId}` });
  }
  req.company = company;

  resolveConsulta(req.body.consulta_id || payload?.consulta_id);

  if (type && type.includes('DONE')) {
    return res.status(200).json({
      message: 'Execução concluída (recebido).',
      total_rows: payload?.total_rows,
    });
  }

  if (type && type.includes('ERROR')) {
    console.error('[mercadologicos/batch] Agente reportou erro de execução:', payload?.message);
    return res.status(200).json({ message: 'Erro do agente registrado nos logs.' });
  }

  const records = normalizeBatchPayload(payload);

  if (!records) {
    console.error('[mercadologicos/batch] 400 - formato não reconhecido. payload recebido:', payload);
    return res.status(400).json({
      error: 'Formato de payload não reconhecido. Esperado array de objetos ou { columns, rows }.',
    });
  }

  if (records.length === 0) {
    return res.status(200).json({ message: 'Nenhum registro nesta página.', inserted: 0 });
  }

  const errors = [];
  records.forEach((r, idx) => {
    if (!r.nome) errors.push(`Item ${idx}: campo "nome" é obrigatório.`);
  });

  if (errors.length > 0) {
    console.error('[mercadologicos/batch] 400 - registros inválidos:', errors);
    return res.status(400).json({ error: 'Registros inválidos.', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await bulkInsert(
      client,
      'mercadologicos',
      ['company_id', 'nome', 'erp_id'],
      records,
      (r) => [req.company.id, r.nome, r.erp_id ?? null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${result.rowCount} mercadológico(s) inserido(s) com sucesso.`,
      inserted: result.rowCount,
      ids: result.rows.map((row) => row.erp_id),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao inserir mercadologicos em lote:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/config/store-hours - Retorna configuração completa da loja
// Usada apenas pela tela de Implantação, restrita a administradores.
app.get('/api/config/store-hours', requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const [result, companyResult] = await Promise.all([
      pool.query('SELECT * FROM store_setup WHERE company_id = $1', [companyId]),
      pool.query('SELECT client_id, name FROM companies WHERE id = $1', [companyId]),
    ]);

    const clientId = companyResult.rows[0]?.client_id || null;
    const companyName = companyResult.rows[0]?.name || null;

    if (result.rows.length === 0) {
      return res.json({
        storeSetup: {
          empresa: companyName,
          loja: null,
          regimeTributario: null,
          corredores: 1,
          pdvs: null,
          weekdayHours: null,
          saturdayHours: null,
          sundayHours: null,
          sundayOperation: null
        },
        clientId
      });
    }

    const setup = result.rows[0];
    const storeSetup = {
      empresa: setup.empresa || companyName,
      loja: setup.loja,
      regimeTributario: setup.regime_tributario,
      corredores: setup.corredores || 1,
      pdvs: setup.pdvs || null,
      weekdayHours: setup.weekday_hours || null,
      saturdayHours: setup.saturday_hours || null,
      sundayHours: setup.sunday_hours || null,
      sundayOperation: setup.sunday_operation || null
    };

    res.json({ storeSetup, clientId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/store-hours - Salva configuração completa da loja
// Usada apenas pela tela de Implantação, restrita a administradores.
app.post('/api/config/store-hours', requireAdmin, async (req, res) => {
  console.log('[config/store-hours] body recebido:', JSON.stringify(req.body, null, 2));
  try {
    const userId = req.user?.id;
    const { empresa, loja, regimeTributario, corredores, pdvs, weekdayHours, saturdayHours, sundayHours, sundayOperation } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Salvar todos os dados em uma única tabela
    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    // O nome informado aqui pelo admin é o nome "oficial" da empresa. O
    // client_id é derivado dele, mas só na PRIMEIRA vez (empresa ainda sem
    // client_id) — depois disso fica travado, pois o agente do cliente já
    // pode estar configurado com esse valor e não deve mudar sozinho.
    if (empresa) {
      const companyRow = await pool.query('SELECT client_id FROM companies WHERE id = $1', [companyId]);
      const currentClientId = companyRow.rows[0]?.client_id;

      if (!currentClientId) {
        const newClientId = await generateUniqueClientId(empresa);
        await pool.query('UPDATE companies SET name = $1, client_id = $2 WHERE id = $3', [empresa, newClientId, companyId]);
      } else {
        await pool.query('UPDATE companies SET name = $1 WHERE id = $2', [empresa, companyId]);
      }
    }

    await pool.query(
      `INSERT INTO store_setup (company_id, empresa, loja, regime_tributario, corredores, pdvs, weekday_hours, saturday_hours, sunday_hours, sunday_operation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (company_id) DO UPDATE SET
         empresa = $2,
         loja = $3,
         regime_tributario = $4,
         corredores = $5,
         pdvs = $6,
         weekday_hours = $7,
         saturday_hours = $8,
         sunday_hours = $9,
         sunday_operation = $10,
         updated_at = CURRENT_TIMESTAMP`,
      [companyId, empresa, loja, regimeTributario, corredores || 1, pdvs || 3, weekdayHours, saturdayHours, sundayHours, sundayOperation]
    );

    res.json({ success: true, message: 'Configuração da loja salva com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indices', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const [vendas, setoresResult, mercadologicosResult] = await Promise.all([
      pool.query('SELECT MAX(erp_id) AS max FROM sales_data WHERE company_id = $1', [companyId]),
      pool.query('SELECT MAX(erp_id) AS max FROM setores WHERE company_id = $1', [companyId]),
      pool.query('SELECT MAX(erp_id) AS max FROM mercadologicos WHERE company_id = $1', [companyId]),
    ]);

    res.json({
      indices: {
        'ultima-venda': vendas.rows[0].max,
        'ultimo-setor': setoresResult.rows[0].max,
        'ultimo-mercadologico': mercadologicosResult.rows[0].max,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== HEALTH CHECK =====

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== SCHEDULER DE SINCRONIZAÇÃO =====
// Horários agora vêm da tabela sync_schedules (editável pela rota
// administrativa /admin-plataforma), não mais direto do .env. Na primeira
// subida, o .env é usado só como semente inicial — veja syncScheduler.js.

initSchedulers([
  { module: 'vendas', fn: syncVendas },
  { module: 'mercadologico', fn: syncMercadologico },
  { module: 'setores', fn: syncSetores },
]).catch((err) => console.error('Erro ao iniciar schedulers de sincronização:', err.message));

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`   API em http://localhost:${PORT}/api`);
  console.log(`   Sincronização manual: GET /api/sync/vendas`);
  console.log(`   Status: GET /api/sync/status`);
})