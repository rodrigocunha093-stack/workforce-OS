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
// Caminho do arquivo de vendas-modelo (apenas para o DEMO local). Em produção
// (Vercel) o arquivo não existe e o demo segue sem dados-modelo — loadModelSalesRows() trata.
const MODEL_SALES_FILE = process.env.MODEL_SALES_FILE || 'C:\\Users\\LOJA1321\\OneDrive\\Área de Trabalho\\dados vendas';
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

async function enforceRateLimit(req, action, maxAttempts = 8, windowMs = 15 * 60 * 1000) {
  const ip = requestIp(req);
  const key = `${action}:${ip}`;
  const now = Date.now();

  // 1) Fast path em memória (protege rajadas dentro de uma instância quente).
  const current = (attempts.get(key) || []).filter((time) => now - time < windowMs);
  if (current.length >= maxAttempts) {
    throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }
  current.push(now);
  attempts.set(key, current);

  // 2) Store compartilhado (cross-instance, serverless-safe). Best-effort: se a
  //    tabela rate_limits não existir, countRecentRateHits retorna null e seguimos
  //    apenas com o limitador em memória.
  const sinceIso = new Date(now - windowMs).toISOString();
  const shared = await dbSupabase.countRecentRateHits(key, sinceIso);
  if (shared !== null) {
    dbSupabase.recordRateHit(key);
    if (shared >= maxAttempts) {
      throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }
  }
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

function defaultOperationalRules() {
  return {
    lojaNaoAbreFraca: true,
    minimoAberturaPorSetor: 1,
    minimoFechamentoPorSetor: 1,
    reposicaoNaoSoCedo: true,
    intervaloMinimoMinutos: 60,
    intervaloMulherMaximoMinutos: 120,
    fechamentoSeguroMinimo: 2,
    permitirFolgaSexta: false,
    permitirFolgaSabado: false,
    domingoConfiguravel: true
  };
}

function defaultEmployeeProfileFields() {
  return {
    setoresAptos: [],
    proficiencia: 'pleno',
    preferenciaTurno: 'flexivel',
    restricoes: [],
    papelOperacional: 'auto'
  };
}

function defaultEscalaWorkflow() {
  return {
    status: 'rascunho',
    updatedAt: null,
    updatedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    completedAt: null,
    completedBy: null
  };
}

function normalizeStringList(value, maxItems = 20, maxLength = 60) {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
  return list
    .map((item) => sanitizeString(String(item)).slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeOperationalRules(rules) {
  const base = defaultOperationalRules();
  const src = rules && typeof rules === 'object' ? rules : {};
  return {
    ...base,
    ...src,
    minimoAberturaPorSetor: Math.max(1, Number(src.minimoAberturaPorSetor ?? base.minimoAberturaPorSetor) || base.minimoAberturaPorSetor),
    minimoFechamentoPorSetor: Math.max(1, Number(src.minimoFechamentoPorSetor ?? base.minimoFechamentoPorSetor) || base.minimoFechamentoPorSetor),
    intervaloMinimoMinutos: Math.max(15, Number(src.intervaloMinimoMinutos ?? base.intervaloMinimoMinutos) || base.intervaloMinimoMinutos),
    intervaloMulherMaximoMinutos: Math.max(60, Number(src.intervaloMulherMaximoMinutos ?? base.intervaloMulherMaximoMinutos) || base.intervaloMulherMaximoMinutos),
    fechamentoSeguroMinimo: Math.max(1, Number(src.fechamentoSeguroMinimo ?? base.fechamentoSeguroMinimo) || base.fechamentoSeguroMinimo),
    permitirFolgaSexta: src.permitirFolgaSexta === true,
    permitirFolgaSabado: src.permitirFolgaSabado === true,
    domingoConfiguravel: src.domingoConfiguravel !== false
  };
}

function normalizeEmployeeRecord(row) {
  const base = defaultEmployeeProfileFields();
  const turnosValidos = ['abertura', 'intermediario', 'fechamento', 'flexivel'];
  const diasValidos = ['', 'segunda', 'terca', 'quarta', 'quinta', 'domingo'];
  const proficienciasValidas = ['iniciante', 'pleno', 'senior', 'lider'];
  const papeisValidos = ['auto', 'abertura', 'sustentacao', 'fechamento', 'apoio'];
  const mercadologicos = Array.isArray(row.mercadologicos)
    ? row.mercadologicos.map((m) => sanitizeString(String(m)).slice(0, 80)).filter(Boolean).slice(0, 30)
    : [];

  let setor = sanitizeString(String(row.setor || 'Caixa')).slice(0, 60);
  if (mercadologicos.length) {
    const setoresOp = mercadologicos.map(mercadologicoParaSetor);
    const freq = {};
    setoresOp.forEach((s) => { freq[s] = (freq[s] || 0) + 1; });
    setor = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  const preferenciaTurno = turnosValidos.includes(String(row.preferenciaTurno || row.turno || '').toLowerCase())
    ? String(row.preferenciaTurno || row.turno).toLowerCase()
    : 'flexivel';

  return {
    nome: sanitizeString(String(row.nome || '')).slice(0, 100),
    sexo: ['masculino', 'feminino'].includes(String(row.sexo || '').toLowerCase()) ? String(row.sexo).toLowerCase() : 'feminino',
    cargo: sanitizeString(String(row.cargo || 'Operador de Caixa')).slice(0, 60),
    setor,
    mercadologicos,
    horasSemanais: Math.min(168, Math.max(1, Number(row.horasSemanais) || 44)),
    salario: Math.max(0, Number(row.salario) || 0),
    turno: turnosValidos.includes(String(row.turno || preferenciaTurno || '').toLowerCase()) ? String(row.turno || preferenciaTurno).toLowerCase() : 'flexivel',
    podeDomingo: row.podeDomingo === false ? false : true,
    folgaPreferencial: diasValidos.includes(String(row.folgaPreferencial || '').toLowerCase()) ? String(row.folgaPreferencial).toLowerCase() : '',
    setoresAptos: normalizeStringList(row.setoresAptos || row.setor || [], 12, 60),
    proficiencia: proficienciasValidas.includes(String(row.proficiencia || '').toLowerCase()) ? String(row.proficiencia).toLowerCase() : base.proficiencia,
    preferenciaTurno,
    restricoes: normalizeStringList(row.restricoes || [], 12, 80),
    papelOperacional: papeisValidos.includes(String(row.papelOperacional || '').toLowerCase()) ? String(row.papelOperacional).toLowerCase() : base.papelOperacional
  };
}

function normalizeEscalaWorkflow(workflow) {
  const base = defaultEscalaWorkflow();
  const src = workflow && typeof workflow === 'object' ? workflow : {};
  const status = ['rascunho', 'revisado', 'publicado', 'realizado'].includes(String(src.status || '').toLowerCase())
    ? String(src.status).toLowerCase()
    : base.status;
  return { ...base, ...src, status };
}

function applyWorkflowStatus(workflow, status, user, at = new Date().toISOString()) {
  const next = normalizeEscalaWorkflow(workflow);
  next.status = status;
  next.updatedAt = at;
  next.updatedBy = user?.email || null;
  if (status === 'revisado') {
    next.reviewedAt = at;
    next.reviewedBy = user?.email || null;
  }
  if (status === 'publicado') {
    next.publishedAt = at;
    next.publishedBy = user?.email || null;
  }
  if (status === 'realizado') {
    next.completedAt = at;
    next.completedBy = user?.email || null;
  }
  return next;
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
      horarioDomingo: '08:00-12:00',
      regrasOperacionais: defaultOperationalRules()
    },
    employees: [],
    salesRows: [],
    salesByMercadologico: [],
    dailyRevenue: [],           // faturamento diário [{data, faturamento}] — histórico longo para forecast
    eventos: [],                // calendário de eventos [{data, tipo, nome, fator}]
    timecardRows: [],           // registros de ponto [{nome, data, entrada, saida}]
    escalaOverrides: {},      // edições manuais { "nome::dayIndex::cenario": "turno" }
    enabledModules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    escalaFechada: null,      // período vigente fechado (snapshot imutável)
    escalaHistorico: [],      // períodos fechados anteriores
    escalaWorkflow: defaultEscalaWorkflow(),
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
  const base = defaultClientState();
  const merged = { ...base, ...(data || {}) };
  merged.profile = {
    ...base.profile,
    ...((data && data.profile) || {}),
    regrasOperacionais: normalizeOperationalRules(data?.profile?.regrasOperacionais)
  };
  merged.employees = Array.isArray(data?.employees) ? data.employees.map(normalizeEmployeeRecord).filter((e) => e.nome.length >= 2) : [];
  merged.escalaWorkflow = normalizeEscalaWorkflow(data?.escalaWorkflow);
  merged.escalaHistorico = Array.isArray(data?.escalaHistorico) ? data.escalaHistorico : [];
  return merged;
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

function rotateArray(list, offset = 0) {
  const arr = Array.isArray(list) ? [...list] : [];
  if (!arr.length) return arr;
  const shift = ((offset % arr.length) + arr.length) % arr.length;
  return arr.slice(shift).concat(arr.slice(0, shift));
}

function uniqueVariantKey(employees) {
  return (employees || [])
    .map((emp) => `${emp.nome}:${emp._coverageRole || emp.turno || 'flexivel'}:${emp._sortIndex ?? ''}`)
    .join('|');
}

function assignCoverageRolesVariant(employees, variantIndex = 0) {
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

  const rotations = [
    (list) => [...list],
    (list) => [...list].reverse(),
    (list) => rotateArray(list, 1),
    (list) => rotateArray(list, -1),
    (list) => list.length > 2 ? rotateArray(list, Math.floor(list.length / 2)) : [...list]
  ];
  const flexOrdered = rotations[variantIndex % rotations.length](flex);
  const result = [];
  explicitOpen.forEach((emp) => result.push({ ...emp, _coverageRole: 'abertura' }));
  explicitClose.forEach((emp) => result.push({ ...emp, _coverageRole: 'fechamento' }));
  explicitMiddle.forEach((emp) => result.push({ ...emp, _coverageRole: 'intermediario' }));

  const openFirst = variantIndex % 2 === 0;
  let openingSlots = Math.max(0, half - explicitOpen.length);
  let closingSlots = Math.max(0, half - explicitClose.length);
  const flexPool = [...flexOrdered];

  const takeFront = () => flexPool.shift();
  const takeBack = () => flexPool.pop();
  const fillOpen = () => {
    while (openingSlots > 0 && flexPool.length) {
      const emp = openFirst ? takeFront() : takeBack();
      if (!emp) break;
      result.push({ ...emp, _coverageRole: 'abertura' });
      openingSlots -= 1;
    }
  };
  const fillClose = () => {
    while (closingSlots > 0 && flexPool.length) {
      const emp = openFirst ? takeBack() : takeFront();
      if (!emp) break;
      result.push({ ...emp, _coverageRole: 'fechamento' });
      closingSlots -= 1;
    }
  };

  if (openFirst) {
    fillOpen();
    fillClose();
  } else {
    fillClose();
    fillOpen();
  }
  flexPool.forEach((emp) => result.push({ ...emp, _coverageRole: 'intermediario' }));

  const orderingStrategies = [
    (list) => [...list].sort((a, b) => a._sortIndex - b._sortIndex),
    (list) => [...list].sort((a, b) => {
      const roleOrder = { abertura: 0, intermediario: 1, central: 1, fechamento: 2 };
      const diff = (roleOrder[a._coverageRole] ?? 1) - (roleOrder[b._coverageRole] ?? 1);
      return diff || a._sortIndex - b._sortIndex;
    }),
    (list) => [...list].sort((a, b) => {
      const roleOrder = { fechamento: 0, intermediario: 1, central: 1, abertura: 2 };
      const diff = (roleOrder[a._coverageRole] ?? 1) - (roleOrder[b._coverageRole] ?? 1);
      return diff || a._sortIndex - b._sortIndex;
    })
  ];

  const ordered = orderingStrategies[Math.floor(variantIndex / rotations.length) % orderingStrategies.length](result);
  return ordered.map((emp, index) => ({ ...emp, _variantIndex: variantIndex, _variantOrder: index }));
}

function buildCoverageRoleVariants(employees, maxVariants = 6) {
  const variants = [];
  const seen = new Set();
  const totalVariants = Math.max(1, maxVariants);
  for (let index = 0; index < totalVariants; index += 1) {
    const variant = assignCoverageRolesVariant(employees, index);
    const key = uniqueVariantKey(variant);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }
  if (!variants.length) {
    variants.push(assignCoverageRolesBySector(employees));
  }
  return variants;
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

// Decomposição multiplicativa: índice dia-da-semana × fator semana-do-mês.
// O fator semana-do-mês é calculado ESPECÍFICO por dia-da-semana (interação dow×wom),
// porque o efeito da semana de pagamento no sábado ≠ na terça. Validado por backtest
// walk-forward nos dados reais (WAPE 20,1% → 17,9% vs fator global). Fallback ao fator
// global quando a célula [dow][wom] tem menos de MIN_CELL amostras.
// Com 30 dias: ~4 amostras/dow (robusto), ~1-2 amostras/wom (direcional).
function buildDemandIndices(rows) {
  if (!rows || !rows.length) return null;
  const MIN_CELL = 4; // amostras mínimas p/ confiar no fator específico da célula

  // Índice por dia da semana (dow 0=dom..6=sab)
  const dowSum = [0,0,0,0,0,0,0];
  const dowDays = [new Set(),new Set(),new Set(),new Set(),new Set(),new Set(),new Set()];
  // Fator por semana do mês (wom 1..5)
  const womSum = [0,0,0,0,0,0]; // idx 0 unused, 1-5
  const womDays = [null, new Set(), new Set(), new Set(), new Set(), new Set()];
  // Interação dow×wom: soma e contagem por célula [dow][wom]
  const cellSum = Array.from({ length: 7 }, () => [0,0,0,0,0,0]);
  const cellCnt = Array.from({ length: 7 }, () => [0,0,0,0,0,0]);

  rows.forEach(r => {
    const venda = Number(r.vendaLiquida || 0);
    const d = new Date(`${r.data}T12:00:00`).getDay();
    dowSum[d] += venda;
    dowDays[d].add(r.data);
    const wom = weekOfMonth(r.data);
    womSum[wom] += venda;
    womDays[wom].add(r.data);
    if (wom >= 1 && wom <= 5) { cellSum[d][wom] += venda; cellCnt[d][wom] += 1; }
  });

  // Média por dow
  const dowAvg = dowSum.map((v, i) => dowDays[i].size ? v / dowDays[i].size : 0);
  const dowActive = dowAvg.filter(v => v > 0);
  const dowMean = dowActive.length ? dowActive.reduce((a, b) => a + b, 0) / dowActive.length : 1;
  const dowIndex = dowAvg.map(v => dowMean > 0 ? Number((v / dowMean).toFixed(3)) : 1);

  // Média por wom (fator GLOBAL — usado como fallback)
  const womAvg = womSum.map((v, i) => i > 0 && womDays[i].size ? v / womDays[i].size : 0);
  const womActive = womAvg.filter((v, i) => i > 0 && v > 0);
  const womMean = womActive.length ? womActive.reduce((a, b) => a + b, 0) / womActive.length : 1;
  const womFactor = womAvg.map((v, i) => i > 0 && womMean > 0 ? Number((v / womMean).toFixed(3)) : 1);

  // Fator semana-do-mês ESPECÍFICO por dia-da-semana (interação). Relativo à média daquele dia.
  // womByDow[dow][wom] = média(dias dow&wom) / média(dias dow); fallback ao womFactor global.
  const womByDow = Array.from({ length: 7 }, (_, d) => {
    const row = [1,1,1,1,1,1];
    const baseDia = dowAvg[d];
    for (let w = 1; w <= 5; w++) {
      if (cellCnt[d][w] >= MIN_CELL && baseDia > 0) {
        row[w] = Number(((cellSum[d][w] / cellCnt[d][w]) / baseDia).toFixed(3));
      } else {
        row[w] = womFactor[w] || 1; // fallback global
      }
    }
    return row;
  });

  // Dias com dados por célula (para nível de confiança)
  const totalDays = new Set(rows.map(r => r.data)).size;
  const dowSamples = dowDays.map(s => s.size);
  const womSamples = womDays.map((s, i) => i > 0 ? s.size : 0);
  const minDowSamples = Math.min(...dowSamples.filter(n => n > 0));

  let confianca = 'inicial';
  if (totalDays >= 90) confianca = 'boa';
  else if (totalDays >= 28 && minDowSamples >= 3) confianca = 'media';

  return {
    dowIndex,     // [7] — 0=dom..6=sab, 1.0 = média
    womFactor,    // [6] — idx 0 unused, 1-5, 1.0 = média (GLOBAL, fallback)
    womByDow,     // [7][6] — fator semana-do-mês específico por dia-da-semana (interação)
    baseMedia: dowMean,
    confianca,
    totalDays,
    dowSamples,
    womSamples
  };
}

// Feriados nacionais fixos (MM-DD) — recorrentes todo ano
const FERIADOS_FIXOS = {
  '01-01': 'Ano Novo', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho',
  '09-07': 'Independência', '10-12': 'N.S. Aparecida', '11-02': 'Finados',
  '11-15': 'Proclamação da República', '12-25': 'Natal'
};

// Eventos que afetam demanda com fator padrão por tipo
const EVENTO_TIPO_FATOR = {
  feriado: 0.3,      // loja fecha ou opera parcial
  vespera: 1.4,       // véspera de feriado — pico
  promocao: 1.35,     // promoção ativa
  data_comemorativa: 1.25, // Dia das Mães, Namorados, etc.
  pagamento: 1.15,    // dia de pagamento (5o dia útil, etc.)
  normal: 1.0
};

function buildEventMap(eventos, year) {
  const map = {};
  (eventos || []).forEach(ev => {
    map[ev.data] = { tipo: ev.tipo, nome: ev.nome, fator: Number(ev.fator) || EVENTO_TIPO_FATOR[ev.tipo] || 1 };
  });
  // Auto-gerar feriados fixos se não há evento manual nessa data
  if (year) {
    Object.entries(FERIADOS_FIXOS).forEach(([mmdd, nome]) => {
      const dataStr = `${year}-${mmdd}`;
      if (!map[dataStr]) {
        map[dataStr] = { tipo: 'feriado', nome, fator: EVENTO_TIPO_FATOR.feriado };
      }
      // Véspera automática (dia anterior, se não for domingo)
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

// Aplica decomposição multiplicativa a uma venda média para obter previsão ajustada.
// Usa o fator semana-do-mês ESPECÍFICO do dia-da-semana (womByDow) quando disponível,
// senão o fator global (womFactor). Modelo K — comprovado por backtest.
function adjustedDemand(baseDia, indices, targetDow, targetWom, eventoFator) {
  if (!indices) return baseDia;
  const dowF = indices.dowIndex[targetDow] || 1;
  let womF = 1;
  if (targetWom >= 1 && targetWom <= 5) {
    if (indices.womByDow && indices.womByDow[targetDow]) {
      womF = indices.womByDow[targetDow][targetWom] || 1;
    } else {
      womF = indices.womFactor[targetWom] || 1;
    }
  }
  const evF = eventoFator || 1;
  return baseDia * dowF * womF * evF;
}

// Gera sugestão de escala semanal baseada no forecast
function buildEscalaSugerida(demandIndices, setorDashboard, employees, profile, eventMap) {
  if (!demandIndices || !employees || !employees.length) return null;
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date();

  // Próximos 7 dias
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const wom = weekOfMonth(dateStr);
    const ev = eventMap ? eventMap[dateStr] : null;
    const evFator = ev ? ev.fator : 1;
    const fatorTotal = (demandIndices.dowIndex[dow] || 1) * (demandIndices.womFactor[wom] || 1) * evFator;
    dias.push({ data: dateStr, dow, wom, diaSemana: dayNames[dow], fatorTotal, evento: ev });
  }

  // Separar operadores de caixa vs setor
  const caixaEmps = employees.filter(e => isOperadorCaixa(e));
  const setorEmps = employees.filter(e => !isOperadorCaixa(e));
  const totalCaixa = caixaEmps.length;

  // Para cada setor com operationalNeed, calcular pessoas por dia
  const setorNecessidades = (setorDashboard || []).filter(s => s.operationalNeed && s.operationalNeed.pessoasNecessarias > 0);

  // Horários da loja
  const hrSegSex = String(profile.horarioSegSex || '07:00-19:00');
  const hrSab = String(profile.horarioSabado || hrSegSex);
  const hrDom = String(profile.horarioDomingo || '08:00-12:00');
  const domOp = String(profile.domingoOperacao || 'aberto');

  const sugestao = dias.map(dia => {
    const isDom = dia.dow === 0;
    const isSab = dia.dow === 6;
    const horario = isDom ? hrDom : (isSab ? hrSab : hrSegSex);
    const lojaFechada = isDom && domOp === 'fechado';

    if (lojaFechada || (dia.evento && dia.evento.tipo === 'feriado' && dia.evento.fator <= 0.1)) {
      return { ...dia, horario, lojaFechada: true, caixaNecessario: 0, setores: [], totalPessoas: 0, folgas: employees.length };
    }

    // Caixa: escalar com fator de demanda (base = quantidadeOperadores do profile)
    const baseCaixa = Number(profile.quantidadeOperadores || totalCaixa || 4);
    const caixaNecessario = Math.max(1, Math.round(baseCaixa * dia.fatorTotal));
    const caixaReal = Math.min(caixaNecessario, totalCaixa);

    // Setores: ajustar pessoasNecessarias pelo fator DOW×WOM específico do setor
    const setores = setorNecessidades.map(s => {
      const baseNeed = s.operationalNeed.pessoasNecessarias;
      const curva = s.curvaDiaSemana;
      let setorFator = dia.fatorTotal; // fallback global
      if (curva && curva.some(v => v > 0)) {
        const ativoDias = curva.filter(v => v > 0);
        const mediaSetor = ativoDias.length ? ativoDias.reduce((a, b) => a + b, 0) / ativoDias.length : 1;
        const dowFatorSetor = mediaSetor > 0 ? (curva[dia.dow] || mediaSetor) / mediaSetor : 1;
        const womFatorSetor = s.womFactor || 1;
        const evFator = dia.evento ? dia.evento.fator : 1;
        setorFator = dowFatorSetor * womFatorSetor * evFator;
      }
      const ajustado = Math.max(1, Math.round(baseNeed * setorFator));
      return {
        setor: s.setor,
        pessoasBase: baseNeed,
        pessoasAjustadas: ajustado,
        fatorSetor: Number(setorFator.toFixed(2)),
        disponivel: Math.round(s.colaboradores),
        saldo: Math.round(s.colaboradores) - ajustado
      };
    });

    const totalSetorNeed = setores.reduce((s, x) => s + x.pessoasAjustadas, 0);
    const totalSetorDisp = setores.reduce((s, x) => s + x.disponivel, 0);
    const totalPessoas = caixaReal + totalSetorNeed;
    const totalDisponivel = totalCaixa + totalSetorDisp;
    const folgas = Math.max(0, totalDisponivel - totalPessoas);

    return {
      ...dia,
      horario,
      lojaFechada: false,
      caixaNecessario: caixaReal,
      caixaTotal: totalCaixa,
      setores,
      totalPessoas,
      totalDisponivel,
      folgas
    };
  });

  // Resumo semanal
  const totalHorasNecessarias = sugestao.filter(d => !d.lojaFechada).reduce((s, d) => {
    const [h1, h2] = d.horario.split('-').map(t => { const p = t.split(':'); return Number(p[0]) + Number(p[1] || 0) / 60; });
    return s + d.totalPessoas * (h2 - h1);
  }, 0);

  return {
    periodo: `${sugestao[0].data} a ${sugestao[6].data}`,
    dias: sugestao,
    resumo: {
      totalColaboradores: employees.length,
      caixaOperadores: totalCaixa,
      setorColaboradores: setorEmps.length,
      horasSemanaisEstimadas: Math.round(totalHorasNecessarias),
      diasAbertos: sugestao.filter(d => !d.lojaFechada).length
    }
  };
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

  // --- FATURAMENTO (último mês completo ou rolling 30 dias) ---
  // Prioridade: dailyRevenue (mais dias) > mercadológico > caixa VRSoft
  let fatDia = 0, fatMes = 0, fatSemana = 0, fonteFat = 'sem dados';
  const dailyRev = Array.isArray(state.dailyRevenue) ? state.dailyRevenue : [];
  const _fatByDate = {};
  if (dailyRev.length >= 7) {
    fonteFat = 'faturamento diário';
    dailyRev.forEach(r => { _fatByDate[r.data] = (_fatByDate[r.data] || 0) + Number(r.faturamento || 0); });
  } else if (mercRows.length) {
    fonteFat = 'mercadológico';
    mercRows.forEach(r => { _fatByDate[r.data] = (_fatByDate[r.data] || 0) + Number(r.vendaLiquida || 0); });
  } else if (caixaRows.length) {
    fonteFat = 'caixa VRSoft';
    caixaRows.forEach(r => { _fatByDate[r.data] = (_fatByDate[r.data] || 0) + Number(r.vendaLiquida || 0); });
  }
  const _fatDates = Object.keys(_fatByDate).sort();
  if (_fatDates.length) {
    const _lastDate = _fatDates[_fatDates.length - 1];
    const _prevMonth = new Date(_lastDate + 'T12:00:00');
    _prevMonth.setMonth(_prevMonth.getMonth() - 1);
    const _prevMonthStr = _prevMonth.toISOString().slice(0, 7);
    const _lastCompleteDates = _fatDates.filter(d => d.slice(0, 7) === (_lastDate.slice(8, 10) <= '06' ? _prevMonthStr : _lastDate.slice(0, 7)));
    if (_lastCompleteDates.length >= 20) {
      fatMes = _lastCompleteDates.reduce((s, d) => s + _fatByDate[d], 0);
      fatDia = fatMes / _lastCompleteDates.length;
      fonteFat += ` (${_lastCompleteDates[0].slice(5,7)}/${_lastCompleteDates[0].slice(0,4)})`;
    } else {
      const _cutoff = new Date(_lastDate + 'T12:00:00');
      _cutoff.setDate(_cutoff.getDate() - 29);
      const _cutoffStr = _cutoff.toISOString().slice(0, 10);
      const _rolling = _fatDates.filter(d => d >= _cutoffStr);
      const _rollingTotal = _rolling.reduce((s, d) => s + _fatByDate[d], 0);
      const _rollingDays = _rolling.length || 1;
      fatDia = _rollingTotal / _rollingDays;
      fatMes = fatDia * 30;
      fonteFat += ` (últ. ${_rollingDays}d)`;
    }
    fatSemana = fatDia * 7;
  }

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
    const ticketVrsoft = totalCupons ? Math.round(totalVenda / totalCupons) : BENCH.ticketMedio;
    ticketMedio = (!fonteFat.startsWith('caixa') && fatDia > 0 && clientesDia > 0)
      ? Math.round(fatDia / clientesDia)
      : ticketVrsoft;
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

function coreSectorRule(setor) {
  const key = normalizeSetor(setor);
  if (key === 'mercearia') return { driver: 'Caixas repostas', benchmark: 40, unidade: 'cx/h', jornadaUtil: 7, proxy: 'qtdeVendida ÷ 12 un por caixa' };
  if (key === 'acougue') return { driver: 'Kg vendidos/processados', benchmark: 31, unidade: 'kg/h', jornadaUtil: 7, proxy: 'qtdeVendida como volume proxy' };
  if (key === 'hortifruti') return { driver: 'Kg manipulados', benchmark: 140, unidade: 'kg/h', jornadaUtil: 7, proxy: 'qtdeVendida como volume proxy' };
  if (key === 'padaria') return { driver: 'Kg produzidos/atendidos', benchmark: 32, unidade: 'kg/h', jornadaUtil: 7, proxy: 'qtdeVendida como volume proxy' };
  if (key.includes('frios') || key.includes('laticinio')) return { driver: 'Kg fatiados/atendidos', benchmark: 35, unidade: 'kg/h', jornadaUtil: 7, proxy: 'qtdeVendida como volume proxy' };
  if (key === 'frente de caixa') return { driver: 'Clientes por hora', benchmark: 24, unidade: 'clientes/h', jornadaUtil: 7, proxy: 'cupons por hora' };
  return null;
}

function deriveOperationalNeed(setor, vendaDia, qtdItensDia, qtdeVendidaDia, colaboradores) {
  const rule = coreSectorRule(setor);
  if (!rule) return null;

  let volumeDia = 0;
  let proxyLabel = rule.proxy;
  const key = normalizeSetor(setor);

  if (key === 'mercearia') {
    volumeDia = qtdeVendidaDia > 0 ? (qtdeVendidaDia / 12) : (qtdItensDia / 18);
    proxyLabel = qtdeVendidaDia > 0 ? 'unidades vendidas convertidas em caixas de reposição' : 'itens vendidos convertidos em caixas de reposição';
  } else {
    volumeDia = qtdeVendidaDia > 0 ? qtdeVendidaDia : qtdItensDia;
    proxyLabel = qtdeVendidaDia > 0 ? rule.proxy : 'qtdItens como proxy temporária por falta de volume físico';
  }

  const horasNecessarias = rule.benchmark > 0 ? volumeDia / rule.benchmark : 0;
  const pessoasNecessarias = volumeDia > 0 ? Math.max(1, Math.ceil(horasNecessarias / rule.jornadaUtil)) : 0;
  const saldo = colaboradores - pessoasNecessarias;
  const confianca = qtdeVendidaDia > 0 ? 'média' : 'inicial';
  let status = 'adequate';
  let statusLabel = 'Adequado';
  let acao = 'Manter o setor na formação atual';

  if (pessoasNecessarias > colaboradores) {
    status = 'critical';
    statusLabel = 'Crítico';
    acao = `Reforçar ${setor} ou redistribuir apoio`;
  } else if (pessoasNecessarias < colaboradores) {
    status = 'attention';
    statusLabel = 'Atenção';
    acao = `Converter sobra de ${setor} em apoio operacional`;
  }

  return {
    driver: rule.driver,
    benchmark: rule.benchmark,
    unidade: rule.unidade,
    jornadaUtil: rule.jornadaUtil,
    proxyLabel,
    volumeDia: Number(volumeDia.toFixed(1)),
    horasNecessarias: Number(horasNecessarias.toFixed(1)),
    pessoasNecessarias,
    saldo,
    confianca,
    status,
    statusLabel,
    acao,
    explicacao: volumeDia > 0
      ? `${Number(volumeDia.toFixed(1)).toLocaleString('pt-BR')} ${rule.unidade.split('/')[0] || 'un'} por dia ÷ benchmark ${rule.benchmark} ${rule.unidade} = ${Number(horasNecessarias.toFixed(1)).toLocaleString('pt-BR')}h; ÷ ${rule.jornadaUtil}h úteis = ${pessoasNecessarias} pessoa(s).`
      : 'Sem volume suficiente para calcular necessidade operacional inicial.'
  };
}

// Dashboard inteligente: cruza vendas POR MERCADOLÓGICO (m2) com a equipe
// targetWom: semana-do-mês alvo (1-5) para ajustar demanda. null = média chapada (legado)
function buildSetorDashboard(mercRows, employees, profile, targetWom) {
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

  // Fator semana-do-mês POR SETOR (cada mercadológico tem sua própria sazonalidade)
  const setorWomSum = {};  // k → [0, sum1..sum5]
  const setorWomDays = {}; // k → [null, Set1..Set5]
  if (targetWom) {
    mercRows.forEach(r => {
      const k = norm(r.mercadologico);
      if (!setorWomSum[k]) {
        setorWomSum[k] = [0,0,0,0,0,0];
        setorWomDays[k] = [null, new Set(), new Set(), new Set(), new Set(), new Set()];
      }
      const wom = weekOfMonth(r.data);
      setorWomSum[k][wom] += Number(r.vendaLiquida || 0);
      setorWomDays[k][wom].add(r.data);
    });
  }
  function womFactorForSetor(k) {
    if (!targetWom || !setorWomSum[k]) return 1;
    const ws = setorWomSum[k];
    const wd = setorWomDays[k];
    const avgs = ws.map((v, i) => i > 0 && wd[i].size ? v / wd[i].size : 0);
    const active = avgs.filter((v, i) => i > 0 && v > 0);
    const mean = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 1;
    return mean > 0 ? Number((avgs[targetWom] / mean).toFixed(3)) || 1 : 1;
  }

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
    const wf = womFactorForSetor(k);
    const vendaDia = (v.vendaLiquida / dias) * wf;
    const itensDia = (v.qtdItens / dias) * wf;
    const qtdeVendidaDia = (v.qtdeVendida / dias) * wf;
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
      vendaDiaBase: Math.round(v.vendaLiquida / dias),
      womFactor: Number(wf.toFixed(3)),
      semanaAlvo: targetWom || null,
      vendaMes: Math.round(v.vendaLiquida * (30 / dias)),
      itensDia: Math.round(itensDia),
      qtdeVendidaDia: Number(qtdeVendidaDia.toFixed(1)),
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
    d.operationalNeed = deriveOperationalNeed(d.setor, d.vendaDia, d.itensDia, d.qtdeVendidaDia, d.colaboradores);
    if (!d.colaboradores) {
      d.status = 'sem-equipe';
      d.statusLabel = 'Sem equipe cadastrada';
    } else if (d.operationalNeed && d.operationalNeed.volumeDia > 0) {
      d.status = d.operationalNeed.status;
      d.statusLabel = d.operationalNeed.statusLabel;
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
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const bounds = shiftStartEnd(shift);
  if (bounds) return Math.max(0, bounds.end - bounds.start - (bounds.end - bounds.start > 6 ? 1 : 0));
  return 0;
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

// ========== MODELO EXCLUSIVO DE REPOSIÇÃO ==========
// Repositores têm demanda INVERSA ao caixa: precisam repor gôndolas
// ANTES do pico de vendas e DEPOIS (ruptura). A cobertura deve ser
// contínua — sempre pelo menos 1 pessoa no salão.
//
// Curva de demanda de reposição (peso relativo por faixa horária):
//   06-08h: 1.5  (recebimento de mercadoria + preparação pré-abertura)
//   08-10h: 1.3  (reposição matinal, gôndolas vazias da noite anterior)
//   10-12h: 0.9  (manutenção de gôndola, vendas moderadas)
//   12-14h: 0.7  (menor fluxo, repositores podem almoçar)
//   14-16h: 1.1  (pós-almoço, reposição para pico da tarde)
//   16-18h: 1.4  (pré-pico da tarde/noite, ruptura aumenta)
//   18-20h: 1.0  (manutenção, reposição de perecíveis)
//   20-22h: 0.6  (encerramento, reposição noturna mínima)
//
// Princípio: escalonar horários de modo que a sobreposição de turnos
// coincida com as faixas de maior peso de reposição.

const REPLENISHMENT_DEMAND_CURVE = [
  { start: 5, end: 7, weight: 1.5 },   // pré-abertura / recebimento
  { start: 7, end: 9, weight: 1.4 },   // reposição matinal forte
  { start: 9, end: 11, weight: 1.0 },  // manutenção
  { start: 11, end: 13, weight: 0.7 }, // almoço — menor demanda
  { start: 13, end: 15, weight: 1.0 }, // retomada
  { start: 15, end: 17, weight: 1.3 }, // pré-pico tarde
  { start: 17, end: 19, weight: 1.1 }, // pico vendas → ruptura
  { start: 19, end: 22, weight: 0.6 }, // encerramento
];

function replenishmentWeight(hour) {
  for (const band of REPLENISHMENT_DEMAND_CURVE) {
    if (hour >= band.start && hour < band.end) return band.weight;
  }
  return 0.5;
}

function bestReplenishmentSlots(open, close, N, jornada) {
  const legalInterval = getLegalIntervalMinutes(jornada) / 60;
  const totalOcupacao = jornada + legalInterval;
  const snap = (h) => Math.round(h * 3) / 3; // arredondar para 20min

  // Gerar todos os slots possíveis (a cada 20min) e pontuá-los
  const candidates = [];
  for (let start = open; start + totalOcupacao <= close + 0.01; start += 1 / 3) {
    const s = snap(start);
    if (s + totalOcupacao > close + 0.01) continue;
    let score = 0;
    for (let h = s; h < s + totalOcupacao; h += 0.5) {
      if (h >= s && h < s + totalOcupacao) {
        score += replenishmentWeight(h);
      }
    }
    candidates.push({ start: s, score });
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);

  // Selecionar N slots que maximizem cobertura total (spread)
  // Estratégia gulosa: escolher o melhor, depois o mais distante com boa pontuação
  const selected = [];
  const storeSpan = close - open - totalOcupacao;
  const minGap = Math.max(1.5, storeSpan / N); // espalhar ao longo do dia

  // Primeiro: slot com melhor pontuação (tipicamente manhã cedo)
  selected.push(candidates[0]);

  for (let i = 1; i < N && candidates.length > 0; i++) {
    // Encontrar o candidato com melhor pontuação que respeita o gap mínimo
    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      const tooClose = selected.some(s => Math.abs(c.start - s.start) < minGap);
      if (tooClose) continue;
      // Bonus para spread: quanto mais longe dos já selecionados, melhor
      const avgDist = selected.reduce((sum, s) => sum + Math.abs(c.start - s.start), 0) / selected.length;
      const spreadScore = c.score + avgDist * 0.3;
      if (spreadScore > bestScore) {
        bestScore = spreadScore;
        best = c;
      }
    }
    if (best) selected.push(best);
    else {
      // Fallback: distribuição uniforme
      const uniformStart = snap(open + (i / N) * (close - open - totalOcupacao));
      selected.push({ start: uniformStart, score: 0 });
    }
  }

  selected.sort((a, b) => a.start - b.start);
  return selected;
}

function generateReplenishmentShift(open, close, idx, N, sexo, jornada = 8) {
  const legalInterval = getLegalIntervalMinutes(jornada) / 60;
  const snap20 = (h) => Math.round(h * 3) / 3;
  const maxCont = 5 + 40 / 60; // 5h40 — CLT art.71

  if (legalInterval === 0) {
    const faixa = Math.max(0, (close - open) - jornada);
    const start = snap20(open + (N > 1 ? idx / (N - 1) : 0.5) * faixa);
    return `${formatHM(start)}-${formatHM(start + jornada)} · ${formatDur(jornada)}`;
  }

  const slots = bestReplenishmentSlots(open, close, N, jornada);
  const slot = slots[Math.min(idx, slots.length - 1)] || { start: open };
  let manhaStart = slot.start;
  const intervalo = Math.max(legalInterval, 1);

  // Intervalo escalonado: cada repositor almoça em horário diferente.
  // Posicionar no meio da jornada individual, respeitando maxCont.
  let blocoManha = snap20(Math.min(maxCont, jornada / 2));
  if (blocoManha < 2) blocoManha = 2;
  let blocoTarde = snap20(jornada - blocoManha);
  if (blocoTarde < 2) { blocoTarde = 2; blocoManha = snap20(jornada - 2); }
  if (blocoManha > maxCont) blocoManha = snap20(maxCont);
  blocoTarde = snap20(jornada - blocoManha);

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
    tardeFim = Math.min(close, tardeStart + blocoTarde);
  }
  if (blocoTarde > maxCont) {
    blocoTarde = snap20(maxCont);
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
          let shiftStart, shiftEnd, explicitBreak = null;
          if (periodoRaw.includes('/')) {
            const blocks = periodoRaw.split('/');
            shiftStart = hmTextToMinutes(blocks[0].split('-')[0]);
            shiftEnd = hmTextToMinutes(blocks[blocks.length - 1].split('-')[1]);
            explicitBreak = hmTextToMinutes(blocks[0].split('-')[1]); // pausa real do turno
          } else {
            const [ini, fim] = periodoRaw.split('-').map(p => p.trim());
            shiftStart = hmTextToMinutes(ini);
            shiftEnd = hmTextToMinutes(fim);
          }
          if (shiftStart === null || shiftEnd === null) return null;

          const workedMin = Math.round(workedHours * 60);
          let breakStart = explicitBreak;
          if (breakStart === null) {
            // Mesma inferência do parseWorkedBlocks (turnos corridos sem pausa explícita)
            const beforeBase = Math.round((workedMin / 2) / 5) * 5;
            const minAntes = workedHours > 6 ? 180 : 120;
            const maxAntes = workedHours > 6 ? 340 : workedMin;
            const minDepois = 120;
            breakStart = shiftStart + Math.min(maxAntes, Math.max(minAntes, Math.min(beforeBase, workedMin - minDepois)));
          }
          const spanMin = workedMin + 60; // jornada + 1h de intervalo

          return { nome, shifts, dayIndex, shiftStart, breakStart, workedMin, spanMin, workedHours, origStart: shiftStart, origBreak: breakStart };
        })
        .filter(Boolean);

      if (!workers.length) return;

      // ===== SOLVER (busca local / coordinate descent) =====
      // Variáveis por operadora: (entrada, início do intervalo).
      // Custo: déficit de cobertura (alto) + deslocamento da escala original (baixo).
      // Restrições embutidas nos candidatos: blocos contínuos ≤ 5h40 (art. 71 c/ margem),
      // ≥2h trabalhadas antes e depois da pausa, turno dentro do expediente.
      const pdvs = Number(summary.storeConfig && summary.storeConfig.pdvs) || 99;
      const hourStarts = Object.keys(targets).map(h => Number(h.split('-')[0])).sort((a, b) => a - b);
      if (!hourStarts.length) return;
      const openMin = hourStarts[0] * 60;
      const closeMin = (hourStarts[hourStarts.length - 1] + 1) * 60;
      const labelOf = (h) => `${String(h).padStart(2, '0')}-${String(h + 1).padStart(2, '0')}`;

      // Presença na hora h (mesma regra do countWorkersAtHour: qualquer sobreposição)
      const presence = (start, breakStart, spanMin, h) => {
        const fs = h * 60, fe = fs + 60;
        const b1e = breakStart, b2s = breakStart + 60, end = start + spanMin;
        return (start < fe && b1e > fs) || (b2s < fe && end > fs);
      };

      // Contagem fixa = total atual − contribuição dos workers móveis na posição original
      const staticCount = {};
      hourStarts.forEach(h => {
        const total = countWorkersAtHour(h, h + 1, dayIndex, people);
        const dyn = workers.reduce((s, w) => s + (presence(w.shiftStart, w.breakStart, w.spanMin, h) ? 1 : 0), 0);
        staticCount[h] = total - dyn;
      });

      const solutionCost = () => {
        let cost = 0;
        hourStarts.forEach(h => {
          let count = staticCount[h];
          workers.forEach(w => { if (presence(w.shiftStart, w.breakStart, w.spanMin, h)) count++; });
          const deficit = Math.max(0, (targets[labelOf(h)] || 0) - Math.min(count, pdvs));
          cost += deficit * 100;
        });
        workers.forEach(w => {
          cost += Math.abs(w.shiftStart - w.origStart) / 60       // mexer na entrada custa
                + Math.abs(w.breakStart - w.origBreak) / 600;     // mexer na pausa custa menos
        });
        return cost;
      };

      const candidatesFor = (w) => {
        const list = [];
        for (let ds = -240; ds <= 240; ds += 30) {
          const start = w.origStart + ds;
          if (start < openMin || start + w.spanMin > closeMin) continue;
          // Janela legal da pausa p/ esta entrada (blocos ≤340min, ≥120min em cada ponta)
          const lo = start + Math.max(120, w.workedMin - 340);
          const hi = start + Math.min(340, w.workedMin - 120);
          if (lo > hi) continue;
          for (let bs = Math.ceil(lo / 60) * 60; bs <= hi; bs += 60) {
            list.push({ start, bs });
          }
          // fallback: pausa não alinhada à hora, se nenhuma alinhada coube
          if (Math.ceil(lo / 60) * 60 > hi) list.push({ start, bs: Math.round(((lo + hi) / 2) / 5) * 5 });
        }
        return list;
      };

      for (let pass = 0; pass < 8; pass++) {
        let improved = false;
        for (const w of workers) {
          const savedStart = w.shiftStart, savedBreak = w.breakStart;
          let bestCost = solutionCost();
          let best = { start: savedStart, bs: savedBreak };
          for (const cand of candidatesFor(w)) {
            w.shiftStart = cand.start;
            w.breakStart = cand.bs;
            const c = solutionCost();
            if (c < bestCost - 1e-9) { bestCost = c; best = cand; }
          }
          w.shiftStart = best.start;
          w.breakStart = best.bs;
          if (best.start !== savedStart || best.bs !== savedBreak) improved = true;
        }
        if (!improved) break;
      }

      // Grava os turnos otimizados de volta na escala
      workers.forEach(w => {
        const end = w.shiftStart + w.spanMin;
        w.shifts[w.dayIndex] = `${formatHM(w.shiftStart / 60)}-${formatHM(w.breakStart / 60)}/${formatHM((w.breakStart + 60) / 60)}-${formatHM(end / 60)} · ${formatDur(w.workedHours)}`;
      });
    });
  });
}

function generateScheduleByProfile(profile, employees, targetHours = 44, targetDaysOff = 1, pesosDia = null, demandCurve = null) {
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

  // --- Demanda horária por dia (dailyCoverage) ---
  const _dkMap = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const demandByDay = {};
  if (demandCurve) {
    _dkMap.forEach((dk, di) => {
      const dayData = demandCurve[dk];
      if (!dayData || !Array.isArray(dayData.rows)) return;
      demandByDay[di] = {};
      dayData.rows.forEach(row => {
        demandByDay[di][row.hora] = Number(row.demanda || 0);
      });
    });
  }
  const placedByDayHour = {};

  function recordPlacement(dayIndex, startH, endH) {
    if (!placedByDayHour[dayIndex]) placedByDayHour[dayIndex] = {};
    for (let h = Math.floor(startH); h < Math.ceil(endH); h++) {
      const bucket = `${String(h).padStart(2,'0')}-${String(h+1).padStart(2,'0')}`;
      placedByDayHour[dayIndex][bucket] = (placedByDayHour[dayIndex][bucket] || 0) + 1;
    }
  }

  function bestDemandStart(dayIndex, open, close, jornada) {
    const demand = demandByDay[dayIndex];
    if (!demand) return null;
    const placed = placedByDayHour[dayIndex] || {};
    let bestStart = null;
    let bestScore = -1;
    for (let s = open; s <= close - jornada + 0.01; s += 0.5) {
      let score = 0;
      for (let h = Math.floor(s); h < Math.ceil(s + jornada); h++) {
        const bucket = `${String(h).padStart(2,'0')}-${String(h+1).padStart(2,'0')}`;
        const d = demand[bucket] || 0;
        const p = placed[bucket] || 0;
        if (p < d) score += (d - p);
      }
      if (score > bestScore) { bestScore = score; bestStart = s; }
    }
    return bestStart;
  }

  // Calcula início do turno conforme preferência + curva de demanda.
  function startForTurno(turno, open, close, idx, jornada = shiftHours, dayIndex = -1) {
    const span = Math.max(0, close - jornada - open);
    const lateStart = open + span;
    switch (turno) {
      case 'abertura': return open;
      case 'fechamento': return lateStart;
      case 'central':
      case 'intermediario': return open + Math.round(span / 2);
      default: {
        if (dayIndex >= 0) {
          const ds = bestDemandStart(dayIndex, open, close, jornada);
          if (ds !== null) return ds;
        }
        return open + Math.round((N > 1 ? idx / (N - 1) : 0) * span);
      }
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

    // CLT Art.71: jornada > 6h → intervalo obrigatório de 1h.
    // breakForShift calcula o horário do intervalo escalonado por idx.
    function breakForShift(start, end, jd) {
      if (jd <= 6) return undefined;
      const maxCont = 5 + 40 / 60; // 5h40 (buffer de 20min antes do limite CLT de 6h)
      const earliest = start + 3; // mínimo 3h trabalhadas antes do intervalo
      const latest = start + maxCont; // máximo 5h40 antes do intervalo
      const slot = earliest + ((idx % Math.max(1, N)) / Math.max(1, N)) * (latest - earliest);
      return Math.round(slot * 4) / 4; // arredonda p/ 15min
    }

    function gerarTurnoDia(day) {
      const loja = lojaDoDia(day);
      const jd = jornadaPorDia[day] || shiftHours;
      if (reposicao) {
        return generateReplenishmentShift(loja.open, loja.close, idx, N, sexo, jd);
      }
      if (comercial) return generateComercialShift(loja.open, loja.close, jd);
      // Pico: calcular entrada e intervalo juntos. Regras:
      // (1) max 5h40 contínuas antes do intervalo (6h CLT - 20min buffer)
      // (2) no máximo 1 pessoa em intervalo por vez
      // (3) intervalos só começam após a fechadora chegar
      function peakShift() {
        const mi = peakMorningWorkers.indexOf(idx);
        if (mi < 0) return null;
        const closerStart = Math.max(loja.open, loja.close - jd);
        const maxCont = 5 + 40 / 60;
        const breakAt = closerStart + mi;
        const start = Math.max(loja.open, Math.round((breakAt - maxCont) * 2) / 2);
        const end = Math.min(loja.close, start + jd);
        return { start, end, breakAt: Math.round(breakAt * 4) / 4 };
      }

      // generateOperatorShift com break estende o shiftEnd em +1h (intervalo).
      // Para garantir que o trabalhador saia no horário correto, o endHour
      // passado deve ser (fim desejado - 1h) quando há intervalo.
      function shiftWithBreak(start, desiredEnd, jdLocal) {
        const brk = breakForShift(start, desiredEnd, jdLocal);
        if (brk !== undefined) {
          const workEnd = desiredEnd - 1;
          return generateOperatorShift(start, workEnd, brk);
        }
        return generateOperatorShift(start, desiredEnd);
      }

      if (ehFechador) {
        if (isPeakDay(day) && idxFechadores.length > 1 && idx !== idxFechadorPrimario) {
          const ps = peakShift();
          if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
          return shiftWithBreak(loja.open, Math.min(loja.close, loja.open + jd + (jd > 6 ? 1 : 0)), jd);
        }
        const totalPresence = jd + (jd > 6 ? 1 : 0);
        const fStart = Math.max(loja.open, loja.close - totalPresence);
        return shiftWithBreak(fStart, loja.close, jd);
      }
      if (ehAbridor) {
        if (isPeakDay(day)) {
          const ps = peakShift();
          if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
        }
        const totalPresence = jd + (jd > 6 ? 1 : 0);
        const aEnd = Math.min(loja.close, loja.open + totalPresence);
        return shiftWithBreak(loja.open, aEnd, jd);
      }
      if (isPeakDay(day)) {
        const ps = peakShift();
        if (ps) return generateOperatorShift(ps.start, ps.end, ps.breakAt);
        const start = loja.open;
        const totalPresence = jd + (jd > 6 ? 1 : 0);
        const end = Math.min(loja.close, start + totalPresence);
        return shiftWithBreak(start, end, jd);
      }
      const start = startForTurno(turno, loja.open, loja.close, idx, jd, day);
      const totalPresence = jd + (jd > 6 ? 1 : 0);
      const end = Math.min(loja.close, start + totalPresence);
      return shiftWithBreak(start, end, jd);
    }

    // Monta a semana priorizando sáb (5) > sex (4) > restante,
    // garantindo que nos dias de pico o turno seja gerado primeiro.
    const shifts = new Array(7).fill(null);
    const ordemPrioridade = [5, 4, 0, 1, 2, 3, 6]; // sáb, sex, seg-qui, dom
    for (const day of ordemPrioridade) {
      shifts[day] = diasTrabalho.includes(day) ? gerarTurnoDia(day) : 'Folga';
    }
    // Registrar horas alocadas para que o próximo colaborador veja a demanda atualizada
    shifts.forEach((shift, di) => {
      if (!shift || shift === 'Folga') return;
      const blocks = parseWorkedBlocks(shift);
      blocks.forEach(b => recordPlacement(di, b.start / 60, b.end / 60));
    });
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
function generateGroupedSchedule(profile, employees, targetHours = 44, targetDaysOff = 1, pesosDia = null, demandCurve = null) {
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
    const groupKey = scheduleGroupKey(grupo[0]);
    const curve = (groupKey === 'frente de caixa') ? demandCurve : null;
    const escalaGrupo = generateScheduleByProfile(profile, grupoComCobertura, targetHours, targetDaysOff, pesosDia, curve);
    Object.assign(merged, escalaGrupo);
  });
  return merged;
}

const PROFICIENCY_SCORE = { iniciante: 1, pleno: 2, senior: 3, lider: 4 };
const ROLE_WEIGHT = { abertura: 6, intermediario: 3, central: 3, sustentacao: 3, fechamento: 7 };

function normalizeRestrictionList(emp) {
  return (Array.isArray(emp?.restricoes) ? emp.restricoes : [])
    .map((item) => normalizeSetor(String(item || '')))
    .filter(Boolean);
}

function restrictionHas(emp, ...terms) {
  const restrictions = normalizeRestrictionList(emp);
  return terms.some((term) => restrictions.includes(normalizeSetor(term)));
}

function canEmployeeWorkRole(emp, role) {
  if (role === 'fechamento' && restrictionHas(emp, 'noturno', 'noite', 'fechamento')) return false;
  if (role === 'abertura' && restrictionHas(emp, 'abertura', 'manha', 'manhã')) return false;
  if (role === 'intermediario' && restrictionHas(emp, 'intermediario', 'intermediário', 'central')) return false;
  return true;
}

function canEmployeeWorkSunday(emp) {
  if (emp?.podeDomingo === false) return false;
  if (restrictionHas(emp, 'domingo')) return false;
  return true;
}

function employeeSectorFit(emp, groupKey) {
  const normalizedGroup = normalizeSetor(groupKey);
  if (normalizedGroup === 'frente de caixa') return isOperadorCaixa(emp);
  const aptos = Array.isArray(emp?.setoresAptos) && emp.setoresAptos.length
    ? emp.setoresAptos.map((item) => normalizeSetor(item))
    : [normalizeSetor(empSetorOperacional(emp) || emp.setor || '')];
  return aptos.includes(normalizedGroup);
}

function employeeRolePreferenceScore(emp, role) {
  const pref = String(emp?.preferenciaTurno || emp?.turno || 'flexivel').toLowerCase();
  const papel = String(emp?.papelOperacional || 'auto').toLowerCase();
  let score = 0;
  if (pref === role) score += 12;
  else if (pref !== 'flexivel' && pref !== role) score -= 4;
  if (papel === role) score += 14;
  else if (papel !== 'auto' && papel !== role) score -= 3;
  return score;
}

function employeeRoleScore(emp, groupKey, role) {
  const prof = PROFICIENCY_SCORE[String(emp?.proficiencia || 'pleno').toLowerCase()] || 2;
  const setorFit = employeeSectorFit(emp, groupKey);
  let score = setorFit ? 40 : -1000;
  if (!canEmployeeWorkRole(emp, role)) score -= 1000;
  score += prof * (ROLE_WEIGHT[role] || 2);
  score += employeeRolePreferenceScore(emp, role);
  if (String(emp?.turno || '').toLowerCase() === role) score += 6;
  if (role === 'fechamento' && canEmployeeWorkSunday(emp)) score += 2;
  if (role === 'abertura' && !restrictionHas(emp, 'sabado', 'sábado')) score += 1;
  return score;
}

function buildNominalCoverageRoles(groupKey, employees) {
  const prepared = (employees || []).map((emp, index) => ({ ...emp, _sortIndex: index }));
  if (prepared.length <= 1) {
    return prepared.map((emp) => ({ ...emp, _coverageRole: 'central' }));
  }

  const half = Math.floor(prepared.length / 2);
  const explicit = { abertura: [], fechamento: [], intermediario: [] };
  const autoCandidates = [];

  prepared.forEach((emp) => {
    const turno = String(emp.turno || 'flexivel').toLowerCase();
    if (['abertura', 'fechamento', 'intermediario'].includes(turno) && canEmployeeWorkRole(emp, turno)) {
      explicit[turno].push(emp);
    } else {
      autoCandidates.push(emp);
    }
  });

  const result = [];
  const used = new Set();
  const pushRole = (emp, role) => {
    if (!emp || used.has(emp.nome)) return;
    used.add(emp.nome);
    result.push({ ...emp, _coverageRole: role });
  };
  explicit.abertura.forEach((emp) => pushRole(emp, 'abertura'));
  explicit.fechamento.forEach((emp) => pushRole(emp, 'fechamento'));
  explicit.intermediario.forEach((emp) => pushRole(emp, 'intermediario'));

  const pickBest = (role) => {
    const ranked = autoCandidates
      .filter((emp) => !used.has(emp.nome))
      .map((emp) => ({ emp, score: employeeRoleScore(emp, groupKey, role) }))
      .sort((a, b) => b.score - a.score || a.emp._sortIndex - b.emp._sortIndex);
    return ranked.length ? ranked[0].emp : null;
  };

  while (result.filter((emp) => emp._coverageRole === 'abertura').length < half) {
    const best = pickBest('abertura');
    if (!best) break;
    pushRole(best, 'abertura');
  }
  while (result.filter((emp) => emp._coverageRole === 'fechamento').length < half) {
    const best = pickBest('fechamento');
    if (!best) break;
    pushRole(best, 'fechamento');
  }

  autoCandidates
    .filter((emp) => !used.has(emp.nome))
    .sort((a, b) => {
      const diff = employeeRoleScore(b, groupKey, 'intermediario') - employeeRoleScore(a, groupKey, 'intermediario');
      return diff || a._sortIndex - b._sortIndex;
    })
    .forEach((emp) => pushRole(emp, 'intermediario'));

  return result.sort((a, b) => {
    const roleOrder = { abertura: 0, intermediario: 1, central: 1, fechamento: 2 };
    const diff = (roleOrder[a._coverageRole] ?? 1) - (roleOrder[b._coverageRole] ?? 1);
    if (diff !== 0) return diff;
    const scoreA = employeeRoleScore(a, groupKey, a._coverageRole);
    const scoreB = employeeRoleScore(b, groupKey, b._coverageRole);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a._sortIndex - b._sortIndex;
  });
}

function inferRoleFromShift(shift, loja, fallback = 'sustentacao') {
  if (!shift || shift === 'Folga') return 'folga';
  const bounds = shiftStartEnd(shift);
  if (!bounds || !loja) return fallback;
  const abre = bounds.start <= loja.open;
  const fecha = bounds.end >= loja.close;
  if (abre && fecha) return 'abertura-fechamento';
  if (abre) return 'abertura';
  if (fecha) return 'fechamento';
  return fallback === 'central' ? 'sustentacao' : fallback;
}

function computeGroupHourSpread(people, names) {
  const totals = names.map((name) => (people[name] || []).reduce((sum, shift) => sum + shiftWorkedHours(shift), 0));
  if (!totals.length) return 0;
  return Math.max(...totals) - Math.min(...totals);
}

function buildRoleJustification(emp, role, groupKey, stats = {}) {
  const refs = [];
  if (employeeSectorFit(emp, groupKey)) refs.push(`apto para ${groupKey}`);
  if (emp?.proficiencia) refs.push(`proficiência ${emp.proficiencia}`);
  if (emp?.preferenciaTurno && emp.preferenciaTurno !== 'flexivel') refs.push(`preferência ${emp.preferenciaTurno}`);
  if (emp?.papelOperacional && emp.papelOperacional !== 'auto') refs.push(`papel ${emp.papelOperacional}`);
  if (Array.isArray(emp?.restricoes) && emp.restricoes.length) refs.push(`restrições respeitadas: ${emp.restricoes.join(', ')}`);
  if (stats.hoursDiffLabel) refs.push(`dispersão do grupo ${stats.hoursDiffLabel}`);
  const roleLabel = role === 'abertura-fechamento' ? 'abertura e fechamento' : role;
  return `Alocado em ${roleLabel} no grupo ${groupKey} por aderência de perfil${refs.length ? ` (${refs.join(' · ')})` : ''}.`;
}

function buildRoleAssignmentQuality(people, groupEmployees, groupKey, lojas) {
  const byName = Object.fromEntries((groupEmployees || []).map((emp) => [emp.nome, emp]));
  let total = 0;
  let ponta = 0;
  Object.entries(people || {}).forEach(([nome, shifts]) => {
    const emp = byName[nome];
    if (!emp) return;
    (shifts || []).forEach((shift, dayIndex) => {
      if (!shift || shift === 'Folga') return;
      const role = inferRoleFromShift(shift, lojas[dayIndex], emp._coverageRole || 'sustentacao');
      const score = employeeRoleScore(emp, groupKey, role);
      total += score;
      if (role === 'abertura' || role === 'fechamento' || role === 'abertura-fechamento') {
        ponta += score;
      }
    });
  });
  return { total, ponta };
}

function clonePeopleMap(people) {
  return Object.fromEntries(Object.entries(people || {}).map(([name, shifts]) => [name, Array.isArray(shifts) ? [...shifts] : []]));
}

function isWorkingAtHour(shift, hour) {
  const bounds = shiftStartEnd(shift);
  if (!bounds) return false;
  return hour >= bounds.start && hour < bounds.end;
}

function hourlyCoverageUnchanged(baselinePeople, candidatePeople, names, dayIndex) {
  for (let h = 5; h <= 23; h++) {
    let baseCov = 0, candCov = 0;
    for (let n = 0; n < names.length; n++) {
      if (isWorkingAtHour(baselinePeople[names[n]]?.[dayIndex], h)) baseCov++;
      if (isWorkingAtHour(candidatePeople[names[n]]?.[dayIndex], h)) candCov++;
    }
    if (candCov < baseCov) return false;
  }
  return true;
}

function shiftSlotPriority(shift, dayIndex, lojas) {
  if (!shift || shift === 'Folga') return dayIndex === 6 ? 0.5 : 0;
  const role = inferRoleFromShift(shift, lojas[dayIndex], 'sustentacao');
  if (role === 'abertura-fechamento') return 10;
  if (role === 'fechamento') return 9;
  if (role === 'abertura') return 8;
  if (role === 'sustentacao' || role === 'intermediario') return 4;
  return 2;
}

function scoreEmployeeShiftForGroup(emp, shift, dayIndex, lojas, groupKey) {
  if (!shift || shift === 'Folga') {
    if (dayIndex === 6 && !canEmployeeWorkSunday(emp)) return 4;
    return 0;
  }
  if (dayIndex === 6 && !canEmployeeWorkSunday(emp)) return -1000;
  const role = inferRoleFromShift(shift, lojas[dayIndex], emp._coverageRole || emp.papelOperacional || 'sustentacao');
  return employeeRoleScore(emp, groupKey, role);
}

function buildGroupMetrics(people, groupEmployees, groupKey, lojas) {
  const names = groupEmployees.map((emp) => emp.nome);
  const complianceCount = checkComplianceCLT(people).length;
  const spread = computeGroupHourSpread(people, names);
  const quality = buildRoleAssignmentQuality(people, groupEmployees, groupKey, lojas);
  return { complianceCount, spread, quality };
}

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

function optimizeWeeklyTemplateAssignments(groupKey, groupEmployees, baselineGroupPeople, lojas) {
  const templates = (groupEmployees || []).map((emp, index) => ({
    sourceName: emp.nome,
    shifts: baselineGroupPeople?.[emp.nome] || [],
    sortIndex: index,
    priority: (baselineGroupPeople?.[emp.nome] || []).reduce((sum, shift, dayIndex) => sum + shiftSlotPriority(shift, dayIndex, lojas), 0)
  }));
  const remaining = [...(groupEmployees || [])];
  const assigned = {};

  templates
    .sort((a, b) => b.priority - a.priority || a.sortIndex - b.sortIndex)
    .forEach((template) => {
      const ranked = remaining
        .map((emp, index) => ({
          emp,
          index,
          score: (template.shifts || []).reduce((sum, shift, dayIndex) => (
            sum + scoreEmployeeShiftForGroup(emp, shift, dayIndex, lojas, groupKey)
          ), 0)
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const best = ranked[0];
      if (!best) return;
      assigned[best.emp.nome] = [...template.shifts];
      remaining.splice(best.index, 1);
    });

  return assigned;
}

function optimizeSingleDayAssignments(groupKey, groupEmployees, people, dayIndex, lojas, baselineMetrics) {
  const current = clonePeopleMap(people);
  const slots = groupEmployees
    .map((emp, index) => ({
      sourceName: emp.nome,
      shift: current[emp.nome]?.[dayIndex] || 'Folga',
      sortIndex: index,
      priority: shiftSlotPriority(current[emp.nome]?.[dayIndex] || 'Folga', dayIndex, lojas)
    }))
    .sort((a, b) => b.priority - a.priority || a.sortIndex - b.sortIndex);
  const remaining = [...groupEmployees];
  const dayAssignment = {};

  slots.forEach((slot) => {
    const ranked = remaining
      .map((emp, index) => ({
        emp,
        index,
        score: scoreEmployeeShiftForGroup(emp, slot.shift, dayIndex, lojas, groupKey)
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const best = ranked[0];
    if (!best) return;
    dayAssignment[best.emp.nome] = slot.shift;
    remaining.splice(best.index, 1);
  });

  Object.entries(dayAssignment).forEach(([name, shift]) => {
    current[name][dayIndex] = shift;
  });

  const candidateMetrics = buildGroupMetrics(current, groupEmployees, groupKey, lojas);
  return isBetterGroupCandidate(candidateMetrics, baselineMetrics)
    ? { people: current, metrics: candidateMetrics }
    : null;
}

function tryPairSwaps(groupKey, groupEmployees, people, lojas, baselineMetrics) {
  const names = groupEmployees.map((emp) => emp.nome);
  const byName = Object.fromEntries(groupEmployees.map((emp) => [emp.nome, emp]));
  const baselineCovRef = clonePeopleMap(people);
  let current = clonePeopleMap(people);
  let currentMetrics = buildGroupMetrics(current, groupEmployees, groupKey, lojas);

  for (let pass = 0; pass < 6; pass += 1) {
    let improved = false;

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
          const leftName = names[i];
          const rightName = names[j];
          const leftShift = current[leftName]?.[dayIndex] || 'Folga';
          const rightShift = current[rightName]?.[dayIndex] || 'Folga';
          if (leftShift === rightShift) continue;

          const leftEmp = byName[leftName];
          const rightEmp = byName[rightName];
          const currentScore =
            scoreEmployeeShiftForGroup(leftEmp, leftShift, dayIndex, lojas, groupKey) +
            scoreEmployeeShiftForGroup(rightEmp, rightShift, dayIndex, lojas, groupKey);
          const swappedScore =
            scoreEmployeeShiftForGroup(leftEmp, rightShift, dayIndex, lojas, groupKey) +
            scoreEmployeeShiftForGroup(rightEmp, leftShift, dayIndex, lojas, groupKey);
          if (swappedScore <= currentScore) continue;

          const candidate = clonePeopleMap(current);
          candidate[leftName][dayIndex] = rightShift;
          candidate[rightName][dayIndex] = leftShift;

          if (!hourlyCoverageUnchanged(baselineCovRef, candidate, names, dayIndex)) continue;

          const candidateMetrics = buildGroupMetrics(candidate, groupEmployees, groupKey, lojas);
          if (!isBetterGroupCandidate(candidateMetrics, baselineMetrics)) continue;
          if (!isBetterGroupCandidate(candidateMetrics, currentMetrics)) continue;
          current = candidate;
          currentMetrics = candidateMetrics;
          improved = true;
        }
      }
    }

    // Cross-day rest swap: trocar dia de folga entre dois colaboradores
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const nameA = names[i], nameB = names[j];
        const folgaA = (current[nameA] || []).findIndex(s => s === 'Folga');
        const folgaB = (current[nameB] || []).findIndex(s => s === 'Folga');
        if (folgaA < 0 || folgaB < 0 || folgaA === folgaB) continue;

        const shiftAatFolgaB = current[nameA]?.[folgaB];
        const shiftBatFolgaA = current[nameB]?.[folgaA];
        if (!shiftAatFolgaB || shiftAatFolgaB === 'Folga') continue;
        if (!shiftBatFolgaA || shiftBatFolgaA === 'Folga') continue;

        const oldScore =
          scoreEmployeeShiftForGroup(byName[nameA], shiftAatFolgaB, folgaB, lojas, groupKey) +
          scoreEmployeeShiftForGroup(byName[nameB], shiftBatFolgaA, folgaA, lojas, groupKey);
        const newScore =
          scoreEmployeeShiftForGroup(byName[nameA], shiftBatFolgaA, folgaA, lojas, groupKey) +
          scoreEmployeeShiftForGroup(byName[nameB], shiftAatFolgaB, folgaB, lojas, groupKey);
        if (newScore <= oldScore) continue;

        const candidate = clonePeopleMap(current);
        candidate[nameA][folgaA] = shiftBatFolgaA;
        candidate[nameA][folgaB] = 'Folga';
        candidate[nameB][folgaA] = 'Folga';
        candidate[nameB][folgaB] = shiftAatFolgaB;

        if (!hourlyCoverageUnchanged(baselineCovRef, candidate, names, folgaA)) continue;
        if (!hourlyCoverageUnchanged(baselineCovRef, candidate, names, folgaB)) continue;

        const candidateMetrics = buildGroupMetrics(candidate, groupEmployees, groupKey, lojas);
        if (!isBetterGroupCandidate(candidateMetrics, baselineMetrics)) continue;
        if (!isBetterGroupCandidate(candidateMetrics, currentMetrics)) continue;
        current = candidate;
        currentMetrics = candidateMetrics;
        improved = true;
      }
    }

    if (!improved) break;
  }

  return current;
}

function tryThreeCycles(groupKey, groupEmployees, people, lojas, baselineMetrics) {
  const names = groupEmployees.map((emp) => emp.nome);
  const byName = Object.fromEntries(groupEmployees.map((emp) => [emp.nome, emp]));
  const baselineCovRef = clonePeopleMap(people);
  let current = clonePeopleMap(people);
  let currentMetrics = buildGroupMetrics(current, groupEmployees, groupKey, lojas);

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const working = names.filter(n => current[n]?.[dayIndex] && current[n][dayIndex] !== 'Folga');
    if (working.length < 3) continue;

    for (let i = 0; i < working.length; i += 1) {
      for (let j = i + 1; j < working.length; j += 1) {
        for (let k = j + 1; k < working.length; k += 1) {
          const a = working[i], b = working[j], c = working[k];
          const shiftA = current[a][dayIndex];
          const shiftB = current[b][dayIndex];
          const shiftC = current[c][dayIndex];

          const currentScore =
            scoreEmployeeShiftForGroup(byName[a], shiftA, dayIndex, lojas, groupKey) +
            scoreEmployeeShiftForGroup(byName[b], shiftB, dayIndex, lojas, groupKey) +
            scoreEmployeeShiftForGroup(byName[c], shiftC, dayIndex, lojas, groupKey);

          // Try both rotation directions: A→B→C→A and A→C→B→A
          const rotations = [
            [shiftB, shiftC, shiftA],
            [shiftC, shiftA, shiftB]
          ];

          for (const [rA, rB, rC] of rotations) {
            const rotatedScore =
              scoreEmployeeShiftForGroup(byName[a], rA, dayIndex, lojas, groupKey) +
              scoreEmployeeShiftForGroup(byName[b], rB, dayIndex, lojas, groupKey) +
              scoreEmployeeShiftForGroup(byName[c], rC, dayIndex, lojas, groupKey);
            if (rotatedScore <= currentScore) continue;

            const candidate = clonePeopleMap(current);
            candidate[a][dayIndex] = rA;
            candidate[b][dayIndex] = rB;
            candidate[c][dayIndex] = rC;

            if (!hourlyCoverageUnchanged(baselineCovRef, candidate, names, dayIndex)) continue;

            const candidateMetrics = buildGroupMetrics(candidate, groupEmployees, groupKey, lojas);
            if (!isBetterGroupCandidate(candidateMetrics, baselineMetrics)) continue;
            if (!isBetterGroupCandidate(candidateMetrics, currentMetrics)) continue;
            current = candidate;
            currentMetrics = candidateMetrics;
          }
        }
      }
    }
  }

  return current;
}

function optimizeCoverageConstrainedAssignments(groupKey, groupEmployees, baselineGroupPeople, lojas) {
  const baselineMetrics = buildGroupMetrics(baselineGroupPeople, groupEmployees, groupKey, lojas);
  let current = clonePeopleMap(baselineGroupPeople);
  let currentMetrics = baselineMetrics;

  const weeklyCandidate = optimizeWeeklyTemplateAssignments(groupKey, groupEmployees, baselineGroupPeople, lojas);
  const weeklyMetrics = buildGroupMetrics(weeklyCandidate, groupEmployees, groupKey, lojas);
  if (isBetterGroupCandidate(weeklyMetrics, baselineMetrics)) {
    current = weeklyCandidate;
    currentMetrics = weeklyMetrics;
  }

  for (let pass = 0; pass < 4; pass += 1) {
    let improved = false;
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const candidate = optimizeSingleDayAssignments(groupKey, groupEmployees, current, dayIndex, lojas, baselineMetrics);
      if (candidate && isBetterGroupCandidate(candidate.metrics, currentMetrics)) {
        current = candidate.people;
        currentMetrics = candidate.metrics;
        improved = true;
      }
    }
    const pairOptimized = tryPairSwaps(groupKey, groupEmployees, current, lojas, baselineMetrics);
    const pairMetrics = buildGroupMetrics(pairOptimized, groupEmployees, groupKey, lojas);
    if (isBetterGroupCandidate(pairMetrics, currentMetrics)) {
      current = pairOptimized;
      currentMetrics = pairMetrics;
      improved = true;
    }
    const cycleOptimized = tryThreeCycles(groupKey, groupEmployees, current, lojas, baselineMetrics);
    const cycleMetrics = buildGroupMetrics(cycleOptimized, groupEmployees, groupKey, lojas);
    if (isBetterGroupCandidate(cycleMetrics, currentMetrics)) {
      current = cycleOptimized;
      currentMetrics = cycleMetrics;
      improved = true;
    }
    if (!improved) break;
  }

  return current;
}

function summarizeProfileFit(profile, employees, people) {
  const lojaSegSex = parseStoreHours(profile.horarioSegSex);
  const lojaSabado = parseStoreHours(profile.horarioSabado);
  const lojaDomingo = sundayIsClosed(profile) ? null : parseStoreHours(profile.horarioDomingo);
  const lojas = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSabado, lojaDomingo];
  const groups = {};
  (employees || []).forEach((emp) => {
    const key = scheduleGroupKey(emp);
    groups[key] = groups[key] || [];
    groups[key].push(emp);
  });
  return Object.entries(groups).reduce((acc, [groupKey, groupEmployees]) => {
    const groupFit = buildRoleAssignmentQuality(people, groupEmployees, groupKey, lojas);
    acc.total += groupFit.total;
    acc.ponta += groupFit.ponta;
    return acc;
  }, { total: 0, ponta: 0 });
}

function buildPeoplePresentation(peopleMap, employees, lojas) {
  const byName = Object.fromEntries((employees || []).map((emp) => [emp.nome, emp]));
  const groups = {};
  (employees || []).forEach((emp) => {
    const key = scheduleGroupKey(emp);
    groups[key] = groups[key] || [];
    groups[key].push(emp);
  });

  const roles = {};
  const justifications = {};
  Object.entries(groups).forEach(([groupKey, groupEmployees]) => {
    const groupSpread = computeGroupHourSpread(peopleMap, groupEmployees.map((worker) => worker.nome));
    groupEmployees.forEach((emp) => {
      const shifts = peopleMap[emp.nome] || [];
      roles[emp.nome] = shifts.map((shift, dayIndex) => inferRoleFromShift(shift, lojas[dayIndex], emp._coverageRole || emp.papelOperacional || 'sustentacao'));
      justifications[emp.nome] = shifts.map((shift, dayIndex) => (
        shift === 'Folga'
          ? 'Folga planejada para cumprir descanso semanal e preservar equilíbrio da equipe.'
          : buildRoleJustification(emp, roles[emp.nome][dayIndex], groupKey, { hoursDiffLabel: `${Number(groupSpread.toFixed(2)).toLocaleString('pt-BR')}h` })
      ));
    });
  });
  return { roles, justifications };
}

function buildEscalaNominal(profile, employees, targetHours = 44, targetDaysOff = 1, pesosDia = null, basePeople = null, coverageSummary = null, mode = 'hybrid') {
  const demandCurve = coverageSummary?.dailyCoverage || null;
  const baselinePeople = basePeople || generateGroupedSchedule(profile, employees, targetHours, targetDaysOff, pesosDia, demandCurve);
  const lojaSegSex = parseStoreHours(profile.horarioSegSex);
  const lojaSabado = parseStoreHours(profile.horarioSabado);
  const lojaDomingo = sundayIsClosed(profile) ? null : parseStoreHours(profile.horarioDomingo);
  const lojas = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSabado, lojaDomingo];
  const byName = Object.fromEntries((employees || []).map((emp) => [emp.nome, emp]));
  const groups = {};
  (employees || []).forEach((emp) => {
    const key = scheduleGroupKey(emp);
    groups[key] = groups[key] || [];
    groups[key].push(emp);
  });

  const people = {};
  const roles = {};
  const justifications = {};
  const optimizedBaselinePeople = {};
  const diagnostics = { groups: {}, baselineCompliance: [], candidateCompliance: [], selected: 'nominal' };

  Object.entries(groups).forEach(([groupKey, groupEmployees]) => {
    const baselineGroupPeople = Object.fromEntries(groupEmployees.map((emp) => [emp.nome, baselinePeople[emp.nome] || []]));
    const baselineCompliance = checkComplianceCLT(baselineGroupPeople);
    const baselineSpread = computeGroupHourSpread(baselineGroupPeople, groupEmployees.map((emp) => emp.nome));
    const baselinePrepared = groupEmployees.map((emp, index) => ({ ...emp, _sortIndex: index }));
    const baselineQuality = buildRoleAssignmentQuality(baselineGroupPeople, baselinePrepared, groupKey, lojas);
    const baselineMetrics = {
      complianceCount: baselineCompliance.length,
      spread: baselineSpread,
      quality: baselineQuality
    };
    const roleVariants = buildCoverageRoleVariants(groupEmployees, 9);

    let bestCandidateGroupPeople = baselineGroupPeople;
    let bestCandidateMetrics = baselineMetrics;
    let bestVariantIndex = -1;

    roleVariants.forEach((variantEmployees, variantIndex) => {
      const validSectorFit = variantEmployees.every((emp) => employeeSectorFit(emp, groupKey));
      const validRestrictions = variantEmployees.every((emp) => canEmployeeWorkRole(emp, emp._coverageRole || 'intermediario'));
      if (!validSectorFit || !validRestrictions) return;

      const variantCurve = (groupKey === 'frente de caixa') ? demandCurve : null;
      const variantSeedPeople = generateScheduleByProfile(profile, variantEmployees, targetHours, targetDaysOff, pesosDia, variantCurve);
      const variantCandidatePeople = optimizeCoverageConstrainedAssignments(groupKey, variantEmployees, variantSeedPeople, lojas);
      const variantMetrics = buildGroupMetrics(variantCandidatePeople, variantEmployees, groupKey, lojas);
      if (!isBetterGroupCandidate(variantMetrics, baselineMetrics)) return;
      if (!isBetterGroupCandidate(variantMetrics, bestCandidateMetrics)) return;

      bestCandidateGroupPeople = variantCandidatePeople;
      bestCandidateMetrics = variantMetrics;
      bestVariantIndex = variantIndex;
    });

    const candidateGroupPeople = bestCandidateGroupPeople;
    const optimizedGroupPeople = candidateGroupPeople;
    const candidateCompliance = checkComplianceCLT(candidateGroupPeople);
    const optimizedCompliance = candidateCompliance;
    const candidateSpread = computeGroupHourSpread(candidateGroupPeople, groupEmployees.map((emp) => emp.nome));
    const optimizedSpread = candidateSpread;
    const candidateQuality = bestCandidateMetrics.quality;
    const optimizedQuality = candidateQuality;
    const candidateBetterOrEqual = isBetterGroupCandidate(bestCandidateMetrics, baselineMetrics);
    const optimizedBetterOrEqual = candidateBetterOrEqual;

    let selected = 'baseline';
    let selectedGroupPeople = baselineGroupPeople;
    if (
      candidateBetterOrEqual &&
      (candidateQuality.total > baselineQuality.total || candidateQuality.ponta > baselineQuality.ponta)
    ) {
      selected = 'nominal';
      selectedGroupPeople = candidateGroupPeople;
    } else if (
      optimizedBetterOrEqual &&
      (optimizedQuality.total > baselineQuality.total || optimizedQuality.ponta > baselineQuality.ponta)
    ) {
      selected = 'baseline-otimizado';
      selectedGroupPeople = optimizedGroupPeople;
    }

    diagnostics.groups[groupKey] = {
      baselineCompliance: baselineCompliance.length,
      candidateCompliance: candidateCompliance.length,
      optimizedCompliance: optimizedCompliance.length,
      baselineHourSpread: Number(baselineSpread.toFixed(2)),
      candidateHourSpread: Number(candidateSpread.toFixed(2)),
      optimizedHourSpread: Number(optimizedSpread.toFixed(2)),
      baselineQuality,
      candidateQuality,
      optimizedQuality,
      variantCount: roleVariants.length,
      selectedVariantIndex: bestVariantIndex,
      selected
    };

    Object.entries(selectedGroupPeople).forEach(([nome, shifts]) => {
      people[nome] = shifts;
    });
    Object.entries(optimizedGroupPeople).forEach(([nome, shifts]) => {
      optimizedBaselinePeople[nome] = shifts;
    });

    baselinePrepared.forEach((emp) => {
      if (!byName[emp.nome]) byName[emp.nome] = emp;
    });
  });

  let selectedPeople = people;
  let presentation = buildPeoplePresentation(selectedPeople, employees, lojas);
  Object.assign(roles, presentation.roles);
  Object.assign(justifications, presentation.justifications);

  diagnostics.baselineCompliance = checkComplianceCLT(baselinePeople);
  diagnostics.candidateCompliance = checkComplianceCLT(selectedPeople);
  if (coverageSummary) {
    const baselineCoverage = summarizeCoverageAgainstDemand(coverageSummary, baselinePeople);
    const selectedCoverage = summarizeCoverageAgainstDemand(coverageSummary, selectedPeople);
    const optimizedCoverage = summarizeCoverageAgainstDemand(coverageSummary, optimizedBaselinePeople);
    diagnostics.baselineCoverage = baselineCoverage;
    diagnostics.selectedCoverage = selectedCoverage;
    diagnostics.optimizedCoverage = optimizedCoverage;
    if (selectedCoverage.totalDeficit > baselineCoverage.totalDeficit) {
      if (optimizedCoverage.totalDeficit <= baselineCoverage.totalDeficit) {
        diagnostics.selected = 'baseline-otimizado';
        selectedPeople = optimizedBaselinePeople;
      } else {
        diagnostics.selected = 'baseline';
        selectedPeople = baselinePeople;
      }
      Object.keys(people).forEach((name) => { delete people[name]; delete roles[name]; delete justifications[name]; });
      Object.entries(selectedPeople).forEach(([nome, shifts]) => { people[nome] = shifts; });
      presentation = buildPeoplePresentation(selectedPeople, employees, lojas);
      Object.assign(roles, presentation.roles);
      Object.assign(justifications, presentation.justifications);
      diagnostics.candidateCompliance = checkComplianceCLT(selectedPeople);
    }
  }
  if (diagnostics.candidateCompliance.length > diagnostics.baselineCompliance.length) {
    diagnostics.selected = 'baseline';
    Object.keys(people).forEach((name) => { delete people[name]; delete roles[name]; delete justifications[name]; });
    Object.entries(baselinePeople).forEach(([nome, shifts]) => {
      people[nome] = shifts;
    });
    presentation = buildPeoplePresentation(baselinePeople, employees, lojas);
    Object.assign(roles, presentation.roles);
    Object.assign(justifications, presentation.justifications);
  }

  return {
    people,
    roles,
    justifications,
    metadata: {
      targetHours,
      targetDaysOff,
      generatedAt: new Date().toISOString()
    },
    diagnostics
  };
}

function countPeopleAtHour(people, dayIndex, hourLabel) {
  const [startStr, endStr] = String(hourLabel).split('-');
  const faixaStart = Number(startStr) * 60;
  const faixaEnd = Number(endStr) * 60;
  let count = 0;
  Object.values(people || {}).forEach((shifts) => {
    const shift = shifts?.[dayIndex];
    if (!shift || shift === 'Folga') return;
    const blocks = parseWorkedBlocks(shift);
    if (blocks.some((block) => block.start < faixaEnd && block.end > faixaStart)) {
      count += 1;
    }
  });
  return count;
}

function summarizeCoverageAgainstDemand(summary, people) {
  const map = [
    ['monday', 0],
    ['tuesday', 1],
    ['wednesday', 2],
    ['thursday', 3],
    ['friday', 4],
    ['saturday', 5],
    ['sunday', 6]
  ];
  const rows = [];
  map.forEach(([dayKey, dayIndex]) => {
    const day = summary.dailyCoverage?.[dayKey];
    if (!day || !Array.isArray(day.rows) || !day.rows.length) return;
    day.rows.forEach((row) => {
      const demanda = Number(row.demanda || 0);
      const escalados = countPeopleAtHour(people, dayIndex, row.hora);
      const saldo = escalados - demanda;
      rows.push({
        dayKey,
        dayIndex,
        hora: row.hora,
        demanda,
        escalados,
        saldo,
        deficit: Math.max(0, -saldo)
      });
    });
  });
  return {
    rows,
    totalDeficit: rows.reduce((sum, row) => sum + row.deficit, 0),
    coveredRows: rows.filter((row) => row.saldo >= 0).length,
    exactRows: rows.filter((row) => row.saldo === 0).length
  };
}

function summarizeProfileViolations(profile, employees, people) {
  const lojaSegSex = parseStoreHours(profile.horarioSegSex);
  const lojaSabado = parseStoreHours(profile.horarioSabado);
  const lojaDomingo = sundayIsClosed(profile) ? null : parseStoreHours(profile.horarioDomingo);
  const lojas = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSabado, lojaDomingo];
  const byName = Object.fromEntries((employees || []).map((emp) => [emp.nome, emp]));
  const violations = [];
  Object.entries(people || {}).forEach(([nome, shifts]) => {
    const emp = byName[nome];
    if (!emp) return;
    const groupKey = scheduleGroupKey(emp);
    if (!employeeSectorFit(emp, groupKey)) {
      violations.push({ nome, tipo: 'setor', detalhe: `Colaborador fora da aptidão principal do grupo ${groupKey}.` });
    }
    (shifts || []).forEach((shift, dayIndex) => {
      if (!shift || shift === 'Folga') return;
      const role = inferRoleFromShift(shift, lojas[dayIndex], 'sustentacao');
      if ((role === 'fechamento' || role === 'abertura-fechamento') && !canEmployeeWorkRole(emp, 'fechamento')) {
        violations.push({ nome, tipo: 'restricao', detalhe: `Fechamento alocado apesar da restrição do colaborador.`, diaIndex: dayIndex });
      }
      if (role === 'abertura' && !canEmployeeWorkRole(emp, 'abertura')) {
        violations.push({ nome, tipo: 'restricao', detalhe: `Abertura alocada apesar da restrição do colaborador.`, diaIndex: dayIndex });
      }
      if (dayIndex === 6 && !canEmployeeWorkSunday(emp)) {
        violations.push({ nome, tipo: 'domingo', detalhe: 'Domingo alocado apesar da restrição de domingo.', diaIndex: dayIndex });
      }
    });
  });
  return violations;
}

function summarizePontaProtection(profile, employees, people) {
  const lojaSegSex = parseStoreHours(profile.horarioSegSex);
  const lojaSabado = parseStoreHours(profile.horarioSabado);
  const lojaDomingo = sundayIsClosed(profile) ? null : parseStoreHours(profile.horarioDomingo);
  const lojas = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSabado, lojaDomingo];
  const byName = Object.fromEntries((employees || []).map((emp) => [emp.nome, emp]));
  let totalSlots = 0;
  let totalScore = 0;
  let seniorSlots = 0;

  Object.entries(people || {}).forEach(([nome, shifts]) => {
    const emp = byName[nome];
    if (!emp) return;
    const prof = PROFICIENCY_SCORE[String(emp?.proficiencia || 'pleno').toLowerCase()] || 2;
    (shifts || []).forEach((shift, dayIndex) => {
      if (!shift || shift === 'Folga') return;
      const role = inferRoleFromShift(shift, lojas[dayIndex], emp.papelOperacional || 'sustentacao');
      const weight = role === 'abertura-fechamento' ? 2 : 1;
      if (role === 'abertura' || role === 'fechamento' || role === 'abertura-fechamento') {
        totalSlots += weight;
        totalScore += prof * weight;
        if (prof >= 3) seniorSlots += weight;
      }
    });
  });

  return {
    slotsCriticos: totalSlots,
    scoreTotal: totalScore,
    mediaProficiencia: totalSlots ? Number((totalScore / totalSlots).toFixed(2)) : 0,
    slotsSeniorOuLider: seniorSlots
  };
}

function compareScheduleEngines(summary, profile, employees, scenarioKey = 'atual') {
  const currentScenario = summary.weeklyScenarioSchedule?.[scenarioKey];
  const nominalScenario = currentScenario?.nominal;
  const currentPeople = currentScenario?.people || {};
  const nominalPeople = nominalScenario?.people || currentPeople;
  const currentCompliance = checkComplianceCLT(currentPeople);
  const nominalCompliance = checkComplianceCLT(nominalPeople);
  const currentCoverage = summarizeCoverageAgainstDemand(summary, currentPeople);
  const nominalCoverage = summarizeCoverageAgainstDemand(summary, nominalPeople);
  const currentProfileViolations = summarizeProfileViolations(profile, employees, currentPeople);
  const nominalProfileViolations = summarizeProfileViolations(profile, employees, nominalPeople);
  const currentPontaProtection = summarizePontaProtection(profile, employees, currentPeople);
  const nominalPontaProtection = summarizePontaProtection(profile, employees, nominalPeople);
  const currentProfileFit = summarizeProfileFit(profile, employees, currentPeople);
  const nominalProfileFit = summarizeProfileFit(profile, employees, nominalPeople);
  return {
    scenarioKey,
    current: {
      compliance: currentCompliance,
      complianceCount: currentCompliance.length,
      coverage: currentCoverage,
      profileViolations: currentProfileViolations,
      profileViolationCount: currentProfileViolations.length,
      pontaProtection: currentPontaProtection,
      profileFit: currentProfileFit
    },
    nominal: {
      compliance: nominalCompliance,
      complianceCount: nominalCompliance.length,
      coverage: nominalCoverage,
      profileViolations: nominalProfileViolations,
      profileViolationCount: nominalProfileViolations.length,
      pontaProtection: nominalPontaProtection,
      profileFit: nominalProfileFit,
      diagnostics: nominalScenario?.diagnostics || null
    },
    verdict: {
      complianceBetterOrEqual: nominalCompliance.length <= currentCompliance.length,
      coverageBetterOrEqual: nominalCoverage.totalDeficit <= currentCoverage.totalDeficit,
      profileBetterOrEqual: nominalProfileViolations.length <= currentProfileViolations.length,
      pontaBetterOrEqual: nominalPontaProtection.mediaProficiencia >= currentPontaProtection.mediaProficiencia,
      fitBetterOrEqual: nominalProfileFit.total >= currentProfileFit.total
    }
  };
}

function reconcileNominalScenario(summary, profile, employees, scenario, pesosDia = null) {
  if (!scenario?.people || !scenario?.nominal?.people) return scenario;
  const currentCoverage = summarizeCoverageAgainstDemand(summary, scenario.people);
  const nominalCoverage = summarizeCoverageAgainstDemand(summary, scenario.nominal.people);
  const currentPonta = summarizePontaProtection(profile, employees, scenario.people);
  const lojaSegSex = parseStoreHours(profile.horarioSegSex);
  const lojaSabado = parseStoreHours(profile.horarioSabado);
  const lojaDomingo = sundayIsClosed(profile) ? null : parseStoreHours(profile.horarioDomingo);
  const lojas = [lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSegSex, lojaSabado, lojaDomingo];
  if (nominalCoverage.totalDeficit <= currentCoverage.totalDeficit) return scenario;

  const optimized = buildEscalaNominal(
    profile,
    employees,
    scenario.targetHours || 44,
    scenario.targetDaysOff || 1,
    pesosDia,
    scenario.people,
    null,
    'baseline-optimized'
  );
  const optimizedCoverage = summarizeCoverageAgainstDemand(summary, optimized.people);
  const optimizedPonta = summarizePontaProtection(profile, employees, optimized.people);

  if (
    optimizedCoverage.totalDeficit <= currentCoverage.totalDeficit &&
    optimizedPonta.mediaProficiencia >= currentPonta.mediaProficiencia
  ) {
    optimized.diagnostics = {
      ...(optimized.diagnostics || {}),
      reconciledFrom: 'nominal',
      reconciledTo: 'baseline-otimizado',
      coverageCurrent: currentCoverage.totalDeficit,
      coverageNominal: nominalCoverage.totalDeficit,
      coverageOptimized: optimizedCoverage.totalDeficit
    };
    scenario.nominal = optimized;
    return scenario;
  }

  const baselinePresentation = buildPeoplePresentation(scenario.people, employees, lojas);
  scenario.nominal = {
    ...scenario.nominal,
    people: scenario.people,
    roles: baselinePresentation.roles,
    justifications: baselinePresentation.justifications,
    diagnostics: {
      ...(scenario.nominal.diagnostics || {}),
      reconciledFrom: 'nominal',
      reconciledTo: 'baseline',
      coverageCurrent: currentCoverage.totalDeficit,
      coverageNominal: nominalCoverage.totalDeficit
    }
  };
  return scenario;
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
  summary.metadata.confianca = Math.min(95, Math.round(20 + dates.length * 0.83));
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

function computeAdherence(summary, timecardRows) {
  if (!timecardRows || !timecardRows.length || !summary.calendarioSemana) return;
  const dias = summary.calendarioSemana.dias;
  const scheduleKey = Object.keys(summary.fullSchedule || {})[0];
  let curPeople = scheduleKey ? summary.fullSchedule[scheduleKey].people : {};
  if (!Object.keys(curPeople).length && summary.weeklyScenarioSchedule) {
    const wssKey = Object.keys(summary.weeklyScenarioSchedule)[0];
    if (wssKey && summary.weeklyScenarioSchedule[wssKey].people) {
      curPeople = summary.weeklyScenarioSchedule[wssKey].people;
    }
  }
  if (!Object.keys(curPeople).length) return;
  const tcByKey = {};
  timecardRows.forEach(r => {
    const key = `${r.nome}::${r.data}`;
    if (!tcByKey[key]) tcByKey[key] = [];
    tcByKey[key].push(r);
  });
  const adherence = {};
  let totalPlanned = 0, totalWorked = 0, totalDeviation = 0, totalSlots = 0;
  Object.entries(curPeople).forEach(([nome, shifts]) => {
    adherence[nome] = [];
    shifts.forEach((shift, dayIdx) => {
      if (dayIdx >= dias.length) return;
      const dataStr = dias[dayIdx].data;
      const records = tcByKey[`${nome}::${dataStr}`] || [];
      const planned = shiftStartEnd(shift);
      if (!planned && shift === 'Folga') {
        const worked = records.length > 0;
        adherence[nome].push({
          status: worked ? 'extra' : 'ok',
          planned: 'Folga',
          actual: worked ? records.map(r => `${r.entrada}-${r.saida}`).join(', ') : 'Folga',
          desvioMin: worked ? records.reduce((s, r) => s + (hhToNum(r.saida) - hhToNum(r.entrada)) * 60, 0) : 0
        });
        if (worked) { totalWorked += records.reduce((s, r) => s + Math.max(0, hhToNum(r.saida) - hhToNum(r.entrada)), 0); totalSlots++; }
        return;
      }
      if (!planned) { adherence[nome].push({ status: 'sem-turno', planned: shift || '—', actual: '—', desvioMin: 0 }); return; }
      totalSlots++;
      const plannedHours = planned.end - planned.start;
      totalPlanned += plannedHours;
      if (!records.length) {
        adherence[nome].push({ status: 'falta', planned: shift, actual: 'Ausente', desvioMin: Math.round(-plannedHours * 60) });
        totalDeviation += plannedHours;
        return;
      }
      const actualStart = Math.min(...records.map(r => hhToNum(r.entrada)));
      const actualEnd = Math.max(...records.map(r => hhToNum(r.saida)));
      const actualHours = actualEnd - actualStart;
      totalWorked += actualHours;
      const desvioEntrada = Math.round((actualStart - planned.start) * 60);
      const desvioSaida = Math.round((actualEnd - planned.end) * 60);
      const desvioTotal = Math.abs(desvioEntrada) + Math.abs(desvioSaida);
      totalDeviation += Math.abs(actualHours - plannedHours);
      let status = 'ok';
      if (desvioTotal > 30) status = 'desvio-alto';
      else if (desvioTotal > 10) status = 'desvio-leve';
      const hh = (v) => { const h = Math.floor(v); const m = Math.round((v - h) * 60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
      adherence[nome].push({
        status,
        planned: shift,
        actual: `${hh(actualStart)}-${hh(actualEnd)}`,
        desvioMin: desvioEntrada + desvioSaida,
        desvioEntrada,
        desvioSaida
      });
    });
  });
  const aderenciaGeral = totalSlots > 0 ? Math.round((1 - totalDeviation / Math.max(totalPlanned, 1)) * 100) : 100;
  summary.adherence = {
    byPerson: adherence,
    summary: {
      totalPlannedHours: Math.round(totalPlanned),
      totalWorkedHours: Math.round(totalWorked * 10) / 10,
      aderencia: Math.max(0, Math.min(100, aderenciaGeral)),
      totalSlots,
      registros: timecardRows.length
    }
  };
}

function computeWeekComparison(summary) {
  const scheduleKey = Object.keys(summary.fullSchedule || {})[0];
  let curPeople = scheduleKey ? summary.fullSchedule[scheduleKey].people : {};
  if (!Object.keys(curPeople).length && summary.weeklyScenarioSchedule) {
    const wssKey = Object.keys(summary.weeklyScenarioSchedule)[0];
    if (wssKey && summary.weeklyScenarioSchedule[wssKey].people) {
      curPeople = summary.weeklyScenarioSchedule[wssKey].people;
    }
  }
  const headcount = Object.keys(curPeople).length;
  if (headcount > 0) {
    const totalHours = Object.values(curPeople).reduce((s, shifts) => s + shifts.reduce((h, sh) => h + shiftWorkedHours(sh), 0), 0);
    const totalFolgas = Object.values(curPeople).reduce((s, shifts) => s + shifts.filter(sh => sh === 'Folga').length, 0);
    const curCompliance = summary.complianceCLT?.[Object.keys(summary.complianceCLT)[0]] || [];
    let forecastBlock = null;
    if (summary.forecastSemana && summary.forecastSemana.length && summary.demandIndices) {
      const prevDias = summary.calendarioSemana.dias.map(dia => {
        const d = new Date(dia.data + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      });
      const eventMap = summary.eventMap || {};
      const prevForecast = prevDias.map(dataStr => {
        const d = new Date(dataStr + 'T12:00:00');
        const dow = d.getDay();
        const wom = weekOfMonth(dataStr);
        const ev = eventMap[dataStr] || null;
        const evFator = ev ? ev.fator : 1;
        return Math.round(adjustedDemand(summary.demandIndices.baseMedia, summary.demandIndices, dow, wom, evFator));
      });
      const curTotal = summary.forecastSemana.reduce((s, f) => s + (f.lojaFechada ? 0 : (f.previsao || 0)), 0);
      const prevTotal = prevForecast.reduce((s, v) => s + v, 0);
      forecastBlock = {
        current: curTotal,
        previous: prevTotal,
        delta: prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : 0,
        label: prevTotal > 0 ? (curTotal > prevTotal ? 'alta' : curTotal < prevTotal ? 'queda' : 'estável') : 'sem base'
      };
    }
    summary.weekComparison = {
      forecast: forecastBlock,
      compliance: { violations: curCompliance.length },
      schedule: {
        headcount,
        totalHours: Math.round(totalHours),
        totalFolgas,
        horasPerCapita: headcount > 0 ? Math.round(totalHours / headcount * 10) / 10 : 0
      }
    };
  }
}

async function applyClientState(summary, user, weekFilter = null) {
  const state = await loadClientState(user.orgId);
  const profile = state.profile || defaultClientState().profile;
  const today = new Date();
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
  // Aplicar vendas do cliente ao dailyCoverage (ICOC por dia da semana)
  // NÃO usar applySalesRowsToSummary pois ela sobrescreve metadata/scenarios
  if (state.salesRows.length) {
    const _covGrouped = {};
    state.salesRows.forEach(row => {
      const dk = dayKeys[new Date(`${row.data}T12:00:00`).getDay()];
      const hr = `${row.horaInicio.slice(0, 2)}-${row.horaFim.slice(0, 2)}`;
      _covGrouped[dk] ||= {};
      _covGrouped[dk][hr] ||= [];
      _covGrouped[dk][hr].push({
        cupons: Number(row.cupons || 0),
        vendaLiquida: Number(row.vendaLiquida || 0),
        qtdItens: Number(row.qtdItens || 0),
        itensMedios: Number(row.itensMedios || 0),
        minutosAtendimento: Number(row.minutosAtendimento || 0)
      });
    });
    // Limpar dados antigos
    Object.values(summary.dailyCoverage || {}).forEach(day => {
      (day.rows || []).forEach(row => {
        row.demanda = null; row.cupons = undefined; row.vendaLiquida = undefined;
        row.qtdItens = undefined; row.itensMedios = undefined; row.minutosAtendimento = undefined;
      });
    });
    // Preencher com médias por dia da semana
    const _salesDates = state.salesRows.map(r => r.data);
    Object.entries(_covGrouped).forEach(([dk, hours]) => {
      if (!summary.dailyCoverage[dk]) return;
      const datesForDay = new Set(_salesDates.filter(d => dayKeys[new Date(`${d}T12:00:00`).getDay()] === dk));
      const numDates = Math.max(1, datesForDay.size);
      summary.dailyCoverage[dk].rows.forEach(row => {
        if (!hours[row.hora]) return;
        const vals = hours[row.hora];
        const totalCupons = vals.reduce((s, v) => s + v.cupons, 0);
        const totalVenda = vals.reduce((s, v) => s + v.vendaLiquida, 0);
        const totalItens = vals.reduce((s, v) => s + v.qtdItens, 0);
        const totalMinutos = vals.reduce((s, v) => s + v.minutosAtendimento, 0);
        const avgCupons = totalCupons / numDates;
        row.cupons = Number(avgCupons.toFixed(1));
        row.demanda = demandFromCoupons(Math.round(avgCupons));
        row.vendaLiquida = Number((totalVenda / numDates).toFixed(2));
        row.itensMedios = totalCupons ? Number((totalItens / totalCupons).toFixed(2)) : 0;
        row.minutosAtendimento = Number((totalMinutos / numDates).toFixed(2));
      });
      summary.dailyCoverage[dk].source = `VRSoft · ${numDates} dia(s) de ${dk === 'saturday' ? 'sábado' : dk === 'sunday' ? 'domingo' : 'semana'}`;
      summary.dailyCoverage[dk].confidence = numDates >= 4 ? 'alta' : numDates >= 2 ? 'média' : 'baixa';
    });
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
  // Semana-alvo para o dimensionamento: semana atual do mês (controller olha pra frente)
  const currentWom = weekOfMonth(new Date().toISOString().slice(0, 10));
  summary.setorDashboard = buildSetorDashboard(mercRows, state.employees || [], profile, currentWom);
  // Setores sem equipe (para alertas do dashboard operacional)
  state._setoresSemEquipe = (summary.setorDashboard || []).filter(s => s.colaboradores === 0 && s.vendaDia > 0).map(s => s.setor);
  state._totalSetoresVenda = (summary.setorDashboard || []).filter(s => s.vendaDia > 0).length;
  // Dashboard executivo operacional (KPIs por dia/semana/mês)
  summary.operationalDashboard = buildOperationalDashboard(state, state.salesRows);
  // FASE 2: Forecast com sazonalidade
  summary.forecast = buildForecast(mercRows, state.salesRows);
  // Índices de demanda (decomposição multiplicativa) para o frontend
  // Índices de demanda: prioriza dailyRevenue (mais longo), depois mercRows, depois salesRows
  const dailyRev = Array.isArray(state.dailyRevenue) ? state.dailyRevenue : [];
  let allSalesForIndices;
  let indicesSource;
  if (dailyRev.length >= 7) {
    allSalesForIndices = dailyRev.map(r => ({ data: r.data, vendaLiquida: r.faturamento }));
    indicesSource = 'faturamento';
  } else if (mercRows.length) {
    allSalesForIndices = mercRows;
    indicesSource = 'mercadologico';
  } else {
    allSalesForIndices = state.salesRows || [];
    indicesSource = 'vrsoft';
  }
  summary.demandIndices = buildDemandIndices(allSalesForIndices);
  summary.demandIndices = summary.demandIndices ? { ...summary.demandIndices, semanaAtual: currentWom, fonte: indicesSource } : null;

  // Calendário de eventos (fator_evento)
  const eventMap = buildEventMap(state.eventos, today.getFullYear());
  summary.eventMap = eventMap;
  summary.eventos = Array.isArray(state.eventos) ? state.eventos : [];

  // Forecast 7 dias com eventos
  if (summary.demandIndices) {
    const forecast7 = [];
    for (let i = 0; i < 7; i++) {
      const fd = new Date(today); fd.setDate(today.getDate() + i);
      const dateStr = fd.toISOString().slice(0, 10);
      const dow = fd.getDay();
      const wom = weekOfMonth(dateStr);
      const ev = eventMap[dateStr] || null;
      const evFator = ev ? ev.fator : 1;
      const previsao = adjustedDemand(summary.demandIndices.baseMedia, summary.demandIndices, dow, wom, evFator);
      forecast7.push({
        data: dateStr,
        dow,
        wom,
        previsao: Math.round(previsao),
        evento: ev,
        fatores: {
          dow: summary.demandIndices.dowIndex[dow],
          wom: (summary.demandIndices.womByDow && summary.demandIndices.womByDow[dow])
            ? summary.demandIndices.womByDow[dow][wom]
            : summary.demandIndices.womFactor[wom],
          evento: evFator
        }
      });
    }
    summary.forecast7 = forecast7;
  }

  // Forecast alinhado à semana da escala (seg-dom do calendarioSemana)
  if (summary.demandIndices && summary.calendarioSemana && summary.calendarioSemana.dias) {
    const pdvLimit = Number(profile.quantidadePdvs || 3);
    const totalOperadores = caixaEmployees.length || Number(profile.quantidadeOperadores || 4);
    summary.forecastSemana = summary.calendarioSemana.dias.map(dia => {
      const d = new Date(dia.data + 'T12:00:00');
      const dow = d.getDay();
      const wom = weekOfMonth(dia.data);
      const ev = eventMap[dia.data] || null;
      const evFator = ev ? ev.fator : 1;
      const previsao = adjustedDemand(summary.demandIndices.baseMedia, summary.demandIndices, dow, wom, evFator);
      const fatorTotal = (summary.demandIndices.dowIndex[dow] || 1)
        * ((summary.demandIndices.womByDow && summary.demandIndices.womByDow[dow]) ? summary.demandIndices.womByDow[dow][wom] : (summary.demandIndices.womFactor[wom] || 1))
        * evFator;
      const isDom = dow === 0;
      const lojaFechada = isDom && sundayIsClosed(profile);
      const excedentes = Math.max(0, totalOperadores - pdvLimit);
      let atividadeSecundaria = null;
      if (excedentes > 0 && !lojaFechada) {
        const isPico = fatorTotal >= 1.1;
        atividadeSecundaria = {
          excedentes,
          pdvs: pdvLimit,
          operadores: totalOperadores,
          atividade: isPico ? 'embalagem' : 'reposicao',
          motivo: isPico
            ? 'Pico de vendas — operadores excedentes auxiliam no empacotamento para acelerar o fluxo de clientes'
            : 'Demanda moderada — operadores excedentes reforçam reposição para reduzir ruptura de gôndola'
        };
      }
      return {
        data: dia.data,
        label: dia.label,
        dow, wom,
        previsao: Math.round(previsao),
        fatorTotal: Number(fatorTotal.toFixed(2)),
        evento: ev,
        lojaFechada,
        atividadeSecundaria
      };
    });
  }

  computeWeekComparison(summary);
  computeAdherence(summary, state.timecardRows || []);

  // Resumo do faturamento diário para o frontend
  if (dailyRev.length) {
    const totalFat = dailyRev.reduce((s, r) => s + r.faturamento, 0);
    summary.dailyRevenueResumo = {
      dias: dailyRev.length,
      primeiro: dailyRev[0].data,
      ultimo: dailyRev[dailyRev.length - 1].data,
      mediaDia: Math.round(totalFat / dailyRev.length),
      total: Math.round(totalFat)
    };
  }
  // Escala sugerida (7 dias, baseada no forecast × setorDashboard)
  summary.escalaSugerida = buildEscalaSugerida(
    summary.demandIndices, summary.setorDashboard,
    state.employees || [], profile, eventMap
  );

  // Mercadológicos nível 2 disponíveis (para o campo Setor do cadastro)
  summary.mercadologicosM2 = mercRows.length
    ? [...new Set(mercRows.map(r => r.mercadologico))].sort()
    : [];
  summary.client = {
    profile: { ...profile, cnpj: '' },
    account: { name: user.name, email: user.email },
    employeesList: state.employees || [],
    escalaWorkflow: normalizeEscalaWorkflow(state.escalaWorkflow),
    caixaCount: caixaEmployees.length,
    onboarding: {
      profileComplete: Boolean(profile.empresa && profile.loja && profile.quantidadeOperadores),
      salesImported: state.salesRows.length > 0,
      employeesImported: state.employees.length > 0,
      employees: state.employees.length,
      salesRows: state.salesRows.length,
      salesDays: representedSalesDays(state.salesRows),
      mercRows: (state.salesByMercadologico || []).length,
      mercDays: new Set((state.salesByMercadologico || []).map(r => r.data)).size,
      dailyRevDays: (state.dailyRevenue || []).length,
      timecardRows: (state.timecardRows || []).length,
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
      scenario.people = generateGroupedSchedule(profile, caixaEmployees, targetHours, targetDaysOff, pesosDia, summary.dailyCoverage);
      scenario.nominal = buildEscalaNominal(profile, caixaEmployees, targetHours, targetDaysOff, pesosDia, scenario.people, summary);
      reconcileNominalScenario(summary, profile, caixaEmployees, scenario, pesosDia);
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

  // ESCALA COMPLETA — todos os colaboradores (todos os setores), fora do bloco caixa-only
  summary.employeeSetorMap = {};
  summary.employeeCargoMap = {};
  (state.employees || []).forEach(e => {
    summary.employeeSetorMap[e.nome] = (e.setor || 'Sem setor').trim() || 'Sem setor';
    summary.employeeCargoMap[e.nome] = (e.cargo || 'Sem cargo').trim() || 'Sem cargo';
  });
  if (state.employees && state.employees.length >= 1) {
    const pesosFull = pesosDiaSemanaDeVendas(state.salesRows, mercRows);
    summary.fullSchedule = {};
    Object.entries(summary.weeklyScenarioSchedule).forEach(([key, sc]) => {
      const people = generateGroupedSchedule(profile, state.employees, sc.targetHours || 44, sc.targetDaysOff || 1, pesosFull, summary.dailyCoverage);
      summary.fullSchedule[key] = {
        label: sc.label,
        targetHours: sc.targetHours,
        targetDaysOff: sc.targetDaysOff,
        people,
        nominal: buildEscalaNominal(profile, state.employees, sc.targetHours || 44, sc.targetDaysOff || 1, pesosFull, people, summary)
      };
      reconcileNominalScenario(summary, profile, state.employees, summary.fullSchedule[key], pesosFull);
    });
    // Aplicar edições manuais (overrides) do gerente
    const overrides = state.escalaOverrides || {};
    if (Object.keys(overrides).length) {
      Object.entries(overrides).forEach(([oKey, turno]) => {
        const [nome, dayStr, cenario] = oKey.split('::');
        const dayIndex = parseInt(dayStr, 10);
        if (!summary.fullSchedule[cenario]?.people?.[nome]) return;
        if (dayIndex < 0 || dayIndex > 6) return;
        summary.fullSchedule[cenario].people[nome][dayIndex] = turno;
      });
    }
    summary.escalaOverrides = overrides;
    summary.complianceCLT = {};
    Object.entries(summary.fullSchedule).forEach(([key, sc]) => {
      summary.complianceCLT[key] = checkComplianceCLT(sc.people);
    });
    summary.bancoHoras = buildBancoHoras(summary.fullSchedule, state.employees);
  }
  summary.escalaFechada = state.escalaFechada || null;
  summary.escalaWorkflow = normalizeEscalaWorkflow(state.escalaWorkflow);
  if (summary.escalaFechada && (!summary.escalaFechada.caixaPeople || !Object.keys(summary.escalaFechada.caixaPeople).length)) {
    const people = summary.escalaFechada.people || {};
    summary.escalaFechada.caixaPeople = Object.fromEntries(
      Object.entries(people).filter(([nome]) => isOperadorCaixaSnapshot(nome, summary.escalaFechada))
    );
  }
  if (summary.escalaFechada && !summary.escalaFechada.workflowStatus) {
    summary.escalaFechada.workflowStatus = 'publicado';
  }
  summary.escalaHistorico = (state.escalaHistorico || []).map(h => ({
    label: h.label, dataInicio: h.dataInicio, dataFim: h.dataFim,
    cenarioLabel: h.cenarioLabel, fechadoEm: h.fechadoEm, fechadoPor: h.fechadoPor
  }));

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
  const finalPesosCaixa = pesosDiaSemanaDeVendas(state.salesRows, mercRows);
  const finalPesosFull = pesosDiaSemanaDeVendas(state.salesRows, mercRows);
  Object.values(summary.weeklyScenarioSchedule || {}).forEach((scenario) => {
    reconcileNominalScenario(summary, profile, caixaEmployees, scenario, finalPesosCaixa);
  });
  Object.values(summary.fullSchedule || {}).forEach((scenario) => {
    reconcileNominalScenario(summary, profile, state.employees, scenario, finalPesosFull);
  });
  const finalCapacity = operators * 40;
  const finalSurplus = finalCapacity - weeklyDemand;
  summary.decisionMemory.recommendations[0].dados = [`${operators} operadoras`, `${weeklyDemand} caixas-hora semanais`, `${finalCapacity}h de capacidade no cenário mais restritivo`];
  summary.decisionMemory.recommendations[0].resultado = `${finalCapacity}h - ${weeklyDemand}h = ${finalSurplus}h semanais disponíveis após atender o caixa`;
  summary.decisionMemory.recommendations[1].dados[0] = `${operators} operadoras`;
  summary.decisionMemory.recommendations[1].resultado = `${operators} x 4h = ${operators * 4}h/semana; aproximadamente ${Math.round(operators * 4 * 4.33)}h/mês de capacidade auxiliar perdida`;
  summary.metadata.diasComVenda = representedDays;
  summary.metadata.confianca = Math.min(95, Math.round(20 + representedDays * 0.83));
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

// ===== Calendário datado (Fase 2) =====
// Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher
function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isoLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Feriados nacionais (fixos + móveis derivados da Páscoa)
function brazilianHolidays(year) {
  const easter = easterDate(year);
  const offset = (days) => { const d = new Date(easter); d.setDate(d.getDate() + days); return isoLocalDate(d); };
  return [
    { data: `${year}-01-01`, nome: 'Confraternização Universal' },
    { data: offset(-48), nome: 'Carnaval (segunda)' },
    { data: offset(-47), nome: 'Carnaval' },
    { data: offset(-2), nome: 'Sexta-feira Santa' },
    { data: `${year}-04-21`, nome: 'Tiradentes' },
    { data: `${year}-05-01`, nome: 'Dia do Trabalho' },
    { data: offset(60), nome: 'Corpus Christi' },
    { data: `${year}-09-07`, nome: 'Independência' },
    { data: `${year}-10-12`, nome: 'N. Sra. Aparecida' },
    { data: `${year}-11-02`, nome: 'Finados' },
    { data: `${year}-11-15`, nome: 'Proclamação da República' },
    { data: `${year}-11-20`, nome: 'Consciência Negra' },
    { data: `${year}-12-25`, nome: 'Natal' }
  ];
}

// Semana-calendário corrente (seg→dom) com datas reais e feriados marcados.
// dayIndex segue a convenção da escala: 0=seg ... 5=sáb, 6=dom.
function buildCalendarWeek(baseDate = new Date(), weekOffset = 0) {
  const base = new Date(baseDate);
  const diasDesdeSegunda = (base.getDay() + 6) % 7;
  const segunda = new Date(base);
  segunda.setDate(base.getDate() - diasDesdeSegunda + (weekOffset * 7));
  const feriados = [...brazilianHolidays(segunda.getFullYear()), ...brazilianHolidays(segunda.getFullYear() + 1)];
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(segunda);
    dt.setDate(segunda.getDate() + i);
    const iso = isoLocalDate(dt);
    const feriado = feriados.find(f => f.data === iso);
    dias.push({
      dayIndex: i,
      data: iso,
      label: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`,
      feriado: feriado ? feriado.nome : null
    });
  }
  return { inicio: dias[0].data, fim: dias[6].data, dias, temFeriado: dias.some(d => d.feriado) };
}

async function summaryFromDatabase(user = null, weekFilter = null, weekOffset = 0) {
  const connection = await db.status();
  if (!connection.connected) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', ...connection } }));
    summary.calendarioSemana = buildCalendarWeek(new Date(), weekOffset);
    summary.weekOffset = weekOffset;
    if (user) return applyClientState(summary, user, weekFilter);
    applySalesRowsToSummary(summary, loadModelSalesRows(), 'Empresa modelo VRSoft');
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    computeWeekComparison(summary);
    return summary;
  }

  try {
    const [demandRows, scenarios] = await Promise.all([db.loadDemandRows(), db.loadScenarios()]);
    const summary = JSON.parse(JSON.stringify(data));
    summary.dataSource = { mode: 'postgresql', ...connection };
    summary.calendarioSemana = buildCalendarWeek(new Date(), weekOffset);
    summary.weekOffset = weekOffset;

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
      summary.metadata.confianca = Math.min(95, Math.round(20 + dates.length * 0.83));
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
    computeWeekComparison(summary);
    return summary;
  } catch (error) {
    const summary = JSON.parse(JSON.stringify({ ...data, dataSource: { mode: 'demo', connected: true, database: connection.database, error: error.message } }));
    if (user) return applyClientState(summary, user, weekFilter);
    applySalesRowsToSummary(summary, loadModelSalesRows(), 'Empresa modelo VRSoft');
    refreshCoverageLoads(summary, summary.storeConfig.pdvs);
    computeWeekComparison(summary);
    return summary;
  }
}

const requestHandler = async (req, res) => {
  try {
    requireSameOrigin(req);
  } catch (error) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: false, error: error.message }));
  }
  const user = await authenticatedUser(req);
  const summaryUrlMatch = req.url.match(/^\/api\/summary(\?.*)?$/);
  if (summaryUrlMatch) {
    try {
      const params = new URLSearchParams(summaryUrlMatch[1] || '');
      const weekOffset = parseInt(params.get('weekOffset') || '0', 10) || 0;
      const summary = await summaryFromDatabase(user, null, weekOffset);
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
        await enforceRateLimit(req, 'colab', 30, 60 * 60 * 1000);
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
    (async () => {
      if (!user) {
        return json(res, { ok: false, error: 'Faça login para visualizar atividades.' }, 401);
      }
      const activities = await loadAudit(user.id);
      return json(res, { ok: true, activities: activities.slice(0, 20), persistence: await db.appPersistenceStatus() });
    })();
    return;
  }
  if (req.url === '/api/account/export') {
    (async () => {
      if (!user) {
        return json(res, { ok: false, error: 'Faça login para exportar seus dados.' }, 401);
      }
      await audit(user.id, 'Dados exportados');
      const payload = {
        exportedAt: new Date().toISOString(),
        account: { name: user.name, email: user.email, createdAt: user.createdAt },
        state: await loadClientState(user.orgId),
        activities: await loadAudit(user.id)
      };
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="workforce-os-backup-${user.id}.json"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(JSON.stringify(payload, null, 2));
    })();
    return;
  }
  if (req.url === '/api/account/change-password' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para alterar sua senha.');
        await enforceRateLimit(req, 'change-password', 5);
        const body = await readJsonBody(req, 50_000);
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '');
        if (!(await verifyPassword(currentPassword, user))) throw new Error('Senha atual incorreta.');
        if (newPassword.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
        if (currentPassword === newPassword) throw new Error('A nova senha deve ser diferente da senha atual.');
        const secured = await hashPassword(newPassword);
        const updated = await dbSupabase.updateUserPassword(user.id, secured.hash, secured.salt);
        if (!updated) throw new Error('Não foi possível atualizar a senha. Tente novamente.');
        await dbSupabase.deleteUserSessions(user.id);
        await createSession(res, req, user.id);
        await audit(user.id, 'PASSWORD_CHANGED', { ip: requestIp(req) });
        return json(res, { ok: true });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/auth/register' && req.method === 'POST') {
    (async () => {
      try {
        await enforceRateLimit(req, 'register', 20, 60 * 60 * 1000);
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
          orgCode = 'EMP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
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
        await enforceRateLimit(req, 'login', 10, 60 * 60 * 1000);
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
          workflowStatus: 'publicado',
          people: full.people,
          caixaPeople: caixa?.people || {},
          nominal: full.nominal || null,
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
        state.escalaWorkflow = applyWorkflowStatus(state.escalaWorkflow, 'publicado', user, snapshot.fechadoEm);
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
          state.escalaWorkflow = applyWorkflowStatus(state.escalaWorkflow, 'rascunho', user);
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
  if (req.url === '/api/escala/status' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        if (user.role !== 'admin' && user.role !== 'gestor' && user.orgId !== user.id) throw new Error('Apenas o administrador pode alterar o status da escala.');
        const body = await readJsonBody(req);
        const nextStatus = String(body.status || '').toLowerCase();
        if (!['rascunho', 'revisado', 'publicado', 'realizado'].includes(nextStatus)) {
          throw new Error('Status inválido.');
        }
        const state = await loadClientState(user.orgId);
        if (state.escalaFechada) {
          state.escalaFechada.workflowStatus = nextStatus;
        }
        state.escalaWorkflow = applyWorkflowStatus(state.escalaWorkflow, nextStatus, user);
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'ESCALA_STATUS_UPDATED', { status: nextStatus, ip: requestIp(req) });
        return json(res, {
          ok: true,
          escalaWorkflow: state.escalaWorkflow,
          escalaFechada: state.escalaFechada
        });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/escala/edit' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para editar a escala.');
        const body = await readJsonBody(req);
        const nome = sanitizeString(String(body.nome || '').trim());
        const dayIndex = parseInt(body.dayIndex, 10);
        const cenario = sanitizeString(String(body.cenario || '').trim());
        const turno = sanitizeString(String(body.turno || '').trim());
        if (!nome || isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6 || !cenario || !turno) {
          throw new Error('Dados inválidos para edição.');
        }
        const validShift = turno === 'Folga'
          || /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(turno)
          || /^\d{2}:\d{2}-\d{2}:\d{2}\/\d{2}:\d{2}-\d{2}:\d{2}/.test(turno);
        if (!validShift) {
          throw new Error('Formato de turno inválido. Use HH:MM-HH:MM ou HH:MM-HH:MM/HH:MM-HH:MM ou Folga.');
        }
        const state = await loadClientState(user.orgId);
        if (!state.escalaOverrides) state.escalaOverrides = {};
        const key = `${nome}::${dayIndex}::${cenario}`;
        state.escalaOverrides[key] = turno;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'ESCALA_EDIT', { nome, dayIndex, cenario, turno, ip: requestIp(req) });
        return json(res, { ok: true, key, turno });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  if (req.url === '/api/escala/reset-edits' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login.');
        const body = await readJsonBody(req);
        const cenario = sanitizeString(String(body.cenario || '').trim());
        const state = await loadClientState(user.orgId);
        if (!state.escalaOverrides) { return json(res, { ok: true, cleared: 0 }); }
        if (cenario) {
          const before = Object.keys(state.escalaOverrides).length;
          Object.keys(state.escalaOverrides).forEach(k => { if (k.endsWith('::' + cenario)) delete state.escalaOverrides[k]; });
          const cleared = before - Object.keys(state.escalaOverrides).length;
          state.updatedAt = new Date().toISOString();
          await saveClientState(user.orgId, state);
          await audit(user.id, 'ESCALA_RESET_EDITS', { cenario, cleared, ip: requestIp(req) });
          return json(res, { ok: true, cleared });
        }
        const cleared = Object.keys(state.escalaOverrides).length;
        state.escalaOverrides = {};
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'ESCALA_RESET_ALL_EDITS', { cleared, ip: requestIp(req) });
        return json(res, { ok: true, cleared });
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
        state.profile = {
          ...state.profile,
          ...body.profile,
          regrasOperacionais: normalizeOperationalRules(body.profile?.regrasOperacionais || state.profile?.regrasOperacionais)
        };
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
        const employees = list.map(normalizeEmployeeRecord).filter((e) => e.nome.length >= 2);

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
  // Importar faturamento diário (3ª fonte: histórico longo para forecast/sazonalidade)
  if (req.url === '/api/import-faturamento' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar faturamento.');
        const body = await readJsonBody(req, 2_000_000);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 50000) : [];

        const validRows = rows.filter(row => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.data || ''))) return false;
          return Number(row.faturamento) >= 0;
        }).map(row => ({
          data: String(row.data),
          faturamento: Number(row.faturamento) || 0
        }));

        if (!validRows.length) throw new Error('Nenhuma linha válida. Use as colunas: data, faturamento (ex: 2025-06-13;45230.50).');

        // Agregar por dia (caso venha duplicado)
        const porDia = {};
        validRows.forEach(r => { porDia[r.data] = (porDia[r.data] || 0) + r.faturamento; });
        const agregado = Object.entries(porDia).map(([data, faturamento]) => ({ data, faturamento })).sort((a, b) => a.data.localeCompare(b.data));

        const state = await loadClientState(user.orgId);
        // Merge com dados existentes (preserva dias antigos, atualiza se reimportado)
        const existing = Array.isArray(state.dailyRevenue) ? state.dailyRevenue : [];
        const merged = {};
        existing.forEach(r => { merged[r.data] = r.faturamento; });
        agregado.forEach(r => { merged[r.data] = r.faturamento; });
        state.dailyRevenue = Object.entries(merged).map(([data, faturamento]) => ({ data, faturamento })).sort((a, b) => a.data.localeCompare(b.data));
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);

        const dias = state.dailyRevenue.length;
        const primeiro = state.dailyRevenue[0]?.data;
        const ultimo = state.dailyRevenue[dias - 1]?.data;
        const totalFat = state.dailyRevenue.reduce((s, r) => s + r.faturamento, 0);
        await audit(user.id, 'FATURAMENTO_IMPORTED', { linhasNovas: agregado.length, totalDias: dias, ip: requestIp(req) });
        return json(res, { ok: true, imported: agregado.length, totalDias: dias, primeiro, ultimo, faturamentoTotal: Math.round(totalFat), mediaDia: Math.round(totalFat / dias) });
      } catch (error) {
        return json(res, { ok: false, error: error.message }, 400);
      }
    })();
    return;
  }
  // CRUD de eventos (calendário de fator_evento)
  if (req.url === '/api/eventos' && req.method === 'GET') {
    (async () => {
      try {
        if (!user) return json(res, { ok: false, error: 'Login necessário.' }, 401);
        const state = await loadClientState(user.orgId);
        const eventos = Array.isArray(state.eventos) ? state.eventos : [];
        const eventMap = buildEventMap(eventos, new Date().getFullYear());
        return json(res, { ok: true, eventos, eventMap });
      } catch (error) { return json(res, { ok: false, error: error.message }, 400); }
    })();
    return;
  }
  if (req.url === '/api/eventos' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Login necessário.');
        const body = await readJsonBody(req, 100_000);
        const eventos = Array.isArray(body.eventos) ? body.eventos : [];
        const valid = eventos.filter(ev => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ev.data || ''))) return false;
          if (!ev.tipo || !EVENTO_TIPO_FATOR[ev.tipo]) return false;
          return true;
        }).map(ev => ({
          data: String(ev.data),
          tipo: String(ev.tipo),
          nome: sanitizeString(String(ev.nome || '')).slice(0, 80),
          fator: Math.max(0, Math.min(5, Number(ev.fator) || EVENTO_TIPO_FATOR[ev.tipo] || 1))
        }));
        const state = await loadClientState(user.orgId);
        state.eventos = valid;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'EVENTOS_UPDATED', { total: valid.length, ip: requestIp(req) });
        return json(res, { ok: true, total: valid.length });
      } catch (error) { return json(res, { ok: false, error: error.message }, 400); }
    })();
    return;
  }
  // Adicionar/atualizar evento individual
  if (req.url === '/api/eventos/upsert' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Login necessário.');
        const ev = await readJsonBody(req, 10_000);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ev.data || ''))) throw new Error('Data inválida.');
        if (!ev.tipo || !EVENTO_TIPO_FATOR[ev.tipo]) throw new Error('Tipo inválido. Use: feriado, vespera, promocao, data_comemorativa, pagamento.');
        const evento = {
          data: String(ev.data),
          tipo: String(ev.tipo),
          nome: sanitizeString(String(ev.nome || '')).slice(0, 80),
          fator: Math.max(0, Math.min(5, Number(ev.fator) || EVENTO_TIPO_FATOR[ev.tipo] || 1))
        };
        const state = await loadClientState(user.orgId);
        if (!Array.isArray(state.eventos)) state.eventos = [];
        const idx = state.eventos.findIndex(e => e.data === evento.data);
        if (idx >= 0) state.eventos[idx] = evento; else state.eventos.push(evento);
        state.eventos.sort((a, b) => a.data.localeCompare(b.data));
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        return json(res, { ok: true, evento, total: state.eventos.length });
      } catch (error) { return json(res, { ok: false, error: error.message }, 400); }
    })();
    return;
  }
  // Remover evento por data
  if (req.url === '/api/eventos/delete' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Login necessário.');
        const body = await readJsonBody(req, 1_000);
        const data = String(body.data || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
        const state = await loadClientState(user.orgId);
        if (!Array.isArray(state.eventos)) state.eventos = [];
        state.eventos = state.eventos.filter(e => e.data !== data);
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        return json(res, { ok: true, total: state.eventos.length });
      } catch (error) { return json(res, { ok: false, error: error.message }, 400); }
    })();
    return;
  }
  if (req.url === '/api/import-timecard' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar registros de ponto.');
        const body = await readJsonBody(req, 16_000_000);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 50000) : [];
        const timeRe = /^\d{2}:\d{2}$/;
        const validRows = rows.filter(r => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return false;
          if (!timeRe.test(r.entrada) || !timeRe.test(r.saida)) return false;
          if (!r.nome || String(r.nome).trim().length < 2) return false;
          return true;
        }).map(r => ({
          nome: sanitizeString(String(r.nome).trim()).slice(0, 100),
          data: String(r.data),
          entrada: String(r.entrada),
          saida: String(r.saida)
        }));
        if (!validRows.length) throw new Error('Nenhum registro válido. Formato: nome, data (YYYY-MM-DD), entrada (HH:MM), saída (HH:MM).');
        const state = await loadClientState(user.orgId);
        state.timecardRows = validRows;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        const dias = new Set(validRows.map(r => r.data)).size;
        const pessoas = new Set(validRows.map(r => r.nome)).size;
        await audit(user.id, 'TIMECARD_IMPORTED', { registros: validRows.length, dias, pessoas, ip: requestIp(req) });
        return json(res, { ok: true, imported: validRows.length, rejected: rows.length - validRows.length, dias, pessoas });
      } catch (error) { return json(res, { ok: false, error: error.message }, 400); }
    })();
    return;
  }
  if (req.url === '/api/import-sales' && req.method === 'POST') {
    (async () => {
      try {
        if (!user) throw new Error('Faça login para importar vendas.');
        const body = await readJsonBody(req, 16_000_000);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 10000) : [];

        const validRows = rows.filter((row) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data)) return false;
          if (!/^\d{2}:\d{2}$/.test(row.horaInicio)) return false;
          if (!/^\d{2}:\d{2}$/.test(row.horaFim)) return false;
          if (Number(row.cupons) < 0 || Number(row.cupons) > 100000) return false;
          return true;
        }).map(row => ({
          data: row.data,
          horaInicio: row.horaInicio,
          horaFim: row.horaFim,
          operador: sanitizeString(String(row.operador || '')).slice(0, 100),
          cupons: Number(row.cupons) || 0,
          vendaLiquida: Number(row.vendaLiquida) || 0,
          qtdItens: Number(row.qtdItens) || 0,
          qtdeVendida: Number(row.qtdeVendida) || 0,
          itensMedios: Number(row.itensMedios) || 0,
          minutosAtendimento: Number(row.minutosAtendimento) || 0
        }));

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
        const body = await readJsonBody(req, 8_000_000);
        const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];

        function parseHoras(v) {
          if (typeof v === 'number' && v > 0) return v;
          const s = String(v || '').trim().replace(/h$/i, '');
          const m = s.match(/^(\d+)[h:,.](\d*)$/i);
          if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / (m[2].length <= 2 ? 100 : 1) : 0);
          const n = Number(s.replace(',', '.'));
          return isNaN(n) ? 0 : n;
        }
        let rejected = 0;
        const validRows = rows.filter((row) => {
          const nome = sanitizeString(String(row.nome || '')).slice(0, 100);
          const horas = parseHoras(row.horasSemanais);
          if (nome.length < 2 || horas <= 0 || horas > 168) { rejected++; return false; }
          return true;
        }).map(row => ({
          nome: sanitizeString(String(row.nome || '')).slice(0, 100),
          horasSemanais: Math.min(168, Math.max(0, parseHoras(row.horasSemanais))),
          funcao: sanitizeString(String(row.funcao || row.cargo || '')).slice(0, 50),
          setor: sanitizeString(String(row.setor || row.departamento || '')).slice(0, 80),
          cargo: sanitizeString(String(row.cargo || row.funcao || '')).slice(0, 50),
          mercadologicos: Array.isArray(row.mercadologicos) ? row.mercadologicos.map(m => sanitizeString(String(m)).slice(0, 80)) : []
        }));

        if (validRows.length < 1) throw new Error(`Nenhum colaborador válido. ${rejected} linha(s) rejeitada(s) — verifique se horasSemanais é numérico (ex: 44, não "44:00h").`);

        const state = await loadClientState(user.orgId);
        state.employees = validRows;
        state.profile.quantidadeOperadores = validRows.length;
        state.updatedAt = new Date().toISOString();
        await saveClientState(user.orgId, state);
        await audit(user.id, 'EMPLOYEES_IMPORTED', { colaboradores: validRows.length, rejeitados: rejected, ip: requestIp(req) });
        return json(res, { ok: true, imported: validRows.length, rejected, state });
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
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Workforce OS rodando em http://localhost:${PORT}`);
  });
}

// Vercel (@vercel/node) exige que o entrypoint exporte uma função handler ou um server.
// Exportamos o handler e anexamos os helpers como propriedades para os scripts internos
// (que usam `const { loadClientState } = require('../server')`).
module.exports = requestHandler;
Object.assign(module.exports, {
  server,
  loadClientState,
  summaryFromDatabase,
  buildEscalaNominal,
  generateGroupedSchedule,
  generateScheduleByProfile,
  checkComplianceCLT,
  compareScheduleEngines,
  scheduleGroupKey,
  isOperadorCaixa,
  employeeSectorFit,
  canEmployeeWorkRole,
  canEmployeeWorkSunday
});
