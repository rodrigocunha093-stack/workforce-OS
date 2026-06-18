'use strict';
// Testes do adaptador workforce-OS (parse de turno + montagem do contexto + paridade).
const { test } = require('node:test');
const assert = require('node:assert');
const m = require('../motor-regras');

// Semana fixa: 2026-06-15 (seg) .. 2026-06-21 (dom).
const SEMANA = { dias: ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'].map((d) => ({ data: d })) };
const NORMAL = '06:00-13:20 · 7h20';

test('SEMANA de teste: índice 6 é domingo', () => {
  assert.equal(m.ehDomingo(SEMANA.dias[6].data), true);
});

test('turnoParaMotor: turno partido infere 60min de intervalo', () => {
  assert.deepEqual(m.turnoParaMotor('08:00-12:00/13:00-17:00 · 8h'), { inicio: '08:00', fim: '17:00', intervaloMin: 60 });
});

test('turnoParaMotor: turno contínuo > 6h ganha pausa legal (evita falso art. 71)', () => {
  const t = m.turnoParaMotor(NORMAL);
  assert.ok(t.intervaloMin >= 60, `intervalo inferido deveria ser >= 60, veio ${t.intervaloMin}`);
});

test('contextoDeEscala: Folga vira alocação sem turno; trabalhado mapeia a data correta', () => {
  const people = { Ana: [NORMAL, 'Folga', NORMAL, NORMAL, NORMAL, NORMAL, NORMAL] };
  const ctx = m.contextoDeEscala(people, { calendarWeek: SEMANA });
  const folga = ctx.alocacoes.find((a) => a.data === '2026-06-16');
  assert.equal(folga.shiftId, null);
  const trab = ctx.alocacoes.find((a) => a.data === '2026-06-15');
  assert.ok(trab.shiftId);
});

test('contextoDeEscala: usa o sexo do funcionário vindo de employees', () => {
  const ctx = m.contextoDeEscala({ Ana: [NORMAL] }, { calendarWeek: SEMANA, employees: [{ nome: 'Ana', sexo: 'Feminino' }] });
  assert.equal(ctx.funcionarios[0].sexo, 'feminino');
});

test('checkComplianceCLT: escala 6x1 normal = 0 alertas (paridade)', () => {
  const normal = [NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, 'Folga'];
  assert.deepEqual(m.checkComplianceCLT({ Maria: normal }, { calendarWeek: SEMANA }), []);
});

test('checkComplianceCLT: dia de 12h dispara alerta para o colaborador certo', () => {
  const longa = ['06:00-18:00 · 12h', 'Folga', NORMAL, NORMAL, NORMAL, NORMAL, NORMAL];
  const r = m.checkComplianceCLT({ João: longa }, { calendarWeek: SEMANA });
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'João');
  assert.ok(r[0].violacoes.length >= 1);
});

test('checkComplianceCLT: funciona sem opts (caminho do otimizador)', () => {
  const normal = [NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, 'Folga'];
  assert.deepEqual(m.checkComplianceCLT({ Maria: normal }), []);
});

// Passo 3 — trava de publicação: validarEscala sobre o contexto da escala.
test('validarEscala: escala ilegal (12h) BLOQUEIA, escala normal NÃO', () => {
  const ilegal = m.contextoDeEscala({ Ana: ['06:00-18:00 · 12h', 'Folga', NORMAL, NORMAL, NORMAL, NORMAL, NORMAL] }, { calendarWeek: SEMANA });
  assert.equal(m.validarEscala(ilegal).bloqueada, true);
  const ok = m.contextoDeEscala({ Ana: [NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, NORMAL, 'Folga'] }, { calendarWeek: SEMANA });
  assert.equal(m.validarEscala(ok).bloqueada, false);
});
