// Erlang-C: Calcula quantos operadores são necessários por hora

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

function cashierLoadForHour(
  hour,
  simpleDemand,
  scheduledCashiers,
  dayType = 'weekday',
  pdvLimit = 3
) {
  if (!simpleDemand) return null;

  const dayMultiplier = dayType === 'saturday' ? 1.16 : dayType === 'sunday' ? 0.82 : 1;
  const inferredCustomers = Math.max(8, Math.round(simpleDemand * 24 * dayMultiplier));

  const avgItems = dayType === 'sunday'
    ? 13 + Math.max(0, simpleDemand - 1) * 3
    : dayType === 'saturday'
    ? 18 + simpleDemand * 7
    : 14 + simpleDemand * 6;

  const averageServiceMinutes = 0.9 + avgItems * 0.08;
  const neededMinutes = inferredCustomers * averageServiceMinutes;

  const workloadAgents = Math.max(1, Math.ceil((neededMinutes / 60) * 1.05));
  const erlangAgents = erlangAgentsNeeded(inferredCustomers, averageServiceMinutes, 3);
  const recommended = Math.max(workloadAgents, erlangAgents);
  const cappedRecommendation = Math.min(Math.max(1, pdvLimit), recommended);

  const scheduled = Math.max(1, scheduledCashiers || simpleDemand);
  const trafficErlangs = (inferredCustomers * averageServiceMinutes) / 60;
  const waitMinutes = scheduled > trafficErlangs
    ? Math.max(0.3, (erlangCWaitProbability(trafficErlangs, scheduled) * averageServiceMinutes) / (scheduled - trafficErlangs))
    : 15;

  return {
    hora: hour,
    clientes: inferredCustomers,
    itensMedios: Math.round(avgItems * 10) / 10,
    tempoMedioMin: Math.round(averageServiceMinutes * 100) / 100,
    minutosNecessarios: Math.round(neededMinutes),
    operadoresRecomendados: cappedRecommendation,
    operadoresCalculados: recommended,
    filaMin: Math.round(waitMinutes * 10) / 10,
    utilizacao: Math.min(100, Math.round((neededMinutes / (scheduled * 60)) * 100))
  };
}

module.exports = {
  erlangCWaitProbability,
  erlangAgentsNeeded,
  cashierLoadForHour
};
