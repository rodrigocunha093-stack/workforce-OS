const axios = require('axios');
const pool = require('../db/postgres');
const { runLimited, waitForConsulta } = require('./syncQueue');
const { logStart, logSuccess, logError, logSummary, shortId, formatAxiosError } = require('./syncLogger');
const { recordTaskLog } = require('./syncPersist');

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
    logError('vendas', String(companyId), `erro ao consultar indices_vendas: ${err.message}`);
    return 0;
  }
}

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

      // Só libera a vaga desse cliente quando o agente terminar de fato
      // (callback com o resultado), não quando o disparo é só "aceito".
      await waitForConsulta(res.data?.consulta_id);
      return res.data;
    });

    logSuccess('vendas', clientId, `${taskId} · ${shortId(data?.consulta_id)}`);
    await recordTaskLog({ module: 'vendas', clientId, companyId, taskId, status: 'success', consultaId: data?.consulta_id });
    return data;
  } catch (err) {
    const message = formatAxiosError(err);
    logError('vendas', clientId, `${taskId} — ${message}`);
    await recordTaskLog({ module: 'vendas', clientId, companyId, taskId, status: 'error', message });
    throw err;
  }
}

async function syncClientVendas(companyId, clientId) {
  try {
    const idInicio = await getLastIndex(companyId);
    logStart('vendas', clientId, `iniciando (empresa=${companyId}, id_inicio=${idInicio})`);

    await Promise.all([
      dispatchJob(clientId, companyId, 'venda', { id_inicio: idInicio }),
      dispatchJob(clientId, companyId, 'indices-escala-vendas'),
    ]);
  } catch (err) {
    logError('vendas', clientId, `falha na sincronização: ${err.message}`);
  }
}

// `clientIds`: opcional — se vier com itens, roda só pra esses clientes
// (disparo manual filtrado); se vier vazio/undefined, roda pra todos (cron
// e disparo manual "todos os clientes").
async function syncAllCompanies(clientIds = null) {
  try {
    const result = (clientIds && clientIds.length > 0)
      ? await pool.query('SELECT id, client_id FROM companies WHERE client_id = ANY($1)', [clientIds])
      : await pool.query('SELECT id, client_id FROM companies WHERE client_id IS NOT NULL');

    if (result.rows.length === 0) {
      logSummary('vendas', 'nenhuma empresa com client_id encontrada.');
      return;
    }

    // Sincroniza sequencialmente pra não sobrecarregar o orquestrador
    for (const company of result.rows) {
      await syncClientVendas(company.id, company.client_id);
      // Pequeno delay entre empresas
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logSummary('vendas', `concluído (${result.rows.length} empresa(s))`);
  } catch (err) {
    logSummary('vendas', `erro ao sincronizar empresas: ${err.message}`);
  }
}

module.exports = { syncClientVendas, syncAllCompanies };
