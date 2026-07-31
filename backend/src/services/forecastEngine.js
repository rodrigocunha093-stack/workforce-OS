// Motor de previsão de demanda — portado do EscalaON (decomposição
// multiplicativa dia-da-semana × semana-do-mês, com fallback quando a
// célula [dow][wom] não tem amostras suficientes). Mesma lógica,
// alimentado pelo histórico de sales_data já sincronizado pelo agente.

const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MIN_CELL = 4; // amostras mínimas p/ confiar no fator específico da célula

function weekOfMonth(dateStr) {
  const day = Number(dateStr.split('-')[2]);
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

// `rows`: [{ data: 'YYYY-MM-DD', valor_total: number }] — um por dia
// (já agregado). Retorna os índices de sazonalidade usados no forecast.
function buildDemandIndices(rows) {
  if (!rows || !rows.length) return null;

  const dowSum = [0, 0, 0, 0, 0, 0, 0];
  const dowDays = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  const womSum = [0, 0, 0, 0, 0, 0];
  const womDays = [null, new Set(), new Set(), new Set(), new Set(), new Set()];
  const cellSum = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0, 0]);
  const cellCnt = Array.from({ length: 7 }, () => [0, 0, 0, 0, 0, 0]);

  rows.forEach((r) => {
    const venda = Number(r.valor_total || 0);
    const d = new Date(`${r.data}T12:00:00`).getDay();
    dowSum[d] += venda;
    dowDays[d].add(r.data);
    const wom = weekOfMonth(r.data);
    womSum[wom] += venda;
    womDays[wom].add(r.data);
    if (wom >= 1 && wom <= 5) { cellSum[d][wom] += venda; cellCnt[d][wom] += 1; }
  });

  const dowAvg = dowSum.map((v, i) => (dowDays[i].size ? v / dowDays[i].size : 0));
  const dowActive = dowAvg.filter((v) => v > 0);
  const dowMean = dowActive.length ? dowActive.reduce((a, b) => a + b, 0) / dowActive.length : 1;
  const dowIndex = dowAvg.map((v) => (dowMean > 0 ? Number((v / dowMean).toFixed(3)) : 1));

  const womAvg = womSum.map((v, i) => (i > 0 && womDays[i].size ? v / womDays[i].size : 0));
  const womActive = womAvg.filter((v, i) => i > 0 && v > 0);
  const womMean = womActive.length ? womActive.reduce((a, b) => a + b, 0) / womActive.length : 1;
  const womFactor = womAvg.map((v, i) => (i > 0 && womMean > 0 ? Number((v / womMean).toFixed(3)) : 1));

  const womByDow = Array.from({ length: 7 }, (_, d) => {
    const row = [1, 1, 1, 1, 1, 1];
    const baseDia = dowAvg[d];
    for (let w = 1; w <= 5; w++) {
      if (cellCnt[d][w] >= MIN_CELL && baseDia > 0) {
        row[w] = Number(((cellSum[d][w] / cellCnt[d][w]) / baseDia).toFixed(3));
      } else {
        row[w] = womFactor[w] || 1;
      }
    }
    return row;
  });

  const totalDays = new Set(rows.map((r) => r.data)).size;
  const dowSamples = dowDays.map((s) => s.size);
  const minDowSamples = Math.min(...dowSamples.filter((n) => n > 0));

  let confianca = 'inicial';
  if (totalDays >= 90) confianca = 'boa';
  else if (totalDays >= 28 && minDowSamples >= 3) confianca = 'media';

  return { dowIndex, womFactor, womByDow, baseMedia: dowMean, confianca, totalDays };
}

// Aplica a decomposição multiplicativa a uma venda média-base pra obter
// a previsão ajustada de um dia específico (dow/wom) + fator de evento.
function adjustedDemand(baseDia, indices, targetDow, targetWom, eventoFator) {
  if (!indices) return baseDia;
  const dowF = indices.dowIndex[targetDow] || 1;
  let womF = 1;
  if (targetWom >= 1 && targetWom <= 5) {
    womF = (indices.womByDow && indices.womByDow[targetDow])
      ? (indices.womByDow[targetDow][targetWom] || 1)
      : (indices.womFactor[targetWom] || 1);
  }
  const evF = eventoFator || 1;
  return baseDia * dowF * womF * evF;
}

// Monta a previsão dos próximos 7 dias (a partir de hoje), aplicando o
// calendário de eventos (feriados/promoções) sobre a base histórica.
function buildForecast7Dias(rows, eventMap) {
  const indices = buildDemandIndices(rows);
  if (!indices) return null;

  const hoje = new Date();
  const forecast7 = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(hoje);
    dt.setDate(hoje.getDate() + i);
    const dataStr = dt.toISOString().slice(0, 10);
    const dow = dt.getDay();
    const wom = weekOfMonth(dataStr);
    const ev = eventMap ? eventMap[dataStr] : null;
    const evFator = ev ? ev.fator : 1;
    const previsao = Math.round(adjustedDemand(indices.baseMedia, indices, dow, wom, evFator));

    forecast7.push({
      data: dataStr,
      diaSemana: NOMES_DIA[dow],
      dow,
      wom,
      previsao,
      dowIndex: indices.dowIndex[dow],
      womFactor: (indices.womByDow && indices.womByDow[dow]) ? indices.womByDow[dow][wom] : indices.womFactor[wom],
      evento: ev,
    });
  }

  return { dias: forecast7, confianca: indices.confianca, totalDiasHistorico: indices.totalDays };
}

module.exports = { weekOfMonth, buildDemandIndices, adjustedDemand, buildForecast7Dias };
