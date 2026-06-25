// Geração de escala semanal - Algoritmo sofisticado baseado em demanda real
// Implementa todas as regras de negócio do workforce-OS original

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

function generateOperatorShift(startHour, endHour, breakAtHour, breakMinutes = 60) {
  const totalHours = endHour - startHour;

  if (breakAtHour !== undefined && totalHours > 6 && breakMinutes > 0) {
    const breakEndHour = breakAtHour + (breakMinutes / 60);
    const breakEndMinutes = Math.min(59, Math.round((breakEndHour % 1) * 60));
    const breakEndHourInt = Math.floor(breakEndHour);

    const shiftEndTotal = endHour + (breakMinutes / 60);
    const shiftEndMinutes = Math.min(59, Math.round((shiftEndTotal % 1) * 60));
    const shiftEndHourInt = Math.floor(shiftEndTotal);

    return `${String(startHour).padStart(2, '0')}:00-${String(breakAtHour).padStart(2, '0')}:${String(breakMinutes).padStart(2, '0')} / ${String(breakEndHourInt).padStart(2, '0')}:${String(breakEndMinutes).padStart(2, '0')}-${String(shiftEndHourInt).padStart(2, '0')}:00`;
  }

  return `${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`;
}

// Distribui 44h pelos 7 dias conforme peso de demanda
function distribuirJornada(targetHours = 44, dias = [0, 1, 2, 3, 4, 5], pesos = [1, 1, 1, 1, 1.25, 1.35]) {
  const diasTrabalhados = dias.length;
  const jornadaPorDia = new Array(7).fill(0);

  // Base horária por dia
  const basePorDia = targetHours / dias.reduce((a, b) => a + pesos[b], 0);

  // Aloca conforme peso, respeitando piso (5h) e teto (9h)
  let totalAlocado = 0;
  dias.forEach(d => {
    const alocacao = basePorDia * pesos[d];
    const clamped = Math.min(9, Math.max(5, alocacao));
    jornadaPorDia[d] = clamped;
    totalAlocado += clamped;
  });

  // Ajusta iterativamente para atingir exatamente targetHours
  let iteracoes = 0;
  while (Math.abs(totalAlocado - targetHours) > 0.01 && iteracoes < 20) {
    const deficit = targetHours - totalAlocado;
    const deficitPorDia = deficit / diasTrabalhados;

    dias.forEach(d => {
      const novaAlocacao = jornadaPorDia[d] + deficitPorDia * 0.1;
      jornadaPorDia[d] = Math.min(9, Math.max(5, novaAlocacao));
    });

    totalAlocado = dias.reduce((a, d) => a + jornadaPorDia[d], 0);
    iteracoes++;
  }

  return jornadaPorDia;
}

// Determina papéis de cobertura (abridor, fechador, intermediário)
function assignCoverageRoles(employees, numAbridores, numFechadores) {
  const roles = {};

  // Primeiro: respeita preferências explícitas
  let abrindoresAssigned = 0;
  let fechadoresAssigned = 0;

  employees.forEach(emp => {
    if (emp.turno === 'abertura' && abrindoresAssigned < numAbridores) {
      roles[emp.name] = 'abridor';
      abrindoresAssigned++;
    } else if (emp.turno === 'fechamento' && fechadoresAssigned < numFechadores) {
      roles[emp.name] = 'fechador';
      fechadoresAssigned++;
    }
  });

  // Completa com flexíveis
  employees.forEach(emp => {
    if (roles[emp.name]) return; // Já atribuído

    if (abrindoresAssigned < numAbridores && emp.turno !== 'fechamento') {
      roles[emp.name] = 'abridor';
      abrindoresAssigned++;
    } else if (fechadoresAssigned < numFechadores && emp.turno !== 'abertura') {
      roles[emp.name] = 'fechador';
      fechadoresAssigned++;
    } else {
      roles[emp.name] = 'intermediario';
    }
  });

  return roles;
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
function generateTurnoForDay(papel, startHour, jobHours, horarioFechamento, breakMinutes = 60) {
  let start = Math.round(startHour * 2) / 2; // Arredonda para 0.5
  let end = start + Math.round(jobHours * 2) / 2;

  // Ajusta para respeitar horário de fechamento
  if (papel === 'fechador' && end > horarioFechamento) {
    start = horarioFechamento - jobHours;
    end = horarioFechamento;
  }

  const breakAtHour = papel === 'abridor' ? Math.floor(start + 2) : Math.floor(start + 3);

  return generateOperatorShift(Math.floor(start), Math.floor(end), breakAtHour, breakMinutes);
}

// Valida compliance CLT
function checkComplianceCLT(staffSchedule) {
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

      // Regra 1: 44h máximo por semana
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

        // Regra 6: máximo 10h por dia
        if (dayHours > 10) {
          violations.push({ name, day, type: 'daily_max_10h', hours: dayHours });
        }
      }

      // Regra 2: Dias consecutivos (máx 6)
      if (consecutiveDays > 6) {
        violations.push({ name, day, type: 'consecutive_days_max_6' });
      }

      // Regra 3: Interjornada (11h mínimo)
      if (lastEndHour !== null && day < 6) {
        const nextShift = shifts[day + 1];
        if (nextShift && nextShift !== 'Folga') {
          const nextMatch = nextShift.match(/(\d{2}):(\d{2})/);
          if (nextMatch) {
            const [nh, nm] = nextMatch;
            const nextStart = parseInt(nh) + parseInt(nm) / 60;
            const rest = 24 - lastEndHour + nextStart;
            if (rest < 11) {
              violations.push({ name, day, type: 'interjornada_min_11h', rest });
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

    // Regra 1: 44h máximo por semana
    if (totalHours > 44) {
      violations.push({ name, type: 'weekly_max_44h', hours: totalHours });
    }

    // Regra 4: DSR (pelo menos 1 folga por semana)
    const numFolgas = shifts.filter(s => s === 'Folga').length;
    if (numFolgas < 1) {
      violations.push({ name, type: 'dsr_min_1_per_week' });
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
    if (emp.folgaPreferencial) {
      const dayMap = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 };
      preferredBreaks[idx] = dayMap[emp.folgaPreferencial];
    }
  });

  const folgas = determineFolgas(employees.length, targetDaysOff, blockedDaysForBreak, preferredBreaks);

  // 5. Gera turnos para cada funcionário
  employees.forEach((emp, idx) => {
    const shifts = new Array(7).fill('Folga');
    const papel = roles[emp.name];
    const folgaDias = folgas[idx] || [];

    // Distribui trabalho seg-sab conforme demanda e papel
    for (let day = 0; day < 6; day++) {
      if (folgaDias.includes(day)) {
        shifts[day] = 'Folga';
        continue;
      }

      const horasDia = jornadaPorDia[day];
      let startHour = horario.open;

      // Ajusta hora de início conforme papel
      if (papel === 'abridor') {
        startHour = horario.open;
      } else if (papel === 'fechador') {
        startHour = horario.close - horasDia;
      } else {
        startHour = horario.open + 1 + (idx % 2) * 0.5;
      }

      const breakMinutes = getLegalIntervalMinutes(horasDia);
      shifts[day] = generateTurnoForDay(papel, startHour, horasDia, horario.close, breakMinutes);
    }

    // Domingo: resprita lei 10.101 (rodízio)
    const weekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    shifts[6] = ((idx + weekSeed) % 3 === 0) ? 'Folga' : shifts[0]; // Rodízio 1 em 3 semanas

    result[emp.name] = shifts;
  });

  return result;
}

module.exports = {
  parseStoreHours,
  generateOperatorShift,
  generateScheduleByProfile,
  distribuirJornada,
  assignCoverageRoles,
  identifyBlockedDaysForBreak,
  determineFolgas,
  checkComplianceCLT,
  getLegalIntervalMinutes
};
