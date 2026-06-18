'use strict';
// Testes das regras puras do motor (casos de borda do design do EscalaDP §6).
const { test } = require('node:test');
const assert = require('node:assert');
const m = require('../motor-regras');
const { umContexto, umaAlocacao, umTurno, umFuncionario } = require('./fixtures');

function diasSeguidos(base, total, folgas = []) {
  return Array.from({ length: total }, (_, k) =>
    umaAlocacao({ data: m.somaDias(base, k), shiftId: folgas.includes(k) ? null : 'turno-1' }));
}

test('dsr_semanal: 7 dias sem folga VIOLA', () => {
  const ctx = umContexto({ alocacoes: diasSeguidos('2026-06-01', 7) });
  assert.equal(m.registry.dsr_semanal(ctx, { dias_descanso: 1 }).length, 1);
});
test('dsr_semanal: folga no 7o dia OK', () => {
  const ctx = umContexto({ alocacoes: diasSeguidos('2026-06-01', 7, [6]) });
  assert.deepEqual(m.registry.dsr_semanal(ctx, { dias_descanso: 1 }), []);
});

test('interjornada_min: 10h VIOLA, 11h OK', () => {
  const turnos = [
    umTurno({ id: 't-tarde', inicio: '14:00', fim: '22:00' }),
    umTurno({ id: 't-08', inicio: '08:00', fim: '16:00' }),
    umTurno({ id: 't-09', inicio: '09:00', fim: '17:00' }),
  ];
  const viola = umContexto({ turnos, alocacoes: [
    umaAlocacao({ data: '2026-06-01', shiftId: 't-tarde' }),
    umaAlocacao({ data: '2026-06-02', shiftId: 't-08' }),
  ] });
  assert.equal(m.registry.interjornada_min(viola, { min_horas: 11 }).length, 1);
  const ok = umContexto({ turnos, alocacoes: [
    umaAlocacao({ data: '2026-06-01', shiftId: 't-tarde' }),
    umaAlocacao({ data: '2026-06-02', shiftId: 't-09' }),
  ] });
  assert.equal(m.registry.interjornada_min(ok, { min_horas: 11 }).length, 0);
});

test('intrajornada_min: 8h sem intervalo VIOLA, com 60min OK', () => {
  const semInt = umContexto({ turnos: [umTurno({ id: 't', intervaloMin: 0 })], alocacoes: [umaAlocacao({ shiftId: 't' })] });
  assert.equal(m.registry.intrajornada_min(semInt, { min_minutos: 60, acima_de_horas: 6 }).length, 1);
  const comInt = umContexto({ turnos: [umTurno({ id: 't', intervaloMin: 60 })], alocacoes: [umaAlocacao({ shiftId: 't' })] });
  assert.equal(m.registry.intrajornada_min(comInt, { min_minutos: 60, acima_de_horas: 6 }).length, 0);
});

test('limite_jornada_semanal: 6x8h sem intervalo = 48h VIOLA', () => {
  const turnos = [umTurno({ id: 't', inicio: '08:00', fim: '16:00', intervaloMin: 0 })];
  const alocacoes = diasSeguidos('2026-06-01', 6).map((a) => ({ ...a, shiftId: 't' }));
  const ctx = umContexto({ turnos, alocacoes });
  assert.equal(m.registry.limite_jornada_semanal(ctx, { max_horas: 44 }).length, 1);
});

test('limite_jornada_diaria: turno de 11h líquidas VIOLA (art. 59)', () => {
  const turnos = [umTurno({ id: 't', inicio: '07:00', fim: '18:00', intervaloMin: 0 })]; // 11h
  const ctx = umContexto({ turnos, alocacoes: [umaAlocacao({ shiftId: 't' })] });
  assert.equal(m.registry.limite_jornada_diaria(ctx, { max_horas: 10 }).length, 1);
});

test('rodizio_domingo_feminino: 2 domingos seguidos VIOLA (feminino), 1 OK', () => {
  let dom = '2026-06-01'; while (!m.ehDomingo(dom)) dom = m.somaDias(dom, 1);
  const domB = m.somaDias(dom, 7);
  const func = [umFuncionario({ id: 'f', sexo: 'feminino' })];
  const viola = umContexto({ funcionarios: func, alocacoes: [
    umaAlocacao({ employeeId: 'f', data: dom }), umaAlocacao({ employeeId: 'f', data: domB }),
  ] });
  assert.equal(m.registry.rodizio_domingo_feminino(viola, {}).length, 1);
  const ok = umContexto({ funcionarios: func, alocacoes: [umaAlocacao({ employeeId: 'f', data: dom })] });
  assert.equal(m.registry.rodizio_domingo_feminino(ok, {}).length, 0);
});

test('limite_domingos_mes: 3 domingos VIOLA (máx 2)', () => {
  let dom = '2026-06-01'; while (!m.ehDomingo(dom)) dom = m.somaDias(dom, 1);
  const func = [umFuncionario({ id: 'f' })];
  const alocacoes = [0, 7, 14].map((d) => umaAlocacao({ employeeId: 'f', data: m.somaDias(dom, d) }));
  const ctx = umContexto({ funcionarios: func, alocacoes });
  assert.equal(m.registry.limite_domingos_mes(ctx, { max: 2 }).length, 1);
});

test('dois_descansos_semanais (média mensal): 6 folgas/28d VIOLA, 8 OK', () => {
  const viola = umContexto({ alocacoes: diasSeguidos('2026-06-01', 28, [3, 6, 10, 13, 20, 27]) });
  assert.equal(m.registry.dois_descansos_semanais(viola, { media_mensal: true }).length, 1);
  const ok = umContexto({ alocacoes: diasSeguidos('2026-06-01', 28, [3, 6, 9, 13, 16, 20, 24, 27]) });
  assert.equal(m.registry.dois_descansos_semanais(ok, { media_mensal: true }).length, 0);
});

test('validarEscala: aviso não bloqueia, bloqueante bloqueia', () => {
  const ctx = umContexto({
    turnos: [umTurno({ id: 't', intervaloMin: 0 })],
    alocacoes: [umaAlocacao({ shiftId: 't' })],
    regras: [{ ruleTypeId: 'intrajornada_min', params: {}, severidade: 'aviso' }],
  });
  assert.equal(m.validarEscala(ctx).bloqueada, false);
  ctx.regras[0].severidade = 'bloqueante';
  assert.equal(m.validarEscala(ctx).bloqueada, true);
});
