// Grava o resultado de cada job de sincronização em sync_task_logs, pra
// alimentar a tela de "Logs de sincronização" no painel administrativo.
// Best-effort: uma falha aqui nunca deve derrubar o fluxo de sincronização
// em si, só perder aquele registro de auditoria.
const pool = require('../db/postgres');

async function recordTaskLog({ module, clientId, companyId, taskId, status, consultaId, message }) {
  try {
    await pool.query(
      `INSERT INTO sync_task_logs (module, client_id, company_id, task_id, status, consulta_id, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [module, clientId, companyId || null, taskId || null, status, consultaId || null, message || null]
    );
  } catch (err) {
    console.error('[syncPersist] Erro ao gravar log de sincronização:', err.message);
  }
}

module.exports = { recordTaskLog };
