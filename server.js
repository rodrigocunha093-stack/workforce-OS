const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const dbSupabase = require('./db-supabase');

const PORT = process.env.PORT || 4173;
const PUBLIC = path.join(__dirname, 'public');
const BUILD_VERSION = '2.0-supabase-js';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CLIENTS_DIR = path.join(DATA_DIR, 'clients');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUDIT_DIR = path.join(DATA_DIR, 'audit');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MODEL_SALES_FILE = 'C:\\Users\\LOJA1321\\OneDrive\\Área de Trabalho\\dados vendas';
const sessions = new Map();
const attempts = new Map();
const PILOT_INVITE_CODE = process.env.PILOT_INVITE_CODE || 'PILOTO-CX-2026';

// Cenários por semana do mês (baseado em dados reais VRSoft)
const CENARIOS_SEMANAS = {
  1: {
    nome: 'Semana 1 do Mês (Dias 1-7)',
    cupons_sabado: 485,
    clientes_por_hora: { '06:00': 10, '07:00': 30, '08:00': 55, '09:00': 50, '10:00': 52, '11:00': 48, '12:00': 30, '13:00': 20, '14:00': 18, '15:00': 25, '16:00': 40, '17:00': 50, '18:00': 28, '19:00': 1 },
    ticket_medio: 50.50,
    itens_cupom: 5.8,
    faturamento_sabado: 24500.00,
    demanda_media: 'Normal'
  },
  2: {
    nome: 'Semana 2 do Mês (Dias 8-14)',
    cupons_sabado: 495,
    clientes_por_hora: { '06:00': 11, '07:00': 32, '08:00': 58, '09:00': 54, '10:00': 56, '11:00': 52, '12:00': 33, '13:00': 22, '14:00': 20, '15:00': 28, '16:00': 42, '17:00': 52, '18:00': 30, '19:00': 1 },
    ticket_medio: 51.50,
    itens_cupom: 6.0,
    faturamento_sabado: 25500.00,
    demanda_media: 'Normal'
  },
  3: {
    nome: 'Semana 3 do Mês (Dias 15-21)',
    cupons_sabado: 500,
    clientes_por_hora: { '06:00': 12, '07:00': 35, '08:00': 60, '09:00': 56, '10:00': 58, '11:00': 54, '12:00': 35, '13:00': 24, '14:00': 22, '15:00': 30, '16:00': 44, '17:00': 54, '18:00': 32, '19:00': 2 },
    ticket_medio: 51.80,
    itens_cupom: 6.0,
    faturamento_sabado: 26000.00,
    demanda_media: 'Normal'
  },
  4: {
    nome: 'Semana 4 do Mês (Dias 22-28) - PROMOÇÃO',
    cupons_sabado: 525,
    clientes_por_hora: { '06:00': 15, '07:00': 40, '08:00': 65, '09:00': 62, '10:00': 68, '11:00': 62, '12:00': 38, '13:00': 28, '14:00': 26, '15:00': 35, '16:00': 48, '17:00': 60, '18:00': 36, '19:00': 2 },
    ticket_medio: 55.00,
    itens_cupom: 6.5,
    faturamento_sabado: 28875.00,
    demanda_media: 'Promoção Iniciando'
  },
  5: {
    nome: 'Semana 5 do Mês (Dias 29-05) - PICO PROMOÇÃO',
    cupons_sabado: 545,
    clientes_por_hora: { '06:00': 12, '07:00': 38, '08:00': 62, '09:00': 60, '10:00': 72, '11:00': 65, '12:00': 42, '13:00': 32, '14:00': 28, '15:00': 38, '16:00': 50, '17:00': 62, '18:00': 40, '19:00': 2 },
    ticket_medio: 58.80,
    itens_cupom: 7.0,
    faturamento_sabado: 32049.00,
    demanda_media: 'Alto - Pico de Promoção'
  }
};

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${path.basename(filePath, '.json')}-${timestamp}.json`;
  fs.copyFileSync(filePath, path.join(BACKUP_DIR, name));
  const prefix = `${path.basename(filePath, '.json')}-`;
  fs.readdirSync(BACKUP_DIR).filter((file) => file.startsWith(prefix)).sort().reverse().slice(20)
    .forEach((file) => fs.unlinkSync(path.join(BACKUP_DIR, file)));
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function saveSessions() {
  // Sessões agora são salvas no Supabase
}

function loadSessions() {
  // Sessões são carregadas do Supabase quando necessário
}

async function audit(userId, action, detail = {}) {
  if (!userId) return;
  await dbSupabase.auditLog(userId, action, detail);
}

async function loadAudit(userId) {
  // Implementar busca de auditoria no Supabase quando necessário
  return [];
}

function requestIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function isLoopbackRequest(req) {
  const ip = requestIp(req).replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

function canUseSupportOrgLookup(req, user) {
  if (isLoopbackRequest(req)) return true;
  return Boolean(user && (user.role === 'admin' || user.role === 'gestor' || user.orgId === user.id));
}

function requireSameOrigin(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (!origin) return;
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;
  if (!host || new URL(origin).host !== host) throw new Error('Origem da requisição não autorizada.');
}

function enforceRateLimit(req, action, maxAttempts = 8, windowMs = 15 * 60 * 1000) {
  const ip = requestIp(req);
  const key = `${action}:${ip}`;
  const now = Date.now();
  const current = attempts.get(key) || [];
  const recent = current.filter((time) => now - time < windowMs);

  if (recent.length >= maxAttempts) {
    audit(null, 'RATE_LIMIT_EXCEEDED', { action, ip, attempts: recent.length });
    throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }

  recent.push(now);
  attempts.set(key, recent);
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

loadSessions();

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && email.length <= 255 && emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8 && password.length <= 128;
}

function validateName(name) {
  return name && name.length >= 2 && name.length <= 100 && /^[\w\s\-áéíóúàâêôãõç]+$/i.test(name);
}

function sanitizeString(str) {
  return String(str).slice(0, 1000).replace(/[<>"']/g, '');
}

function defaultClientState() {
  return {
    profile: {
      empresa: '',
      loja: '',
      cnpj: '',
      regimeTributario: 'Lucro Real',
      quantidadePdvs: 3,
      quantidadeOperadores: 4,
      horarioSegSex: '07:00-19:00',
      horarioSabado: '06:00-19:00',
      domingoOperacao: 'aberto',
      domingosFechadosMes: 0,
      horarioDomingo: '08:00-12:00'
    },
    employees: [],
    salesRows: [],
    salesByMercadologico: [],
    enabledModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    escalaFechada: null,      // período vigente fechado (snapshot imutável)
    escalaHistorico: [],      // períodos fechados anteriores
    updatedAt: null
  };
}

// Mapa de grupo mercadológico (descricao_m2) -> setor operacional que o atende.
// Perecíveis têm equipes dedicadas; mercearia seca é reposição geral.
const MERCADOLOGICO_SETOR = {
  // Perecíveis (atendimento/balança/produção)
  'acougue': 'Açougue', 'açougue': 'Açougue', 'carnes': 'Açougue',
  'padaria': 'Padaria', 'panificacao': 'Padaria', 'confeitaria': 'Padaria',
  'flv': 'Hortifruti', 'hortifruti': 'Hortifruti', 'hortifrutigranjeiros': 'Hortifruti',
  'frios e laticineos': 'Frios e Laticínios', 'frios e laticinios': 'Frios e Laticínios', 'frios': 'Frios e Laticínios', 'laticinios': 'Frios e Laticínios',
  'ilhas e congelados': 'Congelados', 'congelados': 'Congelados', 'ilhas': 'Congelados',
  'peixaria': 'Peixaria', 'pescados': 'Peixaria',
  'rotisseria': 'Rotisseria', 'restaurante': 'Rotisseria',
  // Mercearia seca (reposição geral)
  'bazar': 'Mercearia', 'bebidas': 'Mercearia', 'cereais': 'Mercearia',
  'limpeza': 'Mercearia', 'mercearia doce': 'Mercearia', 'mercearia salgada': 'Mercearia',
  'perfumaria e higiene pessoal': 'Mercearia', 'perfumaria': 'Mercearia', 'higiene': 'Mercearia'
};

function mercadologicoParaSetor(merc) {
  const key = String(merc || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MERCADOLOGICO_SETOR[key] || (merc || 'Outros');
}

function normalizeSetor(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Identifica se o colaborador é operador de caixa (entra na escala de caixa)
function isOperadorCaixa(emp) {
  const setor = normalizeSetor(emp.setor);
  const cargo = normalizeSetor(emp.cargo);
  if (setor.includes('caixa') || setor.includes('frente')) return true;
  if (cargo.includes('caixa') || cargo.includes('operador')) return true;
  // Sem setor definido = assume caixa (compatibilidade)
  if (!setor && !cargo) return true;
  return false;
}

function isOperadorCaixaSnapshot(nome, snapshot) {
  const setor = normalizeSetor(snapshot?.setorMap?.[nome]);
  const cargo = normalizeSetor(snapshot?.cargoMap?.[nome]);
  if (setor.includes('caixa') || setor.includes('frente')) return true;
  if (cargo.includes('caixa') || cargo.includes('operador')) return true;
  return false;
}

function groupBySetor(employees) {
  const groups = {};
  (employees || []).forEach((e) => {
    const key = (e.setor || 'Sem setor').trim() || 'Sem setor';
    groups[key] = groups[key] || [];
    groups[key].push(e);
  });
  return Object.entries(groups).map(([setor, lista]) => ({ setor, total: lista.length })).sort((a, b) => b.total - a.total);
}

const MODULE_CATALOG = [
  { id: 1, key: 'diagnostico', nome: 'Diagnóstico' },
  { id: 2, key: 'cenarios', nome: 'Escala' },
  { id: 3, key: 'domingo', nome: 'Domingos' },
  { id: 4, key: 'auditoria', nome: 'Auditoria' },
  { id: 5, key: 'acoes', nome: 'Controlador' },
  { id: 6, key: 'financeiro', nome: 'Financeiro' },
  { id: 7, key: 'resiliencia', nome: 'Resiliência' },
  { id: 8, key: 'setores', nome: 'Setores' },
  { id: 9, key: 'memoria', nome: 'Memória' },
  { id: 10, key: 'implantacao', nome: 'Implantação' }
];

function clientStateFile(userId) {
  return path.join(CLIENTS_DIR, `${userId}.json`);
}

async function loadClientState(userId) {
  if (!userId) return defaultClientState();
  const data = await dbSupabase.getClientData(userId);
  return { ...defaultClientState(), ...data };
}

async function saveClientState(userId, state) {
  return await dbSupabase.saveClientData(userId, state);
}

async function loadUsers() {
  // Usuarios são carregados do Supabase quando necessário
  return [];
}

async function saveUsers(users) {
  // Usuarios são salvos no Supabase
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve({ salt, hash: key.toString('hex') });
    });
  });
}

async function verifyPassword(password, user) {
  const result = await hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(result.hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=')).filter((pair) => pair.length === 2));
}

async function authenticatedUser(req) {
  const token = cookies(req).workforce_session;
  if (!token) return null;
  const session = await dbSupabase.getSession(token);
  if (!session) return null;
  return await dbSupabase.getUserById(session.userId);
}

async function createSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  await dbSupabase.saveSession(token, userId, expiresAt);
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `workforce_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
}

async function clearSession(res, req) {
  const token = cookies(req).workforce_session;
  if (token) {
    await dbSupabase.deleteSession(token);
  }
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `workforce_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function readJsonBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) reject(new Error('Arquivo excede o limite desta versão do MVP.'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Conteúdo JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function purchaseClass(avgItems) {
  if (avgItems <= 10) return { label: 'Expressa', weight: 1 };
  if (avgItems <= 20) return { label: 'Pequena', weight: 2 };
  if (avgItems <= 40) return { label: 'Media', weight: 3 };
  if (avgItems <= 80) return { label: 'Grande', weight: 5 };
  return { label: 'Atacarejo', weight: 8 };
}

function paymentProfile(hourStart, dayType) {
  if (dayType === 'saturday' && hourStart >= 10 && hourStart <= 12) return { label: 'Multiplos', weight: 1.45 };
  if (hourStart >= 17) return { label: 'Cartao/PIX', weight: 1.12 };
  if (hourStart >= 10 && hourStart <= 11) return { label: 'Dinheiro/Vale', weight: 1.28 };
  return { label: 'Cartao', weight: 1.15 };
}

function operationalFactors(hourStart, simpleDemand, dayType) {
  const factors = [];
  if (simpleDemand >= 3) factors.push({ label: 'Pico', weight: 0.10 });
  if (hourStart === 10 || hourStart === 16) factors.push({ label: 'Sangria', weight: 0.06 });
  if (hourStart === 12 || hourStart === 18) factors.push({ label: 'Troca/fechamento', weight: 0.05 });
  if (dayType === 'saturday') factors.push({ label: 'Fluxo de fim de semana', weight: 0.07 });
  return factors;
}

function queueStatus(waitMinutes) {
  if (waitMinutes <= 2) return { label: 'Baixa', className: 'queue-low' };
  if (waitMinutes <= 5) return { label: 'Media', className: 'queue-medium' };
  if (waitMinutes <= 10) return { label: 'Alta', className: 'queue-high' };
  return { label: 'Critica', className: 'queue-critical' };
}

// Erlang-C (M/M/N): probabilidade de um cliente esperar na fila.
// A = intensidade de tráfego em erlangs (chegadas/h × tempo de atendimento em horas).
function erlangCWaitProbability(A, N) {
  if (N <= A) return 1;
  let term = 1; // A^0/0!
  let sum = 1;
  for (let k = 1; k < N; k++) {
    term *= A / k;
    sum += term;
  }
  const termN = term * (A / N); // A^N/N!
  const c = termN * (N / (N - A));
  return c / (sum + c);
}

// Nº mínimo de operadores para manter a espera média dentro do alvo.
// Dimensiona pela variância das chegadas (fila), não só pela carga média.
function erlangAgentsNeeded(arrivalsPerHour, serviceMinutes, targetWaitMin = 3, maxAgents = 30) {
  const A = (arrivalsPerHour * serviceMinutes) / 60;
  for (let N = Math.max(1, Math.ceil(A)); N <= maxAgents; N++) {
    if (N <= A) continue;
    const pw = erlangCWaitProbability(A, N);
    const avgWait = (pw * serviceMinutes) / (N - A);
    if (avgWait <= targetWaitMin) return N;
  }
  return maxAgents;
}

function cashierLoadForHour(hora, simpleDemand, scheduledCashiers, dayType = 'weekday', pdvLimit = 3, actualCustomers = null, actualAvgItems = null, actualServiceMinutes = null) {
  if (simpleDemand === null || simpleDemand === undefined) return null;
  const hourStart = Number(String(hora).split('-')[0]);
  const dayMultiplier = dayType === 'saturday' ? 1.16 : dayType === 'sunday' ? 0.82 : 1;
  const inferredCustomers = actualCustomers
    ? Math.max(1, Math.round(Number(actualCustomers)))
    : Math.max(8, Math.round(simpleDemand * 24 * dayMultiplier + (hourStart >= 10 && hourStart <= 11 ? 10 : 0)));
  const avgItems = actualAvgItems
    ? Number(actualAvgItems)
    : dayType === 'sunday'
    ? 13 + Math.max(0, simpleDemand - 1) * 3
    : dayType === 'saturday'
      ? 18 + simpleDemand * 7 + (hourStart >= 10 && hourStart <= 11 ? 6 : 0)
      : 14 + simpleDemand * 6 + (hourStart >= 17 ? 5 : 0);
  const purchase = purchaseClass(avgItems);
  const payment = paymentProfile(hourStart, dayType);
  const factors = operationalFactors(hourStart, simpleDemand, dayType);
  const operationalMultiplier = 1 + factors.reduce((total, factor) => total + factor.weight, 0);
  const observedServiceMinutes = Number(actualServiceMinutes || 0);
  const averageServiceMinutes = observedServiceMinutes > 0
    ? observedServiceMinutes / Math.max(1, inferredCustomers)
    : (0.9 + avgItems * 0.08) * payment.weight * operationalMultiplier;
  const neededMinutes = observedServiceMinutes > 0
    ? Math.round(observedServiceMinutes)
    : Math.round(inferredCustomers * averageServiceMinutes);
  const neededHours = Number((neededMinutes / 60).toFixed(2));
  // Dimensionamento híbrido: carga média (workload) é o piso;
  // Erlang-C adiciona o buffer de fila quando a variância das chegadas exige.
  const workloadAgents = Math.max(1, Math.ceil((neededMinutes / 60) * 1.05));
  const erlangAgents = erlangAgentsNeeded(inferredCustomers, averageServiceMinutes, 3);
  const recommended = Math.max(workloadAgents, erlangAgents);
  const cappedRecommendation = Math.min(Math.max(1, pdvLimit), recommended);
  const scheduled = Math.max(1, scheduledCashiers || simpleDemand);
  const capacityMinutes = scheduled * 60;
  const utilization = Math.round(Math.min(160, (neededMinutes / capacityMinutes) * 100));
  const idlePercent = Math.max(0, Math.round(((capacityMinutes - neededMinutes) / capacityMinutes) * 100));
  // Espera estimada pelo modelo de filas com os caixas realmente escalados
  const trafficErlangs = (inferredCustomers * averageServiceMinutes) / 60;
  const waitMinutes = scheduled > trafficErlangs
    ? Number(Math.max(0.3, (erlangCWaitProbability(trafficErlangs, scheduled) * averageServiceMinutes) / (scheduled - trafficErlangs)).toFixed(1))
    : 15; // sistema saturado: fila cresce sem limite
  const queue = queueStatus(waitMinutes);
  const icoc = Math.round((inferredCustomers * 0.3) + (avgItems * purchase.weight * 0.4) + (payment.weight * 20) + (factors.length * 8));

  return {
    clientes: inferredCustomers,
    itensMedios: Number(avgItems.toFixed(1)),
    classeCompra: purchase.label,
    pesoCompra: purchase.weight,
    formaPagamento: payment.label,
    pesoPagamento: payment.weight,
    fatores: factors.map((factor) => factor.label),
    tempoMedioMin: Number(averageServiceMinutes.toFixed(2)),
    minutosNecessarios: neededMinutes,
    minutosOrigem: observedServiceMinutes > 0 ? 'real' : 'estimado',
    horasNecessarias: neededHours,
    operadoresRecomendados: cappedRecommendation,
    operadoresCalculados: recommended,
    operadoresCarga: workloadAgents,
    operadoresErlang: erlangAgents,
    limitadoPorPdvs: recommended > pdvLimit,
    margemSeguranca: 5,
    filaMin: waitMinutes,
    filaStatus: queue.label,
    filaClass: queue.className,
    utilizacao: utilization,
    ociosidade: idlePercent,
    icoc
  };
}

function buildCoverage(hours, demand, atual, transicao, final, dayType = 'weekday') {
  return hours.map((hora, index) => {
    const scheduled = Math.max(atual[index], transicao[index], final[index]);
    return {
      hora,
      demanda: demand ? demand[index] : null,
      atual: atual[index],
      transicao: transicao[index],
      final: final[index],
      cargaCaixa: demand ? cashierLoadForHour(hora, demand[index], scheduled, dayType) : null
    };
  });
}

const staffSchedule = {
  monday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '07:00', fim: '15:00', intervalo: '12:00-13:00', horas: 7 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '16:00', intervalo: '13:00-14:00', horas: 7 },
    { nome: 'Samara', status: 'Folga', perfil: 'Folga compensatória do domingo', inicio: null, fim: null, intervalo: null, horas: 0 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '14:00-15:00', horas: 8 }
  ],
  tuesday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '07:00', fim: '15:00', intervalo: '12:00-13:00', horas: 7 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '16:00', intervalo: '13:00-14:00', horas: 7 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '14:00-15:00', horas: 8 },
    { nome: 'Jane', status: 'Folga', perfil: 'Folga compensatória do domingo', inicio: null, fim: null, intervalo: null, horas: 0 }
  ],
  wednesday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '07:00', fim: '15:00', intervalo: '12:00-13:00', horas: 7 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '16:00', intervalo: '13:00-14:00', horas: 7 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '17:00', intervalo: '12:00-13:00', horas: 8 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '14:00-15:00', horas: 8 }
  ],
  thursday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '07:00', fim: '15:00', intervalo: '12:00-13:00', horas: 7 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '16:00', intervalo: '13:00-14:00', horas: 7 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '17:00', intervalo: '12:00-13:00', horas: 8 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '14:00-15:00', horas: 8 }
  ],
  friday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '07:00', fim: '16:00', intervalo: '12:00-13:00', horas: 8 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '08:00', fim: '17:00', intervalo: '13:00-14:00', horas: 8 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Fechamento', inicio: '09:00', fim: '19:00', intervalo: '14:00-16:00', horas: 8 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '15:00-16:00', horas: 8 }
  ],
  saturday: [
    { nome: 'Lucila', status: 'Trabalhando', perfil: 'Abertura', inicio: '06:00', fim: '15:00', intervalo: '11:00-12:00', horas: 8 },
    { nome: 'Edvania', status: 'Trabalhando', perfil: 'Intermediário', inicio: '07:00', fim: '16:00', intervalo: '12:00-13:00', horas: 8 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Fechamento', inicio: '09:00', fim: '19:00', intervalo: '14:00-16:00', horas: 8 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Fechamento', inicio: '10:00', fim: '19:00', intervalo: '13:00-14:00', horas: 8 }
  ],
  sunday: [
    { nome: 'Lucila', status: 'Folga', perfil: 'Revezamento dominical', inicio: null, fim: null, intervalo: null, horas: 0 },
    { nome: 'Edvania', status: 'Folga', perfil: 'Revezamento dominical', inicio: null, fim: null, intervalo: null, horas: 0 },
    { nome: 'Samara', status: 'Trabalhando', perfil: 'Caixa domingo', inicio: '08:00', fim: '12:00', intervalo: 'Sem intervalo', horas: 4 },
    { nome: 'Jane', status: 'Trabalhando', perfil: 'Caixa domingo', inicio: '08:00', fim: '12:00', intervalo: 'Sem intervalo', horas: 4 }
  ]
};

const weeklyScenarioSchedule = {
  atual: {
    label: '6x1 44h',
    targetHours: 44,
    targetDaysOff: 1,
    people: {
      Lucila:  ['07-15 · 7h', '07-15 · 7h', '07-15 · 7h', '07-15 · 7h', '07-16 · 8h', '06-15 · 8h', 'Folga'],
      Edvania: ['08-16 · 7h', '08-16 · 7h', '08-16 · 7h', '08-16 · 7h', '08-17 · 8h', '07-16 · 8h', 'Folga'],
      Samara:  ['Folga', '10-19 · 8h', '08-17 · 8h', '08-17 · 8h', '09-19 · 8h', '09-19 · 8h', '08-12 · 4h'],
      Jane:    ['10-19 · 8h', 'Folga', '10-19 · 8h', '10-19 · 8h', '10-19 · 8h', '10-19 · 8h', '08-12 · 4h']
    }
  },
  transicao: {
    label: '5x2 42h',
    targetHours: 42,
    targetDaysOff: 2,
    people: {
      Lucila:  ['07-16:24 · 8h24', '07-16:24 · 8h24', '07-16:24 · 8h24', 'Folga', '07-16:24 · 8h24', '06-15:24 · 8h24', 'Folga'],
      Edvania: ['08-17:24 · 8h24', '08-17:24 · 8h24', 'Folga', '08-17:24 · 8h24', '08-17:24 · 8h24', '07-16:24 · 8h24', 'Folga'],
      Samara:  ['Folga', 'Folga', '08:30-19 · 9h30', '08:30-19 · 9h30', '08:30-19 · 9h30', '08:30-19 · 9h30', '08-12 · 4h'],
      Jane:    ['08:30-19 · 9h30', 'Folga', 'Folga', '08:30-19 · 9h30', '08:30-19 · 9h30', '08:30-19 · 9h30', '08-12 · 4h']
    }
  },
  final: {
    label: '5x2 40h',
    targetHours: 40,
    targetDaysOff: 2,
    people: {
      Lucila:  ['07-16 · 8h', '07-16 · 8h', '07-16 · 8h', 'Folga', '07-16 · 8h', '06-15 · 8h', 'Folga'],
      Edvania: ['08-17 · 8h', '08-17 · 8h', 'Folga', '08-17 · 8h', '08-17 · 8h', '07-16 · 8h', 'Folga'],
      Samara:  ['Folga', 'Folga', '09-19 · 9h', '09-19 · 9h', '09-19 · 9h', '09-19 · 9h', '08-12 · 4h'],
      Jane:    ['09-19 · 9h', 'Folga', 'Folga', '09-19 · 9h', '09-19 · 9h', '09-19 · 9h', '08-12 · 4h']
    }
  }
};

const weekdayHours = ['07-08', '08-09', '09-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17', '17-18', '18-19'];
const weekdayAtual = [1, 2, 2, 2, 2, 1, 3, 2, 2, 2, 2, 2];
const weekdayTransicao = [1, 2, 2, 2, 2, 1, 3, 2, 3, 2, 2, 2];
const weekdayFinal = [1, 2, 2, 3, 2, 1, 3, 2, 3, 2, 2, 2];

const data = {
  metadata: {
    ultimaImportacao: '04/06/2026 21:04',
    diasComVenda: 7,
    confianca: 68,
    periodoAmostra: '01/05 a 07/05/2026',
    periodoCapacidade: 'semana contratual'
  },
  calendarEvents: [
    { date: '2026-06-05', type: 'Pagamento', label: 'Sexta pós-pagamento', impact: 'alto' },
    { date: '2026-06-07', type: 'Domingo', label: 'Revezamento feminino', impact: 'medio' },
    { date: '2026-06-13', type: 'Pico', label: 'Sábado com pico 10h-11h', impact: 'alto' },
    { date: '2026-06-14', type: 'Domingo', label: 'Revezamento feminino', impact: 'medio' },
    { date: '2026-06-21', type: 'Domingo', label: 'Revezamento feminino', impact: 'medio' },
    { date: '2026-06-28', type: 'Domingo', label: 'Revezamento feminino', impact: 'medio' }
  ],
  scenarios: [
    { cenario: 'Atual 6x1 - 44h', tipo: '6x1', horasSemanais: 44, operadores: 4, pdvs: 3, capacidade: 176, caixaNecessario: 106 },
    { cenario: 'Transição 5x2 - 42h', tipo: '5x2', horasSemanais: 42, operadores: 4, pdvs: 3, capacidade: 168, caixaNecessario: 106 },
    { cenario: 'Final 5x2 - 40h', tipo: '5x2', horasSemanais: 40, operadores: 4, pdvs: 3, capacidade: 160, caixaNecessario: 106 }
  ],
  storeConfig: {
    pdvs: 3,
    operadores: 4
  },
  taOtimoBenchmark: [
    {
      pilar: 'Previsão de demanda',
      referencia: 'Prever necessidade de mão de obra por sinais operacionais e movimento.',
      nossoStatus: 'Parcial',
      evidencia: 'Usamos cupons e vendas por hora do VRSoft por tipo de dia.',
      proximoPasso: 'Importar histórico maior, feriados, pagamento, promoções e clima.'
    },
    {
      pilar: 'Escala otimizada',
      referencia: 'Montar escala automática alinhando demanda, disponibilidade e custo.',
      nossoStatus: 'Parcial',
      evidencia: 'Simulamos 6x1 44h, 5x2 42h e 5x2 40h com cobertura por hora.',
      proximoPasso: 'Criar motor de sugestão com restrições por colaborador e objetivos configuráveis.'
    },
    {
      pilar: 'Compliance e habilidades',
      referencia: 'Respeitar regras legais, disponibilidade, habilidades e elegibilidade.',
      nossoStatus: 'Em evolução',
      evidencia: 'Auditamos folgas, domingos, intervalos, fechamento mínimo e matriz de habilidades.',
      proximoPasso: 'Parametrizar CCT por cliente e integrar ponto/Domínio para validar realizado.'
    },
    {
      pilar: 'Rebalanceamento operacional',
      referencia: 'Responder a ausência, pico, fila e variação de demanda em tempo quase real.',
      nossoStatus: 'Inicial',
      evidencia: 'Mostramos déficit, sobra, risco e ação recomendada para o gerente.',
      proximoPasso: 'Adicionar alerta diário com fila, ponto real, atraso e substituição sugerida.'
    }
  ],
  sectorEngine: {
    principle: 'Usar produtividade por hora como ponto de partida, calibrar com dados reais por loja e comparar por cluster de faturamento.',
    coreSectors: [
      {
        setor: 'Frente de Caixa',
        driver: 'clientes por hora',
        indicador: 'Clientes/hora',
        faixa: '18 a 30',
        benchmarkInicial: 24,
        unidade: 'clientes/h',
        dadosNecessarios: ['cupons por hora', 'itens por cupom', 'formas de pagamento', 'sangrias/troco'],
        impacto: 'Fila, abandono, experiencia do cliente e seguranca do fechamento'
      },
      {
        setor: 'Acougue',
        driver: 'kg vendidos e kg processados',
        indicador: 'Kg/hora',
        faixa: '25 a 80',
        benchmarkInicial: 31,
        unidade: 'kg/h',
        dadosNecessarios: ['kg vendidos', 'kg processados', 'bandejas', 'atendimento balcao'],
        impacto: 'Ruptura, perda, espera no balcao e margem'
      },
      {
        setor: 'Hortifruti',
        driver: 'kg manipulados',
        indicador: 'Kg/hora',
        faixa: '80 a 250',
        benchmarkInicial: 140,
        unidade: 'kg/h',
        dadosNecessarios: ['kg vendidos', 'caixas recebidas', 'quebras', 'picos de abastecimento'],
        impacto: 'Disponibilidade, aparencia da loja e quebra operacional'
      },
      {
        setor: 'Padaria',
        driver: 'kg produzidos e clientes atendidos',
        indicador: 'Kg/hora',
        faixa: '15 a 60',
        benchmarkInicial: 32,
        unidade: 'kg/h',
        dadosNecessarios: ['kg produzidos', 'fornadas', 'clientes por hora', 'ruptura de pao quente'],
        impacto: 'Venda perdida, frescor, producao e atendimento'
      },
      {
        setor: 'Reposicao',
        driver: 'caixas repostas',
        indicador: 'Caixas/hora',
        faixa: '25 a 60',
        benchmarkInicial: 40,
        unidade: 'caixas/h',
        dadosNecessarios: ['caixas repostas', 'SKUs', 'corredor', 'peso/volume', 'ruptura'],
        impacto: 'Ruptura, organizacao de loja e produtividade de apoio'
      }
    ],
    example: {
      setor: 'Acougue',
      volume: 1200,
      unidade: 'kg no sabado',
      benchmark: 25,
      jornadaUtil: 7,
      horasNecessarias: 48,
      pessoasSugeridas: 7,
      formula: '1200 kg / 25 kg por hora = 48 horas; 48 / 7h uteis = 6,8 pessoas'
    },
    evolution: [
      { cluster: 'R$ 1M a R$ 2M', acougueKgHora: 31, leitura: 'loja pequena/media, menor especializacao' },
      { cluster: 'R$ 2M a R$ 4M', acougueKgHora: 37, leitura: 'volume permite melhor distribuicao de tarefas' },
      { cluster: 'R$ 4M a R$ 8M', acougueKgHora: 42, leitura: 'ganho de escala e processos mais maduros' }
    ],
    library: [
      { setor: 'Frente de Caixa', driver: 'clientes, tickets, itens', indicador: 'Clientes/hora', faixa: '18 a 30', prioridade: 'MVP' },
      { setor: 'Fiscal de Caixa', driver: 'checkouts supervisionados', indicador: 'Caixas supervisionados', faixa: '8 a 15', prioridade: 'Expansao' },
      { setor: 'Reposicao Mercearia', driver: 'caixas repostas', indicador: 'Caixas/hora', faixa: '25 a 60', prioridade: 'MVP' },
      { setor: 'Reposicao Bebidas', driver: 'volumes pesados', indicador: 'Caixas/hora', faixa: '15 a 40', prioridade: 'Expansao' },
      { setor: 'Hortifruti', driver: 'kg manipulados', indicador: 'Kg/hora', faixa: '80 a 250', prioridade: 'MVP' },
      { setor: 'Acougue Balcao', driver: 'kg vendidos', indicador: 'Kg/hora', faixa: '15 a 40', prioridade: 'MVP' },
      { setor: 'Acougue Producao', driver: 'kg processados', indicador: 'Kg/hora', faixa: '25 a 80', prioridade: 'MVP' },
      { setor: 'Acougue Bandejamento', driver: 'bandejas', indicador: 'Bandejas/hora', faixa: '40 a 120', prioridade: 'Expansao' },
      { setor: 'Frios', driver: 'kg fatiados', indicador: 'Kg/hora', faixa: '8 a 30', prioridade: 'Expansao' },
      { setor: 'Padaria Producao', driver: 'kg produzidos', indicador: 'Kg/hora', faixa: '15 a 60', prioridade: 'MVP' },
      { setor: 'Padaria Atendimento', driver: 'clientes', indicador: 'Clientes/hora', faixa: '20 a 60', prioridade: 'Expansao' },
      { setor: 'Confeitaria', driver: 'kg produzidos', indicador: 'Kg/hora', faixa: '5 a 20', prioridade: 'Expansao' },
      { setor: 'Rotisseria', driver: 'refeicoes', indicador: 'Refeicoes/hora', faixa: '20 a 80', prioridade: 'Expansao' },
      { setor: 'Recebimento', driver: 'volumes, pallets e NFs', indicador: 'Volumes/hora', faixa: '100 a 500', prioridade: 'Expansao' },
      { setor: 'Conferencia', driver: 'volumes conferidos', indicador: 'Volumes/hora', faixa: '150 a 700', prioridade: 'Expansao' },
      { setor: 'Deposito', driver: 'pallets movimentados', indicador: 'Pallets/hora', faixa: '2 a 10', prioridade: 'Expansao' },
      { setor: 'Limpeza', driver: 'area', indicador: 'm2/hora', faixa: '300 a 1000', prioridade: 'Expansao' },
      { setor: 'Prevencao de Perdas', driver: 'area supervisionada', indicador: 'm2 monitorados', faixa: '1000 a 5000', prioridade: 'Expansao' },
      { setor: 'E-commerce Picking', driver: 'pedidos', indicador: 'Pedidos/hora', faixa: '8 a 25', prioridade: 'Opcional' }
    ]
  },
  financial: {
    assumptions: {
      salarioBaseMensal: 1650,
      beneficiosMensais: 600,
      encargosPercentual: 70,
      quantidadeOperadores: 4,
      semanasPorMes: 4.33,
      faturamentoSemanaReferencia: 129813.55,
      margemBrutaPercentual: 25,
      custoContratacao: 4500,
      regimeTributario: 'Lucro Real'
    },
    notes: [
      'Salário-base informado: R$ 1.650. Benefícios e encargos ainda são premissas provisórias.',
      'Regime tributário informado: Lucro Real. Esse regime não determina sozinho os encargos da folha.',
      'A redução de jornada não reduz automaticamente salário, benefícios ou encargos.',
      'Economia somente deve ser reconhecida quando houver redução comprovada de horas extras, contratação evitada ou ganho de produtividade.'
    ]
  },
  resilience: {
    status: 'Premissas iniciais para validação do gerente',
    skills: [
      { id: 'caixa', nome: 'Operar caixa', minimo: 2, criticidade: 'Essencial' },
      { id: 'abertura', nome: 'Abrir frente de caixa', minimo: 2, criticidade: 'Crítica' },
      { id: 'fechamento', nome: 'Fechar frente de caixa', minimo: 2, criticidade: 'Crítica' },
      { id: 'sangria', nome: 'Sangria e tesouraria', minimo: 2, criticidade: 'Alta' },
      { id: 'lideranca', nome: 'Liderar ocorrência', minimo: 2, criticidade: 'Alta' },
      { id: 'apoio', nome: 'Apoio e embalagem', minimo: 1, criticidade: 'Operacional' }
    ],
    people: [
      { nome: 'Lucila', skills: { caixa: 3, abertura: 3, fechamento: 2, sangria: 2, lideranca: 3, apoio: 2 }, validado: false },
      { nome: 'Edvania', skills: { caixa: 3, abertura: 2, fechamento: 3, sangria: 3, lideranca: 2, apoio: 2 }, validado: false },
      { nome: 'Samara', skills: { caixa: 3, abertura: 1, fechamento: 2, sangria: 1, lideranca: 1, apoio: 3 }, validado: false },
      { nome: 'Jane', skills: { caixa: 3, abertura: 1, fechamento: 3, sangria: 2, lideranca: 2, apoio: 3 }, validado: false }
    ],
    rules: {
      nivelApto: 2,
      fechamentoMinimoPessoas: 2,
      domingoMinimoPessoas: 2,
      treinamentoPrazoDias: 30
    }
  },
  decisionMemory: {
    principles: [
      { nome: 'Demanda orienta a escala', adaptacao: 'Cupons e vendas por hora do VRSoft, separados por tipo de dia.' },
      { nome: 'Pessoa certa no momento certo', adaptacao: 'Disponibilidade, habilidades, função substituta e regras da CCT.' },
      { nome: 'Decisão antes do calendário', adaptacao: 'Comparar custo, cobertura, risco e capacidade auxiliar antes de publicar.' },
      { nome: 'Reequilíbrio contínuo', adaptacao: 'Confrontar escala, ponto realizado e movimento para corrigir a próxima semana.' }
    ],
    recommendations: [
      {
        decisao: 'Não contratar operador de caixa agora',
        status: 'Recomendado',
        confidence: 68,
        dados: ['4 operadoras', '106 caixas-hora semanais', '160h de capacidade no cenário mais restritivo'],
        formula: 'Folga operacional = capacidade semanal - demanda semanal',
        resultado: '160h - 106h = 54h semanais disponíveis após atender o caixa',
        limitacao: 'Amostra possui somente uma ocorrência de cada dia e a sexta-feira importada foi feriado.',
        proximaAcao: 'Importar oito semanas e medir filas antes de aprovar contratação.'
      },
      {
        decisao: 'Preparar redução para 40h sem prometer economia salarial',
        status: 'Monitorar',
        confidence: 82,
        dados: ['4 operadoras', '44h atuais', '40h futuras', 'R$ 13.620/mês estimados'],
        formula: 'Capacidade perdida = quantidade de pessoas x redução semanal',
        resultado: '4 x 4h = 16h/semana; aproximadamente 69h/mês de capacidade auxiliar perdida',
        limitacao: 'Encargos e benefícios ainda são premissas; precisam ser substituídos pela folha Domínio.',
        proximaAcao: 'Medir quais tarefas auxiliares deixam de ser concluídas antes de contratar.'
      },
      {
        decisao: 'Treinar uma terceira pessoa para abertura',
        status: 'Prioridade alta',
        confidence: 55,
        dados: ['Lucila e Edvania aptas para abertura', 'mínimo definido: 2 pessoas aptas'],
        formula: 'Reserva da função = pessoas aptas - mínimo exigido',
        resultado: '2 - 2 = 0 pessoas reserva; ausência de Lucila ou Edvania cria lacuna crítica',
        limitacao: 'Competências são premissas iniciais e ainda não foram validadas pelo gerente.',
        proximaAcao: 'Validar habilidades e capacitar Samara ou Jane para abertura.'
      },
      {
        decisao: 'Manter dois caixas aos domingos até ampliar dados',
        status: 'Temporário',
        confidence: 60,
        dados: ['Funcionamento 08h-12h', '4 horas', '2 operadoras escaladas'],
        formula: 'Cobertura dominical = caixas escalados - mínimo temporário',
        resultado: '2 - 2 = cobertura exata, sem reserva',
        limitacao: 'Há somente um domingo de movimento importado; regras femininas dependem da CCT aplicável.',
        proximaAcao: 'Importar mais domingos e validar o revezamento com RH/CCT.'
      }
    ]
  },
  dailyCoverage: {
    monday: {
      label: 'Segunda',
      source: 'VRSoft 04/05/2026; intervalo redistribuído de 11h-12h para 12h-13h. Movimento 19h-20h tratado como exceção',
      confidence: 'média',
      rows: buildCoverage(weekdayHours, [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 2, 2], weekdayAtual, weekdayTransicao, weekdayFinal, 'weekday')
    },
    tuesday: {
      label: 'Terça',
      source: 'VRSoft 05/05/2026; intervalo redistribuído de 11h-12h para 12h-13h. Movimento 19h-20h tratado como exceção',
      confidence: 'média',
      rows: buildCoverage(weekdayHours, [1, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 1], weekdayAtual, weekdayTransicao, weekdayFinal, 'weekday')
    },
    wednesday: {
      label: 'Quarta',
      source: 'VRSoft 06/05/2026; 343 cupons. Movimento 19h-20h tratado como exceção fora do horário operacional',
      confidence: 'média',
      rows: buildCoverage(weekdayHours, [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1], weekdayAtual, weekdayTransicao, weekdayFinal, 'weekday')
    },
    thursday: {
      label: 'Quinta',
      source: 'VRSoft 07/05/2026; 356 cupons',
      confidence: 'média',
      rows: buildCoverage(weekdayHours, [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1], weekdayAtual, weekdayTransicao, weekdayFinal, 'weekday')
    },
    friday: {
      label: 'Sexta',
      source: 'VRSoft 01/05/2026 - feriado; intervalo redistribuído de 13h-14h para cobrir 11h-12h',
      confidence: 'baixa',
      rows: buildCoverage(
        weekdayHours,
        [1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        [1, 2, 2, 3, 2, 1, 2, 2, 3, 2, 2, 2],
        weekdayFinal,
        'weekday'
      )
    },
    saturday: {
      label: 'Sábado',
      source: 'VRSoft 02/05/2026; presença redistribuída de 13h-14h para cobrir 10h-11h',
      confidence: 'média',
      rows: buildCoverage(
        ['06-07', '07-08', '08-09', '09-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17', '17-18', '18-19'],
        [1, 1, 2, 2, 3, 2, 1, 1, 1, 2, 2, 2, 2],
        [1, 1, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2],
        [1, 1, 2, 2, 3, 2, 1, 3, 2, 3, 2, 2, 2],
        [1, 1, 2, 2, 3, 2, 1, 3, 2, 3, 2, 2, 2],
        'saturday'
      )
    },
    sunday: {
      label: 'Domingo',
      source: 'VRSoft 03/05/2026; operação considerada das 08h às 12h',
      confidence: 'média',
      rows: buildCoverage(['08-09', '09-10', '10-11', '11-12'], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], 'sunday')
    }
  },
  staffSchedule,
  weeklyScenarioSchedule,
  coverageByDay: {
    weekday: {
      label: 'Segunda a sexta',
      note: 'Loja aberta 07h-19h. Base para dias úteis.',
      rows: [
        { hora: '07-08', atual: 1, transicao: 1, final: 1 },
        { hora: '08-09', atual: 2, transicao: 2, final: 2 },
        { hora: '09-10', atual: 2, transicao: 2, final: 2 },
        { hora: '10-11', atual: 2, transicao: 3, final: 3 },
        { hora: '11-12', atual: 1, transicao: 1, final: 2 },
        { hora: '12-13', atual: 2, transicao: 1, final: 1 },
        { hora: '13-14', atual: 3, transicao: 3, final: 3 },
        { hora: '14-15', atual: 2, transicao: 2, final: 2 },
        { hora: '15-16', atual: 2, transicao: 3, final: 3 },
        { hora: '16-17', atual: 2, transicao: 2, final: 2 },
        { hora: '17-18', atual: 2, transicao: 2, final: 2 },
        { hora: '18-19', atual: 2, transicao: 2, final: 2 }
      ]
    },
    saturday: {
      label: 'Sábado',
      note: 'Loja abre 1h mais cedo, 06h-19h.',
      rows: [
        { hora: '06-07', atual: 1, transicao: 1, final: 1 },
        { hora: '07-08', atual: 1, transicao: 1, final: 1 },
        { hora: '08-09', atual: 2, transicao: 2, final: 2 },
        { hora: '09-10', atual: 2, transicao: 2, final: 2 },
        { hora: '10-11', atual: 2, transicao: 3, final: 3 },
        { hora: '11-12', atual: 2, transicao: 2, final: 2 },
        { hora: '12-13', atual: 2, transicao: 1, final: 1 },
        { hora: '13-14', atual: 3, transicao: 3, final: 3 },
        { hora: '14-15', atual: 2, transicao: 2, final: 2 },
        { hora: '15-16', atual: 2, transicao: 3, final: 3 },
        { hora: '16-17', atual: 2, transicao: 2, final: 2 },
        { hora: '17-18', atual: 2, transicao: 2, final: 2 },
        { hora: '18-19', atual: 2, transicao: 2, final: 2 }
      ]
    },
    sunday: {
      label: 'Domingo',
      note: 'Sem movimento importado suficiente; regra conservadora temporária: 2 caixas por 4h.',
      rows: [
        { hora: '08-09', atual: 2, transicao: 2, final: 2 },
        { hora: '09-10', atual: 2, transicao: 2, final: 2 },
        { hora: '10-11', atual: 2, transicao: 2, final: 2 },
        { hora: '11-12', atual: 2, transicao: 2, final: 2 }
      ]
    }
  },
  sundayRotation: [
    { data: '2026-06-07', folga: ['Lucila', 'Edvania'], trabalhando: ['Samara', 'Jane'], alerta: 'Mínimo domingo = 2 por falta de movimento importado; validar CCT.' },
    { data: '2026-06-14', folga: ['Samara', 'Jane'], trabalhando: ['Lucila', 'Edvania'], alerta: 'Mínimo domingo = 2 por falta de movimento importado; validar CCT.' },
    { data: '2026-06-21', folga: ['Lucila', 'Samara'], trabalhando: ['Edvania', 'Jane'], alerta: 'Mínimo domingo = 2 por falta de movimento importado; validar CCT.' },
    { data: '2026-06-28', folga: ['Edvania', 'Jane'], trabalhando: ['Lucila', 'Samara'], alerta: 'Mínimo domingo = 2 por falta de movimento importado; validar CCT.' }
  ],
  audit: [
    { nome: 'Edvania', sexo: 'feminino', diasTrabalho: 24, folgas: 6, domingosTrabalhados: 3, domingosFolga: 1, horasMes: 166.00, status: 'Atencao' },
    { nome: 'Jane', sexo: 'feminino', diasTrabalho: 25, folgas: 5, domingosTrabalhados: 3, domingosFolga: 1, horasMes: 173.33, status: 'Atencao' },
    { nome: 'Lucila', sexo: 'feminino', diasTrabalho: 24, folgas: 6, domingosTrabalhados: 3, domingosFolga: 1, horasMes: 166.00, status: 'Atencao' },
    { nome: 'Samara', sexo: 'feminino', diasTrabalho: 25, folgas: 5, domingosTrabalhados: 3, domingosFolga: 1, horasMes: 173.33, status: 'Atencao' }
  ],
  commissionReview: {
    score: 74,
    status: 'Pronta para simular; ainda não pronta para publicar',
    dimensions: [
      { nome: 'Cobertura e serviço', score: 88, responsavel: 'Frente de caixa' },
      { nome: 'Conformidade e descanso', score: 62, responsavel: 'RH' },
      { nome: 'Previsão de fluxo', score: 68, responsavel: 'Tráfego' },
      { nome: 'Execução da loja', score: 76, responsavel: 'Gestão de loja' },
      { nome: 'Custo e produtividade', score: 73, responsavel: 'Controladoria' }
    ]
  },
  controllerActions: [
    {
      prioridade: 'Crítica',
      tipo: 'Ampliar base de demanda',
      especialista: 'Gestor de tráfego e dados',
      diagnostico: 'A escala agora possui uma semana completa de referência, mas ainda depende de uma única ocorrência de cada dia; a sexta importada foi feriado.',
      recomendacao: 'Importar ao menos 8 semanas de cupons e vendas por intervalo, separando dias úteis, sábados, domingos, feriados, pagamento e promoções.',
      gatilho: 'Confiança da previsão abaixo de 80%',
      impacto: 'Evita otimizar a escala para uma amostra que não representa o comportamento normal.',
      metrica: 'Erro previsão x realizado por faixa horária',
      referencia: 'Logile, Legion e Quinyx'
    },
    {
      prioridade: 'Alta',
      tipo: 'Proteger abertura, pico e fechamento',
      especialista: 'Gestor de frente de caixa',
      diagnostico: 'Cobertura numérica não garante operação segura nem filas controladas.',
      recomendacao: 'Aplicar mínimo operacional por momento: abertura com preparação definida, pico com demanda coberta e fechamento com pelo menos duas pessoas habilitadas.',
      gatilho: 'Cobertura abaixo da demanda ou somente uma pessoa no fechamento',
      impacto: 'Reduz filas, abandono, risco de segurança e sobrecarga.',
      metrica: 'Fila, tempo médio, abandono e fechamentos com dupla',
      referencia: 'StoreForce, Logile e Legion'
    },
    {
      prioridade: 'Alta',
      tipo: 'Bloqueio trabalhista antes da publicação',
      especialista: 'Gestor de RH e relações trabalhistas',
      diagnostico: 'As regras atuais estão pré-validadas, mas ainda dependem da CCT, descansos, domingos femininos, intervalos e compensações.',
      recomendacao: 'Impedir publicação quando houver violação e exigir justificativa registrada para alertas não bloqueantes.',
      gatilho: 'Descanso, intervalo, carga, folga ou regra dominical fora do parâmetro',
      impacto: 'Reduz passivo, retrabalho e decisões informais sem auditoria.',
      metrica: 'Violações bloqueadas e exceções justificadas',
      referencia: 'UKG, Quinyx e Legion'
    },
    {
      prioridade: 'Alta',
      tipo: 'Converter sobra em execução de loja',
      especialista: 'Gestor de loja',
      diagnostico: 'Horas fora do caixa aparecem como sobra, mas precisam virar tarefas planejadas.',
      recomendacao: 'Associar cada faixa de baixa demanda a tarefas com duração e prioridade: troco, abertura, organização, embalagem, devolução, preços e reposição leve.',
      gatilho: 'Caixas escalados acima da demanda',
      impacto: 'Transforma horas disponíveis em produtividade observável.',
      metrica: 'Horas de apoio planejadas x tarefas concluídas',
      referencia: 'Logile e Legion'
    },
    {
      prioridade: 'Média',
      tipo: 'Equidade e previsibilidade',
      especialista: 'Gestor de RH',
      diagnostico: 'Uma escala operacionalmente ótima pode concentrar fechamentos, sábados e domingos nas mesmas pessoas.',
      recomendacao: 'Pontuar justiça da escala por colaboradora e limitar sequências indesejáveis, respeitando preferências e disponibilidade.',
      gatilho: 'Diferença excessiva de fechamentos, domingos ou alterações tardias',
      impacto: 'Melhora confiança, retenção e estabilidade da equipe.',
      metrica: 'Índice de equidade, trocas e alterações após publicação',
      referencia: 'Quinyx, UKG e Legion'
    },
    {
      prioridade: 'Média',
      tipo: 'Plano versus realizado',
      especialista: 'Controladoria e ponto',
      diagnostico: 'Sem comparar escala e relógio de ponto, não sabemos se a otimização aconteceu na prática.',
      recomendacao: 'Medir diariamente atrasos, horas extras, ausências, cobertura realizada e divergência da previsão.',
      gatilho: 'Após integração com relógio de ponto',
      impacto: 'Cria aprendizado contínuo e melhora a próxima escala.',
      metrica: 'Aderência planejado x realizado e custo por atendimento',
      referencia: 'UKG, Legion e Deputy'
    }
  ]
};

function json(res, payload, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  res.end(JSON.stringify(payload));
}

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function sundayIsClosed(profile = {}) {
  return profile.domingoOperacao === 'fechado' || String(profile.horarioDomingo || '').trim().toLowerCase() === 'fechado';
}

function requiredOperationalDayKeys(profile = {}) {
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (!sundayIsClosed(profile) && Number(profile.domingosFechadosMes || 0) < 4) keys.push('sunday');
  return keys;
}

function parseStoreHours(hourStr) {
  if (!hourStr || typeof hourStr !== 'string') return { open: 7, close: 19 };
  const match = hourStr.match(/(\d{1,2}):?\d{0,2}\s*-\s*(\d{1,2}):?\d{0,2}/);
  if (!match) return { open: 7, close: 19 };
  return { open: Number(match[1]), close: Number(match[2]) };
}

function formatScheduleHour(h) {
  return String(Math.floor(h)).padStart(2, '0');
}

// Hora decimal -> "HH:MM" (ex: 13.333 -> "13:20"). Arredonda minutos a 5min.
function formatHM(h) {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60 / 5) * 5;
  if (mm === 60) { hh += 1; mm = 0; }
  return mm === 0 ? `${String(hh).padStart(2, '0')}:00` : `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
// Duração decimal -> "7h" ou "7h20"
function formatDur(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60 / 5) * 5;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
}

function getLegalIntervalMinutes(workedHours) {
  if (workedHours > 6) return 60;
  if (workedHours > 4) return 15;
  return 0;
}

function hmTextToMinutes(value) {
  const m = String(value || '').match(/(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  return (Number(m[1]) * 60) + Number(m[2] || 0);
}

function parseWorkedBlocks(shift) {
  if (!shift || shift === 'Folga') return [];
  const [periodoRaw] = String(shift).split('·').map((part) => part.trim());
  if (!periodoRaw) return [];

  if (periodoRaw.includes('/')) {
    return periodoRaw
      .split('/')
      .map((bloco) => {
        const [ini, fim] = bloco.split('-').map((part) => part.trim());
        const start = hmTextToMinutes(ini);
        const end = hmTextToMinutes(fim);
        return start === null || end === null ? null : { start, end };
      })
      .filter(Boolean);
  }

  const [ini, fimOriginal] = periodoRaw.split('-').map((part) => part.trim());
  const startMin = hmTextToMinutes(ini);
  const endMin = hmTextToMinutes(fimOriginal);
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
  const maxAntes = workedHours > 6 ? 340 : workedMin; // 5h40 (6h CLT art.71 - 20min buffer)
  const minDepois = 120;
  const beforeMin = Math.min(maxAntes, Math.max(minAntes, Math.min(beforeBase, workedMin - minDepois)));
  const intervalStart = startMin + beforeMin;
  const intervalEnd = intervalStart + intervaloMin;

  return [
    { start: startMin, end: intervalStart },
    { start: intervalEnd, end: endReal }
  ].filter((block) => block.end > block.start);
}

function generateOperatorShift(startHour, endHour, breakAtHour) {
  const workedHours = endHour - startHour;
  if (breakAtHour !== undefined && workedHours > 6) {
    const breakEnd = breakAtHour + 1;
    const shiftEnd = endHour + 1;
    return `${formatHM(startHour)}-${formatHM(breakAtHour)}/${formatHM(breakEnd)}-${formatHM(shiftEnd)} · ${formatDur(workedHours)}`;
  }
  return `${formatHM(startHour)}-${formatHM(endHour)} · ${formatDur(workedHours)}`;
}

function scheduleGroupKey(emp) {
  if (isOperadorCaixa(emp)) return 'frente de caixa';
  const setorOperacional = normalizeSetor(empSetorOperacional(emp));
  if (setorOperacional) return setorOperacional;
  const setor = normalizeSetor(emp.setor);
  if (setor) return setor;
  const cargo = normalizeSetor(emp.cargo);
  return cargo || 'sem setor';
}

// Regra de cobertura por setor:
// - 1 colaborador: centraliza no miolo do dia
// - N colaboradores: floor(N/2) fixos na abertura, floor(N/2) fixos no fechamento
// - sobra (quando N é ímpar) fica no intermediário/miolo
// Preferências explícitas continuam valendo; a distribuição automática completa o restante.
function assignCoverageRolesBySector(employees) {
  const prepared = (employees || []).map((emp, index) => ({ ...emp, _sortIndex: index }));
  if (prepared.length <= 1) {
    return prepared.map((emp) => ({ ...emp, _coverageRole: 'central' }));
  }

  const half = Math.floor(prepared.length / 2);
  const explicitOpen = [];
  const explicitClose = [];
  const explicitMiddle = [];
  const flex = [];

  prepared.forEach((emp) => {
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
    const emp = flexPool.shift();
    result.push({ ...emp, _coverageRole: 'abertura' });
    openingSlots -= 1;
  }
  while (closingSlots > 0 && flexPool.length) {
    const emp = flexPool.pop();
    result.push({ ...emp, _coverageRole: 'fechamento' });
    closingSlots -= 1;
  }
  flexPool.forEach((emp) => result.push({ ...emp, _coverageRole: 'intermediario' }));

  return result.sort((a, b) => a._sortIndex - b._sortIndex);
}

// Distribui a carga semanal pelos dias trabalhados conforme o PESO de demanda de cada dia.
// Dias de pico (sex/sáb) recebem mais horas; dias fracos menos. Respeita piso/teto e soma exata.
// diasTrabalho: array de índices (0=seg..6=dom). pesos: array[7] com peso de cada dia.
function distribuirJornada(targetHours, diasTrabalho, pesos, piso = 5, teto = 9) {
  const n = diasTrabalho.length;
  if (!n) return {};
  // Pesos normalizados dos dias trabalhados.
  // Sáb (5) e Sex (4) recebem piso de peso para garantir prioridade mesmo sem dados de vendas.
  // CLT permite até 10h/dia (8h + 2h extra). Sáb puxado para ~9h, sex ~8h.
  const pesoMinPico = { 5: 1.35, 4: 1.25 }; // sáb ~9h, sex ~8h
  const pd = diasTrabalho.map(d => {
    const base = Math.max(0.1, (pesos && pesos[d]) || 1);
    const minimo = pesoMinPico[d] || 0;
    return Math.max(base, minimo);
  });
  const somaPesos = pd.reduce((s, p) => s + p, 0);
  // Alocação inicial proporcional
  let horas = pd.map(p => (targetHours * p) / somaPesos);
  // Aplica piso/teto iterativamente, redistribuindo o excedente/déficit nos dias livres
  for (let iter = 0; iter < 12; iter++) {
    let ajuste = 0;
    horas = horas.map(h => {
      if (h > teto) { ajuste += h - teto; return teto; }
      if (h < piso) { ajuste -= piso - h; return piso; }
      return h;
    });
    if (Math.abs(ajuste) < 0.01) break;
    // Redistribui 'ajuste' entre os dias que ainda têm folga (entre piso e teto)
    const livres = horas.map((h, i) => (h < teto - 0.01 && h > piso + 0.01) ? i : -1).filter(i => i >= 0);
    if (!livres.length) break;
    const porDia = ajuste / livres.length;
    livres.forEach(i => { horas[i] = Math.min(teto, Math.max(piso, horas[i] + porDia)); });
  }
  // Arredonda a múltiplos de 20min e corrige o resto para fechar exatamente targetHours
  horas = horas.map(h => Math.round(h * 3) / 3); // múltiplos de 20min
  let diff = targetHours - horas.reduce((s, h) => s + h, 0);
  // Ajusta o resto nos dias de maior peso (até o teto) ou menor peso (até o piso).
  // Repete quantas passadas forem necessárias para fechar exatamente a carga semanal.
  const ordem = diasTrabalho.map((d, i) => i).sort((a, b) => pd[b] - pd[a]);
  for (let iter = 0; iter < 24 && Math.abs(diff) >= 0.01; iter++) {
    let mexeu = false;
    const fila = diff > 0 ? ordem : [...ordem].reverse();
    for (const i of fila) {
      if (Math.abs(diff) < 0.01) break;
      const passo = diff > 0
        ? Math.min(1 / 3, teto - horas[i], diff)
        : Math.max(-1 / 3, piso - horas[i], diff);
      if (Math.abs(passo) < 0.01) continue;
      horas[i] += passo;
      diff -= passo;
      mexeu = true;
    }
    if (!mexeu) break;
  }
  const mapa = {};
  diasTrabalho.forEach((d, i) => { mapa[d] = Math.round(horas[i] * 3) / 3; });
  return mapa;
}

// Mapeia um colaborador ao setor operacional (para cruzar com vendas mercadológico)
function empSetorOperacional(emp) {
  const cargo = String(emp.cargo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const setor = String(emp.setor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (cargo.includes('acougu') || setor.includes('acougu')) return 'Açougue';
  if (cargo.includes('padeiro') || cargo.includes('confeit') || cargo.includes('padaria') || setor.includes('padaria')) return 'Padaria';
  if (cargo.includes('peixeiro') || setor.includes('peix')) return 'Peixaria';
  if (setor.includes('hortifruti') || setor.includes('flv')) return 'Hortifruti';
  if (setor.includes('frios') || setor.includes('laticin')) return 'Frios e Laticínios';
  if (setor.includes('congelado') || setor.includes('ilha')) return 'Congelados';
  // Repositores e demais → mapeia o sub-setor mercadológico ao operacional
  return mercadologicoParaSetor(emp.setor);
}

// Benchmarks operacionais de supermercado (calibráveis)
const BENCH = {
  fatPorFuncionario: 36500,    // R$/mês por colaborador total (faixa 33k-40k)
  fatPorCheckoutHora: 1500,    // R$/hora de checkout ativo
  clientesPorHoraCaixa: 20,    // 18-22 clientes/hora por caixa
  tmaMin: 2.5,                 // tempo médio de atendimento (min)
  ipm: 22,                     // itens por minuto
  rupturaMeta: 5,              // % meta de ruptura
  ticketMedio: 75              // R$ ticket médio referência
};

// FASE 2: Forecast com sazonalidade (média ponderada por dia da semana + tendência)
function buildForecast(mercRows, caixaRows) {
  const fonte = (mercRows && mercRows.length) ? mercRows : (caixaRows || []);
  if (!fonte.length) return null;
  // Venda média por dia da semana
  const dow = { v: [0,0,0,0,0,0,0], n: [new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()] };
  fonte.forEach(r => {
    const d = new Date(`${r.data}T12:00:00`).getDay();
    dow.v[d] += Number(r.vendaLiquida || 0);
    dow.n[d].add(r.data);
  });
  const nomesDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const mediaPorDia = dow.v.map((v, i) => ({ dia: nomesDia[i], valor: dow.n[i].size ? Math.round(v / dow.n[i].size) : 0 }));
  const mediaGeral = mediaPorDia.reduce((s, d) => s + d.valor, 0) / (mediaPorDia.filter(d => d.valor).length || 1);
  // Índice de sazonalidade (1.0 = média)
  const sazonalidade = mediaPorDia.map(d => ({ ...d, indice: mediaGeral ? Number((d.valor / mediaGeral).toFixed(2)) : 1 }));
  // Próximos 7 dias (projeção pela média do dia da semana)
  const hoje = new Date();
  const proximos = [];
  for (let i = 1; i <= 7; i++) {
    const dt = new Date(hoje); dt.setDate(hoje.getDate() + i);
    const dw = dt.getDay();
    proximos.push({
      data: dt.toISOString().slice(0, 10),
      diaSemana: nomesDia[dw],
      previsao: mediaPorDia[dw].valor
    });
  }
  // Eventos com fator (feriados/pagamento/promoção — calendário base)
  const eventos = [
    { tipo: 'Pagamento', regra: 'dias 5 e 20', fator: 1.25 },
    { tipo: 'Véspera de feriado', regra: 'antecede feriado', fator: 1.4 },
    { tipo: 'Promoção/Encarte', regra: 'fim de semana', fator: 1.2 }
  ];
  return { sazonalidade, proximos, eventos, picoDiaSemana: sazonalidade.reduce((a, b) => b.valor > a.valor ? b : a) };
}

// FASE 2: Banco de horas (saldo por colaborador conforme escala vs jornada contratual)
function buildBancoHoras(fullSchedule, employees) {
  const sc = fullSchedule && (fullSchedule.atual || Object.values(fullSchedule)[0]);
  if (!sc) return [];
  const contratoMap = {};
  (employees || []).forEach(e => { contratoMap[e.nome] = Number(e.horasSemanais || 44); });
  return Object.entries(sc.people).map(([nome, shifts]) => {
    const trabalhadas = shifts.reduce((s, sh) => {
      const m = String(sh).match(/·\s*(\d+)h/); return s + (m ? Number(m[1]) : 0);
    }, 0);
    const contrato = contratoMap[nome] || 44;
    const saldo = trabalhadas - contrato;
    return { nome, trabalhadas, contrato, saldo };
  }).filter(b => Math.abs(b.saldo) >= 1).sort((a, b) => b.saldo - a.saldo);
}

// Dashboard executivo operacional (KPIs por dia/semana/mês)
function buildOperationalDashboard(state, caixaSalesRows) {
  const mercRows = Array.isArray(state.salesByMercadologico) ? state.salesByMercadologico : [];
  const employees = state.employees || [];
  const caixaRows = caixaSalesRows || state.salesRows || [];

  // --- FATURAMENTO ---
  let fatDia = 0, fonteFat = 'sem dados';
  if (mercRows.length) {
    const diasMerc = new Set(mercRows.map(r => r.data)).size || 1;
    fatDia = mercRows.reduce((s, r) => s + r.vendaLiquida, 0) / diasMerc;
    fonteFat = 'mercadológico';
  } else if (caixaRows.length) {
    const diasCx = new Set(caixaRows.map(r => r.data)).size || 1;
    fatDia = caixaRows.reduce((s, r) => s + Number(r.vendaLiquida || 0), 0) / diasCx;
    fonteFat = 'caixa VRSoft';
  }
  const fatMes = fatDia * 30;
  const fatSemana = fatDia * 7;

  // --- DIMENSIONAMENTO GLOBAL (1 func / R$33-40k/mês) ---
  const headcountIdeal = fatMes ? Math.round(fatMes / BENCH.fatPorFuncionario) : 0;
  const headcountIdealMin = fatMes ? Math.round(fatMes / 40000) : 0;
  const headcountIdealMax = fatMes ? Math.round(fatMes / 33000) : 0;
  const headcountAtual = employees.length;
  let headcountStatus = 'ok';
  if (headcountAtual && headcountIdeal) {
    if (headcountAtual < headcountIdeal * 0.85) headcountStatus = 'baixo';
    else if (headcountAtual > headcountIdeal * 1.15) headcountStatus = 'alto';
  }

  // --- FRENTE DE CAIXA (do VRSoft) ---
  let clientesPicoHora = 0, horaPico = '—', clientesDia = 0, ticketMedio = BENCH.ticketMedio;
  if (caixaRows.length) {
    const porHora = {};
    const diasCx = new Set(caixaRows.map(r => r.data)).size || 1;
    let totalCupons = 0, totalVenda = 0;
    caixaRows.forEach(r => {
      const h = String(r.horaInicio || '').slice(0, 2);
      porHora[h] = (porHora[h] || 0) + Number(r.cupons || 0);
      totalCupons += Number(r.cupons || 0);
      totalVenda += Number(r.vendaLiquida || 0);
    });
    // média por hora por dia
    const picoEntry = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0];
    if (picoEntry) { clientesPicoHora = Math.round(picoEntry[1] / diasCx); horaPico = `${picoEntry[0]}h`; }
    clientesDia = Math.round(totalCupons / diasCx);
    ticketMedio = totalCupons ? Math.round(totalVenda / totalCupons) : BENCH.ticketMedio;
  }
  const checkoutsPico = Math.max(1, Math.ceil(clientesPicoHora / BENCH.clientesPorHoraCaixa));
  const operadoresCaixa = employees.filter(isOperadorCaixa).length;

  // --- ALERTAS INTELIGENTES ---
  const alertas = [];
  if (headcountIdeal && headcountStatus === 'baixo') {
    alertas.push({ nivel: 'alto', texto: `Equipe abaixo do ideal: ${headcountAtual} de ~${headcountIdeal} sugeridos para R$ ${Math.round(fatMes/1000)}k/mês.` });
  } else if (headcountStatus === 'alto') {
    alertas.push({ nivel: 'medio', texto: `Equipe acima do dimensionamento (${headcountAtual} vs ~${headcountIdeal}). Avaliar produtividade.` });
  }
  if (clientesPicoHora && checkoutsPico > operadoresCaixa) {
    alertas.push({ nivel: 'alto', texto: `Pico às ${horaPico} exige ${checkoutsPico} caixas, mas há ${operadoresCaixa} operadores. Risco de fila > 8min.` });
  }
  // Setores sem equipe (risco de ruptura)
  const setoresSemEquipe = (state._setoresSemEquipe || []);
  if (setoresSemEquipe.length) {
    alertas.push({ nivel: 'medio', texto: `${setoresSemEquipe.length} setor(es) com venda mas sem equipe — risco de ruptura: ${setoresSemEquipe.slice(0,3).join(', ')}.` });
  }
  if (!alertas.length) alertas.push({ nivel: 'ok', texto: 'Operação equilibrada nos indicadores analisados.' });

  // --- KPIs DE RUPTURA E PERDAS (estimados) ---
  // Ruptura sobe quando setores estão subdimensionados. Base de mercado ~11%, meta <5%.
  const setoresSemEq = (state._setoresSemEquipe || []).length;
  const totalSetoresVenda = (state._totalSetoresVenda || 1);
  const fatorCobertura = totalSetoresVenda ? 1 - (setoresSemEq / totalSetoresVenda) : 1;
  const rupturaEstimada = Number((11 - fatorCobertura * 6).toFixed(1)); // 5% (cobertura total) a 11% (sem cobertura)
  const impactoRuptura = Math.round(fatMes * (rupturaEstimada / 100));
  const perdaValidade = Math.round(fatMes * 0.0175); // 1,75% médio
  // Abandono: se o pico não tem checkouts suficientes, ~3% das vendas do pico
  const vendaPicoHora = clientesPicoHora * ticketMedio;
  const abandonoFila = checkoutsPico > operadoresCaixa ? Math.round(vendaPicoHora * 0.03 * 30) : 0;
  const perdas = {
    rupturaEstimada,
    rupturaMeta: BENCH.rupturaMeta,
    impactoRuptura,
    perdaValidade,
    abandonoFila,
    totalPerdas: impactoRuptura + perdaValidade + abandonoFila
  };

  // --- MULTIFUNCIONALIDADE (repositor leve como reforço de caixa no pico) ---
  let horasCriticas = [];
  if (caixaRows.length) {
    const porHora = {};
    const diasCx = new Set(caixaRows.map(r => r.data)).size || 1;
    caixaRows.forEach(r => {
      const h = String(r.horaInicio || '').slice(0, 2);
      porHora[h] = (porHora[h] || 0) + Number(r.cupons || 0);
    });
    horasCriticas = Object.entries(porHora)
      .map(([h, c]) => ({ hora: `${h}h`, clientes: Math.round(c / diasCx), checkouts: Math.ceil((c / diasCx) / BENCH.clientesPorHoraCaixa) }))
      .filter(x => x.checkouts > operadoresCaixa)
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 5);
  }
  // Repositores "leves" candidatos a reforço (perfumaria, biscoitos, bebidas leves)
  const repositoresLeves = employees.filter(e => {
    const m = (Array.isArray(e.mercadologicos) ? e.mercadologicos.join(' ') : (e.setor || '')).toLowerCase();
    const c = String(e.cargo || '').toLowerCase();
    return c.includes('repos') && (m.includes('perfumaria') || m.includes('higiene') || m.includes('biscoito') || m.includes('matinal') || m.includes('bebida') || m.includes('bazar'));
  }).map(e => e.nome);
  const multifuncionalidade = {
    horasCriticas,
    repositoresLeves,
    reforcoNecessario: horasCriticas.length ? Math.max(...horasCriticas.map(h => h.checkouts - operadoresCaixa)) : 0
  };

  // --- TENDÊNCIA DE FATURAMENTO (série diária) ---
  let tendencia = [];
  const fonteSerie = mercRows.length ? mercRows : caixaRows;
  if (fonteSerie.length) {
    const porData = {};
    fonteSerie.forEach(r => {
      porData[r.data] = (porData[r.data] || 0) + Number(r.vendaLiquida || 0);
    });
    tendencia = Object.entries(porData).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, valor]) => ({ data, valor: Math.round(valor) }));
  }

  return {
    fonteFat,
    faturamento: { dia: Math.round(fatDia), semana: Math.round(fatSemana), mes: Math.round(fatMes) },
    headcount: { ideal: headcountIdeal, idealMin: headcountIdealMin, idealMax: headcountIdealMax, atual: headcountAtual, status: headcountStatus },
    frenteCaixa: {
      clientesPicoHora, horaPico, clientesDia, ticketMedio,
      checkoutsPico, operadoresCaixa,
      fatCheckoutHora: BENCH.fatPorCheckoutHora,
      clientesPorHora: BENCH.clientesPorHoraCaixa,
      tmaMin: BENCH.tmaMin
    },
    perdas,
    multifuncionalidade,
    tendencia,
    benchmarks: BENCH,
    alertas
  };
}

// Matriz de produtividade por mercadológico (benchmarks de varejo)
const MATRIZ_PRODUTIVIDADE = {
  'cereais': { caixasHora: '45-50', margem: '22-26%', foco: 'Abastecimento contínuo / evitar ruptura visual' },
  'limpeza': { caixasHora: '35-40', margem: '25-35%', foco: 'Frenteamento rigoroso e organização por marca' },
  'mercearia salgada': { caixasHora: '35-45', margem: '28-32%', foco: 'Controle de validade (PEPS)' },
  'mercearia doce': { caixasHora: '35-45', margem: '28-32%', foco: 'Controle de validade (PEPS) / impulso' },
  'biscoitos': { caixasHora: '50-60', margem: '30-35%', foco: 'Reposição rápida e organização por impulso' },
  'bebidas': { caixasHora: '40-50', margem: '14-20%', foco: 'Abastecimento focado em picos (fim de semana)' },
  'bazar': { caixasHora: '30-40', margem: '30-40%', foco: 'Exposição e organização por categoria' },
  'perfumaria e higiene pessoal': { caixasHora: '40-50', margem: '30-38%', foco: 'Frenteamento e prevenção de perdas (furto)' },
  'acougue': { caixasHora: '—', margem: '18-25%', foco: 'Produção, atendimento e validade rigorosa' },
  'padaria': { caixasHora: '—', margem: '35-45%', foco: 'Produção própria e reposição de quentes' },
  'flv': { caixasHora: '—', margem: '30-40%', foco: 'Qualidade visual e baixa de perdas' },
  'frios e laticineos': { caixasHora: '30-40', margem: '25-30%', foco: 'Atendimento, fatiados e validade' },
  'ilhas e congelados': { caixasHora: '35-45', margem: '22-28%', foco: 'Temperatura e reposição de freezer' }
};
function matrizProdutividade(merc) {
  const k = String(merc || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return MATRIZ_PRODUTIVIDADE[k] || { caixasHora: '—', margem: '—', foco: 'Reposição geral' };
}

// Dashboard inteligente: cruza vendas POR MERCADOLÓGICO (m2) com a equipe
function buildSetorDashboard(mercRows, employees, profile) {
  if (!mercRows || !mercRows.length) return [];
  const dias = new Set(mercRows.map(r => r.data)).size || 1;
  const vendaTotalGeral = mercRows.reduce((s, r) => s + r.vendaLiquida, 0);
  const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Agregar vendas POR MERCADOLÓGICO (m2) — chave normalizada, nome original preservado
  const setorVendas = {};
  const setorDiaSemana = {};
  const nomeOriginal = {};
  mercRows.forEach(r => {
    const k = norm(r.mercadologico);
    nomeOriginal[k] = r.mercadologico; // preserva o nome como veio (ex: "BEBIDAS")
    setorVendas[k] = setorVendas[k] || { vendaLiquida: 0, qtdItens: 0, qtdeVendida: 0 };
    setorVendas[k].vendaLiquida += r.vendaLiquida;
    setorVendas[k].qtdItens += r.qtdItens;
    setorVendas[k].qtdeVendida += r.qtdeVendida;
    const dow = new Date(`${r.data}T12:00:00`).getDay();
    setorDiaSemana[k] = setorDiaSemana[k] || { venda: [0,0,0,0,0,0,0], datas: [new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()] };
    setorDiaSemana[k].venda[dow] += r.vendaLiquida;
    setorDiaSemana[k].datas[dow].add(r.data);
  });

  // Agregar colaboradores POR MERCADOLÓGICO (m2) que cada um cobre
  const setorEquipe = {};
  (employees || []).forEach(emp => {
    if (isOperadorCaixa(emp)) return;
    const setorOp = String(emp.setor || '').toLowerCase();
    const cargoOp = String(emp.cargo || '').toLowerCase();
    if (setorOp.includes('administrativo') || cargoOp.includes('financeiro') || cargoOp.includes('fiscal') || cargoOp.includes('faturamento') || cargoOp.includes('rh') || cargoOp.includes('ti') || cargoOp.includes('mkt') || cargoOp.includes('motorista')) return;

    // Mercadológicos m2 que o colaborador cobre (ou o setor, se não marcou)
    const mercs = (Array.isArray(emp.mercadologicos) && emp.mercadologicos.length)
      ? emp.mercadologicos
      : [emp.setor];
    const fracao = 1 / mercs.length; // divide entre os m2 que cobre
    mercs.forEach(m => {
      const k = norm(m);
      if (!nomeOriginal[k]) nomeOriginal[k] = m;
      setorEquipe[k] = setorEquipe[k] || { colaboradores: 0, horas: 0, nomes: [] };
      setorEquipe[k].colaboradores += fracao;
      setorEquipe[k].horas += Number(emp.horasSemanais || 44) * fracao;
      setorEquipe[k].nomes.push(mercs.length > 1 ? `${emp.nome} (${Math.round(fracao * 100)}%)` : emp.nome);
    });
  });

  // Unir todos os mercadológicos com venda OU equipe
  const todasChaves = new Set([...Object.keys(setorVendas), ...Object.keys(setorEquipe)]);
  const dashboard = [];
  todasChaves.forEach(k => {
    const setor = nomeOriginal[k] || k;
    const v = setorVendas[k] || { vendaLiquida: 0, qtdItens: 0, qtdeVendida: 0 };
    const e = setorEquipe[k] || { colaboradores: 0, horas: 0, nomes: [] };
    const vendaDia = v.vendaLiquida / dias;
    const itensDia = v.qtdItens / dias;
    const colaboradores = e.colaboradores;
    const vendaPorColab = colaboradores ? vendaDia / colaboradores : 0;
    const itensPorColab = colaboradores ? itensDia / colaboradores : 0;
    const participacao = vendaTotalGeral ? (v.vendaLiquida / vendaTotalGeral) * 100 : 0;
    // Venda média por dia da semana (curva de demanda do mercadológico)
    const ds = setorDiaSemana[k];
    let curvaDiaSemana = [0,0,0,0,0,0,0];
    let picoDia = '—';
    if (ds) {
      curvaDiaSemana = ds.venda.map((vv, i) => {
        const nd = ds.datas[i].size;
        return nd ? Math.round(vv / nd) : 0;
      });
      const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const maxIdx = curvaDiaSemana.indexOf(Math.max(...curvaDiaSemana));
      picoDia = nomesDia[maxIdx];
    }
    dashboard.push({
      setor,
      vendaDia: Math.round(vendaDia),
      vendaMes: Math.round(v.vendaLiquida * (30 / dias)),
      itensDia: Math.round(itensDia),
      colaboradores: Math.round(colaboradores * 10) / 10,
      horasSemanais: Math.round(e.horas),
      curvaDiaSemana,
      picoDia,
      matriz: matrizProdutividade(setor),
      vendaPorColab: Math.round(vendaPorColab),
      itensPorColab: Math.round(itensPorColab),
      participacao: Number(participacao.toFixed(1)),
      nomes: e.nomes
    });
  });
  // Ordena por venda (maior primeiro)
  dashboard.sort((a, b) => b.vendaDia - a.vendaDia);

  // Inteligência: classificar carga (produtividade relativa)
  const produtividades = dashboard.filter(d => d.colaboradores > 0).map(d => d.vendaPorColab);
  const mediaProacolab = produtividades.length ? produtividades.reduce((s, p) => s + p, 0) / produtividades.length : 0;
  dashboard.forEach(d => {
    if (!d.colaboradores) {
      d.status = 'sem-equipe';
      d.statusLabel = 'Sem equipe cadastrada';
    } else if (d.vendaPorColab > mediaProacolab * 1.3) {
      d.status = 'sobrecarga';
      d.statusLabel = 'Alta carga — avaliar reforço';
    } else if (d.vendaPorColab < mediaProacolab * 0.7) {
      d.status = 'folga';
      d.statusLabel = 'Capacidade ociosa';
    } else {
      d.status = 'equilibrado';
      d.statusLabel = 'Equilibrado';
    }
  });
  return dashboard;
}

function isReposicao(emp) {
  const cargo = String(emp.cargo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return cargo.includes('repositor') || cargo.includes('reposicao') || cargo.includes('repos');
}

// ===== FASE 1: COMPLIANCE CLT =====
function hhToNum(s) { const p = String(s).split(':'); const h = Number(p[0]); return isNaN(h) ? NaN : h + (Number(p[1] || 0) / 60); }
function shiftStartEnd(shift) {
  if (!shift || shift === 'Folga') return null;
  const blocks = String(shift).split('·')[0].trim().split('/');
  const first = blocks[0].split('-');
  const last = blocks[blocks.length - 1].split('-');
  const start = hhToNum(first[0]); const end = hhToNum(last[1]);
  return (isNaN(start) || isNaN(end)) ? null : { start, end };
}
function shiftWorkedHours(shift) {
  if (!shift || shift === 'Folga') return 0;
  const m = String(shift).match(/·\s*(\d+)h(\d{2})?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
}

// Analisa a escala de um cenário e retorna violações CLT por colaborador
function checkComplianceCLT(people) {
  const violacoes = [];
  Object.entries(people).forEach(([nome, shifts]) => {
    const v = [];
    // 1) Horas semanais > 44h
    const totalHoras = shifts.reduce((s, sh) => s + shiftWorkedHours(sh), 0);
    if (totalHoras > 44) v.push(`Jornada ${totalHoras}h/sem excede 44h`);
    // 2) DSR — pelo menos 1 folga na semana
    const folgas = shifts.filter(sh => sh === 'Folga').length;
    if (folgas < 1) v.push('Sem descanso semanal (DSR)');
    // 3) Dias consecutivos > 6
    let consec = 0, maxConsec = 0;
    [...shifts, ...shifts].forEach(sh => { // duplica p/ pegar virada de semana
      if (sh !== 'Folga') { consec++; maxConsec = Math.max(maxConsec, consec); } else consec = 0;
    });
    if (maxConsec > 6) v.push(`${maxConsec} dias consecutivos sem folga (máx 6)`);
    // 4) Interjornada < 11h (fim de um dia ao início do próximo)
    for (let d = 0; d < 7; d++) {
      const hoje = shiftStartEnd(shifts[d]);
      const amanha = shiftStartEnd(shifts[(d + 1) % 7]);
      if (hoje && amanha) {
        const descanso = (24 - hoje.end) + amanha.start;
        if (descanso < 11) { v.push(`Interjornada de ${descanso}h (mín 11h)`); break; }
      }
    }
    // 5) Art. 71 — bloco contínuo de trabalho > 6h sem intervalo
    for (let d = 0; d < 7; d++) {
      const blocks = parseWorkedBlocks(shifts[d]);
      const longo = blocks.find(b => (b.end - b.start) > 360);
      if (longo) {
        v.push(`Bloco contínuo de ${formatDur((longo.end - longo.start) / 60)} sem intervalo (máx 6h — art. 71)`);
        break;
      }
    }
    // 6) Art. 59 — jornada diária > 10h (8h + 2h extras)
    for (let d = 0; d < 7; d++) {
      const horasDia = shiftWorkedHours(shifts[d]);
      if (horasDia > 10) {
        v.push(`Jornada diária de ${formatDur(horasDia)} excede 10h (art. 59)`);
        break;
      }
    }
    if (v.length) violacoes.push({ nome, violacoes: v });
  });
  return violacoes;
}

// Cargos de apoio/administrativo com horário comercial (cobrem o miolo do dia)
function isCargoComercial(emp) {
  const c = String(emp.cargo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ['conferente', 'motorista', 'entregador', 'entrega', 'financeiro', 'fiscal',
    'administrativo', 'faturamento', 'gerente', 'encarregado', 'auxiliar administrativo',
    'rh', ' ti', 'mkt', 'escritorio', 'compras', 'tesouraria', 'cpd', 'recursos humanos']
    .some(x => c.includes(x.trim()));
}

// Turno comercial centralizado: jornada + 1h almoço, cobrindo o miolo do dia (ex: 08-17).
function generateComercialShift(open, close, jornada = 8) {
  const ocupacao = jornada + (getLegalIntervalMinutes(jornada) / 60);
  const dur = close - open;
  const start = open + Math.max(0, Math.round((dur - ocupacao) / 2));
  const end = Math.min(close, start + ocupacao);
  return `${formatHM(start)}-${formatHM(end)} · ${formatDur(jornada)}`;
}

// Jornada de reposição:
// - manhã forte
// - cobertura de manutenção no miolo
// - fechamento inteligente
// Regras CLT validadas no art. 71:
// - >4h e <=6h: intervalo de 15min
// - >6h: intervalo mínimo de 1h
// Regra operacional do motor:
// - o intervalo não abre a jornada e não cai colado no encerramento;
// - jornadas curtas ficam contínuas, com pausa curta próxima do meio;
// - jornadas longas continuam partidas para manter cobertura.
function generateRepositorShift(open, close, idx, N, sexo, jornada = 8, role = 'intermediario') {
  const legalInterval = getLegalIntervalMinutes(jornada) / 60;
  if (legalInterval === 0) {
    const faixaCurta = Math.max(0, (close - open) - jornada);
    const inicioCurto = role === 'abertura'
      ? open
      : role === 'fechamento'
        ? open + faixaCurta
        : open + Math.round((N > 1 ? idx / (N - 1) : 0.5) * faixaCurta);
    return `${formatHM(inicioCurto)}-${formatHM(inicioCurto + jornada)} · ${formatDur(jornada)}`;
  }

  if (jornada <= 6) {
    const ocupacao = jornada + legalInterval;
    const faixaCurta = Math.max(0, (close - open) - ocupacao);
    const inicioCurto = role === 'abertura'
      ? open
      : role === 'fechamento'
        ? open + faixaCurta
        : open + Math.round((N > 1 ? idx / (N - 1) : 0.5) * faixaCurta);
    const metade = jornada / 2;
    const blocoManha = Math.round(metade * 3) / 3;
    const blocoTarde = Math.round((jornada - blocoManha) * 3) / 3;
    const manhaFim = inicioCurto + blocoManha;
    const tardeStart = manhaFim + legalInterval;
    const tardeFim = tardeStart + blocoTarde;
    return `${formatHM(inicioCurto)}-${formatHM(manhaFim)}/${formatHM(tardeStart)}-${formatHM(tardeFim)} · ${formatDur(jornada)}`;
  }

  const intervaloBase = role === 'central' || role === 'intermediario' ? 2 : 1;
  const intervalo = Math.max(legalInterval, intervaloBase);

  const snap20 = (h) => Math.round(h * 3) / 3;
  const splitByRole = () => {
    if (role === 'abertura') return { manha: 0.62, tarde: 0.38 };
    if (role === 'fechamento') return { manha: 0.38, tarde: 0.62 };
    return { manha: 0.5, tarde: 0.5 };
  };
  const ratio = splitByRole();
  let blocoManha = snap20(jornada * ratio.manha);
  let blocoTarde = snap20(jornada - blocoManha);

  // Mantém blocos minimamente úteis em cada ponta.
  if (blocoManha < 2) { blocoManha = 2; blocoTarde = snap20(jornada - blocoManha); }
  if (blocoTarde < 2) { blocoTarde = 2; blocoManha = snap20(jornada - blocoTarde); }

  const jornadaTotal = blocoManha + blocoTarde + intervalo;
  const faixa = Math.max(0, (close - open) - jornadaTotal);

  let manhaStart;
  if (role === 'abertura') {
    manhaStart = open;
  } else if (role === 'fechamento') {
    manhaStart = open + faixa;
  } else {
    manhaStart = open + Math.round((N > 1 ? idx / (N - 1) : 0.5) * faixa);
  }

  let manhaFim = manhaStart + blocoManha;
  let tardeStart = manhaFim + intervalo;
  let tardeFim = tardeStart + blocoTarde;

  if (tardeFim > close) {
    tardeFim = close;
    tardeStart = tardeFim - blocoTarde;
    manhaFim = tardeStart - intervalo;
    manhaStart = manhaFim - blocoManha;
  }
  if (manhaStart < open) {
    manhaStart = open;
    manhaFim = manhaStart + blocoManha;
    tardeStart = manhaFim + intervalo;
    tardeFim = tardeStart + blocoTarde;
  }

  // Se ainda sobrar fora da janela, centraliza sem perder a lógica do papel.
  if (tardeFim > close) {
    const excesso = tardeFim - close;
    manhaStart = Math.max(open, manhaStart - excesso);
    manhaFim = manhaStart + blocoManha;
    tardeStart = manhaFim + intervalo;
    tardeFim = Math.min(close, tardeStart + blocoTarde);
  }

  return `${formatHM(manhaStart)}-${formatHM(manhaFim)}/${formatHM(tardeStart)}-${formatHM(tardeFim)} · ${formatDur(blocoManha + blocoTarde)}`;
}

function buildOptimizationSavings(salesRows, profile, employees, summary) {
  if (!salesRows || !salesRows.length) return null;

  // Custo médio por hora de operador
  const salaries = employees.map(e => Number(e.salario || 0)).filter(s => s > 0);
  const avgSalary = salaries.length ? salaries.reduce((s, v) => s + v, 0) / salaries.length : 1650;
  const encargos = 0.68; // 68% encargos+benefícios padrão
  const monthlyCostPerOperator = avgSalary * (1 + encargos);
  const hoursPerMonth = 220; // 44h/semana * 4.33 ≈ 190h trabalhadas, mas 220h é base CLT
  const costPerHour = monthlyCostPerOperator / hoursPerMonth;

  // Analisar dados reais por hora
  const pdvLimit = Number(profile.quantidadePdvs || 3);
  let totalActualHours = 0;      // Caixas-hora que a empresa REALMENTE abriu
  let totalOptimalHours = 0;     // Caixas-hora otimizado (baseado em demanda real)
  let totalDemandHours = 0;      // Demanda real total
  const daysSet = new Set();
  const hourDetail = {};

  salesRows.forEach(row => {
    daysSet.add(row.data);
    const dayKey = dayKeys[new Date(`${row.data}T12:00:00`).getDay()];
    const dayType = dayKey === 'saturday' ? 'saturday' : dayKey === 'sunday' ? 'sunday' : 'weekday';
    const actualOperators = Number(row.operadores || 0);

    // Calcular ótimo baseado na demanda real (cupons, itens, minutos)
    const carga = cashierLoadForHour(
      `${row.horaInicio.slice(0, 2)}-${row.horaFim.slice(0, 2)}`,
      demandFromCoupons(row.cupons),
      actualOperators,
      dayType,
      pdvLimit,
      row.cupons,
      row.itensMedios,
      row.minutosAtendimento
    );
    const optimal = carga ? carga.operadoresRecomendados : 1;

    totalActualHours += actualOperators;
    totalOptimalHours += optimal;
    totalDemandHours += demandFromCoupons(row.cupons);

    const hourKey = `${row.horaInicio.slice(0, 2)}-${row.horaFim.slice(0, 2)}`;
    hourDetail[hourKey] = hourDetail[hourKey] || { actual: 0, optimal: 0, count: 0 };
    hourDetail[hourKey].actual += actualOperators;
    hourDetail[hourKey].optimal += optimal;
    hourDetail[hourKey].count += 1;
  });

  const numDays = daysSet.size || 1;
  // Projetar para o mês (assumindo dados representam padrão mensal)
  const monthMultiplier = 30 / numDays;

  const actualHoursMonth = totalActualHours * monthMultiplier;
  const optimalHoursMonth = totalOptimalHours * monthMultiplier;
  const savedHoursMonth = Math.max(0, actualHoursMonth - optimalHoursMonth);

  const actualCostMonth = actualHoursMonth * costPerHour;
  const optimalCostMonth = optimalHoursMonth * costPerHour;
  const savingsMonth = actualCostMonth - optimalCostMonth;

  // Distribuição por hora (média)
  const hourlyComparison = Object.entries(hourDetail)
    .map(([hora, d]) => ({
      hora,
      atualMedia: Number((d.actual / d.count).toFixed(1)),
      otimoMedia: Number((d.optimal / d.count).toFixed(1)),
      diferenca: Number(((d.actual - d.optimal) / d.count).toFixed(1))
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // Contar faixas com rotação excessiva (média acima dos PDVs)
  const rotacaoExcessiva = hourlyComparison.filter(h => h.atualMedia > pdvLimit).length;

  return {
    periodo: `${numDays} dias analisados`,
    pdvs: pdvLimit,
    rotacaoExcessiva,
    custoHora: Number(costPerHour.toFixed(2)),
    operacaoReal: {
      caixasHoraMes: Math.round(actualHoursMonth),
      custoMes: Math.round(actualCostMonth)
    },
    operacaoOtimizada: {
      caixasHoraMes: Math.round(optimalHoursMonth),
      custoMes: Math.round(optimalCostMonth)
    },
    economia: {
      caixasHoraMes: Math.round(savedHoursMonth),
      valorMes: Math.round(savingsMonth),
      valorAno: Math.round(savingsMonth * 12),
      percentual: actualHoursMonth ? Math.round((savedHoursMonth / actualHoursMonth) * 100) : 0
    },
    hourlyComparison
  };
}

function updateAllTabsWithImportedData(summary, profile, employees, savedSkillMatrix = null) {
  const employeeNames = employees.map(e => e.nome);
  const sundayClosed = sundayIsClosed(profile);

  // === AUDITORIA ===
  // Calcular dias trabalho, folgas, horas/mês baseado nas escalas geradas
  summary.audit = employees.map((emp, idx) => {
    const targetHours = 44; // 6x1 padrão
    const targetDaysOff = sundayClosed ? 1 : 1;
    const diasTrabalho = (7 - targetDaysOff) * 4.33; // semanas/mês
    const folgas = targetDaysOff * 4.33;
    const horasMes = targetHours * 4.33;
    return {
      nome: emp.nome,
      sexo: (emp.sexo || 'feminino').toLowerCase(),
      diasTrabalho: Math.round(diasTrabalho),
      folgas: Math.round(folgas),
      domingosTrabalhados: sundayClosed ? 0 : Math.floor(idx / 2),
      domingosFolga: sundayClosed ? 4 : 4 - Math.floor(idx / 2),
      horasMes: Number(horasMes.toFixed(2)),
      status: horasMes > 180 ? 'Atencao' : 'OK'
    };
  });

  // === DOMINGOS - ROTAÇÃO ===
  if (sundayClosed) {
    summary.sundayRotation = [];
  } else {
    // Gerar 4 domingos de rotação
    const sundayDates = ['2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28'];
    const minSunday = Math.max(2, Math.floor(employees.length / 2));
    summary.sundayRotation = sundayDates.map((date, weekIdx) => {
      const trabalhando = [];
      const folga = [];
      employees.forEach((emp, idx) => {
        // Rotação: cada operadora trabalha 3 de cada 4 domingos
        if ((idx + weekIdx) % 4 === 0) {
          folga.push(emp.nome);
        } else {
          trabalhando.push(emp.nome);
        }
      });
      return {
        data: date,
        folga,
        trabalhando,
        alerta: `Mínimo domingo = ${minSunday} pessoas para cobertura adequada.`
      };
    });
  }

  // === RESILIÊNCIA - PESSOAS ===
  summary.resilience.people = employees.map((emp, idx) => {
    // Se há matriz salva para esta operadora, usa ela
    const saved = savedSkillMatrix && savedSkillMatrix.find(s => s.nome === emp.nome);
    if (saved) {
      return { nome: emp.nome, skills: saved.skills, validado: saved.validado };
    }
    return {
      nome: emp.nome,
      skills: {
        caixa: 3,
        abertura: idx % 2 === 0 ? 3 : 2,
        fechamento: idx % 3 === 0 ? 3 : 2,
        sangria: idx === 0 || idx === 1 ? 3 : 1,
        lideranca: idx === 0 ? 3 : 2,
        apoio: 3
      },
      validado: false
    };
  });

  // === FINANCEIRO ===
  const salaries = employees.map(e => Number(e.salario || 0)).filter(s => s > 0);
  if (salaries.length) {
    summary.financial.assumptions.salarioBaseMensal = Math.round(salaries.reduce((sum, s) => sum + s, 0) / salaries.length);
  }
  summary.financial.assumptions.quantidadeOperadores = employees.length;
  summary.financial.assumptions.regimeTributario = profile.regimeTributario || summary.financial.assumptions.regimeTributario;
}

function regenerateCoverageHours(summary, profile) {
  const segSex = parseStoreHours(profile.horarioSegSex);
  const sabado = parseStoreHours(profile.horarioSabado);
  const sundayClosed = sundayIsClosed(profile);
  const domingo = sundayClosed ? null : parseStoreHours(profile.horarioDomingo);

  function buildRows(open, close) {
    const rows = [];
    for (let h = open; h < close; h++) {
      rows.push({
        hora: `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`,
        atual: 0,
        transicao: 0,
        final: 0,
        demanda: null
      });
    }
    return rows;
  }

  // Manter referências originais para preservar dados de demanda importados
  const oldDailyCoverage = summary.dailyCoverage;

  // Aplicar para cada dia
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(dayKey => {
    if (summary.dailyCoverage[dayKey]) {
      const newRows = buildRows(segSex.open, segSex.close);
      // Preservar demanda das rows antigas se existir
      newRows.forEach(newRow => {
        const oldRow = oldDailyCoverage[dayKey].rows.find(r => r.hora === newRow.hora);
        if (oldRow && oldRow.demanda != null) {
          Object.assign(newRow, oldRow);
        }
      });
      summary.dailyCoverage[dayKey].rows = newRows;
      summary.dailyCoverage[dayKey].note = `Loja aberta ${formatScheduleHour(segSex.open)}h-${formatScheduleHour(segSex.close)}h`;
    }
  });

  if (summary.dailyCoverage.saturday) {
    const newRows = buildRows(sabado.open, sabado.close);
    newRows.forEach(newRow => {
      const oldRow = oldDailyCoverage.saturday.rows.find(r => r.hora === newRow.hora);
      if (oldRow && oldRow.demanda != null) {
        Object.assign(newRow, oldRow);
      }
    });
    summary.dailyCoverage.saturday.rows = newRows;
    summary.dailyCoverage.saturday.note = `Sábado: loja aberta ${formatScheduleHour(sabado.open)}h-${formatScheduleHour(sabado.close)}h`;
  }

  if (summary.dailyCoverage.sunday) {
    if (sundayClosed) {
      summary.dailyCoverage.sunday.closed = true;
      summary.dailyCoverage.sunday.rows = [];
      summary.dailyCoverage.sunday.note = 'Loja fechada aos domingos.';
    } else if (domingo) {
      const newRows = buildRows(domingo.open, domingo.close);
      newRows.forEach(newRow => {
        const oldRow = oldDailyCoverage.sunday.rows.find(r => r.hora === newRow.hora);
        if (oldRow && oldRow.demanda != null) {
          Object.assign(newRow, oldRow);
        }
      });
      summary.dailyCoverage.sunday.rows = newRows;
      summary.dailyCoverage.sunday.note = `Domingo: loja aberta ${formatScheduleHour(domingo.open)}h-${formatScheduleHour(domingo.close)}h`;
    }
  }
}

function countWorkersAtHour(hourStart, hourEnd, dayIndex, people) {
  const faixaStart = hourStart * 60;
  const faixaEnd = hourEnd * 60;
  let count = 0;
  Object.values(people).forEach(shifts => {
    const shift = shifts[dayIndex];
    if (!shift || shift === 'Folga') return;
    const blocks = parseWorkedBlocks(shift);
    if (blocks.some((block) => block.start < faixaEnd && block.end > faixaStart)) {
      count++;
    }
  });
  return count;
}

function recalculateCoverageFromSchedules(summary, pdvs) {
  const dayKeyMap = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

  Object.entries(summary.dailyCoverage).forEach(([dayKey, day]) => {
    const dayIndex = dayKeyMap[dayKey];
    if (dayIndex === undefined || day.closed) return;

    day.rows.forEach(row => {
      const [startStr, endStr] = row.hora.split('-');
      const hourStart = Number(startStr);
      const hourEnd = Number(endStr);

      ['atual', 'transicao', 'final'].forEach(scenarioKey => {
        const scenario = summary.weeklyScenarioSchedule[scenarioKey];
        if (!scenario) return;
        const workers = countWorkersAtHour(hourStart, hourEnd, dayIndex, scenario.people);
        // Demanda atual da hora, ou 0 se desconhecida
        const demanda = Number(row.demanda || 0);
        // Caixas a abrir = min(operadoras trabalhando, PDVs, max(demanda, 1))
        // Mas se há demanda alta, abre até o limite dos PDVs
        const idealCaixas = Math.max(demanda, 1);
        row[scenarioKey] = Math.min(workers, pdvs, idealCaixas);
      });
    });
  });
}

function applyOptimizationToSchedule(summary, optimizedCoverage) {
  const dayKeyMap = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
  const scenarioKeys = ['atual', 'transicao', 'final'];

  scenarioKeys.forEach(scenarioKey => {
    const dayMap = optimizedCoverage[scenarioKey];
    if (!dayMap) return;
    const scenario = summary.weeklyScenarioSchedule[scenarioKey];
    if (!scenario || !scenario.people) return;
    const people = scenario.people;

    Object.entries(dayMap).forEach(([dayKey, optimizedRows]) => {
      if (!Array.isArray(optimizedRows)) return;
      const dayIndex = dayKeyMap[dayKey];
      if (dayIndex === undefined) return;

      const targets = {};
      optimizedRows.forEach(o => { targets[o.hora] = Number(o.atual || 0); });

      const workers = Object.entries(people)
        .map(([nome, shifts]) => {
          const shift = shifts[dayIndex];
          if (!shift || shift === 'Folga') return null;
          const workedHours = shiftWorkedHours(shift) || 0;
          const intervalMin = getLegalIntervalMinutes(workedHours);
          if (intervalMin !== 60) return null;

          const [periodoRaw] = String(shift).split('·').map(p => p.trim());
          let shiftStart, shiftEnd;
          if (periodoRaw.includes('/')) {
            const blocks = periodoRaw.split('/');
            shiftStart = hmTextToMinutes(blocks[0].split('-')[0]);
            shiftEnd = hmTextToMinutes(blocks[blocks.length - 1].split('-')[1]);
          } else {
            const [ini, fim] = periodoRaw.split('-').map(p => p.trim());
            shiftStart = hmTextToMinutes(ini);
            shiftEnd = hmTextToMinutes(fim);
          }
          if (shiftStart === null || shiftEnd === null) return null;

          const workedMin = Math.round(workedHours * 60);
          const beforeBase = Math.round((workedMin / 2) / 5) * 5;
          const minAntes = workedHours > 6 ? 180 : 120;
          const maxAntes = workedHours > 6 ? 340 : workedMin; // 5h40 (6h art.71 - 20min)
          const minDepois = 120;
          const beforeMin = Math.min(maxAntes, Math.max(minAntes, Math.min(beforeBase, workedMin - minDepois)));
          const currentBreakStart = shiftStart + beforeMin;

          // Janela legal p/ mover o intervalo: nenhum bloco contínuo > 5h40 (art. 71 c/ margem)
          const earliest = Math.max(shiftStart + 120, shiftEnd - 60 - 340, Math.ceil(shiftStart / 60) * 60);
          const latest = Math.min(shiftStart + 340, shiftEnd - 60 - 120, Math.floor((shiftEnd - 60) / 60) * 60);
          if (earliest > latest) return null;

          return { nome, shifts, dayIndex, shiftStart, shiftEnd, workedHours, breakStart: currentBreakStart, earliest, latest };
        })
        .filter(Boolean);

      if (!workers.length) return;

      const currentCounts = {};
      Object.keys(targets).forEach(hora => {
        currentCounts[hora] = countWorkersAtHour(Number(hora.split('-')[0]), Number(hora.split('-')[1]), dayIndex, people);
      });

      const breakHourOf = (w) => {
        const h = Math.floor(w.breakStart / 60);
        return `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`;
      };
      const feasibleHours = (w) => {
        const hours = [];
        for (let s = w.earliest; s <= w.latest; s += 60) {
          const h = Math.floor(s / 60);
          hours.push({ label: `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`, start: s });
        }
        return hours;
      };

      const rebuildShift = (w) => {
        const s = formatHM(w.shiftStart / 60);
        const bkS = formatHM(w.breakStart / 60);
        const bkE = formatHM((w.breakStart + 60) / 60);
        const e = formatHM(w.shiftEnd / 60);
        return `${s}-${bkS}/${bkE}-${e} · ${formatDur(w.workedHours)}`;
      };

      // Processa primeiro as horas com maior déficit (a janela de pausas é
      // limitada — resolver o pior buraco antes evita gastar pausas à toa)
      const horasPorDeficit = Object.keys(targets).sort((a, b) =>
        ((targets[b] || 0) - (currentCounts[b] || 0)) - ((targets[a] || 0) - (currentCounts[a] || 0)));
      horasPorDeficit.forEach(hourLabel => {
        while ((currentCounts[hourLabel] || 0) < (targets[hourLabel] || 0)) {
          const candidates = workers.filter(w => breakHourOf(w) === hourLabel);
          if (!candidates.length) break;

          let moved = false;
          for (const worker of candidates) {
            const options = feasibleHours(worker)
              .filter(o => o.label !== hourLabel)
              .map(o => ({
                ...o,
                surplus: (currentCounts[o.label] || 0) - (targets[o.label] || 0)
              }))
              .filter(o => o.surplus > 0)
              .sort((a, b) => b.surplus - a.surplus);

            if (!options.length) continue;
            const chosen = options[0];
            currentCounts[hourLabel] = (currentCounts[hourLabel] || 0) + 1;
            currentCounts[chosen.label] = (currentCounts[chosen.label] || 0) - 1;
            worker.breakStart = chosen.start;
            worker.shifts[worker.dayIndex] = rebuildShift(worker);
            moved = true;
            break;
          }
          if (!moved) break;
        }
      });
    });
  });
}

function generateScheduleByProfile(profile, employees, targetHours = 44, targetDaysOff = 1, pesosDia = null) {
  const segSex = parseStoreHours(profile.horarioSegSex);
  const sabado = parseStoreHours(profile.horarioSabado);
  const sundayClosed = sundayIsClosed(profile);
  const domingo = sundayClosed ? null : parseStoreHours(profile.horarioDomingo);

  const segSexDuration = segSex.close - segSex.open;
  const sabadoDuration = sabado.close - sabado.open;

  // Jornada diária = carga semanal / dias trabalhados (CLT: 44h em 6 dias = 7h20).
  // 6x1 44h → 7.33h/dia; 5x2 40h → 8h/dia; 5x2 42h → 8.4h/dia.
  const diasTrabalhados = Math.max(1, 7 - targetDaysOff);
  const shiftHours = Math.min(9, targetHours / diasTrabalhados); // max 9h/dia (operacional)
  const numShifts = Math.max(1, Math.ceil(segSexDuration / 4));

  // Semente semanal p/ rodízio de domingo (muda a cada semana-calendário)
  const weekSeed = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));

  const folgaDiaMap = { segunda: 0, terca: 1, quarta: 2, quinta: 3, domingo: 6 };
  const N = employees.length; // tamanho do grupo (setor + cargo)

  // Calcula início do turno conforme preferência + distribuição uniforme pelo grupo.
  // jornada = duração do turno naquele dia (pode variar por demanda).
  function startForTurno(turno, open, close, idx, jornada = shiftHours) {
    const span = Math.max(0, close - jornada - open); // janela de início (abertura até turno que fecha)
    const lateStart = open + span; // turno que fecha a loja
    switch (turno) {
      case 'abertura': return open;
      case 'fechamento': return lateStart;
      case 'central':
      case 'intermediario': return open + Math.round(span / 2);
      default:
        // flexível — espalha o grupo uniformemente da abertura ao fechamento
        return open + Math.round((N > 1 ? idx / (N - 1) : 0) * span);
    }
  }

  // COBERTURA: respeita preferências explícitas; só usa flexíveis para completar abridor/fechador.
  const temAbridorExplicito = employees.some(e => (e.turno || 'flexivel') === 'abertura');
  const temFechadorExplicito = employees.some(e => (e.turno || 'flexivel') === 'fechamento');
  const idxFlexiveis = employees.map((e, i) => ((e.turno || 'flexivel') === 'flexivel' ? i : -1)).filter(i => i >= 0);
  const idxFechadorAuto = (!temFechadorExplicito && idxFlexiveis.length) ? idxFlexiveis[idxFlexiveis.length - 1] : -1;
  const idxAbridorAuto = (!temAbridorExplicito && idxFlexiveis.length) ? idxFlexiveis.find(i => i !== idxFechadorAuto) ?? -1 : -1;

  // Em dias de pico (sex/sáb), manter apenas 1 fechador(a) no turno de fechamento.
  // Fechadores extras são redirecionados para cobrir a manhã (início escalonado).
  const idxFechadores = employees
    .map((e, i) => ((e._coverageRole || e.turno || 'flexivel') === 'fechamento' ? i : -1))
    .filter(i => i >= 0);
  const idxFechadorPrimario = idxFechadores.length > 0 ? idxFechadores[idxFechadores.length - 1] : -1;

  // Workers matutinos em dias de pico (todos exceto o fechador primário)
  const peakMorningWorkers = employees.map((_, i) => i).filter(i => i !== idxFechadorPrimario);

  const result = {};
  employees.forEach((emp, idx) => {
    const turno = emp._coverageRole || emp.turno || 'flexivel';
    const podeDomingo = emp.podeDomingo !== false;
    const folgaPref = emp.folgaPreferencial || '';
    const reposicao = isReposicao(emp);
    // Comercial: cargos de apoio/admin OU função única no grupo (1 pessoa)
    const comercial = !reposicao && (isCargoComercial(emp) || N === 1);
    const sexo = String(emp.sexo || 'feminino').toLowerCase();

    // COBERTURA: a PREFERÊNCIA do colaborador tem prioridade. A designação
    // automática (abridor/fechador) só vale para quem está como 'flexível'.
    let ehFechador, ehAbridor;
    if (turno === 'fechamento') { ehFechador = true; ehAbridor = false; }
    else if (turno === 'abertura') { ehAbridor = true; ehFechador = false; }
    else if (turno === 'intermediario' || turno === 'central') { ehAbridor = false; ehFechador = false; }
    else { // flexível — completa a cobertura que falta
      ehFechador = N > 1 && idx === idxFechadorAuto;
      ehAbridor = N > 1 && idx === idxAbridorAuto && idx !== idxFechadorAuto;
    }

    // Rodízio de domingo (Lei 10.101): em loja aberta no domingo, cada colaborador(a)
    // folga no domingo pelo menos 1 vez a cada 3 semanas. O weekSeed muda a cada
    // semana, rotacionando quem folga; esse domingo passa a ser o DSR da semana.
    const folgaDomingoRodizio = !sundayClosed && Boolean(domingo) && podeDomingo
      && ((idx + weekSeed) % 3 === 0);
    const domingoTrabalha = !sundayClosed && podeDomingo && Boolean(domingo) && !folgaDomingoRodizio;

    // Folgas adicionais por colaborador(a): se o domingo já é folga (loja fechada,
    // rodízio ou indisponibilidade), ele conta como DSR e reduz as folgas de seg-qui.
    const folgasAdicionaisEmp = domingoTrabalha ? targetDaysOff : Math.max(0, targetDaysOff - 1);
    const folgaDaysAllowed = [0, 1, 2, 3];
    const additionalFolgaDays = [];
    const prefDay = folgaDiaMap[folgaPref];
    if (prefDay !== undefined && folgaDaysAllowed.includes(prefDay) && folgasAdicionaisEmp > 0) {
      additionalFolgaDays.push(prefDay);
    }
    for (let i = 0; additionalFolgaDays.length < folgasAdicionaisEmp && i < folgaDaysAllowed.length; i++) {
      const d = folgaDaysAllowed[(idx + i) % folgaDaysAllowed.length];
      if (!additionalFolgaDays.includes(d)) additionalFolgaDays.push(d);
    }
    const diasTrabalho = [];
    for (let day = 0; day < 7; day++) {
      if (additionalFolgaDays.includes(day)) continue;
      if (day === 6 && !domingoTrabalha) continue;
      diasTrabalho.push(day);
    }

    // JORNADA VARIÁVEL POR DEMANDA: distribui targetHours pelos dias conforme o peso de vendas.
    // Sex/sáb (pico) recebem mais horas; seg-qui menos. Sem dados → uniforme.
    const jornadaPorDia = distribuirJornada(targetHours, diasTrabalho, pesosDia);
    const lojaDoDia = (day) => (day === 5 ? sabado : day === 6 ? domingo : segSex);

    // Sexta (4) e sábado (5) = dias de pico: time completo sem lacuna.
    // Flexíveis comprimem-se na abertura (sobreposição máxima) em vez de se
    // espalharem uniformemente. Abridor e fechador fixos continuam garantidos.
    const isPeakDay = (day) => day === 4 || day === 5;

    function gerarTurnoDia(day) {
      const loja = lojaDoDia(day);
      const jd = jornadaPorDia[day] || shiftHours;
      if (reposicao) {
        if (ehFechador) return generateRepositorShift(loja.open, loja.close, idx, N, sexo, jd, 'fechamento');
        if (ehAbridor) return generateRepositorShift(loja.open, loja.close, idx, N, sexo, jd, 'abertura');
        if (isPeakDay(day)) return generateRepositorShift(loja.open, loja.close, idx, N, sexo, jd, 'abertura');
        return generateRepositorShift(loja.open, loja.close, idx, N, sexo, jd, turno);
      }
      if (comercial) return generateComercialShift(loja.open, loja.close, jd);
      // Pico: calcular entrada e intervalo juntos. Regras:
      // (1) max 4h40 contínuas antes do intervalo (5h CLT - 20min buffer)
      // (2) no máximo 1 pessoa em intervalo por vez
      // (3) intervalos só começam após a fechadora chegar
      // Estratégia: escalonar entradas (1h entre cada) para que intervalos
      // fiquem naturalmente espaçados de 1h, todos dentro do limite de 4h40.
      function peakShift() {
        const mi = peakMorningWorkers.indexOf(idx);
        if (mi < 0) return null;
        const closerStart = Math.max(loja.open, loja.close - jd);
        const maxCont = 5 + 40 / 60; // 6h CLT art.71 - 20min buffer = 5h40
        // Intervalo do slot mi: closerStart + mi horas (espaçados de 1h)
        const breakAt = closerStart + mi;
        // Entrada = breakAt - maxCont (ou loja.open, o que for mais tarde)
        const start = Math.max(loja.open, Math.round((breakAt - maxCont) * 2) / 2);
        const end = Math.min(loja.close, start + jd);
        return { start, end, breakAt: Math.round(breakAt * 4) / 4 };
      }

      if (ehFechador) {
        if (isPeakDay(day) && idxFechadores.length > 1 && idx !== idxFechadorPrimario) {
          const ps = peakShift();
          if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
          return generateOperatorShift(loja.open, Math.min(loja.close, loja.open + jd));
        }
        return generateOperatorShift(Math.max(loja.open, loja.close - jd), loja.close);
      }
      if (ehAbridor) {
        if (isPeakDay(day)) {
          const ps = peakShift();
          if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
        }
        return generateOperatorShift(loja.open, Math.min(loja.close, loja.open + jd));
      }
      if (isPeakDay(day)) {
        const ps = peakShift();
        if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
        const start = loja.open;
        return generateOperatorShift(start, Math.min(loja.close, start + jd));
      }
      const start = startForTurno(turno, loja.open, loja.close, idx, jd);
      return generateOperatorShift(start, Math.min(loja.close, start + jd));
    }

    // Monta a semana priorizando sáb (5) > sex (4) > restante,
    // garantindo que nos dias de pico o turno seja gerado primeiro.
    const shifts = new Array(7).fill(null);
    const ordemPrioridade = [5, 4, 0, 1, 2, 3, 6]; // sáb, sex, seg-qui, dom
    for (const day of ordemPrioridade) {
      shifts[day] = diasTrabalho.includes(day) ? gerarTurnoDia(day) : 'Folga';
    }
    result[emp.nome] = shifts;
  });
  return result;
}

// Gera escala agrupando por SETOR operacional.
// Regra nova:
// - metade do setor fixa na abertura
// - metade fixa no fechamento
// - sobra (ímpar) no intermediário
// - setor com 1 pessoa fica centralizado para cobrir o miolo do dia
function generateGroupedSchedule(profile, employees, targetHours = 44, targetDaysOff = 1, pesosDia = null) {
  const groups = {};
  (employees || []).forEach((emp) => {
    const key = scheduleGroupKey(emp);
    groups[key] = groups[key] || [];
    groups[key].push(emp);
  });

  // Gerar escala para cada setor isoladamente e mesclar
  const merged = {};
  Object.values(groups).forEach((grupo) => {
    const grupoComCobertura = assignCoverageRolesBySector(grupo);
    const escalaGrupo = generateScheduleByProfile(profile, grupoComCobertura, targetHours, targetDaysOff, pesosDia);
    Object.assign(merged, escalaGrupo);
  });
  return merged;
}

// Calcula o peso de demanda por dia da semana (0=seg..6=dom) a partir das vendas.
// Usado para a jornada variável (mais horas nos dias de pico).
function pesosDiaSemanaDeVendas(salesRows, mercRows) {
  const fonte = (mercRows && mercRows.length) ? mercRows : (salesRows || []);
  if (!fonte.length) return null;
  const soma = [0, 0, 0, 0, 0, 0, 0], cont = [0, 0, 0, 0, 0, 0, 0];
  fonte.forEach(r => {
    const dow = (new Date(`${r.data}T12:00:00`).getDay() + 6) % 7; // seg=0
    soma[dow] += Number(r.vendaLiquida || r.cupons || 0);
    cont[dow] += 1;
  });
  const media = soma.map((s, i) => cont[i] ? s / cont[i] : 0);
  const mediaGeral = media.filter(v => v > 0).reduce((s, v) => s + v, 0) / (media.filter(v => v > 0).length || 1);
  if (!mediaGeral) return null;
  // peso = venda média do dia / média geral (1.0 = típico)
  return media.map(v => v > 0 ? v / mediaGeral : 1);
}

function dateLabel(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function monthWeekLabel(date) {
  const [, month, day] = date.split('-').map(Number);
  const week = Math.floor((day - 1) / 7) + 1;
  return { month, week, key: `${String(month).padStart(2, '0')}-W${week}` };
}

function buildMonthlyWeekAnalysis(summary, salesRows = []) {
  if (!salesRows.length) return [];
  const scenarios = summary.scenarios || [];
  const byBucket = {};
  const dailyDemand = {};

  salesRows.forEach((row) => {
    if (!row.data) return;
    const bucket = monthWeekLabel(row.data);
    const demand = demandFromCoupons(row.cupons);
    byBucket[bucket.key] ||= {
      key: bucket.key,
      month: bucket.month,
      week: bucket.week,
      dates: new Set(),
      caixaHoraPeriodo: 0,
      cuponsPeriodo: 0,
      vendaPeriodo: 0,
      minutosPeriodo: 0
    };
    byBucket[bucket.key].dates.add(row.data);
    byBucket[bucket.key].caixaHoraPeriodo += demand;
    byBucket[bucket.key].cuponsPeriodo += Number(row.cupons || 0);
    byBucket[bucket.key].vendaPeriodo += Number(row.vendaLiquida || 0);
    byBucket[bucket.key].minutosPeriodo += Number(row.minutosAtendimento || 0);
    dailyDemand[row.data] = (dailyDemand[row.data] || 0) + demand;
  });

  return Object.values(byBucket)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => {
      const dates = [...bucket.dates].sort();
      const observedDays = dates.length || 1;
      const equivalentWeekDemand = Number(((bucket.caixaHoraPeriodo / observedDays) * 7).toFixed(1));
      const strongestDate = dates
        .map((date) => ({ date, demand: dailyDemand[date] || 0 }))
        .sort((left, right) => right.demand - left.demand)[0];
      const scenarioSurplus = scenarios.map((scenario) => Number((scenario.capacidade - equivalentWeekDemand).toFixed(1)));
      return {
        key: bucket.key,
        label: `Mes ${bucket.month} · semana ${bucket.week}`,
        periodLabel: `${dateLabel(dates[0])} a ${dateLabel(dates[dates.length - 1])}`,
        observedDays,
        caixaHoraPeriodo: Number(bucket.caixaHoraPeriodo.toFixed(1)),
        caixaHoraSemanaEquivalente: equivalentWeekDemand,
        cuponsMediosDia: Number((bucket.cuponsPeriodo / observedDays).toFixed(1)),
        vendaMediaDia: Number((bucket.vendaPeriodo / observedDays).toFixed(2)),
        minutosMediosDia: Number((bucket.minutosPeriodo / observedDays).toFixed(1)),
        strongestDate: strongestDate ? dateLabel(strongestDate.date) : null,
        strongestDemand: strongestDate ? strongestDate.demand : 0,
        auxiliar44h: scenarioSurplus[0] ?? null,
        auxiliar42h: scenarioSurplus[1] ?? null,
        auxiliar40h: scenarioSurplus[2] ?? null,
        headcountSignal: equivalentWeekDemand > Number((scenarios[2] || {}).capacidade || 0) ? 'rever quadro' : 'manter quadro'
      };
    });
}

function representedSalesDays(rows = []) {
  const calendarDays = new Set(rows.map((row) => row.data)).size;
  const declaredDays = rows.reduce((max, row) => Math.max(max, Number(row.diasRepresentados || 0)), 0);
  return Math.max(calendarDays, declaredDays);
}

function demandFromCoupons(coupons) {
  const value = Number(coupons || 0);
  if (value <= 35) return 1;
  if (value <= 70) return 2;
  if (value <= 105) return 3;
  return 4;
}

function parseDecimal(value) {
  const text = String(value || '0').trim();
  if (!text) return 0;
  if (text.includes(',') && text.includes('.')) return Number(text.replace(/\./g, '').replace(',', '.')) || 0;
  if (text.includes(',')) return Number(text.replace(',', '.')) || 0;
  return Number(text) || 0;
}

function minutesBetween(start, end) {
  const parse = (value) => {
    const [hour, minute, second = 0] = String(value || '').split(':').map(Number);
    if ([hour, minute].some(Number.isNaN)) return null;
    return hour * 60 + minute + second / 60;
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) return 0;
  const diff = endMinutes - startMinutes;
  return diff > 120 ? 0 : diff;
}

function loadModelSalesRows() {
  if (!fs.existsSync(MODEL_SALES_FILE)) return [];
  const text = fs.readFileSync(MODEL_SALES_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = headerLine.split(';').map((header) => header.trim().toLowerCase());
  const position = Object.fromEntries(headers.map((header, index) => [header, index]));
  const required = ['data', 'horainicio', 'horatermino', 'qtd_itens', 'qtd_unidades', 'valor_cupom'];
  if (required.some((key) => position[key] === undefined)) return [];

  const grouped = {};
  lines.forEach((line) => {
    const cells = line.split(';').map((cell) => cell.trim());
    const data = cells[position.data];
    const horaInicio = cells[position.horainicio];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}/.test(horaInicio)) return;
    const hour = Number(horaInicio.slice(0, 2));
    if (Number.isNaN(hour)) return;
    const bucketStart = `${String(hour).padStart(2, '0')}:00`;
    const bucketEnd = `${String(hour + 1).padStart(2, '0')}:00`;
    const key = `${data}|${bucketStart}|${bucketEnd}`;
    grouped[key] ||= {
      data,
      horaInicio: bucketStart,
      horaFim: bucketEnd,
      cupons: 0,
      vendaLiquida: 0,
      qtdeVendida: 0,
      qtdItens: 0,
      minutosAtendimento: 0
    };
    grouped[key].cupons += 1;
    grouped[key].vendaLiquida += parseDecimal(cells[position.valor_cupom]);
    grouped[key].qtdeVendida += parseDecimal(cells[position.qtd_unidades]);
    grouped[key].qtdItens += parseDecimal(cells[position.qtd_itens]);
    grouped[key].minutosAtendimento += minutesBetween(horaInicio, cells[position.horatermino]);
  });

  return Object.values(grouped).map((row) => ({
    ...row,
    vendaLiquida: Number(row.vendaLiquida.toFixed(2)),
    qtdeVendida: Number(row.qtdeVendida.toFixed(3)),
    qtdItens: Number(row.qtdItens.toFixed(0)),
    itensMedios: row.cupons ? Number((row.qtdItens / row.cupons).toFixed(2)) : 0,
    minutosAtendimento: Number(row.minutosAtendimento.toFixed(2)),
    diasRepresentados: 1,
    modeloOrigem: 'empresa_modelo_vrsoft'
  }));
}

function applySalesRowsToSummary(summary, salesRows, sourceLabel) {
  if (!salesRows.length) return summary;
  const grouped = {};
  salesRows.forEach((row) => {
    const dayKey = dayKeys[new Date(`${row.data}T12:00:00`).getDay()];
    const hour = `${row.horaInicio.slice(0, 2)}-${row.horaFim.slice(0, 2)}`;
    grouped[dayKey] ||= {};
    grouped[dayKey][hour] ||= [];
    grouped[dayKey][hour].push({
      demanda: demandFromCoupons(row.cupons),
      cupons: Number(row.cupons || 0),
      vendaLiquida: Number(row.vendaLiquida || 0),
      qtdeVendida: Number(row.qtdeVendida || 0),
      qtdItens: Number(row.qtdItens || 0),
      itensMedios: Number(row.itensMedios || 0),
      minutosAtendimento: Number(row.minutosAtendimento || 0)
    });
  });

  Object.values(summary.dailyCoverage || {}).forEach((day) => {
    (day.rows || []).forEach((row) => {
      row.demanda = null;
      row.cupons = undefined;
      row.vendaLiquida = undefined;
      row.qtdeVendida = undefined;
      row.qtdItens = undefined;
      row.itensMedios = undefined;
      row.minutosAtendimento = undefined;
    });
  });

  Object.entries(grouped).forEach(([dayKey, hours]) => {
    if (!summary.dailyCoverage[dayKey]) return;
    summary.dailyCoverage[dayKey].rows.forEach((row) => {
      if (!hours[row.hora]) return;
      const values = hours[row.hora];
      row.demanda = Math.ceil(values.reduce((sum, value) => sum + value.demanda, 0) / values.length);
      row.cupons = Number((values.reduce((sum, value) => sum + value.cupons, 0) / values.length).toFixed(2));
      row.vendaLiquida = Number((values.reduce((sum, value) => sum + value.vendaLiquida, 0) / values.length).toFixed(2));
      row.qtdeVendida = Number((values.reduce((sum, value) => sum + value.qtdeVendida, 0) / values.length).toFixed(3));
      const totalCoupons = values.reduce((sum, value) => sum + value.cupons, 0);
      const totalItems = values.reduce((sum, value) => sum + value.qtdItens, 0);
      row.itensMedios = totalCoupons ? Number((totalItems / totalCoupons).toFixed(2)) : Number((values.reduce((sum, value) => sum + value.itensMedios, 0) / values.length).toFixed(2));
      row.minutosAtendimento = Number((values.reduce((sum, value) => sum + value.minutosAtendimento, 0) / values.length).toFixed(2));
    });
    summary.dailyCoverage[dayKey].source = `${sourceLabel} · média de ${Object.values(hours).reduce((sum, rows) => sum + rows.length, 0)} faixa(s)`;
    summary.dailyCoverage[dayKey].confidence = 'alta';
  });

  refreshCoverageLoads(summary, summary.storeConfig.pdvs);
  const dates = [...new Set(salesRows.map((row) => row.data))].sort();
  const weeklyDemand = Object.values(summary.dailyCoverage).flatMap((day) => day.rows).reduce((sum, row) => sum + Number(row.demanda || 0), 0);
  summary.scenarios.forEach((scenario) => { scenario.caixaNecessario = weeklyDemand; });
  summary.monthlyWeekAnalysis = buildMonthlyWeekAnalysis(summary, salesRows);
  summary.metadata.diasComVenda = dates.length;
  summary.metadata.confianca = Math.min(95, Math.round(35 + dates.length * 4.7));
  summary.metadata.periodoAmostra = `${dateLabel(dates[0])} a ${dateLabel(dates[dates.length - 1])}`;
  summary.metadata.ultimaImportacao = 'Empresa modelo · dados vendas';
  return summary;
}

function refreshCoverageLoads(summary, pdvLimit) {
  Object.entries(summary.dailyCoverage || {}).forEach(([dayKey, day]) => {
    const dayType = dayKey === 'saturday' ? 'saturday' : dayKey === 'sunday' ? 'sunday' : 'weekday';
    (day.rows || []).forEach((row) => {
      if (row.demanda === null || row.demanda === undefined) {
        row.cargaCaixa = null;
        return;
      }
      const scheduled = Math.max(Number(row.atual || 0), Number(row.transicao || 0), Number(row.final || 0));
      row.cargaCaixa = cashierLoadForHour(row.hora, row.demanda, scheduled, dayType, pdvLimit, row.cupons, row.itensMedios, row.minutosAtendimento);
    });
  });
}

function weekOfMonth(dateStr) {
  const day = Number(dateStr.split('-')[2]);
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

async function applyClientState(summary, user, weekFilter = null) {
  const state = await loadClientState(user.orgId);
  const profile = state.profile || defaultClientState().profile;
  // Filtrar vendas pela semana do mês (módulo 2 — análise semana a semana)
  if (weekFilter && Array.isArray(state.salesRows)) {
    const semanaLabels = { 1: 'Semana 1 (dias 1-7)', 2: 'Semana 2 (dias 8-14)', 3: 'Semana 3 (dias 15-21)', 4: 'Semana 4 (dias 22-28)', 5: 'Semana 5 (dias 29-31)' };
    const filtradas = state.salesRows.filter(r => weekOfMonth(r.data) === Number(weekFilter));
    state.salesRows = filtradas;
    summary.metadata = summary.metadata || {};
    summary.metadata.semanaAtiva = Number(weekFilter);
    summary.metadata.semanaLabel = semanaLabels[Number(weekFilter)] || `Semana ${weekFilter}`;
    summary.metadata.demandaMediaSemana = filtradas.length ? `${filtradas.length} faixas analisadas` : 'Sem dados nesta semana';
  }
  const requiredDayKeys = requiredOperationalDayKeys(profile);
  const importedDayKeys = new Set(state.salesRows.map((row) => dayKeys[new Date(`${row.data}T12:00:00`).getDay()]));
  const importedOperationalDayKeys = requiredDayKeys.filter((key) => importedDayKeys.has(key));
  const missingOperationalDayKeys = requiredDayKeys.filter((key) => !importedDayKeys.has(key));
  summary.enabledModules = Array.isArray(state.enabledModules) ? state.enabledModules : [1,2,3,4,5,6,7,8,9,10];
  summary.userRole = user.role || 'admin';
  // Separar operadores de caixa dos demais setores — a escala de caixa usa SÓ os de caixa
  const caixaEmployees = (state.employees || []).filter(isOperadorCaixa);
  summary.setoresResumo = groupBySetor(state.employees || []);
  // Resumo de vendas por mercadológico/setor (base para dimensionar escala por dados)
  const mercRows = Array.isArray(state.salesByMercadologico) ? state.salesByMercadologico : [];
  if (mercRows.length) {
    const porSetor = {};
    mercRows.forEach(r => {
      porSetor[r.setor] = porSetor[r.setor] || { setor: r.setor, vendaLiquida: 0, qtdItens: 0, dias: new Set() };
      porSetor[r.setor].vendaLiquida += r.vendaLiquida;
      porSetor[r.setor].qtdItens += r.qtdItens;
      porSetor[r.setor].dias.add(r.data);
    });
    summary.mercadologicoResumo = Object.values(porSetor)
      .map(s => ({ setor: s.setor, vendaLiquida: Math.round(s.vendaLiquida), qtdItens: Math.round(s.qtdItens), dias: s.dias.size, vendaMediaDia: Math.round(s.vendaLiquida / Math.max(1, s.dias.size)) }))
      .sort((a, b) => b.vendaLiquida - a.vendaLiquida);
  } else {
    summary.mercadologicoResumo = [];
  }
  // Dashboard inteligente por setor (cruza vendas com equipe)
  summary.setorDashboard = buildSetorDashboard(mercRows, state.employees || [], profile);
  // Setores sem equipe (para alertas do dashboard operacional)
  state._setoresSemEquipe = (summary.setorDashboard || []).filter(s => s.colaboradores === 0 && s.vendaDia > 0).map(s => s.setor);
  state._totalSetoresVenda = (summary.setorDashboard || []).filter(s => s.vendaDia > 0).length;
  // Dashboard executivo operacional (KPIs por dia/semana/mês)
  summary.operationalDashboard = buildOperationalDashboard(state, state.salesRows);
  // FASE 2: Forecast com sazonalidade
  summary.forecast = buildForecast(mercRows, state.salesRows);
  // Mercadológicos nível 2 disponíveis (para o campo Setor do cadastro)
  summary.mercadologicosM2 = mercRows.length
    ? [...new Set(mercRows.map(r => r.mercadologico))].sort()
    : [];
  summary.client = {
    profile: { ...profile, cnpj: '' },
    account: { name: user.name, email: user.email },
    employeesList: state.employees || [],
    caixaCount: caixaEmployees.length,
    onboarding: {
      profileComplete: Boolean(profile.empresa && profile.loja && profile.quantidadeOperadores),
      salesImported: state.salesRows.length > 0,
      employeesImported: state.employees.length > 0,
      employees: state.employees.length,
      salesRows: state.salesRows.length,
      salesDays: representedSalesDays(state.salesRows),
      operationalDayTypes: requiredDayKeys.length,
      operationalDayTypesImported: importedOperationalDayKeys.length,
      missingOperationalDayTypes: missingOperationalDayKeys,
      sundayClosed: sundayIsClosed(profile),
      partialSundayClosure: !sundayIsClosed(profile) && Number(profile.domingosFechadosMes || 0) > 0,
      updatedAt: state.updatedAt
    }
  };
  const maturityScore =
    (summary.client.onboarding.profileComplete ? 18 : 0) +
    (summary.client.onboarding.employeesImported ? 18 : 0) +
    (summary.client.onboarding.salesImported ? 18 : 0) +
    (importedOperationalDayKeys.length ? Math.round(importedOperationalDayKeys.length / requiredDayKeys.length * 22) : 0) +
    (summary.client.onboarding.salesDays >= 28 ? 14 : summary.client.onboarding.salesDays >= 7 ? 8 : 0) +
    (state.employees.some((employee) => Number(employee.salario || 0) > 0) ? 5 : 0) +
    (profile.regimeTributario ? 5 : 0);
  summary.client.maturity = {
    score: Math.min(100, maturityScore),
    stage: maturityScore >= 80 ? 'Pronto para operação assistida' : maturityScore >= 60 ? 'Diagnóstico operacional' : maturityScore >= 40 ? 'Base inicial' : 'Implantação',
    blockers: [
      !summary.client.onboarding.profileComplete ? 'Configurar dados da loja' : null,
      !summary.client.onboarding.employeesImported ? 'Importar equipe' : null,
      !summary.client.onboarding.salesImported ? 'Importar vendas por hora' : null,
      missingOperationalDayKeys.length ? `Importar tipos de dia abertos: ${missingOperationalDayKeys.map((key) => ({ monday: 'segunda', tuesday: 'terça', wednesday: 'quarta', thursday: 'quinta', friday: 'sexta', saturday: 'sábado', sunday: 'domingo' }[key] || key)).join(', ')}` : null,
      summary.client.onboarding.salesDays < 28 ? 'Ampliar histórico para pelo menos 4 semanas' : null
    ].filter(Boolean),
    strengths: [
      summary.client.onboarding.profileComplete ? 'Operação configurada' : null,
      summary.client.onboarding.employeesImported ? 'Equipe disponível para escala' : null,
      summary.client.onboarding.salesImported ? 'Movimento VRSoft importado' : null,
      sundayIsClosed(profile) ? 'Domingo fechado tratado como não aplicável' : null
    ].filter(Boolean)
  };
  summary.financial.assumptions.regimeTributario = profile.regimeTributario || summary.financial.assumptions.regimeTributario;
  // Capacidade de caixa conta APENAS operadores de caixa (não mistura açougue/admin/balcão)
  const operators = Number(caixaEmployees.length || profile.quantidadeOperadores || 4);
  summary.financial.assumptions.quantidadeOperadores = operators;
  summary.scenarios.forEach((scenario) => {
    scenario.operadores = operators;
    scenario.pdvs = Number(profile.quantidadePdvs || 3);
    scenario.capacidade = scenario.horasSemanais * operators;
  });
  const initialDemand = summary.scenarios[0].caixaNecessario;
  const initialFinalCapacity = operators * 40;
  summary.decisionMemory.recommendations[0].dados = [`${operators} operadoras`, `${initialDemand} caixas-hora semanais`, `${initialFinalCapacity}h de capacidade no cenário mais restritivo`];
  summary.decisionMemory.recommendations[0].resultado = `${initialFinalCapacity}h - ${initialDemand}h = ${initialFinalCapacity - initialDemand}h semanais disponíveis após atender o caixa`;
  summary.decisionMemory.recommendations[1].dados[0] = `${operators} operadoras`;
  summary.decisionMemory.recommendations[1].resultado = `${operators} x 4h = ${operators * 4}h/semana; aproximadamente ${Math.round(operators * 4 * 4.33)}h/mês de capacidade auxiliar perdida`;

  if (sundayIsClosed(profile)) {
    if (summary.dailyCoverage.sunday) {
      summary.dailyCoverage.sunday.rows.forEach((row) => {
        row.demanda = null;
        row.atual = 0;
        row.transicao = 0;
        row.final = 0;
      });
      summary.dailyCoverage.sunday.source = 'Domingo fechado na configuração da loja';
      summary.dailyCoverage.sunday.note = 'Sem exigência de venda, escala ou cobertura de caixa.';
      summary.dailyCoverage.sunday.confidence = 'não aplicável';
      summary.dailyCoverage.sunday.closed = true;
    }
    summary.staffSchedule.sunday = (state.employees.length ? state.employees : [{ nome: 'Lucila' }, { nome: 'Edvania' }, { nome: 'Samara' }, { nome: 'Jane' }])
      .slice(0, Math.max(4, state.employees.length || 4))
      .map((employee) => ({ nome: employee.nome, status: 'Folga', perfil: 'Loja fechada no domingo', inicio: null, fim: null, intervalo: null, horas: 0 }));
    summary.sundayRotation = [];
    summary.audit.forEach((person) => {
      person.domingosTrabalhados = 0;
      person.domingosFolga = 0;
    });
    summary.controllerActions = summary.controllerActions.map((action) => action.tipo === 'Bloqueio trabalhista antes da publicação'
      ? { ...action, diagnostico: 'Loja configurada como fechada aos domingos. A validação dominical deixa de ser bloqueio e passa a ser não aplicável.', recomendacao: 'Manter registro da configuração de domingo fechado e não exigir importação de vendas nem escala dominical.' }
      : action);
  }

  summary.storeConfig = {
    pdvs: Number(profile.quantidadePdvs || 3),
    operadores: operators
  };
  refreshCoverageLoads(summary, summary.storeConfig.pdvs);

  if (caixaEmployees.length >= 1) {
    const originals = ['Lucila', 'Edvania', 'Samara', 'Jane'];
    const employeeNames = caixaEmployees.map((employee) => employee.nome);
    const names = Object.fromEntries(originals.map((original, index) => [original, employeeNames[index] || original]));

    // Renomear escalas diárias
    Object.values(summary.staffSchedule).flat().forEach((person) => { person.nome = names[person.nome] || person.nome; });

    // Adicionar operadoras extras nas escalas diárias
    if (caixaEmployees.length > 4) {
      const extraEmployees = caixaEmployees.slice(4);
      Object.keys(summary.staffSchedule).forEach((dayKey) => {
        const existingSchedule = summary.staffSchedule[dayKey];
        extraEmployees.forEach((employee, idx) => {
          const template = existingSchedule[idx % existingSchedule.length];
          if (template) {
            summary.staffSchedule[dayKey].push({
              ...template,
              nome: employee.nome
            });
          }
        });
      });
    }

    // ATUALIZAR TODAS as abas com dados importados/configurados
    updateAllTabsWithImportedData(summary, profile, caixaEmployees, state.skillMatrix);

    // REGENERAR faixas horárias do dailyCoverage com base no horário da loja
    regenerateCoverageHours(summary, profile);

    // Peso de demanda por dia da semana (jornada variável: mais horas nos dias de pico)
    const pesosDia = pesosDiaSemanaDeVendas(state.salesRows, mercRows);
    summary.jornadaVariavel = pesosDia ? {
      ativa: true,
      pesos: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => ({ dia: d, peso: Number((pesosDia[i] || 1).toFixed(2)) }))
    } : { ativa: false };

    // GERAR ESCALAS DINÂMICAS baseadas no horário da loja
    Object.entries(summary.weeklyScenarioSchedule).forEach(([scenarioKey, scenario]) => {
      const targetHours = scenario.targetHours || 44;
      const targetDaysOff = scenario.targetDaysOff || 1;
      // Revezamento por grupo + jornada variável por demanda
      scenario.people = generateGroupedSchedule(profile, caixaEmployees, targetHours, targetDaysOff, pesosDia);
    });

    // ESCALA COMPLETA — todos os colaboradores, revezamento por grupo (setor + cargo)
    summary.employeeSetorMap = {};
    summary.employeeCargoMap = {};
    state.employees.forEach(e => {
      summary.employeeSetorMap[e.nome] = (e.setor || 'Sem setor').trim() || 'Sem setor';
      summary.employeeCargoMap[e.nome] = (e.cargo || 'Sem cargo').trim() || 'Sem cargo';
    });
    summary.fullSchedule = {};
    Object.entries(summary.weeklyScenarioSchedule).forEach(([key, sc]) => {
      summary.fullSchedule[key] = {
        label: sc.label,
        targetHours: sc.targetHours,
        targetDaysOff: sc.targetDaysOff,
        people: generateGroupedSchedule(profile, state.employees, sc.targetHours || 44, sc.targetDaysOff || 1, pesosDia)
      };
    });
    // FASE 1: Compliance CLT — violações por cenário
    summary.complianceCLT = {};
    Object.entries(summary.fullSchedule).forEach(([key, sc]) => {
      summary.complianceCLT[key] = checkComplianceCLT(sc.people);
    });
    // FASE 2: Banco de horas
    summary.bancoHoras = buildBancoHoras(summary.fullSchedule, state.employees);
    // FASE 1: Período de escala fechado (vigente) + histórico
    summary.escalaFechada = state.escalaFechada || null;
    if (summary.escalaFechada && (!summary.escalaFechada.caixaPeople || !Object.keys(summary.escalaFechada.caixaPeople).length)) {
      const people = summary.escalaFechada.people || {};
      summary.escalaFechada.caixaPeople = Object.fromEntries(
        Object.entries(people).filter(([nome]) => isOperadorCaixaSnapshot(nome, summary.escalaFechada))
      );
    }
    summary.escalaHistorico = (state.escalaHistorico || []).map(h => ({
      label: h.label, dataInicio: h.dataInicio, dataFim: h.dataFim,
      cenarioLabel: h.cenarioLabel, fechadoEm: h.fechadoEm, fechadoPor: h.fechadoPor
    }));

    summary.sundayRotation.forEach((item) => {
      item.folga = item.folga.map((name) => names[name] || name);
      item.trabalhando = item.trabalhando.map((name) => names[name] || name);
    });
    summary.audit.forEach((person) => { person.nome = names[person.nome] || person.nome; });
    summary.resilience.people.forEach((person) => { person.nome = names[person.nome] || person.nome; });
    const salaries = state.employees.map((employee) => Number(employee.salario || 0)).filter(Boolean);
    if (salaries.length) summary.financial.assumptions.salarioBaseMensal = salaries.reduce((sum, value) => sum + value, 0) / salaries.length;
  }

  if (!state.salesRows.length) {
    summary.metadata.periodoAmostra = `${summary.metadata.periodoAmostra} (demonstração)`;
    if (caixaEmployees.length >= 1) {
      recalculateCoverageFromSchedules(summary, Number(profile.quantidadePdvs || 3));
      refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    }
    return summary;
  }
  const grouped = {};
  state.salesRows.forEach((row) => {
    const dayKey = dayKeys[new Date(`${row.data}T12:00:00`).getDay()];
    if (dayKey === 'sunday' && sundayIsClosed(profile)) return;
    const hour = `${row.horaInicio.slice(0, 2)}-${row.horaFim.slice(0, 2)}`;
    grouped[dayKey] ||= {};
    grouped[dayKey][hour] ||= [];
    grouped[dayKey][hour].push({
      demanda: demandFromCoupons(row.cupons),
      cupons: Number(row.cupons || 0),
      vendaLiquida: Number(row.vendaLiquida || 0),
      qtdeVendida: Number(row.qtdeVendida || 0),
      qtdItens: Number(row.qtdItens || 0),
      itensMedios: Number(row.itensMedios || 0),
      minutosAtendimento: Number(row.minutosAtendimento || 0)
    });
  });
  Object.entries(grouped).forEach(([dayKey, hours]) => {
    if (!summary.dailyCoverage[dayKey]) return;
    summary.dailyCoverage[dayKey].rows.forEach((row) => {
      if (hours[row.hora]) {
        const values = hours[row.hora];
        row.demanda = Math.ceil(values.reduce((sum, value) => sum + value.demanda, 0) / values.length);
        row.cupons = Math.round(values.reduce((sum, value) => sum + value.cupons, 0) / values.length);
        row.vendaLiquida = Number((values.reduce((sum, value) => sum + value.vendaLiquida, 0) / values.length).toFixed(2));
        const totalQuantity = values.reduce((sum, value) => sum + value.qtdeVendida, 0);
        const totalCoupons = values.reduce((sum, value) => sum + value.cupons, 0);
        const totalItems = values.reduce((sum, value) => sum + value.qtdItens, 0);
        const weightedAvgItems = totalCoupons && totalItems ? totalItems / totalCoupons : totalCoupons ? totalQuantity / totalCoupons : values.reduce((sum, value) => sum + value.itensMedios, 0) / values.length;
        if (weightedAvgItems) row.itensMedios = Number(weightedAvgItems.toFixed(2));
        row.minutosAtendimento = Number((values.reduce((sum, value) => sum + value.minutosAtendimento, 0) / values.length).toFixed(2));
      }
    });
    summary.dailyCoverage[dayKey].source = `Importação guiada · ${Object.values(hours).reduce((sum, rows) => sum + rows.length, 0)} faixas`;
  });
  // RECALCULAR caixas ativos depois da demanda ter sido aplicada
  if (caixaEmployees.length >= 1) {
    recalculateCoverageFromSchedules(summary, Number(profile.quantidadePdvs || 3));
  }

  // APLICAR otimização salva (se houver)
  if (state.optimizedCoverage) {
    summary.optimizationSavedAt = state.optimizedCoverage.savedAt;
    // 1. Redistribuir intervalos na escala de caixa para bater com a cobertura otimizada
    applyOptimizationToSchedule(summary, state.optimizedCoverage);
    // 2. Recalcular cobertura a partir dos turnos agora otimizados
    if (caixaEmployees.length >= 1) {
      recalculateCoverageFromSchedules(summary, Number(profile.quantidadePdvs || 3));
    }
    // 3. Aplicar os targets finais da otimização salva
    ['atual', 'transicao', 'final'].forEach(scenario => {
      const dayMap = state.optimizedCoverage[scenario];
      if (!dayMap) return;
      Object.entries(dayMap).forEach(([dayKey, optimizedRows]) => {
        if (!summary.dailyCoverage[dayKey] || !Array.isArray(optimizedRows)) return;
        summary.dailyCoverage[dayKey].rows.forEach((row) => {
          const opt = optimizedRows.find(o => o.hora === row.hora);
          if (opt) {
            row[scenario] = opt.atual;
            row.ajusteAutomatico = opt.ajusteAutomatico;
            row[`${scenario}AjusteAutomatico`] = opt.ajusteAutomatico;
          }
        });
      });
    });
  }

  refreshCoverageLoads(summary, summary.storeConfig.pdvs);
  const dates = [...new Set(state.salesRows.map((row) => row.data))].sort();
  const representedDays = representedSalesDays(state.salesRows);
  const weeklyDemand = Object.values(summary.dailyCoverage).flatMap((day) => day.rows).reduce((sum, row) => sum + Number(row.demanda || 0), 0);
  summary.scenarios.forEach((scenario) => {
    scenario.caixaNecessario = weeklyDemand;
  });
  summary.monthlyWeekAnalysis = buildMonthlyWeekAnalysis(summary, state.salesRows);
  // ANÁLISE DE ECONOMIA: operação real vs otimizada
  summary.optimizationSavings = buildOptimizationSavings(state.salesRows, profile, state.employees, summary);
  const finalCapacity = operators * 40;
  const finalSurplus = finalCapacity - weeklyDemand;
  summary.decisionMemory.recommendations[0].dados = [`${operators} operadoras`, `${weeklyDemand} caixas-hora semanais`, `${finalCapacity}h de capacidade no cenário mais restritivo`];
  summary.decisionMemory.recommendations[0].resultado = `${finalCapacity}h - ${weeklyDemand}h = ${finalSurplus}h semanais disponíveis após atender o caixa`;
  summary.decisionMemory.recommendations[1].dados[0] = `${operators} operadoras`;
  summary.decisionMemory.recommendations[1].resultado = `${operators} x 4h = ${operators * 4}h/semana; aproximadamente ${Math.round(operators * 4 * 4.33)}h/mês de capacidade auxiliar perdida`;
  summary.metadata.diasComVenda = representedDays;
  summary.metadata.confianca = Math.min(95, Math.round(35 + representedDays * 4.7));
  summary.metadata.periodoAmostra = representedDays > dates.length
    ? `${dateLabel(dates[0])} · ${representedDays} dias agregados`
    : `${dateLabel(dates[0])} a ${dateLabel(dates[dates.length - 1])}`;
  summary.metadata.ultimaImportacao = state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR') : summary.metadata.ultimaImportacao;
  return summary;
}

function summaryForWeek(baseSummary, weekNumber) {
  const week = CENARIOS_SEMANAS[weekNumber];
  if (!week) return baseSummary;

  const summary = JSON.parse(JSON.stringify(baseSummary));
  summary.metadata.semanaAtiva = weekNumber;
  summary.metadata.semanaLabel = week.nome;
  summary.metadata.demandaMediaSemana = week.demanda_media;

  // Aplicar dados reais da semana ao sábado
  if (summary.dailyCoverage && summary.dailyCoverage.saturday) {
    let totalMinutosNecessarios = 0;

    summary.dailyCoverage.saturday.rows.forEach((row) => {
      const hora = row.hora.split('-')[0];
      const chaveHora = `${String(hora).padStart(2, '0')}:00`;
      const clientesSemana = week.clientes_por_hora[chaveHora] || 0;

      if (clientesSemana > 0) {
        // Usar clientes reais como "demanda" para cálculo
        row.cargaCaixa = cashierLoadForHour(
          row.hora,
          clientesSemana,
          3,
          'saturday',
          summary.storeConfig?.pdvs || 3,
          clientesSemana,
          week.itens_cupom,
          null
        );

        if (row.cargaCaixa) {
          row.demanda = clientesSemana;
          totalMinutosNecessarios += row.cargaCaixa.minutosNecessarios || 0;
        }
      } else {
        row.demanda = 0;
        row.cargaCaixa = null;
      }
    });

    // Atualizar capacidade semanal
    if (summary.scenarios) {
      const caixasNecessarias = Math.ceil(totalMinutosNecessarios / 60);
      summary.scenarios.forEach((scenario) => {
        scenario.caixaNecessario = caixasNecessarias;
      });
    }
  }

  return summary;
}

async function summaryFromDatabase(user = null, weekFilter = null) {
  const connection = await db.status();
  if (!connection.connected) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', ...connection } }));
    if (user) return applyClientState(summary, user, weekFilter);
    applySalesRowsToSummary(summary, loadModelSalesRows(), 'Empresa modelo VRSoft');
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    return summary;
  }

  try {
    const [demandRows, scenarios] = await Promise.all([db.loadDemandRows(), db.loadScenarios()]);
    const summary = JSON.parse(JSON.stringify(data));
    summary.dataSource = { mode: 'postgresql', ...connection };

    if (demandRows.length) {
      const dates = [...new Set(demandRows.map((row) => row.data_referencia))].sort();
      const grouped = {};
      demandRows.filter((row) => !row.fora_horario_operacional).forEach((row) => {
        const dayKey = dayKeys[new Date(`${row.data_referencia}T12:00:00`).getDay()];
        const hour = `${row.hora_inicio.slice(0, 2)}-${row.hora_fim.slice(0, 2)}`;
        grouped[dayKey] ||= {};
        grouped[dayKey][hour] ||= [];
        grouped[dayKey][hour].push(Number(row.caixas_necessarios));
      });

      Object.entries(grouped).forEach(([dayKey, hours]) => {
        summary.dailyCoverage[dayKey].rows.forEach((row) => {
          if (hours[row.hora]) {
            row.demanda = Math.ceil(hours[row.hora].reduce((sum, value) => sum + value, 0) / hours[row.hora].length);
          }
        });
        summary.dailyCoverage[dayKey].source = `PostgreSQL · ${Object.values(hours)[0].length} semana(s) de referência`;
        summary.dailyCoverage[dayKey].confidence = dates.length >= 28 ? 'alta' : dates.length >= 7 ? 'média' : 'baixa';
      });

      const weeklyDemand = Object.values(summary.dailyCoverage)
        .flatMap((day) => day.rows)
        .reduce((sum, row) => sum + Number(row.demanda || 0), 0);
      summary.scenarios.forEach((scenario) => { scenario.caixaNecessario = weeklyDemand; });
      summary.metadata.diasComVenda = dates.length;
      summary.metadata.confianca = Math.min(95, Math.round(35 + dates.length * 4.7));
      summary.metadata.periodoAmostra = `${dateLabel(dates[0])} a ${dateLabel(dates[dates.length - 1])}`;
      summary.metadata.ultimaImportacao = new Date().toLocaleString('pt-BR');
    }

    if (scenarios.length) {
      const demand = summary.scenarios[0].caixaNecessario;
      summary.scenarios = scenarios.slice(0, 3).map((scenario) => ({
        cenario: scenario.nome,
        tipo: scenario.tipo_escala,
        horasSemanais: Number(scenario.horas_semanais),
        operadores: 4,
        pdvs: 3,
        capacidade: Number(scenario.horas_semanais) * 4,
        caixaNecessario: demand
      }));
    }
    if (user) return applyClientState(summary, user, weekFilter);
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    return summary;
  } catch (error) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', connected: true, database: connection.database, error: error.message } }));
    if (user) return applyClientState(summary, user, weekFilter);
    applySalesRowsToSummary(summary, loadModelSalesRows(), 'Empresa modelo VRSoft');
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    return summary;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    requireSameOrigin(req);
  } catch (error) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: false, error: error.message }));
  }
  const user = await authenticatedUser(req);
  if (req.url === '/api/summary') {
    try {
      const summary = await summaryFromDatabase(user);
      return json(res, summary);
    } catch (error) {
      console.error('ERROR in /api/summary:', error.message, error.stack);
      return json(res, { error: error.message, stack: error.stack }, 500);
    }
  }
  if (req.url.match(/^\/api\/summary\/week\/\d+$/)) {
    const weekNumber = Number(req.url.split('/').pop());
    if (weekNumber >= 1 && weekNumber <= 5) {
      try {
        // Filtra os dados REAIS do cliente pela semana do mês e recalcula tudo
        const summary = await summaryFromDatabase(user, weekNumber);
        return json(res, summary);
      } catch (error) {
        console.error('ERROR in /api/summary/week:', error.message);
        return json(res, { error: error.message }, 500);
      }
    }
    return json(res, { error: 'Semana inválida. Use 1-5.' });
  }
  if (req.url === '/api/db-status') return json(res, await db.status());
  if (req.url === '/api/persistence-status') return json(res, await db.appPersistenceStatus());
  if (req.url === '/api/auth/status') return json(res, { authenticated: Boolean(user), user: user ? { name: user.name, email: user.email, orgCode: user.orgCode, role: user.role } : null });
  const supportSummaryMatch = req.url.match(/^\/api\/support\/summary\/([A-Z0-9-]+)$/i);
  if (supportSummaryMatch) {
    try {
      if (!canUseSupportOrgLookup(req, user)) {
        return json(res, { ok: false, error: 'Acesso restrito ao suporte local ou gestor autenticado.' }, 403);
      }
      const orgCode = sanitizeString(String(decodeURIComponent(supportSummaryMatch[1]) || '').trim()).toUpperCase();
      if (!orgCode) return json(res, { ok: false, error: 'Informe o código da empresa.' }, 400);
      const orgOwner = await dbSupabase.getUserByOrgCode(orgCode);
      if (!orgOwner) return json(res, { ok: false, error: 'Código de empresa não encontrado.' }, 404);
      const summary = await summaryFromDatabase(orgOwner);
      return json(res, {
        ok: true,
        orgCode,
        company: (summary.client && summary.client.profile && summary.client.profile.empresa) || '',
        account: (summary.client && summary.client.account) || null,
        summary
      });
    } catch (error) {
      return json(res, { ok: false, error: error.message }, 400);
    }
  }
  if (req.url === '/api/company/info') {
    if (!user) return json(res, { ok: false, error: 'Faça login.' }, 401);
    const members = await dbSupabase.listOrgMembers(user.orgId);
    return json(res, { ok: true, orgCode: user.orgCode, role: user.role, members });
  }
  // FASE 4: What-if — simula impacto de mudança de equipe/faturamento
  if (req.url === '/api/whatif' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        const body = await readJsonBody(req, 10_000);
        const summary = await summaryFromDatabase(user);
        const ops = summary.operationalDashboard || {};
        const fatMesBase = ops.faturamento ? ops.faturamento.mes : 0;
        const equipeBase = ops.headcount ? ops.headcount.atual : 0;
        const custoColab = Number(body.custoColaborador || 2700); // custo total/colab/mês

        // Cenário simulado
        const deltaEquipe = Number(body.deltaEquipe || 0);   // +/- colaboradores
        const deltaFatPct = Number(body.deltaFatPct || 0);   // % variação faturamento
        const equipeSim = Math.max(0, equipeBase + deltaEquipe);
        const fatMesSim = Math.round(fatMesBase * (1 + deltaFatPct / 100));
        const idealSim = Math.round(fatMesSim / 36500);
        const custoFolhaSim = equipeSim * custoColab;
        const custoFolhaBase = equipeBase * custoColab;
        // Ruptura estimada conforme gap equipe vs ideal
        const gapSim = idealSim ? (idealSim - equipeSim) / idealSim : 0;
        const rupturaSim = Math.max(2, Math.min(15, 5 + gapSim * 12));
        const perdaRupturaSim = Math.round(fatMesSim * (rupturaSim / 100));

        return json(res, {
          ok: true,
          base: { equipe: equipeBase, fatMes: fatMesBase, custoFolha: custoFolhaBase, ideal: ops.headcount ? ops.headcount.ideal : 0 },
          simulado: {
            equipe: equipeSim, fatMes: fatMesSim, ideal: idealSim,
            custoFolha: custoFolhaSim,
            deltaCusto: custoFolhaSim - custoFolhaBase,
            rupturaEstimada: Number(rupturaSim.toFixed(1)),
            perdaRuptura: perdaRupturaSim,
            cobertura: idealSim ? Math.round((equipeSim / idealSim) * 100) : 100
          }
        });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  // FASE 3: Self-service — colaborador consulta a própria escala (público, por código + nome)
  if (req.url === '/api/colaborador/escala' && req.method === 'POST') {
    (async () => {
      try {
        enforceRateLimit(req, 'colab', 30, 60 * 60 * 1000);
        const body = await readJsonBody(req, 10_000);
        const orgCode = sanitizeString(String(body.orgCode || '').trim()).toUpperCase();
        const nome = sanitizeString(String(body.nome || '').trim());
        if (!orgCode || !nome) throw new Error('Informe o código da empresa e seu nome.');
        const orgOwner = await dbSupabase.getUserByOrgCode(orgCode);
        if (!orgOwner) throw new Error('Código de empresa inválido.');
        const summary = await summaryFromDatabase(orgOwner);
        const full = summary.fullSchedule && (summary.fullSchedule.atual || Object.values(summary.fullSchedule)[0]);
        if (!full) throw new Error('Escala ainda não disponível.');
        // Busca o colaborador (case-insensitive, contém)
        const nomeNorm = nome.toLowerCase();
        const match = Object.keys(full.people).find(n => n.toLowerCase() === nomeNorm)
          || Object.keys(full.people).find(n => n.toLowerCase().includes(nomeNorm));
        if (!match) throw new Error('Nome não encontrado na escala. Confira com seu gestor.');
        return json(res, {
          ok: true,
          nome: match,
          setor: (summary.employeeSetorMap || {})[match] || '',
          cargo: (summary.employeeCargoMap || {})[match] || '',
          escala: full.people[match],
          label: full.label,
          empresa: (summary.client && summary.client.profile && summary.client.profile.empresa) || ''
        });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/company/add-member' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        if (user.role !== 'admin') throw new Error('Apenas o administrador pode adicionar usuários.');
        const body = await readJsonBody(req, 50_000);
        const email = String(body.email || '').trim().toLowerCase();
        const name = sanitizeString(String(body.name || '').trim());
        const password = String(body.password || '');

        if (!validateEmail(email)) throw new Error('E-mail inválido.');
        if (!validateName(name)) throw new Error('Nome inválido (2-100 caracteres).');
        if (!validatePassword(password)) throw new Error('Senha deve ter pelo menos 8 caracteres.');

        const existingUser = await dbSupabase.getUser(email);
        if (existingUser) throw new Error('Este e-mail já está cadastrado.');

        const secured = await hashPassword(password);
        const newMember = {
          id: crypto.randomUUID(),
          name,
          email,
          passwordSalt: secured.salt,
          passwordHash: secured.hash,
          inviteCode: PILOT_INVITE_CODE,
          orgId: user.orgId,        // mesma empresa do admin
          orgCode: user.orgCode,
          role: 'membro'
        };

        const created = await dbSupabase.createUser(newMember);
        if (!created) throw new Error('Erro ao criar usuário. Tente novamente.');

        await audit(user.id, 'MEMBER_CREATED', { newMemberEmail: email, orgCode: user.orgCode, ip: requestIp(req) });
        const members = await dbSupabase.listOrgMembers(user.orgId);
        return json(res, { ok: true, members });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/account/activity') {
    if (!user) {
      return json(res, { ok: false, error: 'Faça login para visualizar atividades.' }, 401);
    }
    return json(res, { ok: true, activities: loadAudit(user.id).slice(0, 20), backups: fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((file) => file.startsWith(user.id)).length : 0, persistence: await db.appPersistenceStatus() });
  }
  if (req.url === '/api/account/export') {
    if (!user) {
      return json(res, { ok: false, error: 'Faça login para exportar seus dados.' }, 401);
    }
    audit(user.id, 'Dados exportados');
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email, createdAt: user.createdAt },
      state: loadClientState(user.orgId),
      activities: loadAudit(user.id)
    };
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="workforce-os-backup-${user.id}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(JSON.stringify(payload, null, 2));
  }
  if (req.url === '/api/account/change-password' && req.method === 'POST') {
    try {
      if (!user) throw new Error('Faça login para alterar sua senha.');
      enforceRateLimit(req, 'change-password', 5);
      const body = await readJsonBody(req, 50_000);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (!(await verifyPassword(currentPassword, user))) throw new Error('Senha atual incorreta.');
      if (newPassword.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
      if (currentPassword === newPassword) throw new Error('A nova senha deve ser diferente da senha atual.');
      const secured = await hashPassword(newPassword);
      const users = loadUsers();
      const target = users.find((item) => item.id === user.id);
      target.passwordSalt = secured.salt;
      target.passwordHash = secured.hash;
      target.passwordChangedAt = new Date().toISOString();
      saveUsers(users);
      [...sessions.entries()].filter(([, session]) => session.userId === user.id).forEach(([key]) => sessions.delete(key));
      createSession(res, req, user.id);
      await audit(user.id, 'PASSWORD_CHANGED', { ip: requestIp(req) });
      return json(res, { ok: true });
    } catch (error) {
      return json(res, { ok: false, error: error.message }, 400);
    }
  }
  if (req.url === '/api/auth/register' && req.method === 'POST') {
    (async () => {
      try {
        enforceRateLimit(req, 'register', 20, 60 * 60 * 1000);  // Relaxed for testing
        const body = await readJsonBody(req, 50_000);
        const email = String(body.email || '').trim().toLowerCase();
        const name = sanitizeString(String(body.name || '').trim());
        const password = String(body.password || '');
        const inviteCode = sanitizeString(String(body.inviteCode || '').trim());
        const companyCode = sanitizeString(String(body.companyCode || '').trim()).toUpperCase();

        if (!validateEmail(email)) throw new Error('Dados inválidos. Verifique e tente novamente.');
        if (!validateName(name)) throw new Error('Dados inválidos. Verifique e tente novamente.');
        if (!validatePassword(password)) throw new Error('Dados inválidos. Verifique e tente novamente.');
        if (inviteCode !== PILOT_INVITE_CODE) {
          await audit(null, 'INVALID_INVITE_CODE', { email, ip: requestIp(req) });
          throw new Error('Dados inválidos. Verifique e tente novamente.');
        }

        const existingUser = await dbSupabase.getUser(email);
        if (existingUser) {
          await audit(null, 'DUPLICATE_REGISTRATION_ATTEMPT', { email, ip: requestIp(req) });
          throw new Error('Este e-mail já possui uma conta.');
        }

        const userId = crypto.randomUUID();
        let orgId, orgCode, role, joinedExisting = false;

        if (companyCode) {
          // Entrar em empresa existente
          const orgOwner = await dbSupabase.getUserByOrgCode(companyCode);
          if (!orgOwner) throw new Error('Código de empresa inválido. Verifique com o administrador.');
          orgId = orgOwner.orgId;
          orgCode = companyCode;
          role = 'membro';
          joinedExisting = true;
        } else {
          // Criar nova empresa
          orgId = userId;
          orgCode = 'EMP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
          role = 'admin';
        }

        const secured = await hashPassword(password);
        const newUser = { id: userId, name, email, passwordSalt: secured.salt, passwordHash: secured.hash, inviteCode: PILOT_INVITE_CODE, orgId, orgCode, role };

        const userCreated = await dbSupabase.createUser(newUser);
        if (!userCreated) throw new Error('Erro ao criar usuário. Tente novamente.');

        // Só cria estado novo se for empresa nova (membro herda o existente)
        if (!joinedExisting) {
          const stateCreated = await saveClientState(orgId, defaultClientState());
          if (!stateCreated) throw new Error('Erro ao configurar perfil. Tente novamente.');
        }

        await createSession(res, req, newUser.id);
        await audit(newUser.id, joinedExisting ? 'MEMBER_JOINED_ORG' : 'ACCOUNT_CREATED', { email, orgCode, role, ip: requestIp(req) });
        return json(res, { ok: true, user: { name, email }, orgCode, role });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    (async () => {
      try {
        enforceRateLimit(req, 'login', 20, 60 * 60 * 1000);  // Relaxed for testing
        const body = await readJsonBody(req, 50_000);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!validateEmail(email) || !validatePassword(password)) {
          throw new Error('E-mail ou senha inválidos.');
        }

        const userMatch = await dbSupabase.getUser(email);
        if (!userMatch || !(await verifyPassword(password, userMatch))) {
          await audit(null, 'FAILED_LOGIN_ATTEMPT', { email, ip: requestIp(req) });
          throw new Error('E-mail ou senha inválidos.');
        }

        await createSession(res, req, userMatch.id);
        await audit(userMatch.id, 'LOGIN_SUCCESS', { ip: requestIp(req) });
        return json(res, { ok: true, user: { name: userMatch.name, email: userMatch.email } });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 401);
      }
    })();
    return;
  }
  if (req.url === '/api/cenarios' && req.method === 'GET') {
    return json(res, { ok: true, cenarios: CENARIOS_SEMANAS });
  }
  if (req.url === '/api/auth/logout' && req.method === 'POST') {
    (async () => {
      if (user) await audit(user.id, 'Logout realizado');
      await clearSession(res, req);
      return json(res, { ok: true });
    })();
    return;
  }
  if (req.url === '/api/save-skills' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para salvar competências.');
        const body = await readJsonBody(req);
        const people = Array.isArray(body.people) ? body.people : [];
        if (!people.length) throw new Error('Nenhuma competência para salvar.');

        const state = await loadClientState(user.orgId);
        state.skillMatrix = people.map(p => ({
          nome: sanitizeString(String(p.nome || '')).slice(0, 100),
          skills: p.skills || {},
          validado: Boolean(p.validado)
        }));
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'SKILLS_SAVED', { count: people.length, ip: requestIp(req) });
        return json(res, { ok: true });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  // FASE 1: FECHAR PERÍODO DA ESCALA (congela snapshot imutável)
  if (req.url === '/api/escala/fechar' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        if (user.role !== 'admin' && user.role !== 'gestor' && user.orgId !== user.id) throw new Error('Apenas o administrador pode fechar o período.');
        const body = await readJsonBody(req);
        const cenario = ['atual', 'transicao', 'final'].includes(body.cenario) ? body.cenario : 'atual';
        const dataInicio = String(body.dataInicio || '').slice(0, 10);
        const dataFim = String(body.dataFim || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
          throw new Error('Informe o período (data início e fim).');
        }
        // Gera a escala atual e captura o snapshot do cenário escolhido
        const summary = await summaryFromDatabase(user);
        const full = summary.fullSchedule && summary.fullSchedule[cenario];
        const caixa = summary.weeklyScenarioSchedule && summary.weeklyScenarioSchedule[cenario];
        if (!full || !Object.keys(full.people || {}).length) throw new Error('Não há escala para fechar. Cadastre a equipe primeiro.');

        const snapshot = {
          id: `${user.orgId}-${dataInicio}`,
          label: `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`,
          dataInicio, dataFim, cenario,
          cenarioLabel: full.label,
          fechadoEm: new Date().toISOString(),
          fechadoPor: user.email,
          people: full.people,
          caixaPeople: caixa?.people || {},
          setorMap: summary.employeeSetorMap || {},
          cargoMap: summary.employeeCargoMap || {},
          compliance: (summary.complianceCLT && summary.complianceCLT[cenario]) || []
        };

        const state = await loadClientState(user.orgId);
        // Move a vigente anterior (se houver) para o histórico
        if (state.escalaFechada) {
          state.escalaHistorico = [state.escalaFechada, ...(state.escalaHistorico || [])].slice(0, 12);
        }
        state.escalaFechada = snapshot;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'ESCALA_FECHADA', { periodo: snapshot.label, cenario, ip: requestIp(req) });
        return json(res, { ok: true, escalaFechada: snapshot });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  // FASE 1: REABRIR PERÍODO (volta ao rascunho dinâmico)
  if (req.url === '/api/escala/reabrir' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        if (user.role !== 'admin' && user.role !== 'gestor' && user.orgId !== user.id) throw new Error('Apenas o administrador pode reabrir o período.');
        const state = await loadClientState(user.orgId);
        if (state.escalaFechada) {
          state.escalaHistorico = [state.escalaFechada, ...(state.escalaHistorico || [])].slice(0, 12);
          state.escalaFechada = null;
          state.updatedAt = new Date().toISOString();
          await saveClientState(user.orgId, state);
          await audit(user.id, 'ESCALA_REABERTA', { ip: requestIp(req) });
        }
        return json(res, { ok: true });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/save-optimization' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para salvar otimização.');
        const body = await readJsonBody(req);
        const scenario = String(body.scenario || 'atual');
        const optimizedCoverage = body.optimizedCoverage || {};

        if (!['atual', 'transicao', 'final'].includes(scenario)) {
          throw new Error('Cenário inválido.');
        }

        const state = await loadClientState(user.orgId);
        state.optimizedCoverage = state.optimizedCoverage || {};
        state.optimizedCoverage[scenario] = optimizedCoverage;
        state.optimizedCoverage.savedAt = new Date().toISOString();
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'OPTIMIZATION_SAVED', { scenario, ip: requestIp(req) });
        return json(res, { ok: true, savedAt: state.optimizedCoverage.savedAt });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/gestor/orgs') {
    if (!user || user.role !== 'gestor') return json(res, { ok: false, error: 'Acesso restrito ao gestor.' }, 403);
    const admins = await dbSupabase.listAllOrgAdmins();
    const orgs = [];
    for (const adm of admins) {
      const st = await dbSupabase.getClientData(adm.orgId);
      orgs.push({
        orgId: adm.orgId,
        orgCode: adm.orgCode,
        adminEmail: adm.adminEmail,
        empresa: (st && st.profile && st.profile.empresa) || '(sem nome)',
        loja: (st && st.profile && st.profile.loja) || '',
        enabledModules: (st && Array.isArray(st.enabledModules)) ? st.enabledModules : [1,2,3,4,5,6,7,8,9,10]
      });
    }
    return json(res, { ok: true, modules: MODULE_CATALOG, orgs });
  }
  if (req.url === '/api/gestor/set-modules' && req.method === 'POST') {
    (async () => {
      try {
        if (!user || user.role !== 'gestor') throw new Error('Acesso restrito ao gestor.');
        const body = await readJsonBody(req);
        const targetOrgId = String(body.orgId || '');
        const modules = Array.isArray(body.modules) ? body.modules.map(Number).filter(n => n >= 1 && n <= 10) : [];
        if (!targetOrgId) throw new Error('Empresa não informada.');

        const st = await dbSupabase.getClientData(targetOrgId) || defaultClientState();
        st.enabledModules = modules.length ? modules : [1];
        st.updatedAt = new Date().toISOString();
        await dbSupabase.saveClientData(targetOrgId, st);
        await audit(user.id, 'GESTOR_SET_MODULES', { targetOrgId, modules });
        return json(res, { ok: true, enabledModules: st.enabledModules });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/onboarding' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para configurar sua loja.');
        const body = await readJsonBody(req);

        // Validar dados de entrada
        if (body.profile) {
          if (body.profile.empresa) body.profile.empresa = sanitizeString(body.profile.empresa).slice(0, 100);
          if (body.profile.loja) body.profile.loja = sanitizeString(body.profile.loja).slice(0, 100);
          if (body.profile.cnpj) body.profile.cnpj = String(body.profile.cnpj).slice(0, 20);
        }

        const state = await loadClientState(user.orgId);
        state.profile = { ...state.profile, ...body.profile };
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'CONFIG_UPDATED', { empresa: state.profile.empresa, loja: state.profile.loja });
        return json(res, { ok: true, state });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/employees/save' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para gerenciar a equipe.');
        const body = await readJsonBody(req);
        const list = Array.isArray(body.employees) ? body.employees.slice(0, 500) : [];

        const turnosValidos = ['abertura', 'intermediario', 'fechamento', 'flexivel'];
        const diasValidos = ['', 'segunda', 'terca', 'quarta', 'quinta', 'domingo'];
        const employees = list.map((row) => {
          const mercadologicos = Array.isArray(row.mercadologicos)
            ? row.mercadologicos.map(m => sanitizeString(String(m)).slice(0, 80)).filter(Boolean).slice(0, 30)
            : [];
          // Setor operacional predominante (derivado dos mercadológicos marcados)
          let setor = sanitizeString(String(row.setor || 'Caixa')).slice(0, 60);
          if (mercadologicos.length) {
            const setoresOp = mercadologicos.map(mercadologicoParaSetor);
            // setor mais frequente
            const freq = {};
            setoresOp.forEach(s => { freq[s] = (freq[s] || 0) + 1; });
            setor = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          }
          return {
            nome: sanitizeString(String(row.nome || '')).slice(0, 100),
            sexo: ['masculino', 'feminino'].includes(String(row.sexo || '').toLowerCase()) ? String(row.sexo).toLowerCase() : 'feminino',
            cargo: sanitizeString(String(row.cargo || 'Operador de Caixa')).slice(0, 60),
            setor,
            mercadologicos,
            horasSemanais: Math.min(168, Math.max(1, Number(row.horasSemanais) || 44)),
            salario: Math.max(0, Number(row.salario) || 0),
            turno: turnosValidos.includes(String(row.turno || '').toLowerCase()) ? String(row.turno).toLowerCase() : 'flexivel',
            podeDomingo: row.podeDomingo === false ? false : true,
            folgaPreferencial: diasValidos.includes(String(row.folgaPreferencial || '').toLowerCase()) ? String(row.folgaPreferencial).toLowerCase() : ''
          };
        }).filter((e) => e.nome.length >= 2);

        const state = await loadClientState(user.orgId);
        state.employees = employees;
        state.profile.quantidadeOperadores = employees.length;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'EMPLOYEES_MANAGED', { total: employees.length, ip: requestIp(req) });
        return json(res, { ok: true, total: employees.length });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/import-mercadologico' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar vendas por mercadológico.');
        const body = await readJsonBody(req, 5_000_000);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 50000) : [];

        const validRows = rows.filter((row) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.data || ''))) return false;
          if (!String(row.mercadologico || '').trim()) return false;
          return Number(row.vendaLiquida) >= 0;
        }).map((row) => ({
          data: row.data,
          grupoM1: sanitizeString(String(row.grupoM1 || '')).slice(0, 60),
          mercadologico: sanitizeString(String(row.mercadologico)).slice(0, 80),
          setor: mercadologicoParaSetor(row.mercadologico),
          vendaLiquida: Number(row.vendaLiquida) || 0,
          qtdItens: Number(row.qtdItens) || 0,
          qtdeVendida: Number(row.qtdeVendida) || 0,
          cupons: Number(row.cupons) || 0
        }));

        if (!validRows.length) throw new Error('Nenhuma linha válida. Use as colunas: data, mercadologico, venda_liquida.');

        const state = await loadClientState(user.orgId);
        state.salesByMercadologico = validRows;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);

        const setores = [...new Set(validRows.map(r => r.setor))];
        const dias = [...new Set(validRows.map(r => r.data))];
        await audit(user.id, 'MERCADOLOGICO_IMPORTED', { linhas: validRows.length, setores: setores.length, dias: dias.length, ip: requestIp(req) });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, setores, dias: dias.length });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/import-sales' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar vendas.');
        const body = await readJsonBody(req);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 10000) : [];

        const validRows = rows.filter((row) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data)) return false;
          if (!/^\d{2}:\d{2}$/.test(row.horaInicio)) return false;
          if (!/^\d{2}:\d{2}$/.test(row.horaFim)) return false;
          if (Number(row.cupons) < 0 || Number(row.cupons) > 100000) return false;
          return true;
        });

        if (!validRows.length) throw new Error('Nenhuma linha válida encontrada. Use o modelo de importação.');

        const state = await loadClientState(user.orgId);
        state.salesRows = validRows;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'SALES_IMPORTED', { linhas: validRows.length, dias: new Set(validRows.map((row) => row.data)).size, ip: requestIp(req) });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, state });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/import-employees' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar a equipe.');
        const body = await readJsonBody(req);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];

        const validRows = rows.filter((row) => {
          const nome = sanitizeString(String(row.nome || '')).slice(0, 100);
          const horas = Number(row.horasSemanais);
          return nome.length >= 2 && horas > 0 && horas <= 168;
        }).map(row => ({
          nome: sanitizeString(String(row.nome || '')).slice(0, 100),
          horasSemanais: Math.min(168, Math.max(0, Number(row.horasSemanais))),
          funcao: sanitizeString(String(row.funcao || '')).slice(0, 50)
        }));

        if (validRows.length < 1) throw new Error('Importe ao menos uma operadora válida.');

        const state = await loadClientState(user.orgId);
        state.employees = validRows;
        state.profile.quantidadeOperadores = validRows.length;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'EMPLOYEES_IMPORTED', { colaboradores: validRows.length, ip: requestIp(req) });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, state });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }

  // Proteção contra path traversal
  const file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  const filePath = path.join(PUBLIC, file);
  if (!filePath.startsWith(PUBLIC)) {
    return json(res, { error: 'Forbidden' }, 403);
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
    res.writeHead(200, {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
    });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`Workforce OS rodando em http://localhost:${PORT}`);
});
