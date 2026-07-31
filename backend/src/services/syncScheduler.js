// Gerencia os cron jobs de sincronização (vendas, mercadologico, setores) a
// partir da tabela sync_schedules, permitindo reconfigurar o horário em
// tempo real (via rota administrativa) sem precisar reiniciar o servidor.
const cron = require('node-cron');
const pool = require('../db/postgres');

const MODULES = ['vendas', 'mercadologico', 'setores'];
const DEFAULT_CRON = '0 6 * * *';
const ENV_KEYS = {
  vendas: 'SYNC_VENDAS_SCHEDULES',
  mercadologico: 'SYNC_MERCADOLOGICO_SCHEDULES',
  setores: 'SYNC_SETORES_SCHEDULES',
};

const tasks = new Map(); // module -> cron ScheduledTask ativo
const jobFns = new Map(); // module -> função async que dispara a sincronização
const runningModules = new Set(); // módulos com uma execução em andamento agora

// Executa o job de um módulo respeitando uma trava: se já tiver uma
// execução em andamento (disparada pelo cron ou manualmente), essa chamada
// é ignorada em vez de rodar em paralelo — vale tanto pro cron quanto pro
// disparo manual, os dois passam por aqui.
async function runJob(module, clientIds = null) {
  if (runningModules.has(module)) {
    console.log(`[sync:${module}] Execução ignorada — já existe uma em andamento.`);
    return { skipped: true };
  }

  const fn = jobFns.get(module);
  if (!fn) return { skipped: true };

  runningModules.add(module);
  try {
    await fn(clientIds);
  } finally {
    runningModules.delete(module);
  }
  return { skipped: false };
}

function isRunning(module) {
  return runningModules.has(module);
}

// Na primeira execução (tabela ainda vazia), semeia um agendamento por
// módulo a partir do .env — assim quem já tinha SYNC_*_SCHEDULES configurado
// não perde o horário na migração.
async function ensureSeed() {
  for (const module of MODULES) {
    const existing = await pool.query('SELECT 1 FROM sync_schedules WHERE module = $1', [module]);
    if (existing.rows.length === 0) {
      const fromEnv = (process.env[ENV_KEYS[module]] || '').split(',').filter(Boolean)[0];
      await pool.query(
        'INSERT INTO sync_schedules (module, cron_expression, enabled) VALUES ($1, $2, true)',
        [module, fromEnv || DEFAULT_CRON]
      );
    }
  }
}

function applySchedule(module, cronExpression, enabled) {
  const existing = tasks.get(module);
  if (existing) {
    existing.stop();
    tasks.delete(module);
  }

  if (!enabled) return;

  const task = cron.schedule(cronExpression, () => {
    console.log(`\n── sync:${module} ── ${new Date().toISOString()} ──`);
    runJob(module).catch((err) => console.error(`[scheduler-${module}] Erro:`, err.message));
  });

  tasks.set(module, task);
}

// Chamado uma vez na subida do servidor. `jobs` é [{ module, fn }].
async function initSchedulers(jobs) {
  jobs.forEach(({ module, fn }) => jobFns.set(module, fn));

  await ensureSeed();

  const result = await pool.query('SELECT module, cron_expression, enabled FROM sync_schedules');
  result.rows.forEach((row) => applySchedule(row.module, row.cron_expression, row.enabled));

  console.log('📅 Agendamentos de sincronização carregados do banco (sync_schedules):');
  result.rows.forEach((row) => {
    console.log(`   ${row.enabled ? '✓' : '✗ (desativado)'} ${row.module}: ${row.cron_expression}`);
  });
}

// Chamado pela rota administrativa quando o horário é alterado pela tela.
async function updateSchedule(module, cronExpression, enabled) {
  if (!MODULES.includes(module)) {
    throw new Error(`Módulo inválido: ${module}`);
  }
  if (!cron.validate(cronExpression)) {
    throw new Error(`Expressão cron inválida: ${cronExpression}`);
  }

  await pool.query(
    `INSERT INTO sync_schedules (module, cron_expression, enabled, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (module) DO UPDATE SET
       cron_expression = $2, enabled = $3, updated_at = NOW()`,
    [module, cronExpression, enabled]
  );

  applySchedule(module, cronExpression, enabled);
}

// Disparo manual (rota administrativa). `clientIds` opcional: se vier com
// itens, roda só pra esses clientes; senão, roda pra todos. Não espera
// terminar — dispara em background e o front consulta o status via
// listSchedules()/`running`.
function triggerNow(module, clientIds = null) {
  if (!MODULES.includes(module)) {
    throw new Error(`Módulo inválido: ${module}`);
  }
  if (isRunning(module)) {
    const err = new Error('Já existe uma sincronização em andamento pra esse módulo — aguarde terminar.');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }

  const alvo = clientIds && clientIds.length > 0 ? clientIds.join(', ') : 'todos os clientes';
  console.log(`\n── sync:${module} (disparo manual — ${alvo}) ── ${new Date().toISOString()} ──`);
  runJob(module, clientIds).catch((err) => console.error(`[manual-${module}] Erro:`, err.message));
}

async function listSchedules() {
  const result = await pool.query(
    'SELECT module, cron_expression, enabled, updated_at FROM sync_schedules ORDER BY module'
  );
  return result.rows.map((row) => ({ ...row, running: isRunning(row.module) }));
}

module.exports = { initSchedulers, updateSchedule, listSchedules, triggerNow, isRunning, MODULES };
