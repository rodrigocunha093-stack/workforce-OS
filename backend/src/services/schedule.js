// Geração de escala semanal

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

function generateOperatorShift(startHour, endHour, breakAtHour) {
  const workedHours = endHour - startHour;

  if (breakAtHour !== undefined && workedHours > 6) {
    const breakEnd = breakAtHour + 1;
    const shiftEnd = endHour + 1;
    return `${String(startHour).padStart(2, '0')}:00-${String(breakAtHour).padStart(2, '0')}:00 / ${String(breakEnd).padStart(2, '0')}:00-${String(shiftEnd).padStart(2, '0')}:00`;
  }

  return `${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`;
}

function generateComercialShift(open, close, jornada = 8) {
  const intervalMinutes = getLegalIntervalMinutes(jornada);
  const ocupacao = jornada + (intervalMinutes / 60);
  const dur = close - open;
  const start = open + Math.max(0, Math.round((dur - ocupacao) / 2));
  const end = start + jornada;
  const breakAt = start + 3;

  return generateOperatorShift(start, end, intervalMinutes > 0 ? breakAt : undefined);
}

function generateScheduleByProfile(profile, employees) {
  const horario = parseStoreHours(profile.horario || '08:00-20:00');
  const diasTrabalhados = 6; // 6x1
  const jornada = 44 / diasTrabalhados; // ~7.33h

  const result = {};
  const dias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

  employees.forEach((emp, idx) => {
    const turno = emp.turno || 'flexivel';
    const shifts = new Array(7).fill(null);

    // Simples: distribuição básica
    for (let day = 0; day < 6; day++) {
      if (idx === 0 && day === 0) {
        shifts[day] = generateOperatorShift(horario.open, horario.open + 8);
      } else if (idx === employees.length - 1 && day === 5) {
        shifts[day] = generateOperatorShift(horario.close - 8, horario.close);
      } else if ((idx + day) % 2 === 0) {
        shifts[day] = generateOperatorShift(horario.open + 1, horario.open + 9);
      } else {
        shifts[day] = generateOperatorShift(horario.open + 2, horario.open + 10);
      }
    }

    // Uma folga por semana
    const folgaDay = (idx + Math.floor(Math.random() * 6)) % 6;
    shifts[folgaDay] = 'Folga';
    shifts[6] = 'Folga'; // domingo

    result[emp.name] = shifts;
  });

  return result;
}

module.exports = {
  parseStoreHours,
  generateOperatorShift,
  generateComercialShift,
  generateScheduleByProfile
};
