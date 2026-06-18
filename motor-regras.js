'use strict';
// =============================================================================
// MOTOR DE REGRAS CLT/CCT — workforce-OS
// -----------------------------------------------------------------------------
// PARTE A: motor puro, portado de @escaladp/rules (Escaladp/packages/rules/src).
//          Funções puras (contexto, params) -> violações. Sem UI, sem banco.
//          Mantido fiel ao original para um dia convergir num pacote compartilhado.
// PARTE B: adaptador específico do workforce-OS. Traduz a "semana padrão"
//          (people = { nome: [7 strings de turno] }) para o RuleContext do motor,
//          reaproveitando a MESMA inferência de pausa do server.js (parseWorkedBlocks)
//          para garantir paridade com o checkComplianceCLT anterior.
// =============================================================================

// ======================= PARTE A — MOTOR PURO ================================

// ---- Helpers de tempo (lib/tempo.ts) — tudo em UTC ----
function dataHora(data, hora) {
  const [ano, mes, dia] = String(data).split('-').map(Number);
  const [hh, mm] = String(hora).split(':').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, hh, mm, 0, 0));
}
function fimTurno(data, inicio, fim) {
  const ini = dataHora(data, inicio);
  const f = dataHora(data, fim);
  if (f.getTime() <= ini.getTime()) f.setUTCDate(f.getUTCDate() + 1);
  return f;
}
function duracaoHoras(data, inicio, fim) {
  return (fimTurno(data, inicio, fim).getTime() - dataHora(data, inicio).getTime()) / 3_600_000;
}
function somaDias(data, n) {
  const d = dataHora(data, '00:00');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diaSemana(data) {
  return dataHora(data, '00:00').getUTCDay();
}
function ehDomingo(data) {
  return diaSemana(data) === 0;
}
function segundaFeiraDaSemana(data) {
  const d = dataHora(data, '00:00');
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a, b) {
  return Math.round((dataHora(b, '00:00').getTime() - dataHora(a, '00:00').getTime()) / 86_400_000);
}

// ---- Helper de grade (lib/grade.ts) ----
function diasTrabalhadosPorFuncionario(alocacoes) {
  const mapa = new Map();
  for (const a of alocacoes) {
    if (a.shiftId == null) continue;
    const set = mapa.get(a.employeeId) || new Set();
    set.add(a.data);
    mapa.set(a.employeeId, set);
  }
  return mapa;
}

// ---- Regras (rules/*.ts) ----

// Interjornada (CLT art. 66): descanso mínimo entre o FIM de uma jornada e o
// INÍCIO da próxima. Param: { min_horas } (padrão 11).
function interjornadaMin(ctx, params) {
  const minHoras = Number(params.min_horas != null ? params.min_horas : 11);
  const turnoPorId = new Map(ctx.turnos.map((t) => [t.id, t]));
  const violacoes = [];
  const porFuncionario = new Map();
  for (const a of ctx.alocacoes) {
    if (a.shiftId == null) continue;
    const turno = turnoPorId.get(a.shiftId);
    if (!turno) continue;
    const lista = porFuncionario.get(a.employeeId) || [];
    lista.push({ data: a.data, inicio: dataHora(a.data, turno.inicio), fim: fimTurno(a.data, turno.inicio, turno.fim) });
    porFuncionario.set(a.employeeId, lista);
  }
  for (const [funcionarioId, eventos] of porFuncionario) {
    eventos.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
    for (let i = 1; i < eventos.length; i++) {
      const descansoHoras = (eventos[i].inicio.getTime() - eventos[i - 1].fim.getTime()) / 3_600_000;
      if (descansoHoras < minHoras) {
        violacoes.push({
          ruleTypeId: 'interjornada_min', severidade: 'bloqueante', funcionarioId, data: eventos[i].data,
          mensagem: `Interjornada de ${descansoHoras.toFixed(1)}h antes do turno de ${eventos[i].data} (mínimo ${minHoras}h).`,
        });
      }
    }
  }
  return violacoes;
}

// Intrajornada (CLT art. 71): jornada acima de X horas exige intervalo mínimo.
// Params: { min_minutos, acima_de_horas } (padrão 60min para jornada > 6h).
function intrajornadaMin(ctx, params) {
  const minMinutos = Number(params.min_minutos != null ? params.min_minutos : 60);
  const acimaDeHoras = Number(params.acima_de_horas != null ? params.acima_de_horas : 6);
  const turnoPorId = new Map(ctx.turnos.map((t) => [t.id, t]));
  const violacoes = [];
  for (const a of ctx.alocacoes) {
    if (a.shiftId == null) continue;
    const turno = turnoPorId.get(a.shiftId);
    if (!turno) continue;
    const horas = duracaoHoras(a.data, turno.inicio, turno.fim);
    if (horas > acimaDeHoras && turno.intervaloMin < minMinutos) {
      violacoes.push({
        ruleTypeId: 'intrajornada_min', severidade: 'bloqueante', funcionarioId: a.employeeId, data: a.data,
        mensagem: `Jornada de ${horas.toFixed(1)}h em ${a.data} exige intervalo de ${minMinutos}min (tem ${turno.intervaloMin}min).`,
      });
    }
  }
  return violacoes;
}

// DSR (CLT art. 67): em toda janela de 7 dias deve haver ao menos N folgas.
// Param: { dias_descanso } (padrão 1).
function dsrSemanal(ctx, params) {
  const diasDescanso = Number(params.dias_descanso != null ? params.dias_descanso : 1);
  const violacoes = [];
  const porFunc = diasTrabalhadosPorFuncionario(ctx.alocacoes);
  for (const [funcionarioId, trabalhados] of porFunc) {
    const datas = [...trabalhados].sort();
    for (const inicio of datas) {
      let trabalhadosNaJanela = 0;
      for (let k = 0; k < 7; k++) if (trabalhados.has(somaDias(inicio, k))) trabalhadosNaJanela++;
      if (7 - trabalhadosNaJanela < diasDescanso) {
        const fimJanela = somaDias(inicio, 6);
        violacoes.push({
          ruleTypeId: 'dsr_semanal', severidade: 'bloqueante', funcionarioId, data: fimJanela,
          mensagem: `Menos de ${diasDescanso} folga(s) na semana de ${inicio} a ${fimJanela}.`,
        });
        break;
      }
    }
  }
  return violacoes;
}

// Limite de jornada semanal (CLT art. 58 / fases da PEC): soma das horas
// trabalhadas (descontado o intervalo) na semana não passa de max_horas.
function limiteJornadaSemanal(ctx, params) {
  const maxHoras = Number(params.max_horas != null ? params.max_horas : 44);
  const turnoPorId = new Map(ctx.turnos.map((t) => [t.id, t]));
  const violacoes = [];
  const soma = new Map();
  for (const a of ctx.alocacoes) {
    if (a.shiftId == null) continue;
    const turno = turnoPorId.get(a.shiftId);
    if (!turno) continue;
    const horas = duracaoHoras(a.data, turno.inicio, turno.fim) - turno.intervaloMin / 60;
    const semana = segundaFeiraDaSemana(a.data);
    const chave = `${a.employeeId}|${semana}`;
    const atual = soma.get(chave) || { funcionarioId: a.employeeId, semana, horas: 0 };
    atual.horas += horas;
    soma.set(chave, atual);
  }
  for (const { funcionarioId, semana, horas } of soma.values()) {
    if (horas > maxHoras + 1e-6) {
      violacoes.push({
        ruleTypeId: 'limite_jornada_semanal', severidade: 'bloqueante', funcionarioId, data: semana,
        mensagem: `Jornada semanal de ${horas.toFixed(1)}h na semana de ${semana} excede ${maxHoras}h.`,
      });
    }
  }
  return violacoes;
}

// Limite de jornada diária (CLT art. 59): horas trabalhadas por dia não passam
// de max_horas (padrão 10 = 8h + 2h extras). Acréscimo nosso ao catálogo do EscalaDP.
function limiteJornadaDiaria(ctx, params) {
  const maxHoras = Number(params.max_horas != null ? params.max_horas : 10);
  const turnoPorId = new Map(ctx.turnos.map((t) => [t.id, t]));
  const violacoes = [];
  for (const a of ctx.alocacoes) {
    if (a.shiftId == null) continue;
    const turno = turnoPorId.get(a.shiftId);
    if (!turno) continue;
    const horas = duracaoHoras(a.data, turno.inicio, turno.fim) - turno.intervaloMin / 60;
    if (horas > maxHoras + 1e-6) {
      violacoes.push({
        ruleTypeId: 'limite_jornada_diaria', severidade: 'bloqueante', funcionarioId: a.employeeId, data: a.data,
        mensagem: `Jornada diária de ${horas.toFixed(1)}h em ${a.data} excede ${maxHoras}h (art. 59).`,
      });
    }
  }
  return violacoes;
}

// Rodízio de domingos (CCT): mulheres não podem trabalhar dois domingos seguidos.
function rodizioDomingoFeminino(ctx, _params) {
  const violacoes = [];
  const sexoPorId = new Map(ctx.funcionarios.map((f) => [f.id, f.sexo]));
  const porFunc = diasTrabalhadosPorFuncionario(ctx.alocacoes);
  for (const [funcionarioId, trabalhados] of porFunc) {
    if (sexoPorId.get(funcionarioId) !== 'feminino') continue;
    const domingos = [...trabalhados].filter(ehDomingo).sort();
    for (let i = 1; i < domingos.length; i++) {
      if (diasEntre(domingos[i - 1], domingos[i]) === 7) {
        violacoes.push({
          ruleTypeId: 'rodizio_domingo_feminino', severidade: 'bloqueante', funcionarioId, data: domingos[i],
          mensagem: `Trabalha dois domingos seguidos (${domingos[i - 1]} e ${domingos[i]}); rodízio não respeitado.`,
        });
      }
    }
  }
  return violacoes;
}

// Limite de domingos no mês (CCT): máximo de domingos trabalhados por mês,
// opcionalmente só para um grupo. Params: { max, aplica_a }.
function limiteDomingosMes(ctx, params) {
  const max = Number(params.max != null ? params.max : 2);
  const aplicaA = params.aplica_a;
  const violacoes = [];
  const sexoPorId = new Map(ctx.funcionarios.map((f) => [f.id, f.sexo]));
  const porFunc = diasTrabalhadosPorFuncionario(ctx.alocacoes);
  for (const [funcionarioId, trabalhados] of porFunc) {
    if (aplicaA && sexoPorId.get(funcionarioId) !== aplicaA) continue;
    const domingos = [...trabalhados].filter(ehDomingo);
    if (domingos.length > max) {
      violacoes.push({
        ruleTypeId: 'limite_domingos_mes', severidade: 'bloqueante', funcionarioId,
        mensagem: `Trabalha ${domingos.length} domingos no mês (máximo ${max}).`,
      });
    }
  }
  return violacoes;
}

// Ajuda de custo por domingo trabalhado (CCT). É um AVISO que contabiliza o
// valor devido por domingo efetivamente trabalhado. Param: { valor }.
function ajudaCustoDomingo(ctx, params) {
  const valor = Number(params.valor != null ? params.valor : 0);
  const violacoes = [];
  for (const a of ctx.alocacoes) {
    if (a.shiftId == null) continue;
    if (!ehDomingo(a.data)) continue;
    violacoes.push({
      ruleTypeId: 'ajuda_custo_domingo', severidade: 'aviso', funcionarioId: a.employeeId, data: a.data,
      mensagem: `Ajuda de custo de R$ ${valor.toFixed(2)} devida pelo domingo trabalhado em ${a.data}.`,
    });
  }
  return violacoes;
}

// Folga compensatória de domingo (CCT): após um domingo trabalhado, deve haver
// uma folga dentro de uma janela de dias. Param: { janela_dias } (padrão 7).
function folgaCompensatoriaDomingo(ctx, params) {
  const janela = Number(params.janela_dias != null ? params.janela_dias : 7);
  const violacoes = [];
  const porFunc = diasTrabalhadosPorFuncionario(ctx.alocacoes);
  for (const [funcionarioId, trabalhados] of porFunc) {
    const domingos = [...trabalhados].filter(ehDomingo);
    for (const domingo of domingos) {
      let temFolga = false;
      for (let k = 1; k <= janela; k++) {
        if (!trabalhados.has(somaDias(domingo, k))) { temFolga = true; break; }
      }
      if (!temFolga) {
        violacoes.push({
          ruleTypeId: 'folga_compensatoria_domingo', severidade: 'bloqueante', funcionarioId, data: domingo,
          mensagem: `Sem folga compensatória nos ${janela} dias após o domingo trabalhado em ${domingo}.`,
        });
      }
    }
  }
  return violacoes;
}

// Dois descansos semanais (fase 42h+ da PEC): exige 2 folgas por semana. Com
// { media_mensal: true }, avalia pela média no mês.
function doisDescansosSemanais(ctx, params) {
  const mediaMensal = params.media_mensal === true;
  const violacoes = [];
  const stats = new Map();
  for (const a of ctx.alocacoes) {
    const s = stats.get(a.employeeId) || { trabalhados: 0, folgas: 0 };
    if (a.shiftId == null) s.folgas++; else s.trabalhados++;
    stats.set(a.employeeId, s);
  }
  for (const [funcionarioId, s] of stats) {
    const totalDias = s.trabalhados + s.folgas;
    if (totalDias === 0) continue;
    if (mediaMensal) {
      const semanas = totalDias / 7;
      if (s.folgas < 2 * semanas) {
        violacoes.push({
          ruleTypeId: 'dois_descansos_semanais', severidade: 'bloqueante', funcionarioId,
          mensagem: `Média de ${(s.folgas / semanas).toFixed(1)} folgas/semana no mês (exige 2): ${s.folgas} folgas em ${totalDias} dias.`,
        });
      }
    }
  }
  return violacoes;
}

// ---- Registry + avaliação (registry.ts + escala.ts) ----
const registry = {
  interjornada_min: interjornadaMin,
  intrajornada_min: intrajornadaMin,
  dsr_semanal: dsrSemanal,
  limite_jornada_semanal: limiteJornadaSemanal,
  limite_jornada_diaria: limiteJornadaDiaria,
  rodizio_domingo_feminino: rodizioDomingoFeminino,
  limite_domingos_mes: limiteDomingosMes,
  ajuda_custo_domingo: ajudaCustoDomingo,
  folga_compensatoria_domingo: folgaCompensatoriaDomingo,
  dois_descansos_semanais: doisDescansosSemanais,
};

function validar(ctx) {
  return ctx.regras.flatMap((r) => {
    const fn = registry[r.ruleTypeId];
    if (!fn) return []; // regra sem função registrada é ignorada, em vez de quebrar
    return fn(ctx, r.params || {}).map((v) => ({ ...v, severidade: r.severidade }));
  });
}

function validarEscala(ctx) {
  const violacoes = validar(ctx);
  return { violacoes, bloqueada: violacoes.some((v) => v.severidade === 'bloqueante') };
}

// Catálogo padrão = CLT federal. Reproduz a cobertura do checkComplianceCLT
// anterior (44h/sem, interjornada 11h, intervalo art.71, DSR, 10h/dia). As regras
// de domingo/PEC existem no registry e entram via configuração de CCT (Passo 2).
function defaultCctRules() {
  return [
    { ruleTypeId: 'limite_jornada_semanal', params: { max_horas: 44 }, severidade: 'bloqueante' },
    { ruleTypeId: 'interjornada_min', params: { min_horas: 11 }, severidade: 'bloqueante' },
    { ruleTypeId: 'intrajornada_min', params: { min_minutos: 60, acima_de_horas: 6 }, severidade: 'bloqueante' },
    { ruleTypeId: 'dsr_semanal', params: { dias_descanso: 1 }, severidade: 'bloqueante' },
    { ruleTypeId: 'limite_jornada_diaria', params: { max_horas: 10 }, severidade: 'bloqueante' },
  ];
}

// ======================= PARTE B — ADAPTADOR WORKFORCE-OS ====================
// Réplica fiel da inferência de pausa do server.js (parseWorkedBlocks e amigos),
// para o motor enxergar exatamente os mesmos turnos que o resto do sistema.

function hmTextToMinutes(value) {
  const m = String(value || '').match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  return (Number(m[1]) * 60) + Number(m[2] || 0);
}
function shiftWorkedHours(shift) {
  if (!shift || shift === 'Folga') return 0;
  const m = String(shift).match(/·\s*(\d+)h(\d{2})?/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const periodo = String(shift).split('·')[0].trim();
  const blocos = periodo.split('/');
  const first = blocos[0].split('-'); const last = blocos[blocos.length - 1].split('-');
  const start = hmTextToMinutes(first[0]); const end = hmTextToMinutes(last[1]);
  if (start == null || end == null) return 0;
  const span = (end - start) / 60;
  return Math.max(0, span - (span > 6 ? 1 : 0));
}
function getLegalIntervalMinutes(workedHours) {
  if (workedHours > 6) return 60;
  if (workedHours > 4) return 15;
  return 0;
}
// Igual ao server.js: divide turnos longos inserindo a pausa legal e estendendo
// o fim real, devolvendo os blocos efetivamente trabalhados (em minutos).
function parseWorkedBlocks(shift) {
  if (!shift || shift === 'Folga') return [];
  const periodoRaw = String(shift).split('·')[0].trim();
  if (!periodoRaw) return [];
  if (periodoRaw.includes('/')) {
    return periodoRaw.split('/').map((bloco) => {
      const [ini, fim] = bloco.split('-').map((p) => p.trim());
      const start = hmTextToMinutes(ini); const end = hmTextToMinutes(fim);
      return start === null || end === null ? null : { start, end };
    }).filter(Boolean);
  }
  const [ini, fimOriginal] = periodoRaw.split('-').map((p) => p.trim());
  const startMin = hmTextToMinutes(ini); const endMin = hmTextToMinutes(fimOriginal);
  if (startMin === null || endMin === null) return [];
  const workedHours = shiftWorkedHours(shift) || ((endMin - startMin) / 60);
  const legalIntervalMin = getLegalIntervalMinutes(workedHours);
  if (!legalIntervalMin) return [{ start: startMin, end: endMin }];
  const workedMin = Math.round(workedHours * 60);
  const rawSpanMin = endMin - startMin;
  const explicitIntervalMin = Math.max(0, rawSpanMin - workedMin);
  const intervaloMin = explicitIntervalMin >= legalIntervalMin ? explicitIntervalMin : legalIntervalMin;
  const endReal = explicitIntervalMin >= legalIntervalMin ? endMin : endMin + intervaloMin;
  const beforeBase = Math.round((workedMin / 2) / 5) * 5;
  const minAntes = workedHours > 6 ? 180 : 120;
  const maxAntes = workedHours > 6 ? 340 : workedMin;
  const minDepois = 120;
  const beforeMin = Math.min(maxAntes, Math.max(minAntes, Math.min(beforeBase, workedMin - minDepois)));
  const intervalStart = startMin + beforeMin;
  const intervalEnd = intervalStart + intervaloMin;
  return [{ start: startMin, end: intervalStart }, { start: intervalEnd, end: endReal }]
    .filter((b) => b.end > b.start);
}
function minutosParaHHMM(min) {
  const h = Math.floor(min / 60); const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Turno do workforce-OS (string) -> { inicio, fim, intervaloMin } do motor, com
// o intervalo coerente com os blocos realmente trabalhados. null se for folga/ilegível.
function turnoParaMotor(shift) {
  const blocks = parseWorkedBlocks(shift);
  if (!blocks.length) return null;
  const startMin = blocks[0].start;
  const endMin = blocks[blocks.length - 1].end;
  const workedMin = blocks.reduce((s, b) => s + (b.end - b.start), 0);
  const intervaloMin = Math.max(0, (endMin - startMin) - workedMin);
  return { inicio: minutosParaHHMM(startMin), fim: minutosParaHHMM(endMin), intervaloMin };
}

// Semana padrão (seg=0 .. dom=6) com datas reais, igual a buildCalendarWeek do server.js.
function semanaPadrao(baseDate) {
  const base = baseDate ? new Date(baseDate) : new Date();
  const diasDesdeSegunda = (base.getDay() + 6) % 7;
  const segunda = new Date(base);
  segunda.setDate(base.getDate() - diasDesdeSegunda);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(segunda);
    dt.setDate(segunda.getDate() + i);
    const iso = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    dias.push({ data: iso });
  }
  return { dias };
}

function normalizarRegras(cctRules) {
  return (cctRules || [])
    .filter((r) => r && r.ruleTypeId && r.ativa !== false)
    .map((r) => ({
      ruleTypeId: r.ruleTypeId,
      params: r.params || {},
      severidade: r.severidade === 'aviso' ? 'aviso' : 'bloqueante',
    }));
}

// people = { nome: [7 strings de turno] } -> RuleContext do motor.
// opts: { employees, cctRules, calendarWeek, baseDate }
function contextoDeEscala(people, opts) {
  opts = opts || {};
  const week = (opts.calendarWeek && opts.calendarWeek.dias && opts.calendarWeek.dias.length >= 7)
    ? opts.calendarWeek : semanaPadrao(opts.baseDate);
  const dias = week.dias;
  const sexoPorNome = {};
  (opts.employees || []).forEach((e) => { if (e && e.nome) sexoPorNome[e.nome] = String(e.sexo || '').toLowerCase(); });

  const funcionarios = [];
  const turnos = [];
  const alocacoes = [];
  Object.keys(people || {}).forEach((nome) => {
    const shifts = people[nome] || [];
    const sx = sexoPorNome[nome];
    funcionarios.push({ id: nome, nome, sexo: (sx === 'masculino' || sx === 'feminino') ? sx : undefined, tipoContrato: 'clt' });
    for (let i = 0; i < 7; i++) {
      const data = dias[i].data;
      const shift = shifts[i];
      const t = (!shift || shift === 'Folga') ? null : turnoParaMotor(shift);
      if (!t) { alocacoes.push({ employeeId: nome, data, shiftId: null }); continue; }
      const shiftId = nome + '__' + i;
      turnos.push({ id: shiftId, nome: String(shift), inicio: t.inicio, fim: t.fim, intervaloMin: t.intervaloMin });
      alocacoes.push({ employeeId: nome, data, shiftId });
    }
  });

  const regras = (opts.cctRules && opts.cctRules.length) ? normalizarRegras(opts.cctRules) : defaultCctRules();
  const inicio = new Date(dias[0].data + 'T00:00:00Z');
  const fim = new Date(dias[6].data + 'T23:59:59Z');
  return { regras, funcionarios, turnos, alocacoes, periodo: { inicio, fim } };
}

// Substitui a antiga função do server.js, mantendo o MESMO formato de saída:
// [{ nome, violacoes: [mensagens] }] — uma entrada por colaborador com alerta.
function checkComplianceCLT(people, opts) {
  const ctx = contextoDeEscala(people, opts);
  const violacoes = validar(ctx);
  const porNome = new Map();
  for (const v of violacoes) {
    const nome = v.funcionarioId || '—';
    if (!porNome.has(nome)) porNome.set(nome, []);
    porNome.get(nome).push(v.mensagem);
  }
  const resultado = [];
  Object.keys(people || {}).forEach((nome) => {
    if (porNome.has(nome)) resultado.push({ nome, violacoes: porNome.get(nome) });
  });
  return resultado;
}

module.exports = {
  // motor puro
  dataHora, fimTurno, duracaoHoras, somaDias, diaSemana, ehDomingo, segundaFeiraDaSemana, diasEntre,
  diasTrabalhadosPorFuncionario, registry, validar, validarEscala, defaultCctRules,
  // adaptador workforce-OS
  parseWorkedBlocks, turnoParaMotor, semanaPadrao, normalizarRegras, contextoDeEscala, checkComplianceCLT,
};
