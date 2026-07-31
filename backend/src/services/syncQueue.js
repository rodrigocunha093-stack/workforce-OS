// Controla quantos jobs ficam "em execução" simultaneamente no agente de
// cada cliente. O agente aceita no máximo 2 consultas simultâneas por
// client_id; disparar mais que isso de uma vez estoura esse limite (429).
//
// Regras:
// - Por cliente: no máximo 2 jobs em voo ao mesmo tempo. Um 3º job só é
//   disparado quando um dos dois anteriores terminar (o agente chama de
//   volta com o resultado — não basta a chamada HTTP de disparo retornar
//   "aceito", o job continua rodando no agente até o callback chegar).
// - Entre clientes diferentes: totalmente independente/assíncrono, cada
//   cliente tem sua própria janela de até 2 jobs simultâneos.
const MAX_CONCURRENT_PER_CLIENT = 2;
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000; // fallback caso o agente nunca chame de volta

const clientState = new Map(); // clientId -> { active, queue: [fn] }
const pendingConsultas = new Map(); // consulta_id -> { resolve, timer }

function getState(clientId) {
  let state = clientState.get(clientId);
  if (!state) {
    state = { active: 0, queue: [] };
    clientState.set(clientId, state);
  }
  return state;
}

function acquireSlot(clientId) {
  const state = getState(clientId);
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (state.active < MAX_CONCURRENT_PER_CLIENT) {
        state.active += 1;
        resolve();
      } else {
        state.queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function releaseSlot(clientId) {
  const state = getState(clientId);
  state.active = Math.max(0, state.active - 1);
  const next = state.queue.shift();
  if (next) next();
}

// Executa `task` respeitando o limite de 2 jobs simultâneos por clientId.
async function runLimited(clientId, task) {
  await acquireSlot(clientId);
  try {
    return await task();
  } finally {
    releaseSlot(clientId);
  }
}

// Aguarda o callback de conclusão do agente pra essa consulta (identificada
// por consulta_id). Resolve na hora se o consulta_id não vier (agente que
// não suporta o rastreio), e tem timeout de segurança pra não travar a fila
// pra sempre caso o callback nunca chegue.
function waitForConsulta(consultaId, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!consultaId) return Promise.resolve({ skipped: true });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingConsultas.delete(consultaId);
      resolve({ timedOut: true });
    }, timeoutMs);

    pendingConsultas.set(consultaId, { resolve, timer });
  });
}

// Chamado pelos handlers de callback (/sales_data, /setores/batch,
// /mercadologicos/batch) quando o agente entrega o resultado de uma
// consulta, liberando a vaga na fila daquele cliente.
function resolveConsulta(consultaId) {
  if (!consultaId) return;
  const pending = pendingConsultas.get(consultaId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingConsultas.delete(consultaId);
    pending.resolve({ timedOut: false });
  }
}

module.exports = { runLimited, waitForConsulta, resolveConsulta };
