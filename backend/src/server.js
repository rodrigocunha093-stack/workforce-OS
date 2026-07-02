require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('./db/postgres');

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

// Middleware de verificação de API Key
async function verifyApiKey(req, res, next) {
  const apiKey = req.body.client_identifier || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(403).json({ error: 'Ação proibida: API Key não fornecida.' });
  }

  try {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const result = await pool.query(
      'SELECT id FROM companies WHERE api_key_hash = $1',
      [hash]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Ação proibida: API Key inválida.' });
    }

    req.company = result.rows[0];
    next();
  } catch (err) {
    console.error('Erro na verificação da API Key:', err.message);
    res.status(500).json({ error: 'Erro interno na verificação de segurança.' });
  }
}

// ===== ROTAS DE AUTENTICAÇÃO =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, orgName } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    // No registro, criamos uma empresa para o usuário se orgName for fornecido
    let companyId;
    const companyResult = await pool.query(
      'INSERT INTO companies (name, api_key_hash) VALUES ($1, $2) RETURNING id',
      [orgName || `${name}'s Company`, crypto.createHash('sha256').update(crypto.randomBytes(32).toString('hex')).digest('hex')]
    );
    companyId = companyResult.rows[0].id;

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, company_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, company_id',
      [name, email, hashedPassword, companyId]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
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
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, company_id: user.company_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS ADMINISTRATIVAS =====

const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// ===== ROTAS DE ESCALA =====

const scheduleRouter = require('./routes/schedule');
app.use('/api/schedule', scheduleRouter);

// ===== ROTAS DE COLABORADORES =====

app.get('/api/employees', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Token expirado ou inválido. Faça login novamente.' });
    }

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      'SELECT * FROM employees WHERE company_id = $1',
      [companyId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
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
app.post('/api/sales_data', verifyApiKey, async (req, res) => {
  // Log temporário para confirmar o formato exato recebido em produção.
  // Remova depois de validar (ou condicione a um DEBUG=true).
  console.log('[sales_data] body recebido:', JSON.stringify(req.body).slice(0, 2000));

  const { type, payload } = extractEnvelope(req.body);

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

    const result = await bulkInsert(
      client,
      'sales_data',
      ['company_id', 'data', 'hora', 'clientes', 'itens', 'valor_total', 'erp_id'],
      records,
      (r) => [
        req.company.id,
        r.data,
        toTimeValue(r.hora),
        r.clientes,
        toItensInteger(r.itens),
        r.valor_total,
        r.erp_id,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${result.rowCount} registro(s) de vendas inserido(s) com sucesso.`,
      inserted: result.rowCount,
      ids: result.rows.map((row) => row.erp_id),
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
  // Log temporário para confirmar o formato exato recebido em produção.
  console.log('[employees/batch] body recebido:', JSON.stringify(req.body).slice(0, 2000));

  const { type, payload } = extractEnvelope(req.body);

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
app.post('/api/setores/batch', verifyApiKey, async (req, res) => {
  // Log temporário para confirmar o formato exato recebido em produção.
  console.log('[setores/batch] body recebido:', JSON.stringify(req.body).slice(0, 2000));

  const { type, payload } = extractEnvelope(req.body);

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
      ['company_id', 'nome', 'corredor', 'erp_id'],
      records,
      (r) => [
        req.company.id,
        r.nome,
        r.corredor ?? null,
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

// ---- POST /api/mercadologicos/batch ----
// Body esperado: array de objetos [{ nome }, ...]
app.post('/api/mercadologicos/batch', verifyApiKey, async (req, res) => {
  // Log temporário para confirmar o formato exato recebido em produção.
  console.log('[mercadologicos/batch] body recebido:', JSON.stringify(req.body).slice(0, 2000));

  const { type, payload } = extractEnvelope(req.body);

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
app.get('/api/config/store-hours', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

    const result = await pool.query(
      'SELECT * FROM store_setup WHERE company_id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.json({
        storeSetup: {
          empresa: null,
          loja: null,
          regimeTributario: null,
          corredores: 1,
          pdvs: 3,
          weekdayHours: '08:00-20:00',
          saturdayHours: '07:00-20:00',
          sundayHours: '09:00-18:00',
          sundayOperation: 'aberto'
        }
      });
    }

    const setup = result.rows[0];
    const storeSetup = {
      empresa: setup.empresa,
      loja: setup.loja,
      regimeTributario: setup.regime_tributario,
      corredores: setup.corredores || 1,
      pdvs: setup.pdvs || 3,
      weekdayHours: setup.weekday_hours || '08:00-20:00',
      saturdayHours: setup.saturday_hours || '07:00-20:00',
      sundayHours: setup.sunday_hours || '09:00-18:00',
      sundayOperation: setup.sunday_operation || 'aberto'
    };

    res.json({ storeSetup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/store-hours - Salva configuração completa da loja
app.post('/api/config/store-hours', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { empresa, loja, regimeTributario, corredores, pdvs, weekdayHours, saturdayHours, sundayHours, sundayOperation } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Criar tabela store_setup se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_setup (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
        empresa VARCHAR(255),
        loja VARCHAR(255),
        regime_tributario VARCHAR(50),
        corredores INTEGER DEFAULT 1,
        pdvs INTEGER DEFAULT 3,
        weekday_hours VARCHAR(11),
        saturday_hours VARCHAR(11),
        sunday_hours VARCHAR(11),
        sunday_operation VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Salvar todos os dados em uma única tabela
    // Pegar o company_id do usuário
    const userResult = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
    const companyId = userResult.rows[0]?.company_id;

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

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`   API em http://localhost:${PORT}/api`);
  console.log(`   Schedule em http://localhost:${PORT}/api/schedule`);
})