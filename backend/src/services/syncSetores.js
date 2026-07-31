const axios = require('axios');
const pool = require('../db/postgres');
const { runLimited, waitForConsulta } = require('./syncQueue');
const { logStart, logSuccess, logError, logSummary, shortId, formatAxiosError } = require('./syncLogger');
const { recordTaskLog } = require('./syncPersist');

const ORCHESTRATOR_URL = 'http://10.0.100.204:8040/api/v1/consultas';
const API_KEY = process.env.API_KEY_SETORES;

console.log('[syncSetores] Inicialização:', {
  ORCHESTRATOR_URL,
  API_KEY: API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA',
});

async function dispatchJob(clientId, companyId, taskId, params = {}) {
  try {
    const payload = {
      client_id: clientId,
      task_id: taskId,
      modo: 'callback',
    };
    if (Object.keys(params).length > 0) {
      payload.params = params;
    }

    const data = await runLimited(clientId, async () => {
      const res = await axios.post(ORCHESTRATOR_URL, payload, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      await waitForConsulta(res.data?.consulta_id);
      return res.data;
    });

    logSuccess('setores', clientId, `${taskId} · ${shortId(data?.consulta_id)}`);
    await recordTaskLog({ module: 'setores', clientId, companyId, taskId, status: 'success', consultaId: data?.consulta_id });
    return data;
  } catch (err) {
    const message = formatAxiosError(err);
    logError('setores', clientId, `${taskId} — ${message}`);
    await recordTaskLog({ module: 'setores', clientId, companyId, taskId, status: 'error', message });
    throw err;
  }
}

async function syncClientSetores(companyId, clientId) {
  try {
    // Pega o maior erp_id já sincronizado
    const result = await pool.query(
      'SELECT MAX(erp_id) AS max FROM setores WHERE company_id = $1',
      [companyId]
    );
    const idInicio = result.rows[0]?.max ?? -1;
    logStart('setores', clientId, `iniciando (empresa=${companyId}, id_inicio=${idInicio})`);

    await dispatchJob(clientId, companyId, 'setores', { id_inicio: idInicio });
  } catch (err) {
    logError('setores', clientId, `falha na sincronização: ${err.message}`);
  }
}

async function syncAllCompanies(clientIds = null) {
  try {
    const result = (clientIds && clientIds.length > 0)
      ? await pool.query('SELECT id, client_id FROM companies WHERE client_id = ANY($1)', [clientIds])
      : await pool.query('SELECT id, client_id FROM companies WHERE client_id IS NOT NULL');

    if (result.rows.length === 0) {
      logSummary('setores', 'nenhuma empresa com client_id encontrada.');
      return;
    }

    for (const company of result.rows) {
      await syncClientSetores(company.id, company.client_id);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logSummary('setores', `concluído (${result.rows.length} empresa(s))`);
  } catch (err) {
    logSummary('setores', `erro ao sincronizar empresas: ${err.message}`);
  }
}

module.exports = { syncClientSetores, syncAllCompanies };
