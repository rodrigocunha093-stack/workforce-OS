// Motor de calendário de eventos — portado do EscalaON (motor de forecast),
// mesma lógica: feriados nacionais fixos são auto-gerados (com véspera
// automática, exceto se a véspera cair em domingo), e eventos manuais
// (promoção, data comemorativa, pagamento) sobrescrevem o fator padrão do
// tipo quando o usuário informa um fator customizado.

// Feriados nacionais fixos (MM-DD) — recorrentes todo ano. Não inclui os
// móveis (Carnaval, Sexta-feira Santa, Corpus Christi) porque dependem do
// cálculo da Páscoa — ainda não implementado aqui.
const FERIADOS_FIXOS = {
  '01-01': 'Ano Novo', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho',
  '09-07': 'Independência', '10-12': 'N.S. Aparecida', '11-02': 'Finados',
  '11-15': 'Proclamação da República', '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

// Fator padrão de ajuste de demanda por tipo de evento.
const EVENTO_TIPO_FATOR = {
  feriado: 0.3,            // loja fecha ou opera parcial
  vespera: 1.4,             // véspera de feriado — pico
  promocao: 1.35,           // promoção ativa
  data_comemorativa: 1.25,  // Dia das Mães, Namorados, etc.
  pagamento: 1.15,          // dia de pagamento
  normal: 1.0,
};

// Constrói o mapa data -> {tipo, nome, fator} combinando eventos manuais
// cadastrados pelo cliente com os feriados nacionais fixos (auto-gerados
// para o ano informado, incluindo a véspera automática).
function buildEventMap(eventos, year) {
  const map = {};
  (eventos || []).forEach((ev) => {
    const dataStr = typeof ev.data === 'string' ? ev.data.slice(0, 10) : ev.data;
    map[dataStr] = {
      tipo: ev.tipo,
      nome: ev.nome,
      fator: Number(ev.fator) || EVENTO_TIPO_FATOR[ev.tipo] || 1,
    };
  });

  if (year) {
    Object.entries(FERIADOS_FIXOS).forEach(([mmdd, nome]) => {
      const dataStr = `${year}-${mmdd}`;
      if (!map[dataStr]) {
        map[dataStr] = { tipo: 'feriado', nome, fator: EVENTO_TIPO_FATOR.feriado };
      }
      const vespera = new Date(`${dataStr}T12:00:00`);
      vespera.setDate(vespera.getDate() - 1);
      if (vespera.getDay() !== 0) {
        const vesperaStr = vespera.toISOString().slice(0, 10);
        if (!map[vesperaStr]) {
          map[vesperaStr] = { tipo: 'vespera', nome: `Véspera ${nome}`, fator: EVENTO_TIPO_FATOR.vespera };
        }
      }
    });
  }

  return map;
}

module.exports = { FERIADOS_FIXOS, EVENTO_TIPO_FATOR, buildEventMap };
