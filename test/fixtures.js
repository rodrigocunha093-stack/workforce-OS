'use strict';
// Builders de fixture (portados do EscalaDP §6): cenários de teste legíveis.

function umFuncionario(over = {}) {
  return { id: 'func-1', nome: 'Fulano', sexo: 'masculino', tipoContrato: 'clt', ...over };
}
function umTurno(over = {}) {
  return { id: 'turno-1', nome: 'Manhã', inicio: '08:00', fim: '16:00', intervaloMin: 60, ...over };
}
function umaAlocacao(over = {}) {
  return { employeeId: 'func-1', data: '2026-06-01', shiftId: 'turno-1', ...over };
}
function umContexto(over = {}) {
  return {
    regras: [], funcionarios: [], turnos: [], alocacoes: [],
    periodo: { inicio: new Date('2026-06-01T00:00:00Z'), fim: new Date('2026-06-30T23:59:59Z') },
    ...over,
  };
}

module.exports = { umFuncionario, umTurno, umaAlocacao, umContexto };
