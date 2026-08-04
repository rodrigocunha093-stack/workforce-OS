// Extrai, da escala já gerada (generateScheduleByProfile), quantos
// operadores de caixa estão de fato trabalhando em cada hora — é o
// "escalados" real usado pelo Controller de Frente de Caixa (equivalente
// ao fullSchedule do EscalaON, só que lido da nossa própria escala).

const TIME_BLOCK_RE = /(\d{2}):(\d{2})-(\d{2}):(\d{2})/g;

function isOperadorCaixa(emp) {
  // "operador" sozinho é ambíguo demais (Operador de Loja, Operador de
  // Frios não são caixa) — só "caixa" no cargo/setor é sinal confiável.
  const combined = `${emp.cargo || ''} ${emp.setor || ''}`.toLowerCase();
  return combined.includes('caixa');
}

// Retorna os blocos de horário trabalhados de um turno (ex.:
// "07:00-12:00 / 13:00-19:00" -> [{start:7, end:12}, {start:13, end:19}]).
// Ignora "Folga" e considera o intervalo/pausa como não-trabalhado (o
// break já sai como um "buraco" entre os dois blocos gerados).
function parseWorkedBlocks(shift) {
  if (!shift || shift === 'Folga') return [];
  const blocks = [];
  let match;
  TIME_BLOCK_RE.lastIndex = 0;
  while ((match = TIME_BLOCK_RE.exec(shift)) !== null) {
    const start = Number(match[1]) + Number(match[2]) / 60;
    let end = Number(match[3]) + Number(match[4]) / 60;
    if (end < start) end += 24;
    blocks.push({ start, end });
  }
  return blocks;
}

// `schedule`: { [nomeFuncionario]: [turnoDia0, ..., turnoDia6] } — mesmo
// formato retornado por generateScheduleByProfile (0=segunda..6=domingo).
// Conta quantos operadores de caixa têm um bloco de trabalho cobrindo a
// `hourStart` (ex.: 14 = das 14:00 às 15:00) no `dayIndex` informado.
function countCaixaScheduledAtHour(schedule, employees, dayIndex, hourStart) {
  let count = 0;
  employees.forEach((emp) => {
    if (!isOperadorCaixa(emp)) return;
    const shifts = schedule[emp.name];
    if (!shifts) return;
    const blocks = parseWorkedBlocks(shifts[dayIndex]);
    const working = blocks.some((b) => hourStart >= b.start && hourStart < b.end);
    if (working) count += 1;
  });
  return count;
}

module.exports = { isOperadorCaixa, parseWorkedBlocks, countCaixaScheduledAtHour };
