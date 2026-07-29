const axios = require('axios');
const pool = require('../db/postgres');

const ORCHESTRATOR_URL = 'http://10.0.100.204:8040/api/v1/consultas';
const API_KEY = process.env.API_KEY_SETORES;

console.log('[syncSetores] Inicialização:', {
  ORCHESTRATOR_URL,
  API_KEY: API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA',
});

async function dispatchJob(clientId, taskId, params = {}) {
  try {
    const payload = {
      client_id: clientId,
      task_id: taskId,
      modo: 'callback',
    };
    if (Object.keys(params).length > 0) {
      payload.params = params;
    }

    const res = await axios.post(ORCHESTRATOR_URL, payload, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log(`[syncSetores] Job ${taskId} despachado pra ${clientId}:`, res.data);
    return res.data;
  } catch (err) {
    console.error(`[syncSetores] Erro ao despachar job ${taskId} (${clientId}):`, {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

async function syncClientSetores(companyId, clientId) {
  try {
    console.log(`[syncSetores] Iniciando sincronização: empresa=${companyId}, client_id=${clientId}`);

    // Pega o maior erp_id já sincronizado
    const result = await pool.query(
      'SELECT MAX(erp_id) AS max FROM setores WHERE company_id = $1',
      [companyId]
    );
    const idInicio = result.rows[0]?.max ?? 0;
    console.log(`[syncSetores] id_inicio para ${clientId}: ${idInicio}`);

    // Dispara a tarefa
    await dispatchJob(clientId, 'setores', { id_inicio: idInicio });

    console.log(`[syncSetores] Tarefa despachada com sucesso para ${clientId}`);
  } catch (err) {
    console.error(`[syncSetores] Erro na sincronização de ${clientId}:`, err.message);
  }
}

async function syncAllCompanies() {
  try {
    console.log('[syncSetores] Iniciando sincronização de todas as empresas...');
    const result = await pool.query('SELECT id, client_id FROM companies WHERE client_id IS NOT NULL');

    if (result.rows.length === 0) {
      console.log('[syncSetores] Nenhuma empresa com client_id encontrada.');
      return;
    }

    for (const company of result.rows) {
      await syncClientSetores(company.id, company.client_id);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('[syncSetores] Sincronização completada.');
  } catch (err) {
    console.error('[syncSetores] Erro ao sincronizar empresas:', err.message);
  }
}

module.exports = { syncClientSetores, syncAllCompanies };
