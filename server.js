const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const dbSupabase = require('./db-supabase');

const PORT = process.env.PORT || 4173;
const PUBLIC = path.join(__dirname, 'public');
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

// Cenários por semana do mês
const CENARIOS_SEMANAS = {
  1: { nome: 'Semana 1 (1-7)', demanda: 485, itens: 5.8, ticket: 50.50 },
  2: { nome: 'Semana 2 (8-14)', demanda: 495, itens: 6.0, ticket: 51.50 },
  3: { nome: 'Semana 3 (15-21)', demanda: 500, itens: 6.0, ticket: 51.80 },
  4: { nome: 'Semana 4 (22-28) - PROMOCAO', demanda: 525, itens: 6.5, ticket: 55.00 },
  5: { nome: 'Semana 5 (29-05) - PICO', demanda: 545, itens: 7.0, ticket: 58.80 }
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

function requireSameOrigin(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (!origin) return;
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;
  if (!host || new URL(origin).host !== host) throw new Error('Origem da requisição não autorizada.');
}

function enforceRateLimit(req, action, maxAttempts = 8, windowMs = 15 * 60 * 1000) {
  const key = `${action}:${requestIp(req)}`;
  const now = Date.now();
  const current = attempts.get(key) || [];
  const recent = current.filter((time) => now - time < windowMs);
  if (recent.length >= maxAttempts) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  recent.push(now);
  attempts.set(key, recent);
}

loadSessions();

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
    updatedAt: null
  };
}

function clientStateFile(userId) {
  return path.join(CLIENTS_DIR, `${userId}.json`);
}

async function loadClientState(userId) {
  if (!userId) return defaultClientState();
  const data = await dbSupabase.getClientData(userId);
  return { ...defaultClientState(), ...data };
}

async function saveClientState(userId, state) {
  await dbSupabase.saveClientData(userId, state);
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
  const recommended = Math.max(1, Math.ceil((neededMinutes / 60) * 1.05));
  const cappedRecommendation = Math.min(Math.max(1, pdvLimit), recommended);
  const capacityMinutes = Math.max(1, scheduledCashiers || simpleDemand) * 60;
  const utilization = Math.round(Math.min(160, (neededMinutes / capacityMinutes) * 100));
  const idlePercent = Math.max(0, Math.round(((capacityMinutes - neededMinutes) / capacityMinutes) * 100));
  const overflow = Math.max(0, neededMinutes - capacityMinutes);
  const waitMinutes = overflow
    ? Number(Math.min(15, overflow / Math.max(1, inferredCustomers) * 4).toFixed(1))
    : Number(Math.max(0.5, utilization / 100 * 1.8).toFixed(1));
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
  blueYonderBenchmark: [
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

function json(res, payload) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
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

function applyClientState(summary, user) {
  const state = loadClientState(user.id);
  const profile = state.profile || defaultClientState().profile;
  const requiredDayKeys = requiredOperationalDayKeys(profile);
  const importedDayKeys = new Set(state.salesRows.map((row) => dayKeys[new Date(`${row.data}T12:00:00`).getDay()]));
  const importedOperationalDayKeys = requiredDayKeys.filter((key) => importedDayKeys.has(key));
  const missingOperationalDayKeys = requiredDayKeys.filter((key) => !importedDayKeys.has(key));
  summary.client = {
    profile: { ...profile, cnpj: '' },
    account: { name: user.name, email: user.email },
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
  const operators = Number(state.employees.length || profile.quantidadeOperadores || 4);
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

  if (state.employees.length >= 4) {
    const originals = ['Lucila', 'Edvania', 'Samara', 'Jane'];
    const replacements = state.employees.slice(0, 4).map((employee) => employee.nome);
    const names = Object.fromEntries(originals.map((original, index) => [original, replacements[index]]));
    Object.values(summary.staffSchedule).flat().forEach((person) => { person.nome = names[person.nome] || person.nome; });
    Object.values(summary.weeklyScenarioSchedule).forEach((scenario) => {
      scenario.people = Object.fromEntries(Object.entries(scenario.people).map(([name, shifts]) => [names[name] || name, shifts]));
    });
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
  refreshCoverageLoads(summary, summary.storeConfig.pdvs);
  const dates = [...new Set(state.salesRows.map((row) => row.data))].sort();
  const representedDays = representedSalesDays(state.salesRows);
  const weeklyDemand = Object.values(summary.dailyCoverage).flatMap((day) => day.rows).reduce((sum, row) => sum + Number(row.demanda || 0), 0);
  summary.scenarios.forEach((scenario) => {
    scenario.caixaNecessario = weeklyDemand;
  });
  summary.monthlyWeekAnalysis = buildMonthlyWeekAnalysis(summary, state.salesRows);
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

async function summaryFromDatabase(user = null) {
  const connection = await db.status();
  if (!connection.connected) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', ...connection } }));
    if (user) return applyClientState(summary, user);
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
    if (user) return applyClientState(summary, user);
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    return summary;
  } catch (error) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', connected: true, database: connection.database, error: error.message } }));
    if (user) return applyClientState(summary, user);
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
  if (req.url === '/api/summary') return json(res, await summaryFromDatabase(user));
  if (req.url === '/api/db-status') return json(res, await db.status());
  if (req.url === '/api/persistence-status') return json(res, await db.appPersistenceStatus());
  if (req.url === '/api/auth/status') return json(res, { authenticated: Boolean(user), user: user ? { name: user.name, email: user.email } : null });
  if (req.url === '/api/account/activity') {
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: 'Faça login para visualizar atividades.' }));
    }
    return json(res, { ok: true, activities: loadAudit(user.id).slice(0, 20), backups: fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((file) => file.startsWith(user.id)).length : 0, persistence: await db.appPersistenceStatus() });
  }
  if (req.url === '/api/account/export') {
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: 'Faça login para exportar seus dados.' }));
    }
    audit(user.id, 'Dados exportados');
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email, createdAt: user.createdAt },
      state: loadClientState(user.id),
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
      audit(user.id, 'Senha alterada');
      return json(res, { ok: true });
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  }
  if (req.url === '/api/auth/register' && req.method === 'POST') {
    (async () => {
      try {
        enforceRateLimit(req, 'register', 5);
        const body = await readJsonBody(req, 50_000);
        const email = String(body.email || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        const password = String(body.password || '');
        if (String(body.inviteCode || '').trim() !== PILOT_INVITE_CODE) throw new Error('Código de convite inválido.');
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new Error('Informe nome, e-mail válido e senha com pelo menos 8 caracteres.');
        const existingUser = await dbSupabase.getUser(email);
        if (existingUser) throw new Error('Este e-mail já possui uma conta.');
        const secured = await hashPassword(password);
        const newUser = { id: crypto.randomUUID(), name, email, passwordSalt: secured.salt, passwordHash: secured.hash, inviteCode: PILOT_INVITE_CODE };
        await dbSupabase.createUser(newUser);
        await saveClientState(newUser.id, defaultClientState());
        await createSession(res, req, newUser.id);
        await audit(newUser.id, 'Conta criada', { email });
        return json(res, { ok: true, user: { name, email } });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: error.message }));
      }
    })();
    return;
  }
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    (async () => {
      try {
        enforceRateLimit(req, 'login', 8);
        const body = await readJsonBody(req, 50_000);
        const email = String(body.email || '').trim().toLowerCase();
        const userMatch = await dbSupabase.getUser(email);
        if (!userMatch || !(await verifyPassword(String(body.password || ''), userMatch))) throw new Error('E-mail ou senha inválidos.');
        await createSession(res, req, userMatch.id);
        await audit(userMatch.id, 'Login realizado', { ip: requestIp(req) });
        return json(res, { ok: true, user: { name: userMatch.name, email: userMatch.email } });
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: error.message }));
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
  if (req.url === '/api/onboarding' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para configurar sua loja.');
        const body = await readJsonBody(req);
        const state = await loadClientState(user.id);
        state.profile = { ...state.profile, ...body.profile };
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.id, state);
        await audit(user.id, 'Configuração da loja atualizada', { empresa: state.profile.empresa, loja: state.profile.loja });
        return json(res, { ok: true, state });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: error.message }));
      }
    })();
    return;
  }
  if (req.url === '/api/import-sales' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar vendas.');
        const body = await readJsonBody(req);
        const rows = Array.isArray(body.rows) ? body.rows : [];
        const validRows = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.data) && /^\d{2}:\d{2}$/.test(row.horaInicio) && /^\d{2}:\d{2}$/.test(row.horaFim) && Number(row.cupons) >= 0);
        if (!validRows.length) throw new Error('Nenhuma linha válida encontrada. Use o modelo de importação.');
        const state = await loadClientState(user.id);
        state.salesRows = validRows;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.id, state);
        await audit(user.id, 'Vendas importadas', { linhas: validRows.length, dias: new Set(validRows.map((row) => row.data)).size });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, state });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: error.message }));
      }
    })();
    return;
  }
  if (req.url === '/api/import-employees' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar a equipe.');
        const body = await readJsonBody(req);
        const rows = Array.isArray(body.rows) ? body.rows : [];
        const validRows = rows.filter((row) => row.nome && Number(row.horasSemanais) > 0);
        if (validRows.length < 4) throw new Error('Importe ao menos quatro operadoras para a implantação atual.');
        const state = await loadClientState(user.id);
        state.employees = validRows;
        state.profile.quantidadeOperadores = validRows.length;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.id, state);
        await audit(user.id, 'Equipe importada', { colaboradores: validRows.length });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, state });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: error.message }));
      }
    })();
    return;
  }
  const file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  const filePath = path.join(PUBLIC, file);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
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
