const { Pool } = require('pg');

const config = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'meu_sistema',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 2500,
  idleTimeoutMillis: 10000,
  max: 5
};

const pool = new Pool(config);

async function relationExists(name) {
  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [name]);
  return result.rows[0].exists;
}

async function status() {
  if (!config.password) {
    return {
      connected: false,
      host: config.host,
      port: config.port,
      database: config.database,
      error: 'Senha não configurada. Defina PGPASSWORD antes de iniciar o dashboard.'
    };
  }
  try {
    const result = await pool.query('SELECT current_database() AS database, current_user AS usuario, version() AS versao');
    return {
      connected: true,
      host: config.host,
      port: config.port,
      database: result.rows[0].database,
      usuario: result.rows[0].usuario,
      versao: result.rows[0].versao.split(',')[0]
    };
  } catch (error) {
    return {
      connected: false,
      host: config.host,
      port: config.port,
      database: config.database,
      error: error.message
    };
  }
}

async function loadDemandRows() {
  if (!(await relationExists('vw_demanda_caixa_vrsoft_hora'))) return [];
  const result = await pool.query(`
    SELECT
      data_referencia::text,
      to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
      to_char(hora_fim, 'HH24:MI') AS hora_fim,
      quantidade_cupons,
      venda_liquida,
      fora_horario_operacional,
      caixas_necessarios
    FROM vw_demanda_caixa_vrsoft_hora
    ORDER BY data_referencia, hora_inicio
  `);
  return result.rows;
}

async function loadScenarios() {
  if (!(await relationExists('cenarios_escala'))) return [];
  const result = await pool.query(`
    SELECT id, nome, tipo_escala, horas_semanais, dias_trabalho_semana, dias_folga_semana
    FROM cenarios_escala
    ORDER BY horas_semanais DESC
  `);
  return result.rows;
}

async function appPersistenceStatus() {
  const connection = await status();
  if (!connection.connected) return { mode: 'local', ready: false, reason: connection.error };
  const required = ['app_organizations', 'app_users', 'app_client_states', 'app_sessions', 'app_audit_events'];
  const existing = [];
  for (const relation of required) {
    if (await relationExists(relation)) existing.push(relation);
  }
  let counts = {};
  if (existing.length === required.length) {
    const result = await pool.query(`
      SELECT
        (SELECT count(*) FROM app_organizations)::int AS organizations,
        (SELECT count(*) FROM app_users)::int AS users,
        (SELECT count(*) FROM app_client_states)::int AS client_states,
        (SELECT count(*) FROM app_audit_events)::int AS audit_events
    `);
    counts = result.rows[0];
  }
  return { mode: existing.length === required.length ? 'postgresql-ready' : 'local', ready: existing.length === required.length, existing, required, ...counts };
}

module.exports = { pool, status, loadDemandRows, loadScenarios, appPersistenceStatus };
