// Geração de escala semanal - Algoritmo sofisticado baseado em demanda real
// Implementa todas as regras de negócio do workforce-OS original

const { isOperadorCaixa, parseWorkedBlocks } = require('./scheduleCoverage');

function parseStoreHours(horarioStr) {
  const [start, end] = (horarioStr || '08:00-20:00').split('-');
  const [sh, sm] = start.split(':');
  const [eh, em] = end.split(':');
  return {
    open: parseInt(sh),
    close: parseInt(eh)
  };
}

function getLegalIntervalMinutes(jornada) {
  if (jornada > 6) return 60;
  if (jornada > 4) return 15;
  return 0;
}

// Formata uma hora fracionária (ex.: 7.5) como "HH:MM" — antes o código só
// sabia formatar hora cheia (":00"), então qualquer meia-hora calculada em
// distribuirJornada/generateTurnoForDay era truncada (Math.floor) antes de
// virar texto, e a jornada exibida acabava diferente da jornada real
// alocada (por isso o total de horas do turno gerado não batia com o alvo).
function formatHour(h) {
  const hourInt = Math.floor(h + 1e-9);
  let minutes = Math.round((h - hourInt) * 60);
  let hourFinal = hourInt;
  if (minutes === 60) { minutes = 0; hourFinal += 1; }
  return `${String(hourFinal).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function generateOperatorShift(startHour, endHour, breakAtHour, breakMinutes = 60) {
  const totalHours = endHour - startHour;

  if (breakAtHour !== undefined && totalHours > 6 && breakMinutes > 0) {
    const breakEndHour = breakAtHour + (breakMinutes / 60);
    const shiftEndTotal = endHour + (breakMinutes / 60);
    return `${formatHour(startHour)}-${formatHour(breakAtHour)} / ${formatHour(breakEndHour)}-${formatHour(shiftEndTotal)}`;
  }

  return `${formatHour(startHour)}-${formatHour(endHour)}`;
}

// Distribui 44h pelos 7 dias conforme peso de demanda
function distribuirJornada(targetHours = 44, dias = [0, 1, 2, 3, 4, 5], pesos = [1, 1, 1, 1, 1.25, 1.35, 1]) {
  const jornadaPorDia = new Array(7).fill(0);

  // Base horária por dia — pesos[d] pode faltar (ex.: domingo, índice 6,
  // se quem chamou passou um array de 6 posições) — 1 (peso neutro) evita NaN.
  const pesoDia = (d) => (pesos[d] !== undefined ? pesos[d] : 1);
  const basePorDia = targetHours / dias.reduce((a, b) => a + pesoDia(b), 0);

  // Aloca conforme peso, respeitando piso (5h) e teto (9h)
  dias.forEach(d => {
    const alocacao = basePorDia * pesoDia(d);
    jornadaPorDia[d] = Math.min(9, Math.max(5, alocacao));
  });

  // "Water-filling": redistribui a diferença pro alvo só entre os dias que
  // ainda têm folga no teto/piso — converge exato (o ajuste amortecido
  // antigo, "* 0.1" por 20 iterações, não fechava a conta quando algum dia
  // batia no teto/piso, sobrando um resíduo de horas nunca alocado).
  for (let iteracoes = 0; iteracoes < 50; iteracoes++) {
    const totalAlocado = dias.reduce((a, d) => a + jornadaPorDia[d], 0);
    const diff = targetHours - totalAlocado;
    if (Math.abs(diff) < 0.005) break;

    const ajustaveis = dias.filter((d) => (diff > 0 ? jornadaPorDia[d] < 9 - 1e-6 : jornadaPorDia[d] > 5 + 1e-6));
    if (!ajustaveis.length) break; // alvo inatingível dentro do piso/teto — já é o melhor possível

    const parcela = diff / ajustaveis.length;
    ajustaveis.forEach((d) => {
      jornadaPorDia[d] = Math.min(9, Math.max(5, jornadaPorDia[d] + parcela));
    });
  }

  return jornadaPorDia;
}

// ---- Pontuação de aderência ao papel (portado 1:1 do projeto modelo,
// server.js:3262-3319 — PROFICIENCY_SCORE/ROLE_WEIGHT/employeeRoleScore) ----
// Decide, entre os funcionários "flexíveis", quem tem melhor perfil pra
// abrir/fechar a loja, em vez de só pegar o primeiro/último da lista.

const PROFICIENCY_SCORE = { iniciante: 1, pleno: 2, senior: 3, lider: 4 };
const ROLE_WEIGHT = { abridor: 6, intermediario: 3, fechador: 7, 'abertura-fechamento': 7 };
const ROLE_TO_TURNO = { abridor: 'abertura', fechador: 'fechamento', intermediario: 'intermediario' };

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function restrictionHas(emp, ...terms) {
  const restricoes = (Array.isArray(emp.restricoes) ? emp.restricoes : []).map(normalizeText);
  return terms.some((term) => restricoes.includes(normalizeText(term)));
}

// Restrição é bloqueio duro: nunca escala nesse papel, não importa a pontuação.
function canEmployeeWorkRole(emp, role) {
  if ((role === 'fechador' || role === 'abertura-fechamento') && restrictionHas(emp, 'noturno', 'noite', 'fechamento')) return false;
  if ((role === 'abridor' || role === 'abertura-fechamento') && restrictionHas(emp, 'abertura', 'manha', 'manhã')) return false;
  if (role === 'intermediario' && restrictionHas(emp, 'intermediario', 'central')) return false;
  return true;
}

// Além do campo pode_domingo, uma restrição explícita "domingo" também bloqueia.
function canEmployeeWorkSunday(emp) {
  if (emp.pode_domingo === false) return false;
  if (restrictionHas(emp, 'domingo')) return false;
  return true;
}

function employeeRolePreferenceScore(emp, role) {
  const roleTurno = ROLE_TO_TURNO[role];
  const pref = String(emp.turno || 'flexivel').toLowerCase();
  const papel = String(emp.papel_operacional || 'auto').toLowerCase();
  let score = 0;
  if (pref === roleTurno) score += 12;
  else if (pref !== 'flexivel' && pref !== roleTurno) score -= 4;
  if (papel === roleTurno) score += 14;
  else if (papel !== 'auto' && papel !== roleTurno) score -= 3;
  return score;
}

function employeeRoleScore(emp, role) {
  // Proficiência sem valor definido pesa neutro (2, igual "pleno") — não
  // tem default no cadastro (é campo obrigatório vazio até o admin
  // escolher), mas aqui não pode travar o algoritmo, só fica sem bônus/ônus.
  const prof = PROFICIENCY_SCORE[String(emp.proficiencia || '').toLowerCase()] || 2;
  let score = 0;
  if (!canEmployeeWorkRole(emp, role)) score -= 1000;
  score += prof * (ROLE_WEIGHT[role] || 2);
  score += employeeRolePreferenceScore(emp, role);
  if (role === 'fechador' && canEmployeeWorkSunday(emp)) score += 2;
  return score;
}

// Determina papéis de cobertura (abridor, fechador, intermediário).
// Preferência explícita (turno='abertura'/'fechamento') sempre vale — quem
// sobra ("flexível") é ranqueado por employeeRoleScore em vez de pegar só
// o primeiro/último da lista.
function assignCoverageRoles(employees, numAbridores, numFechadores) {
  const roles = {};
  const used = new Set();

  employees.forEach((emp) => {
    if (emp.turno === 'abertura') { roles[emp.name] = 'abridor'; used.add(emp.name); }
    else if (emp.turno === 'fechamento') { roles[emp.name] = 'fechador'; used.add(emp.name); }
  });

  const abrindoresJaAssigned = Object.values(roles).filter((r) => r === 'abridor').length;
  const fechadoresJaAssigned = Object.values(roles).filter((r) => r === 'fechador').length;
  const flexiveis = employees.filter((emp) => !used.has(emp.name));

  const rankFor = (role) => flexiveis
    .filter((emp) => !used.has(emp.name))
    .map((emp) => ({ emp, score: employeeRoleScore(emp, role) }))
    .sort((a, b) => b.score - a.score);

  let faltamAbridores = numAbridores - abrindoresJaAssigned;
  while (faltamAbridores > 0) {
    const ranked = rankFor('abridor');
    if (!ranked.length) break;
    roles[ranked[0].emp.name] = 'abridor';
    used.add(ranked[0].emp.name);
    faltamAbridores--;
  }

  let faltamFechadores = numFechadores - fechadoresJaAssigned;
  while (faltamFechadores > 0) {
    const ranked = rankFor('fechador');
    if (!ranked.length) break;
    roles[ranked[0].emp.name] = 'fechador';
    used.add(ranked[0].emp.name);
    faltamFechadores--;
  }

  flexiveis.filter((emp) => !used.has(emp.name)).forEach((emp) => {
    roles[emp.name] = 'intermediario';
    used.add(emp.name);
  });

  return roles;
}

// ---- Agrupamento por setor (portado do projeto modelo, server.js:1261 e
// 3236-3259 — scheduleGroupKey/generateGroupedSchedule) ----
//
// No modelo, a escala NUNCA é gerada pra empresa toda de uma vez: cada
// setor operacional (Frente de Caixa, Açougue, Padaria...) tem sua própria
// escala, gerada isoladamente, e só depois mescladas. Isso é o que faz
// papel de abridor/fechador fazer sentido por setor (metade abre, metade
// fecha DAQUELE setor, não da loja inteira) — no nosso schedule.js isso
// nunca existiu: gerávamos uma escala só, achatada, pra todo mundo junto.
function scheduleGroupKey(emp) {
  if (isOperadorCaixa(emp)) return 'frente de caixa';
  const setor = normalizeText(emp.setor);
  if (setor) return setor;
  const cargo = normalizeText(emp.cargo);
  return cargo || 'sem setor';
}

// Cobertura por setor: 1 colaborador -> centraliza; N colaboradores ->
// floor(N/2) fixos na abertura, floor(N/2) no fechamento, sobra (ímpar) no
// intermediário. Preferência explícita de turno sempre vale primeiro.
function assignCoverageRolesBySector(employees) {
  if (employees.length <= 1) {
    return employees.map((emp) => ({ ...emp, _coverageRole: 'central' }));
  }

  const half = Math.floor(employees.length / 2);
  const explicitOpen = [];
  const explicitClose = [];
  const explicitMiddle = [];
  const flex = [];

  employees.forEach((emp) => {
    const turno = String(emp.turno || 'flexivel').toLowerCase();
    if (turno === 'abertura') explicitOpen.push(emp);
    else if (turno === 'fechamento') explicitClose.push(emp);
    else if (turno === 'intermediario') explicitMiddle.push(emp);
    else flex.push(emp);
  });

  const result = [];
  explicitOpen.forEach((emp) => result.push({ ...emp, _coverageRole: 'abertura' }));
  explicitClose.forEach((emp) => result.push({ ...emp, _coverageRole: 'fechamento' }));
  explicitMiddle.forEach((emp) => result.push({ ...emp, _coverageRole: 'intermediario' }));

  let openingSlots = Math.max(0, half - explicitOpen.length);
  let closingSlots = Math.max(0, half - explicitClose.length);
  const flexPool = [...flex];

  while (openingSlots > 0 && flexPool.length) {
    result.push({ ...flexPool.shift(), _coverageRole: 'abertura' });
    openingSlots -= 1;
  }
  while (closingSlots > 0 && flexPool.length) {
    result.push({ ...flexPool.pop(), _coverageRole: 'fechamento' });
    closingSlots -= 1;
  }
  flexPool.forEach((emp) => result.push({ ...emp, _coverageRole: 'intermediario' }));

  return result;
}

// Gera a escala agrupando por setor operacional: cada grupo é escalado
// isoladamente (abertura/fechamento calculados dentro do próprio grupo) e
// depois mesclados num único mapa nome->turnos. Só "Frente de Caixa" usa a
// curva de demanda real por hora — os outros setores usam distribuição
// genérica por dia da semana (é o que o modelo faz: só caixa tem histórico
// de clientes/hora suficiente pra dimensionar por demanda real).
function generateGroupedSchedule(profile, employees, targetHours = 44, targetDaysOff = 1, demandaIndices = undefined) {
  const horario = parseStoreHours(profile.horario || '08:00-20:00');
  const groups = {};
  (employees || []).forEach((emp) => {
    const key = scheduleGroupKey(emp);
    groups[key] = groups[key] || [];
    groups[key].push(emp);
  });

  const merged = {};
  Object.values(groups).forEach((grupo) => {
    // _coverageRole vira o `turno` efetivo lido por assignCoverageRoles/
    // generateScheduleByProfile — usa turno explícito se a pessoa já tinha,
    // senão a metade/metade calculada por setor.
    const grupoComCobertura = assignCoverageRolesBySector(grupo).map((emp) => ({
      ...emp,
      turno: emp.turno && emp.turno !== 'flexivel' ? emp.turno : mapCoverageRoleToTurno(emp._coverageRole),
    }));
    const escalaGrupo = generateScheduleByProfile(profile, grupoComCobertura, targetHours, targetDaysOff, demandaIndices);

    // Tenta redistribuir os moldes semanais entre as pessoas do grupo pra
    // melhorar aderência de perfil — só aplica se não piorar CLT/equilíbrio.
    const baselineMetrics = buildGroupMetrics(escalaGrupo, grupoComCobertura, horario);
    const otimizado = optimizeWeeklyTemplateAssignments(grupoComCobertura, escalaGrupo, horario);
    const otimizadoMetrics = buildGroupMetrics(otimizado, grupoComCobertura, horario);
    const escalaFinal = isBetterGroupCandidate(otimizadoMetrics, baselineMetrics) ? otimizado : escalaGrupo;

    Object.assign(merged, escalaFinal);
  });
  return merged;
}

function mapCoverageRoleToTurno(role) {
  if (role === 'abertura') return 'abertura';
  if (role === 'fechamento') return 'fechamento';
  return 'flexivel';
}

// ---- Otimização por trocas (portado do projeto modelo,
// server.js:3444-3530 — shiftStartEnd/inferRoleFromShift/
// optimizeWeeklyTemplateAssignments/isBetterGroupCandidate) ----
//
// A geração inicial por setor (acima) monta 7 dias por pessoa em ordem
// arbitrária. Essa etapa pega os "moldes semanais" já gerados pro grupo e
// tenta redistribuí-los entre as pessoas do grupo pra maximizar aderência
// de perfil (quem tem proficiência/papel/restrição mais alinhado pega o
// molde de abertura/fechamento) — só aceita a troca se ela não piorar
// conformidade CLT nem o equilíbrio de horas do grupo.

function shiftBounds(shift) {
  if (!shift || shift === 'Folga') return null;
  const blocks = parseWorkedBlocks(shift);
  if (!blocks.length) return null;
  return { start: blocks[0].start, end: blocks[blocks.length - 1].end };
}

function shiftWorkedHours(shift) {
  return parseWorkedBlocks(shift).reduce((sum, b) => sum + (b.end - b.start), 0);
}

// horario: { open, close } em horas decimais (mesmo formato de parseStoreHours).
function inferRoleFromShift(shift, horario, fallback = 'intermediario') {
  if (!shift || shift === 'Folga') return 'folga';
  const bounds = shiftBounds(shift);
  if (!bounds || !horario) return fallback;
  const abre = bounds.start <= horario.open;
  const fecha = bounds.end >= horario.close;
  if (abre && fecha) return 'abertura-fechamento';
  if (abre) return 'abridor';
  if (fecha) return 'fechador';
  return fallback;
}

function shiftSlotPriority(shift, dayIndex, horario) {
  if (!shift || shift === 'Folga') return dayIndex === 6 ? 0.5 : 0;
  const role = inferRoleFromShift(shift, horario, 'intermediario');
  if (role === 'abertura-fechamento') return 10;
  if (role === 'fechador') return 9;
  if (role === 'abridor') return 8;
  if (role === 'intermediario') return 4;
  return 2;
}

function scoreEmployeeShiftForGroup(emp, shift, dayIndex, horario) {
  if (!shift || shift === 'Folga') {
    if (dayIndex === 6 && !canEmployeeWorkSunday(emp)) return 4;
    return 0;
  }
  if (dayIndex === 6 && !canEmployeeWorkSunday(emp)) return -1000;
  const role = inferRoleFromShift(shift, horario, 'intermediario');
  return employeeRoleScore(emp, role);
}

// Reatribui os moldes semanais já gerados (mantém os HORÁRIOS, troca só
// QUEM os assume) — pega o molde mais "exigente" primeiro (abertura-
// fechamento > fechador > abridor > intermediário) e dá pra quem pontua
// melhor nele.
function optimizeWeeklyTemplateAssignments(groupEmployees, baselineGroupPeople, horario) {
  const templates = groupEmployees.map((emp, index) => {
    const shifts = baselineGroupPeople[emp.name] || [];
    return {
      shifts,
      sortIndex: index,
      priority: shifts.reduce((sum, shift, dayIndex) => sum + shiftSlotPriority(shift, dayIndex, horario), 0),
    };
  });

  const remaining = [...groupEmployees];
  const assigned = {};

  templates
    .sort((a, b) => b.priority - a.priority || a.sortIndex - b.sortIndex)
    .forEach((template) => {
      const ranked = remaining
        .map((emp, index) => ({
          emp,
          index,
          score: template.shifts.reduce((sum, shift, dayIndex) => sum + scoreEmployeeShiftForGroup(emp, shift, dayIndex, horario), 0),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const best = ranked[0];
      if (!best) return;
      assigned[best.emp.name] = [...template.shifts];
      remaining.splice(best.index, 1);
    });

  return assigned;
}

function computeGroupHourSpread(people, names) {
  const totals = names.map((name) => (people[name] || []).reduce((sum, shift) => sum + shiftWorkedHours(shift), 0));
  if (!totals.length) return 0;
  return Math.max(...totals) - Math.min(...totals);
}

function buildRoleAssignmentQuality(people, groupEmployees, horario) {
  let total = 0;
  let ponta = 0;
  groupEmployees.forEach((emp) => {
    const shifts = people[emp.name] || [];
    shifts.forEach((shift, dayIndex) => {
      if (!shift || shift === 'Folga') return;
      const role = inferRoleFromShift(shift, horario, 'intermediario');
      const score = employeeRoleScore(emp, role);
      total += score;
      if (role === 'abridor' || role === 'fechador' || role === 'abertura-fechamento') ponta += score;
    });
  });
  return { total, ponta };
}

function buildGroupMetrics(people, groupEmployees, horario) {
  const names = groupEmployees.map((emp) => emp.name);
  return {
    complianceCount: checkComplianceCLT(people).length,
    spread: computeGroupHourSpread(people, names),
    quality: buildRoleAssignmentQuality(people, groupEmployees, horario),
  };
}

// Só aceita a troca se ela não piorar conformidade CLT nem espalhar mais as
// horas entre o grupo, e melhorar a pontuação de aderência de perfil.
function isBetterGroupCandidate(candidateMetrics, referenceMetrics) {
  if (candidateMetrics.complianceCount > referenceMetrics.complianceCount) return false;
  if (candidateMetrics.spread > Math.max(2, referenceMetrics.spread)) return false;
  if (candidateMetrics.quality.total < referenceMetrics.quality.total) return false;
  if (candidateMetrics.quality.ponta < referenceMetrics.quality.ponta) return false;
  return (
    candidateMetrics.quality.total > referenceMetrics.quality.total ||
    candidateMetrics.quality.ponta > referenceMetrics.quality.ponta
  );
}

// Explica pro gestor por que aquela pessoa foi escalada naquele papel —
// mesma ideia do buildRoleJustification do modelo (server.js:3408-3418).
function buildRoleJustification(emp, role) {
  const roleLabel = { abridor: 'abertura', fechador: 'fechamento', intermediario: 'intermediário', 'abertura-fechamento': 'abertura e fechamento' }[role] || role;
  const refs = [];
  if (emp.proficiencia) refs.push(`proficiência ${emp.proficiencia}`);
  if (emp.turno && emp.turno !== 'flexivel') refs.push(`preferência de turno ${emp.turno}`);
  if (emp.papel_operacional && emp.papel_operacional !== 'auto') refs.push(`papel travado em ${emp.papel_operacional}`);
  if (Array.isArray(emp.restricoes) && emp.restricoes.length) refs.push(`restrições respeitadas: ${emp.restricoes.join(', ')}`);
  return `Alocado em ${roleLabel}${refs.length ? ` (${refs.join(' · ')})` : ' (sem preferências específicas registradas)'}.`;
}

// Monta um mapa nome -> lista de justificativas (uma por dia trabalhado)
// pra exibir ao gestor o motivo de cada alocação. `horario` é o mesmo
// {open, close} usado na geração.
function buildScheduleJustifications(employees, schedule, horario) {
  const justifications = {};
  (employees || []).forEach((emp) => {
    const shifts = schedule[emp.name] || [];
    justifications[emp.name] = shifts.map((shift) => {
      if (!shift || shift === 'Folga') return 'Folga.';
      const role = inferRoleFromShift(shift, horario, 'intermediario');
      return buildRoleJustification(emp, role);
    });
  });
  return justifications;
}

// Identifica dias bloqueados para folga (picos de demanda)
function identifyBlockedDaysForBreak(demandaIndices = [1.0, 1.0, 1.0, 1.0, 1.25, 1.35]) {
  const indices = demandaIndices.map((d, i) => ({ day: i, demand: d }));
  const topDays = indices
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 3)
    .filter(d => d.demand > 1.0)
    .map(d => d.day);

  return topDays;
}

// Determina as folgas respeitando regras de negócio
function determineFolgas(numEmployees, numDaysOff = 1, blockedDays = [], preferredDays = {}) {
  const diasDisponiveis = [0, 1, 2, 3, 4, 5]; // seg-sab
  const diasValidos = diasDisponiveis.filter(d => !blockedDays.includes(d));

  const result = {};
  let dayIndex = 0;

  for (let emp = 0; emp < numEmployees; emp++) {
    const selectedDays = [];

    for (let i = 0; i < numDaysOff; i++) {
      let nextDay;
      if (preferredDays[emp] !== undefined && !selectedDays.includes(preferredDays[emp])) {
        nextDay = preferredDays[emp];
      } else {
        nextDay = diasValidos[dayIndex % diasValidos.length];
        dayIndex++;
      }
      selectedDays.push(nextDay);
    }

    result[emp] = selectedDays;
  }

  return result;
}

// Gera turno para um dia específico baseado em papel e demanda
function generateTurnoForDay(papel, startHour, jobHours, horarioFechamento, breakMinutes = 60, staggerIdx = 0) {
  let start = Math.round(startHour * 2) / 2; // Arredonda para 0.5
  let end = start + Math.round(jobHours * 2) / 2;

  // Ajusta para respeitar horário de fechamento
  if (papel === 'fechador' && end > horarioFechamento) {
    start = horarioFechamento - jobHours;
    end = horarioFechamento;
  }

  // Sem o escalonamento (`stagger`), todo abridor tinha intervalo
  // exatamente em start+2h e todo o resto em start+3h — como a maioria
  // do time compartilha o mesmo horário de início, isso zerava a
  // cobertura de caixa inteira bem na mesma hora (visível no Controller
  // de Frente de Caixa como "0 escalados" simultâneo pra todo mundo).
  // Espalha em 3 faixas de 30min (0/0.5/1h) por índice do funcionário.
  const baseOffset = papel === 'abridor' ? 2 : 3;
  const stagger = (staggerIdx % 3) * 0.5;
  const jobHoursRounded = Math.round(jobHours * 2) / 2;
  const maxOffset = Math.max(1, jobHoursRounded - 2); // deixa ≥1h antes do fim
  const breakAtHour = start + Math.min(baseOffset + stagger, maxOffset);

  return generateOperatorShift(start, end, breakAtHour, breakMinutes);
}

// Regras CLT federal — usadas como padrão sempre que a empresa não
// customizou (ou apagou) uma regra específica. Cada regra tem `enabled`,
// um valor de referência, e `blocks` (true = trava publicação da escala,
// false = só gera aviso informativo).
const CLT_FEDERAL_DEFAULTS = {
  maxWeeklyHours: { enabled: true, value: 44, blocks: true },
  interjornada: { enabled: true, value: 11, blocks: true },
  intervalo: { enabled: true, minMinutes: 60, acimaDeHoras: 6, blocks: true },
  dsr: { enabled: true, folgasPerWeek: 1, blocks: true },
  maxDailyHours: { enabled: true, value: 10, blocks: true },
  maxConsecutiveDays: { enabled: true, value: 6, blocks: true },
};

function mergeCltRules(customRules) {
  const merged = {};
  Object.keys(CLT_FEDERAL_DEFAULTS).forEach((key) => {
    merged[key] = { ...CLT_FEDERAL_DEFAULTS[key], ...(customRules?.[key] || {}) };
  });
  return merged;
}

const DIA_SEMANA_NOMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

// Valida compliance CLT/CCT — `customRules` (opcional) sobrescreve os
// padrões federais por empresa (ver mergeCltRules). Cada violação carrega
// `blocks` (se essa regra específica bloqueia publicação ou só avisa) e
// uma `message` pronta pra exibir ao gestor.
function checkComplianceCLT(staffSchedule, customRules) {
  const rules = mergeCltRules(customRules);
  const violations = [];

  Object.entries(staffSchedule).forEach(([name, shifts]) => {
    let totalHours = 0;
    let consecutiveDays = 0;
    let lastEndHour = null;

    for (let day = 0; day < 7; day++) {
      const shift = shifts[day];

      if (shift === 'Folga') {
        consecutiveDays = 0;
        continue;
      }

      consecutiveDays++;

      const match = shift.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/g);
      if (match) {
        let dayHours = 0;
        match.forEach(m => {
          const [start, end] = m.split('-');
          const [sh, sm] = start.split(':');
          const [eh, em] = end.split(':');
          const s = parseInt(sh) + parseInt(sm) / 60;
          const e = parseInt(eh) + parseInt(em) / 60;
          dayHours += e - s;
        });
        totalHours += dayHours;

        if (rules.maxDailyHours.enabled && dayHours > rules.maxDailyHours.value) {
          violations.push({
            name, day, type: 'daily_max_10h', hours: dayHours, blocks: rules.maxDailyHours.blocks,
            message: `${name}: jornada de ${dayHours.toFixed(1)}h na ${DIA_SEMANA_NOMES[day]} passou do limite diário de ${rules.maxDailyHours.value}h.`,
          });
        }
      }

      if (rules.maxConsecutiveDays.enabled && consecutiveDays > rules.maxConsecutiveDays.value) {
        violations.push({
          name, day, type: 'consecutive_days_max_6', blocks: rules.maxConsecutiveDays.blocks,
          message: `${name}: ultrapassou ${rules.maxConsecutiveDays.value} dias seguidos trabalhados.`,
        });
      }

      if (rules.interjornada.enabled && lastEndHour !== null && day < 6) {
        const nextShift = shifts[day + 1];
        if (nextShift && nextShift !== 'Folga') {
          const nextMatch = nextShift.match(/(\d{2}):(\d{2})/);
          if (nextMatch) {
            const [nh, nm] = nextMatch;
            const nextStart = parseInt(nh) + parseInt(nm) / 60;
            const rest = 24 - lastEndHour + nextStart;
            if (rest < rules.interjornada.value) {
              violations.push({
                name, day, type: 'interjornada_min_11h', rest, blocks: rules.interjornada.blocks,
                message: `${name}: descanso de ${rest.toFixed(1)}h entre a ${DIA_SEMANA_NOMES[day]} e o dia seguinte ficou abaixo do mínimo de ${rules.interjornada.value}h.`,
              });
            }
          }
        }
      }

      const endMatch = shift.match(/(\d{2}):(\d{2})$/);
      if (endMatch) {
        const [eh, em] = endMatch;
        lastEndHour = parseInt(eh) + parseInt(em) / 60;
      }
    }

    if (rules.maxWeeklyHours.enabled && totalHours > rules.maxWeeklyHours.value) {
      violations.push({
        name, type: 'weekly_max_44h', hours: totalHours, blocks: rules.maxWeeklyHours.blocks,
        message: `${name}: jornada semanal de ${totalHours.toFixed(1)}h passou do limite de ${rules.maxWeeklyHours.value}h.`,
      });
    }

    const numFolgas = shifts.filter(s => s === 'Folga').length;
    if (rules.dsr.enabled && numFolgas < rules.dsr.folgasPerWeek) {
      violations.push({
        name, type: 'dsr_min_1_per_week', blocks: rules.dsr.blocks,
        message: `${name}: teve só ${numFolgas} folga(s) na semana (mínimo exigido: ${rules.dsr.folgasPerWeek}).`,
      });
    }
  });

  return violations;
}

// Função principal: gera escala completa
function generateScheduleByProfile(profile, employees, targetHours = 44, targetDaysOff = 1, demandaIndices = [1, 1, 1, 1, 1.25, 1.35]) {
  const horario = parseStoreHours(profile.horario || '08:00-20:00');
  const result = {};

  // 1. Determina dias bloqueados para folga (dias de pico)
  const blockedDaysForBreak = identifyBlockedDaysForBreak(demandaIndices);

  // 2. Distribui horas conforme demanda
  const jornadaPorDia = distribuirJornada(targetHours, [0, 1, 2, 3, 4, 5], demandaIndices);

  // 3. Atribui papéis (abridor/fechador)
  const numAbridores = Math.max(1, Math.floor(employees.length / 2));
  const numFechadores = Math.max(1, Math.floor(employees.length / 2));
  const roles = assignCoverageRoles(employees, numAbridores, numFechadores);

  // 4. Determina folgas
  const preferredBreaks = {};
  employees.forEach((emp, idx) => {
    if (emp.folga_preferencial) {
      const dayMap = { domingo: 6, segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 };
      const dia = dayMap[emp.folga_preferencial];
      if (dia !== undefined && dia < 6) preferredBreaks[idx] = dia;
    }
  });

  // Regime 5x2 (targetDaysOff >= 2): domingo vira folga FIXA toda semana,
  // não mais rodízio — então só falta escolher (targetDaysOff - 1) folgas
  // entre segunda e sábado. No 6x1 (targetDaysOff = 1), domingo continua
  // sendo tratado à parte pelo rodízio de 1 em 3 semanas (como sempre foi).
  const regime5x2 = targetDaysOff >= 2;
  const folgasSegSab = regime5x2 ? targetDaysOff - 1 : targetDaysOff;
  const folgas = determineFolgas(employees.length, folgasSegSab, blockedDaysForBreak, preferredBreaks);

  // 5. Gera turnos para cada funcionário
  // A jornada é redistribuída POR PESSOA, só entre os dias que ela de fato
  // trabalha naquela semana (Mon-Sáb menos a(s) folga(s) + domingo se
  // aplicável) — nunca fatiada num número fixo de dias e depois descartada
  // quando cai numa folga, senão a soma nunca bate com targetHours.
  employees.forEach((emp, idx) => {
    const shifts = new Array(7).fill('Folga');
    const papel = roles[emp.name];
    const folgaDias = folgas[idx] || [];

    // Domingo: no 5x2 é folga fixa (2ª folga da semana); no 6x1 respeita
    // pode_domingo/restrição e aplica o rodízio de 1 em 3 semanas.
    const podeDomingo = canEmployeeWorkSunday(emp);
    let domingoTrabalha;
    if (regime5x2 || !podeDomingo) {
      domingoTrabalha = false;
    } else {
      const weekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
      domingoTrabalha = (idx + weekSeed) % 3 !== 0; // rodízio: folga 1 em 3 semanas
    }

    const diasTrabalho = [0, 1, 2, 3, 4, 5].filter((d) => !folgaDias.includes(d));
    if (domingoTrabalha) diasTrabalho.push(6);

    // Contrato individual (ex: meio-período) prevalece sobre o alvo do
    // cenário — sem isso, todo mundo era escalado pra 44h/42h/40h mesmo
    // quem tem horas_semanais menor cadastrado na Implantação.
    const empTargetHours = emp.horas_semanais && Number(emp.horas_semanais) > 0
      ? Number(emp.horas_semanais)
      : targetHours;
    const jornadaPorDiaEmp = distribuirJornada(empTargetHours, diasTrabalho, demandaIndices);

    diasTrabalho.forEach((day) => {
      const horasDia = jornadaPorDiaEmp[day];
      let startHour = horario.open;

      if (papel === 'abridor') {
        startHour = horario.open;
      } else if (papel === 'fechador') {
        startHour = horario.close - horasDia;
      } else {
        startHour = horario.open + 1 + (idx % 2) * 0.5;
      }

      const breakMinutes = getLegalIntervalMinutes(horasDia);
      shifts[day] = generateTurnoForDay(papel, startHour, horasDia, horario.close, breakMinutes, idx);
    });

    result[emp.name] = shifts;
  });

  return result;
}

module.exports = {
  parseStoreHours,
  generateOperatorShift,
  generateScheduleByProfile,
  generateGroupedSchedule,
  scheduleGroupKey,
  distribuirJornada,
  assignCoverageRoles,
  identifyBlockedDaysForBreak,
  determineFolgas,
  checkComplianceCLT,
  mergeCltRules,
  CLT_FEDERAL_DEFAULTS,
  getLegalIntervalMinutes,
  employeeRoleScore,
  canEmployeeWorkRole,
  canEmployeeWorkSunday,
  buildRoleJustification,
  buildScheduleJustifications,
  inferRoleFromShift,
};
