// Dashboard ICOS (Carga Operacional por Mercadológico) — portado do
// EscalaON (buildSetorDashboard/deriveOperationalNeed). Mesma lógica:
// venda média por dia (normalizada pelos dias com dado), curva de demanda
// por dia da semana, e necessidade operacional (quantas pessoas o
// departamento precisa) baseada em volume físico real — não só em R$.

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Regra de dimensionamento por tipo de departamento — benchmark de volume
// por hora, e quantas horas da jornada são realmente aproveitáveis pra essa
// atividade (o resto é deslocamento, limpeza, atendimento etc.).
function coreSectorRule(nome) {
  const key = normalizeKey(nome);
  if (key.includes('mercearia')) return { driver: 'Caixas repostas', benchmark: 40, unidade: 'cx/h', jornadaUtil: 7 };
  if (key.includes('acougue')) return { driver: 'Kg vendidos/processados', benchmark: 31, unidade: 'kg/h', jornadaUtil: 7 };
  if (key.includes('hortifruti')) return { driver: 'Kg manipulados', benchmark: 140, unidade: 'kg/h', jornadaUtil: 7 };
  if (key.includes('padaria')) return { driver: 'Kg produzidos/atendidos', benchmark: 32, unidade: 'kg/h', jornadaUtil: 7 };
  if (key.includes('perecive') || key.includes('frios') || key.includes('laticin')) {
    return { driver: 'Kg fatiados/atendidos', benchmark: 35, unidade: 'kg/h', jornadaUtil: 7 };
  }
  return null;
}

// Matriz de produtividade — faixa de reposição (caixas/h) e faixa de
// margem bruta típica por tipo de departamento, mais um comentário do que
// mais importa gerenciar ali. Referência (calibrável por cliente depois).
const MATRIZ_PRODUTIVIDADE = {
  'mercearia doce': { caixasHora: '35-45', margem: '28-32%', foco: 'Controle de validade (PEPS) / impulso' },
  'mercearia salgada': { caixasHora: '35-45', margem: '28-32%', foco: 'Controle de validade (PEPS)' },
  'mercearia seca': { caixasHora: '35-45', margem: '28-32%', foco: 'Controle de validade (PEPS)' },
  acougue: { caixasHora: '—', margem: '18-25%', foco: 'Produção, atendimento e validade rigorosa' },
  hortifruti: { caixasHora: '—', margem: '30-40%', foco: 'Qualidade visual e baixa de perdas' },
  padaria: { caixasHora: '—', margem: '35-45%', foco: 'Produção própria e reposição de quentes' },
  perecive: { caixasHora: '30-40', margem: '25-30%', foco: 'Atendimento, fatiados e validade' },
  limpeza: { caixasHora: '35-40', margem: '25-35%', foco: 'Frenteamento rigoroso e organização por marca' },
  bebidas: { caixasHora: '40-50', margem: '14-20%', foco: 'Abastecimento focado em picos (fim de semana)' },
  bazar: { caixasHora: '30-40', margem: '30-40%', foco: 'Exposição e organização por categoria' },
  perfumaria: { caixasHora: '40-50', margem: '30-38%', foco: 'Frenteamento e prevenção de perdas (furto)' },
  higiene: { caixasHora: '40-50', margem: '30-38%', foco: 'Frenteamento e prevenção de perdas (furto)' },
};

function matrizProdutividade(nome) {
  const key = normalizeKey(nome);
  const match = Object.keys(MATRIZ_PRODUTIVIDADE).find((k) => key.includes(k));
  return MATRIZ_PRODUTIVIDADE[match] || { caixasHora: '—', margem: '—', foco: 'Reposição geral' };
}

// Converte quantidade vendida (kg ou unidades, dependendo do
// departamento) em pessoas necessárias, comparando com quem já está
// escalado ali.
function deriveOperationalNeed(nome, quantidadeDia, colaboradores) {
  const rule = coreSectorRule(nome);
  if (!rule) return null;

  const volumeDia = Number(quantidadeDia) || 0;
  const horasNecessarias = rule.benchmark > 0 ? volumeDia / rule.benchmark : 0;
  const pessoasNecessarias = volumeDia > 0 ? Math.max(1, Math.ceil(horasNecessarias / rule.jornadaUtil)) : 0;
  const saldo = colaboradores - pessoasNecessarias;

  let status = 'adequado';
  let statusLabel = 'Equilibrado';
  let acao = 'Manter o setor na formação atual';

  if (pessoasNecessarias > colaboradores) {
    status = 'critico';
    statusLabel = 'Alta carga';
    acao = `Reforçar ${nome} ou redistribuir apoio`;
  } else if (pessoasNecessarias < colaboradores) {
    status = 'atencao';
    statusLabel = 'Capacidade ociosa';
    acao = `Converter sobra de ${nome} em apoio operacional`;
  }

  return {
    driver: rule.driver,
    benchmark: rule.benchmark,
    unidade: rule.unidade,
    volumeDia: Number(volumeDia.toFixed(1)),
    horasNecessarias: Number(horasNecessarias.toFixed(1)),
    pessoasNecessarias,
    saldo,
    status,
    statusLabel,
    acao,
  };
}

// `rows`: linhas de sales_by_mercadologico (mercadologico_nome, data,
// venda, quantidade) de UM company_id. `employeesBySetor`: Map normalizado
// nome-do-departamento -> { count, nomes: [...] } (calculado fora, a
// partir da tabela employees).
function buildMercadologicoDashboard(rows, employeesBySetor) {
  if (!rows || !rows.length) return [];

  const porDepartamento = {};
  rows.forEach((r) => {
    const nome = r.mercadologico_nome;
    const key = normalizeKey(nome);
    if (!porDepartamento[key]) {
      porDepartamento[key] = {
        nome,
        vendaTotal: 0,
        quantidadeTotal: 0,
        dias: new Set(),
        curvaVenda: [0, 0, 0, 0, 0, 0, 0],
        curvaDias: [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()],
      };
    }
    const d = porDepartamento[key];
    d.vendaTotal += Number(r.venda) || 0;
    d.quantidadeTotal += Number(r.quantidade) || 0;
    d.dias.add(r.data);
    const dow = new Date(`${r.data}T12:00:00`).getDay();
    d.curvaVenda[dow] += Number(r.venda) || 0;
    d.curvaDias[dow].add(r.data);
  });

  const vendaTotalGeral = Object.values(porDepartamento).reduce((s, d) => s + d.vendaTotal, 0);
  const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const dashboard = Object.entries(porDepartamento).map(([key, d]) => {
    const numDias = d.dias.size || 1;
    const vendaDia = d.vendaTotal / numDias;
    const quantidadeDia = d.quantidadeTotal / numDias;
    const equipe = employeesBySetor.get(key) || { count: 0, nomes: [] };
    const colaboradores = equipe.count;
    const participacao = vendaTotalGeral ? (d.vendaTotal / vendaTotalGeral) * 100 : 0;

    const curvaDiaSemana = d.curvaVenda.map((v, i) => (d.curvaDias[i].size ? Math.round(v / d.curvaDias[i].size) : 0));
    const maxIdx = curvaDiaSemana.indexOf(Math.max(...curvaDiaSemana));

    const operationalNeed = deriveOperationalNeed(d.nome, quantidadeDia, colaboradores);
    const vendaPorColab = colaboradores > 0 ? Math.round(vendaDia / colaboradores) : null;
    const itensPorColab = colaboradores > 0 ? Math.round(quantidadeDia / colaboradores) : null;

    return {
      setor: d.nome,
      vendaDia: Math.round(vendaDia),
      quantidadeDia: Number(quantidadeDia.toFixed(1)),
      participacao: Number(participacao.toFixed(1)),
      colaboradores,
      nomes: equipe.nomes,
      vendaPorColab,
      itensPorColab,
      curvaDiaSemana,
      picoDia: nomesDia[maxIdx],
      matriz: matrizProdutividade(d.nome),
      operationalNeed,
      status: operationalNeed ? operationalNeed.status : (colaboradores > 0 ? 'sem-benchmark' : 'sem-equipe'),
      statusLabel: operationalNeed ? operationalNeed.statusLabel : (colaboradores > 0 ? 'Sem benchmark' : 'Sem equipe cadastrada'),
    };
  });

  dashboard.sort((a, b) => b.vendaDia - a.vendaDia);
  return dashboard;
}

module.exports = { buildMercadologicoDashboard, deriveOperationalNeed, coreSectorRule };
