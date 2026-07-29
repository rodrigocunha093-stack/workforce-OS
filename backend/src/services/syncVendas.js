const axios = require('axios');
const pool = require('../db/postgres');

const ORCHESTRATOR_URL = 'http://10.0.100.204:8040/api/v1/consultas';
const API_KEY = process.env.API_KEY_VENDAS;

console.log('[syncVendas] Inicialização:', {
  ORCHESTRATOR_URL,
  API_KEY: API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA',
});

async function getLastIndex(companyId) {
  try {
    const result = await pool.query(
      'SELECT MAX(ultimo_id) AS max FROM indices_vendas WHERE company_id = $1',
      [companyId]
    );
    return result.rows[0]?.max ?? 0;
  } catch (err) {
    console.error(`[syncVendas] Erro ao consultar indices_vendas (company=${companyId}):`, err.message);
    return 0;
  }
}

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

    console.log(`[syncVendas] Job ${taskId} despachado pra ${clientId}:`, res.data);
    return res.data;
  } catch (err) {
    console.error(`[syncVendas] Erro ao despachar job ${taskId} (${clientId}):`, {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

async function syncClientVendas(companyId, clientId) {
  try {
    console.log(`[syncVendas] Iniciando sincronização: empresa=${companyId}, client_id=${clientId}`);

    // Passo 1: Consultar último índice
    const idInicio = await getLastIndex(companyId);
    console.log(`[syncVendas] id_inicio para ${clientId}: ${idInicio}`);

    // Passo 2: Despachar ambas as tarefas
    await Promise.all([
      dispatchJob(clientId, 'venda', { id_inicio: idInicio }),
      dispatchJob(clientId, 'indices-escala-vendas'),
    ]);

    console.log(`[syncVendas] Tarefas despachadas com sucesso para ${clientId}`);
  } catch (err) {
    console.error(`[syncVendas] Erro na sincronização de ${clientId}:`, err.message);
  }
}

async function syncAllCompanies() {
  try {
    console.log('[syncVendas] Iniciando sincronização de todas as empresas...');
    const result = await pool.query('SELECT id, client_id FROM companies WHERE client_id IS NOT NULL');

    if (result.rows.length === 0) {
      console.log('[syncVendas] Nenhuma empresa com client_id encontrada.');
      return;
    }

    // Sincroniza sequencialmente pra não sobrecarregar o orquestrador
    for (const company of result.rows) {
      await syncClientVendas(company.id, company.client_id);
      // Pequeno delay entre empresas
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('[syncVendas] Sincronização completada.');
  } catch (err) {
    console.error('[syncVendas] Erro ao sincronizar empresas:', err.message);
  }
}

module.exports = { syncClientVendas, syncAllCompanies };
