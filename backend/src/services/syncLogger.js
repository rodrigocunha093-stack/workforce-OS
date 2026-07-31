// Logger compartilhado pelos 3 serviços de sincronização (vendas,
// mercadologico, setores). Formato tabular, sem abreviações e sem cores
// ANSI (que renderizam de forma inconsistente entre terminais).
//
// Insere uma linha em branco toda vez que o "tipo" da ação muda (iniciando
// -> concluído -> erro -> resumo), pra separar visualmente os blocos mesmo
// com os 3 schedulers rodando ao mesmo tempo e intercalando linhas.
const LABELS = {
  vendas: 'VENDAS',
  mercadologico: 'MERCADOLOGICO',
  setores: 'SETORES',
};

const MODULE_WIDTH = Math.max(...Object.values(LABELS).map((l) => l.length));
const CLIENT_WIDTH = 16;

let lastKind = null;

function tag(module) {
  return (LABELS[module] || module.toUpperCase()).padEnd(MODULE_WIDTH);
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '?';
}

function print(kind, line) {
  if (lastKind !== null && kind !== lastKind) {
    console.log('');
  }
  console.log(line);
  lastKind = kind;
}

function logStart(module, clientId, message) {
  print('start', `${tag(module)} | ${clientId.padEnd(CLIENT_WIDTH)} | ${message}`);
}

function logSuccess(module, clientId, message) {
  print('success', `${tag(module)} | ${clientId.padEnd(CLIENT_WIDTH)} | ✅ ${message}`);
}

function logError(module, clientId, message) {
  print('error', `${tag(module)} | ${clientId.padEnd(CLIENT_WIDTH)} | ❌ ERRO: ${message}`);
}

// Linha de resumo (fim do lote todo — não é sobre um client_id específico,
// e sim sobre todos os clientes processados nesse ciclo do módulo).
function logSummary(module, message) {
  print('summary', `${tag(module)} | ${'— todos —'.padEnd(CLIENT_WIDTH)} | ${message}`);
}

// Formata o erro de uma chamada axios mostrando o corpo real da resposta do
// orquestrador (essencial pra diagnosticar um 500, já que err.message
// sozinho só diz "Request failed with status code 500", sem dizer o motivo).
function formatAxiosError(err) {
  if (err.response) {
    const body = typeof err.response.data === 'object'
      ? JSON.stringify(err.response.data)
      : err.response.data;
    return `HTTP ${err.response.status} — ${body || '(sem corpo na resposta)'}`;
  }
  return err.message;
}

module.exports = { logStart, logSuccess, logError, logSummary, shortId, formatAxiosError };
