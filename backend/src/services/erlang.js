// Erlang-C: quantos operadores de caixa são necessários por hora pra manter
// a espera média dentro de um alvo — portado do EscalaON (mesma matemática:
// classificação de porte de compra, perfil de pagamento por horário,
// fatores operacionais de pico/sangria/troca, fila M/M/N).
//
// Diferença em relação ao EscalaON: lá, clientes/itens por hora eram
// inferidos a partir de um índice de demanda simples (não tinham dado real
// por hora). Aqui já temos o histórico real (sales_data com coluna "hora"),
// então usamos a média real de clientes/itens direto — mais preciso.

function purchaseClass(avgItems) {
  if (avgItems <= 10) return { label: 'Expressa', weight: 1 };
  if (avgItems <= 20) return { label: 'Pequena', weight: 2 };
  if (avgItems <= 40) return { label: 'Média', weight: 3 };
  if (avgItems <= 80) return { label: 'Grande', weight: 5 };
  return { label: 'Atacarejo', weight: 8 };
}

function paymentProfile(hourStart, dayType) {
  if (dayType === 'saturday' && hourStart >= 10 && hourStart <= 12) return { label: 'Múltiplos', weight: 1.45 };
  if (hourStart >= 17) return { label: 'Cartão/PIX', weight: 1.12 };
  if (hourStart >= 10 && hourStart <= 11) return { label: 'Dinheiro/Vale', weight: 1.28 };
  return { label: 'Cartão', weight: 1.15 };
}

function operationalFactors(hourStart, clientesPorHora, dayType) {
  const factors = [];
  if (clientesPorHora >= 60) factors.push({ label: 'Pico', weight: 0.10 });
  if (hourStart === 10 || hourStart === 16) factors.push({ label: 'Sangria', weight: 0.06 });
  if (hourStart === 12 || hourStart === 18) factors.push({ label: 'Troca/fechamento', weight: 0.05 });
  if (dayType === 'saturday') factors.push({ label: 'Fluxo de fim de semana', weight: 0.07 });
  return factors;
}

function erlangCWaitProbability(A, N) {
  if (N <= A) return 1;

  let term = 1;
  let sum = 1;

  for (let k = 1; k < N; k++) {
    term *= A / k;
    sum += term;
  }

  const termN = term * (A / N);
  const c = termN * (N / (N - A));

  return c / (sum + c);
}

function erlangAgentsNeeded(arrivalsPerHour, serviceMinutes, targetWaitMin = 3) {
  const A = (arrivalsPerHour * serviceMinutes) / 60;

  for (let N = Math.max(1, Math.ceil(A)); N <= 30; N++) {
    if (N <= A) continue;

    const pw = erlangCWaitProbability(A, N);
    const avgWait = (pw * serviceMinutes) / (N - A);

    if (avgWait <= targetWaitMin) {
      return N;
    }
  }

  return 30;
}

// `clientesPorHora`/`itensPorCliente`: média real (sales_data) daquela
// hora, naquele dia da semana. `scheduledCashiers`: quantos operadores de
// caixa estão de fato escalados nessa hora (extraído da escala gerada).
function cashierLoadForHour(hour, clientesPorHora, itensPorCliente, scheduledCashiers, dayType = 'weekday', pdvLimit = 3) {
  if (!clientesPorHora) return null;

  const hourStart = parseInt(String(hour).split(':')[0], 10);
  const inferredCustomers = Math.max(1, Math.round(clientesPorHora));
  const avgItems = itensPorCliente > 0 ? itensPorCliente : 14;

  const purchase = purchaseClass(avgItems);
  const payment = paymentProfile(hourStart, dayType);
  const factors = operationalFactors(hourStart, clientesPorHora, dayType);
  const operationalMultiplier = 1 + factors.reduce((total, f) => total + f.weight, 0);

  const averageServiceMinutes = (0.9 + avgItems * 0.08) * payment.weight * operationalMultiplier;
  const neededMinutes = inferredCustomers * averageServiceMinutes;

  const workloadAgents = Math.max(1, Math.ceil((neededMinutes / 60) * 1.05));
  const erlangAgents = erlangAgentsNeeded(inferredCustomers, averageServiceMinutes, 3);
  const recommended = Math.max(workloadAgents, erlangAgents);
  const cappedRecommendation = Math.min(Math.max(1, pdvLimit), recommended);

  const scheduled = Math.max(0, scheduledCashiers || 0);
  const trafficErlangs = (inferredCustomers * averageServiceMinutes) / 60;
  const waitMinutes = scheduled > trafficErlangs
    ? Math.max(0.3, (erlangCWaitProbability(trafficErlangs, scheduled) * averageServiceMinutes) / (scheduled - trafficErlangs))
    : 15;

  let status;
  if (scheduled === cappedRecommendation) status = 'adequado';
  else if (scheduled > cappedRecommendation + 1) status = 'excesso';
  else if (scheduled > cappedRecommendation) status = 'leve_excesso';
  else status = 'deficit';

  return {
    hora: hour,
    clientes: inferredCustomers,
    itensMedios: Math.round(avgItems * 10) / 10,
    classePorte: purchase.label,
    tempoMedioMin: Math.round(averageServiceMinutes * 100) / 100,
    minutosNecessarios: Math.round(neededMinutes),
    operadoresRecomendados: cappedRecommendation,
    operadoresCalculados: recommended,
    operadoresEscalados: scheduled,
    filaMin: Math.round(waitMinutes * 10) / 10,
    utilizacao: scheduled > 0 ? Math.min(160, Math.round((neededMinutes / (scheduled * 60)) * 100)) : null,
    status,
  };
}

module.exports = {
  erlangCWaitProbability,
  erlangAgentsNeeded,
  cashierLoadForHour,
};
