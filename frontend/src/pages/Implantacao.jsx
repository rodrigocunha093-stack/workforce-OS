import React, { useState, useEffect } from 'react';

const globalStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] { -moz-appearance: textfield; }

  /* Ícones nativos de calendário/relógio vêm pretos por padrão — invisíveis
     no fundo escuro. Inverte pra ficarem claros. */
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator {
    filter: invert(1) brightness(1.6);
    cursor: pointer;
  }

  select option {
    background-color: #101827;
    color: #e8eef5;
    padding: 8px;
  }
  select option:checked { background-color: #1e4b7a; color: #fff; }

  @keyframes imp-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .imp-callout {
    position: absolute; top: -18px; right: 20px; z-index: 5;
    animation: imp-bounce 2.2s ease-in-out infinite;
  }
  .imp-callout-bubble {
    padding: 7px 13px; border-radius: 12px; font-size: 12px; font-weight: 700; white-space: nowrap;
    color: #2a1a02; background: linear-gradient(180deg, #fde68a, #fbbf24);
    box-shadow: 0 10px 24px -8px rgba(251,191,36,0.6);
  }
  .imp-callout-tail {
    width: 14px; height: 14px; margin: -6px auto 0; margin-right: 22px;
    background: #fbbf24; transform: rotate(45deg);
    box-shadow: 3px 3px 6px -3px rgba(251,191,36,0.5);
  }

  @keyframes imp-bounce-x {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(-4px); }
  }
  .imp-callout-left {
    position: absolute; z-index: 5;
    display: flex; align-items: center;
    animation: imp-bounce-x 2.2s ease-in-out infinite;
  }
  .imp-callout-left .imp-callout-bubble { white-space: nowrap; }
  .imp-callout-tail-right {
    width: 0; height: 0; margin-left: -1px; flex-shrink: 0;
    border-top: 8px solid transparent; border-bottom: 8px solid transparent;
    border-left: 10px solid #fbbf24;
  }

  @keyframes imp-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes imp-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.9; }
  }
  @keyframes imp-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.75); }
  }
  .imp-fade { animation: imp-fade-up .6s cubic-bezier(.22,.61,.36,1) both; }

  .imp-card {
    position: relative;
    transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
  }
  .imp-card:hover {
    border-color: rgba(74,168,255,0.35);
    transform: translateY(-2px);
    box-shadow: 0 24px 60px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(74,168,255,0.12);
  }
  /* Mesmo efeito de borda em gradiente diagonal usado no Perfil/Usuários/
     Controlador (.eg-card::before / .ctl-panel::before) — antes só essas
     3 páginas tinham esse acabamento, deixando o resto do produto (aqui,
     Escala e Logs) com cara de tela diferente dentro do mesmo produto. */
  .imp-card::before {
    content: ''; position: absolute; inset: 0; border-radius: 18px; padding: 1px;
    background: linear-gradient(140deg, rgba(74,168,255,.5), transparent 35%, transparent 65%, rgba(124,92,255,.4));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    pointer-events: none; opacity: .7;
  }

  .imp-input:focus {
    border-color: rgba(74,168,255,0.55) !important;
    box-shadow: 0 0 0 4px rgba(74,168,255,0.14) !important;
    background: rgba(74,168,255,0.05) !important;
  }

  .imp-btn { transition: filter .15s ease, transform .1s ease, box-shadow .2s ease; position: relative; overflow: hidden; }
  .imp-btn:hover { filter: brightness(1.08); box-shadow: 0 10px 30px -10px rgba(74,168,255,0.6); }
  .imp-btn:active { transform: translateY(1px); }

  .imp-row { transition: background .18s ease; }
  .imp-row:hover { background: rgba(74,168,255,0.05); }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

  .imp-file::-webkit-file-upload-button {
    background: rgba(74,168,255,0.12);
    color: #4aa8ff;
    border: 1px solid rgba(74,168,255,0.3);
    border-radius: 8px;
    padding: 7px 13px;
    margin-right: 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background .15s ease;
  }
  .imp-file::-webkit-file-upload-button:hover { background: rgba(74,168,255,0.2); }

  .imp-checkbox {
    appearance: none; -webkit-appearance: none;
    width: 19px; height: 19px; border-radius: 6px; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.04);
    cursor: pointer; position: relative;
    transition: all .15s ease;
  }
  .imp-checkbox:hover { border-color: rgba(74,168,255,0.5); }
  .imp-checkbox:checked {
    background: linear-gradient(135deg, #4aa8ff, #1e6fc4);
    border-color: transparent;
  }
  .imp-checkbox:checked::after {
    content: ''; position: absolute; left: 6px; top: 2px;
    width: 5px; height: 10px;
    border: solid #ffffff; border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
`;

const EMPTY_EMPLOYEE = {
  nome: '', cpf: '', sexo: 'Feminino', cargo: '', setor: '', id_mercadologico: '', horas_semanais: 44, salario: '',
  turno: 'flexivel', papel_operacional: 'auto', proficiencia: '', setores_aptos: [], restricoes: [], folga_preferencial: '', pode_domingo: true,
};

const TURNO_OPTS = [['flexivel', 'Flexível'], ['abertura', 'Abertura'], ['intermediario', 'Intermediário'], ['fechamento', 'Fechamento']];
const PAPEL_OPTS = [['auto', 'Auto'], ['abertura', 'Abertura'], ['sustentacao', 'Sustentação'], ['fechamento', 'Fechamento'], ['apoio', 'Apoio']];
const PROFICIENCIA_OPTS = [['iniciante', 'Iniciante'], ['pleno', 'Pleno'], ['senior', 'Sênior'], ['lider', 'Líder']];
const DIAS_SEMANA_OPTS = [['', 'Sem preferência'], ['domingo', 'Domingo'], ['segunda', 'Segunda'], ['terca', 'Terça'], ['quarta', 'Quarta'], ['quinta', 'Quinta'], ['sexta', 'Sexta'], ['sabado', 'Sábado']];

// "Prédios" do mapa 3D da loja (StoreFloorMap) — cada mercadológico real
// (Bebidas, Higiene Pessoal, Açougue...) pode ser atribuído a um deles.
const ZONAS_MAPA_OPTS = [
  ['', 'Automático (por palavra-chave)'],
  ['acougue', 'Açougue'],
  ['padaria', 'Padaria'],
  ['hortifruti', 'Hortifruti'],
  ['frios', 'Frios'],
  ['loja', 'Loja (gôndolas)'],
  ['recebimento', 'Recebimento'],
  ['escritorio', 'Escritório'],
  ['comercial', 'Comercial'],
  ['checkout', 'Frente de Caixa'],
];

// Consulta de exemplo pro cliente rodar no banco do Domínio (bethadba) e
// extrair a maior parte das colunas do CSV de equipe já prontas.
const DOMINIO_SQL_EXEMPLO = `SELECT
    f.nome,
    f.cpf, 
    f.sexo,
    f2.nome AS "cargo",
    f.horas_semana,
    f.salario,
    f3.nome AS "setor"
FROM bethadba.foempregados f
LEFT JOIN bethadba.focargos f2
    ON f.codi_emp = f2.codi_emp
    AND f.i_cargos = f2.i_cargos
LEFT JOIN bethadba.fodepto f3
    ON f.codi_emp = f3.codi_emp
    AND f.i_depto = f3.i_depto
WHERE f.codi_emp IN (1)`;

// Lê um valor do registro aceitando vários nomes de campo possíveis do back-end.
const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
};

// Normaliza um colaborador vindo do banco para o formato usado na tabela,
// preservando id e os campos originais (_raw) para o PUT.
const normalizeEmployee = (e) => ({
  id: e.id ?? e._id ?? e.codigo,
  nome: pick(e, ['nome', 'name', 'nome_completo', 'funcionario', 'colaborador']),
  cpf: pick(e, ['cpf', 'CPF', 'documento']),
  sexo: pick(e, ['sexo', 'sex', 'genero', 'gender']) || 'Feminino',
  cargo: pick(e, ['cargo', 'role', 'funcao', 'position']),
  setor: pick(e, ['setor', 'sector', 'departamento', 'department', 'area']),
  id_mercadologico: e.id_mercadologico ?? '',
  horas_semanais: pick(e, ['horas_semanais', 'horas', 'carga_horaria', 'weekly_hours', 'hours', 'jornada']),
  salario: pick(e, ['salario', 'salary', 'wage', 'remuneracao']),
  turno: e.turno || 'flexivel',
  papel_operacional: e.papel_operacional || 'auto',
  proficiencia: e.proficiencia || '',
  setores_aptos: Array.isArray(e.setores_aptos) ? e.setores_aptos : [],
  restricoes: Array.isArray(e.restricoes) ? e.restricoes : [],
  folga_preferencial: e.folga_preferencial || '',
  pode_domingo: e.pode_domingo !== false,
  _raw: e
});

const normalizeTimecard = (t) => ({
  id: t.id ?? t._id ?? t.codigo,
  nome: pick(t, ['nome', 'name', 'funcionario', 'colaborador']),
  data: pick(t, ['data', 'date', 'dia']),
  entrada: pick(t, ['entrada', 'entry', 'inicio', 'hora_entrada']),
  saida: pick(t, ['saida', 'exit', 'fim', 'hora_saida']),
  _raw: t
});

// Campo de horário padronizado: dois seletores nativos (type="time") em
// vez de texto livre, evitando formatos inválidos ("8h às 20h", "08-20"
// etc.). Combina em "HH:MM-HH:MM" pro backend, que é o formato esperado.
function splitRange(value) {
  const [start, end] = String(value || '').split('-');
  return { start: start || '', end: end || '' };
}

function HourRangeField({ label, value, onChange, inputStyle, labelStackStyle, required }) {
  // Estado local independente pros dois campos — não deriva direto de
  // `value` a cada render, senão o valor combinado fica vazio enquanto só
  // um dos dois está preenchido, e isso "ecoa" de volta e apaga o campo
  // que a pessoa acabou de digitar. Só sincroniza de fora quando os dois
  // pedaços chegam prontos (ex.: carregado da API).
  const [start, setStart] = useState(() => splitRange(value).start);
  const [end, setEnd] = useState(() => splitRange(value).end);

  useEffect(() => {
    const split = splitRange(value);
    if (split.start && split.end) {
      setStart(split.start);
      setEnd(split.end);
    }
  }, [value]);

  const handleStart = (v) => {
    setStart(v);
    onChange(v && end ? `${v}-${end}` : '');
  };
  const handleEnd = (v) => {
    setEnd(v);
    onChange(start && v ? `${start}-${v}` : '');
  };

  return (
    <label style={labelStackStyle}>
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="imp-input"
          type="time"
          value={start}
          onChange={(e) => handleStart(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          required={required}
        />
        <span style={{ color: '#5b6880', fontSize: 13, flexShrink: 0 }}>até</span>
        <input
          className="imp-input"
          type="time"
          value={end}
          onChange={(e) => handleEnd(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          required={required}
        />
      </div>
    </label>
  );
}

export default function Implantacao() {
  const [setupData, setSetupData] = useState({
    company: '',
    store: '',
    taxRegime: 'Lucro Real',
    corredores: 1,
    pdvs: '',
    weekdayHours: '',
    saturdayHours: '',
    sundayOperation: '',
    closedSundays: 0,
    sundayHours: ''
  });

  const [importedFiles, setImportedFiles] = useState({ employees: null, timecard: null });
  const [importFiles, setImportFiles] = useState({ employees: null, timecard: null }); // File objects reais
  const [importing, setImporting] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [setupToast, setSetupToast] = useState(null); // { type: 'success'|'error', message }
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  const showSetupToast = (type, message) => {
    setSetupToast({ type, message });
    setTimeout(() => setSetupToast(null), 4000);
  };

  // Lado direito: dados gerenciáveis
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [timecards, setTimecards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [mercadologicos, setMercadologicos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkSetor, setBulkSetor] = useState('');
  const [addingSetor, setAddingSetor] = useState(false);
  const [showZonaConfig, setShowZonaConfig] = useState(false);
  const [newSetorName, setNewSetorName] = useState('');

  useEffect(() => {
    loadSavedSetup();
    loadEmployees();
    loadTimecards();
    loadMercadologicos();
  }, []);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const loadSavedSetup = async () => {
    try {
      const response = await fetch('/api/config/store-hours', { method: 'GET', headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setClientId(data.clientId || null);
        if (data.storeSetup) {
          setSetupData(prev => ({
            ...prev,
            company: data.storeSetup.empresa || '',
            store: data.storeSetup.loja || '',
            taxRegime: data.storeSetup.regimeTributario || 'Lucro Real',
            corredores: data.storeSetup.corredores || 1,
            pdvs: data.storeSetup.pdvs || '',
            weekdayHours: data.storeSetup.weekdayHours || '',
            saturdayHours: data.storeSetup.saturdayHours || '',
            sundayHours: data.storeSetup.sundayHours || '',
            sundayOperation: data.storeSetup.sundayOperation || ''
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configuração:', err);
    } finally {
      setSetupLoaded(true);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.employees || []);
        setEmployees(rows.map(normalizeEmployee));
      }
    } catch (err) {
      console.error('Erro ao carregar equipe:', err);
    } finally {
      setEmployeesLoaded(true);
    }
  };

  const rowKey = (r) => r.id ?? r._tempId;

  const loadMercadologicos = async () => {
    try {
      const res = await fetch('/api/mercadologicos', { headers: authHeaders() });
      if (res.ok) setMercadologicos(await res.json());
    } catch (err) {
      console.error('Erro ao carregar mercadológicos:', err);
    }
  };

  // Cadastra manualmente um setor que não existe no catálogo sincronizado
  // do ERP (ex: "Caixa" — função operacional, não departamento de
  // produto, então nunca vem do sync de mercadológico).
  const addNewSetor = async () => {
    const nome = newSetorName.trim();
    if (!nome) return;
    try {
      const res = await fetch('/api/mercadologicos', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ nome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar setor.');
      setMercadologicos((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      showSetupToast('success', `Setor "${data.nome}" criado.`);
      setNewSetorName('');
      setAddingSetor(false);
    } catch (err) {
      showSetupToast('error', 'Erro ao criar setor: ' + err.message);
    }
  };

  // Só é possível apagar setores cadastrados manualmente (erp_id nulo) —
  // o backend já bloqueia tentativa em cima de um mercadológico sincronizado.
  const deleteSetor = async (setor) => {
    if (!window.confirm(`Remover o setor "${setor.nome}"? Colaboradores atribuídos a ele ficam sem setor.`)) return;
    try {
      const res = await fetch(`/api/mercadologicos/${setor.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover setor.');
      setMercadologicos((prev) => prev.filter((m) => m.id !== setor.id));
      setEmployees((prev) => prev.map((r) => String(r.id_mercadologico) === String(setor.id) ? { ...r, setor: '', id_mercadologico: '' } : r));
      showSetupToast('success', `Setor "${setor.nome}" removido.`);
    } catch (err) {
      showSetupToast('error', err.message);
    }
  };

  // Atualiza a zona do mapa 3D (StoreFloorMap) de um mercadológico — o
  // admin escolhe explicitamente em qual "prédio" ele conta, em vez de
  // deixar o mapa adivinhar por palavra-chave (que deixava setores tipo
  // Bebidas/Higiene Pessoal invisíveis quando não batiam com nada).
  const setZonaMapa = async (mercadologico, zona) => {
    setMercadologicos((prev) => prev.map((m) => m.id === mercadologico.id ? { ...m, zona_mapa: zona || null } : m));
    try {
      const res = await fetch(`/api/mercadologicos/${mercadologico.id}/zona`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ zona_mapa: zona || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar zona.');
    } catch (err) {
      showSetupToast('error', err.message);
    }
  };

  // Atualiza o setor de UM colaborador imediatamente (sem precisar entrar
  // em modo de edição) — rápido pra ajustes pontuais.
  const setEmployeeSetor = async (emp, idMercadologico) => {
    const setorNome = mercadologicos.find((m) => String(m.id) === String(idMercadologico))?.nome || '';
    setEmployees((prev) => prev.map((r) => (r === emp ? { ...r, setor: setorNome, id_mercadologico: idMercadologico } : r)));
    if (!emp.id) return;
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ id_mercadologico: idMercadologico || null }),
      });
    } catch (err) {
      console.error('Erro ao atribuir setor:', err);
    }
  };

  // Atualiza um campo de preferência de escala (turno, papel, proficiência,
  // domingo) imediatamente, sem precisar entrar em modo de edição.
  const setEmployeeField = async (emp, field, value) => {
    setEmployees((prev) => prev.map((r) => (r === emp ? { ...r, [field]: value } : r)));
    if (!emp.id) return;
    try {
      await fetch(`/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) {
      console.error(`Erro ao atualizar ${field}:`, err);
    }
  };

  // Atribuição em massa: aplica o mesmo setor a todos os colaboradores
  // marcados de uma vez, pra não precisar editar um por um.
  const applyBulkSetor = async () => {
    if (!bulkSetor || selectedIds.length === 0) return;
    const setorNome = mercadologicos.find((m) => String(m.id) === String(bulkSetor))?.nome || '';
    const targets = employees.filter((r) => selectedIds.includes(rowKey(r)));
    setEmployees((prev) => prev.map((r) => (selectedIds.includes(rowKey(r)) ? { ...r, setor: setorNome, id_mercadologico: bulkSetor } : r)));
    await Promise.all(targets.filter((r) => r.id).map((r) =>
      fetch(`/api/employees/${r.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ id_mercadologico: bulkSetor }),
      }).catch((err) => console.error('Erro ao atribuir setor em massa:', err))
    ));
    setSelectedIds([]);
    setBulkSetor('');
  };

  const toggleSelected = (key) => {
    setSelectedIds((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const toggleSelectAll = () => {
    const allKeys = employees.map(rowKey);
    setSelectedIds((prev) => prev.length === allKeys.length ? [] : allKeys);
  };

  const loadTimecards = async () => {
    try {
      const res = await fetch('/api/timecards', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.timecards || []);
        setTimecards(rows.map(normalizeTimecard));
      }
    } catch (err) {
      console.error('Erro ao carregar ponto:', err);
    }
  };

  const handleSetupChange = (field, value) => setSetupData({ ...setupData, [field]: value });
  const handleFileChange = (field, file) => {
    setImportedFiles({ ...importedFiles, [field]: file?.name || null });
    setImportFiles({ ...importFiles, [field]: file || null });
  };

  // Lê o CSV (";" como separador) e devolve um array de objetos usando a
  // primeira linha como cabeçalho.
  const parseCsv = (text) => {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(';').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(';');
      const row = {};
      headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
      return row;
    });
  };

  const handleImportEmployees = async () => {
    const file = importFiles.employees;
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showSetupToast('error', 'CSV vazio ou em formato inválido.');
        return;
      }
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao importar equipe.');
      showSetupToast('success', `${data.inserted} colaborador${data.inserted === 1 ? '' : 'es'} importado${data.inserted === 1 ? '' : 's'} com sucesso!`);
      setImportFiles({ ...importFiles, employees: null });
      setImportedFiles({ ...importedFiles, employees: null });
      await loadEmployees();
    } catch (err) {
      showSetupToast('error', 'Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = (type) => {
    const templates = {
      employees: 'nome;cpf;sexo;cargo;horas_semanais;salario\nLucila;000.000.000-00;Feminino;Operadora de Caixa;44;1650\nEdvania;000.000.000-00;Feminino;Operadora de Caixa;44;1650\nSamara;000.000.000-00;Feminino;Operadora de Caixa;44;1650\nJane;000.000.000-00;Feminino;Operadora de Caixa;44;1650\n',
      timecard: 'nome;data;entrada;saida\nLucila;2026-06-09;07:02;15:05\nLucila;2026-06-10;06:58;15:01\nEdvania;2026-06-09;08:03;16:10\nEdvania;2026-06-10;07:55;16:02\nSamara;2026-06-09;10:05;19:03\nJane;2026-06-09;10:01;18:58\n'
    };
    const fileNames = { employees: 'modelo-equipe-caixa.csv', timecard: 'modelo-ponto.csv' };
    const csv = templates[type];
    const link = document.createElement('a');
    const bomContent = type === 'employees' ? csv : '\uFEFF' + csv;
    link.href = URL.createObjectURL(new Blob([bomContent], { type: 'text/csv;charset=utf-8' }));
    link.download = fileNames[type];
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleSubmitSetup = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/config/store-hours', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          empresa: setupData.company,
          loja: setupData.store,
          regimeTributario: setupData.taxRegime,
          corredores: setupData.corredores,
          pdvs: setupData.pdvs,
          weekdayHours: setupData.weekdayHours,
          saturdayHours: setupData.saturdayHours,
          sundayHours: setupData.sundayHours,
          sundayOperation: setupData.sundayOperation
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao salvar configuração');
      }
      const data = await response.json();
      showSetupToast('success', data.message || 'Configuração da loja salva com sucesso!');
      await loadSavedSetup();
    } catch (err) {
      showSetupToast('error', 'Erro ao salvar: ' + err.message);
    }
  };

  // ---- Gerenciamento (lado direito) ----
  const startEdit = (row) => { setEditingId(row.id ?? row._tempId); setEditRow({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditRow(null); };

  const saveEdit = async () => {
    const endpoint = activeTab === 'employees' ? '/api/employees' : '/api/timecards';
    try {
      if (editRow.id) {
        await fetch(`${endpoint}/${editRow.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(editRow) });
      }
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
    }
    if (activeTab === 'employees') {
      setEmployees(prev => prev.map(r => (r.id ?? r._tempId) === editingId ? { ...editRow } : r));
    } else {
      setTimecards(prev => prev.map(r => (r.id ?? r._tempId) === editingId ? { ...editRow } : r));
    }
    cancelEdit();
  };

  const deleteRow = async (row) => {
    if (!window.confirm('Remover este registro?')) return;
    const endpoint = activeTab === 'employees' ? '/api/employees' : '/api/timecards';
    try {
      if (row.id) await fetch(`${endpoint}/${row.id}`, { method: 'DELETE', headers: authHeaders() });
    } catch (err) {
      console.error('Erro ao remover:', err);
    }
    if (activeTab === 'employees') setEmployees(prev => prev.filter(r => r !== row));
    else setTimecards(prev => prev.filter(r => r !== row));
  };

  const addEmployee = () => {
    const novo = { ...EMPTY_EMPLOYEE, _tempId: `tmp-${Date.now()}` };
    setEmployees(prev => [novo, ...prev]);
    startEdit(novo);
  };

  // ---------------- Estilos ----------------
  const c = {
    text: '#e8eef5',
    muted: '#94a3b8',
    accent: '#4aa8ff',
    accentDeep: '#1e6fc4',
    border: 'rgba(255,255,255,0.09)',
  };

  const containerStyle = {
    position: 'relative',
    minHeight: '100vh',
    padding: '40px 32px 56px',
    color: c.text,
    fontFamily: 'inherit',
    background: 'radial-gradient(1300px 640px at 50% -340px, #0f1b33 0%, #0a0e1a 55%, #070a13 100%)',
    overflow: 'hidden',
  };

  const arcStyle = {
    position: 'absolute', top: '-280px', left: '50%', transform: 'translateX(-50%)',
    width: '1000px', height: '560px', borderRadius: '50%',
    background: 'radial-gradient(closest-side, rgba(74,168,255,0.26), rgba(74,168,255,0.04) 62%, transparent 72%)',
    filter: 'blur(6px)', pointerEvents: 'none', animation: 'imp-breathe 7s ease-in-out infinite',
  };
  const gridBgStyle = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
    backgroundSize: '26px 26px',
    maskImage: 'radial-gradient(760px 400px at 50% 0%, #000 0%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(760px 400px at 50% 0%, #000 0%, transparent 78%)',
  };
  const contentStyle = { position: 'relative', maxWidth: '1280px', margin: '0 auto' };

  const sectionHeadStyle = { marginBottom: '30px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' };
  const eyebrowStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    margin: '0 0 14px', padding: '6px 13px', borderRadius: '999px',
    background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.22)',
    color: c.accent, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
  };
  const eyebrowDot = { width: '6px', height: '6px', borderRadius: '50%', background: c.accent, boxShadow: `0 0 10px ${c.accent}`, animation: 'imp-dot 1.8s ease-in-out infinite' };
  const h2Style = {
    margin: 0, fontSize: '24px', lineHeight: 1.25, maxWidth: '780px', fontWeight: 700, letterSpacing: '-0.01em',
    color: c.text,
  };
  const softPillStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#fcd34d', whiteSpace: 'nowrap', height: 'fit-content' };

  const columnsWrap = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' };
  const managementWrap = { marginTop: '10px' };

  const sideHeader = () => ({ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: `1px solid ${c.border}` });
  const sideBar = (color) => ({ width: '4px', height: '16px', borderRadius: '3px', background: color });
  const sideTitle = { margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.text };

  const panelStyle = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    border: `1px solid ${c.border}`,
    borderRadius: '18px', padding: '24px', marginBottom: '18px',
    boxShadow: '0 30px 80px -50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  };
  const panelHeadStyle = { marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${c.border}` };
  const h3Style = { margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: c.text, display: 'flex', alignItems: 'center', gap: '8px' };
  const numBadge = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '7px', background: 'linear-gradient(135deg, #4aa8ff, #1e6fc4)', color: '#ffffff', fontSize: '12px', fontWeight: 800, boxShadow: '0 4px 12px -4px rgba(74,168,255,0.7)' };
  const noteStyle = { margin: 0, fontSize: '12.5px', color: c.muted, lineHeight: 1.5 };

  const labelStyle = { display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px', padding: '7px 0', fontSize: '13px', color: c.text };
  const labelStackStyle = { display: 'grid', gridTemplateColumns: '1fr', gap: '6px', padding: '7px 0', fontSize: '13px', color: c.text };
  const inputStyle = { padding: '11px 13px', borderRadius: '10px', border: `1px solid ${c.border}`, background: 'rgba(255,255,255,0.04)', color: c.text, fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color .18s ease, box-shadow .18s ease, background .18s ease' };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const buttonStyle = { padding: '12px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #4aa8ff, #1e6fc4)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' };
  const secondaryButtonStyle = { padding: '10px 15px', borderRadius: '10px', background: 'rgba(74,168,255,0.1)', color: c.accent, border: '1px solid rgba(74,168,255,0.3)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' };
  const ghostBtn = { padding: '7px 11px', borderRadius: '8px', background: 'transparent', color: c.muted, border: `1px solid ${c.border}`, fontWeight: 600, cursor: 'pointer', fontSize: '11px', transition: 'all .15s ease' };

  const colBadge = { display: 'block', background: 'rgba(255,255,255,0.025)', padding: '13px', borderRadius: '10px', marginBottom: '14px', fontSize: '11px', border: `1px solid ${c.border}` };
  const codeStyle = { display: 'block', color: c.muted, marginTop: '4px', fontFamily: 'monospace', fontSize: '10.5px' };
  const fileNameBox = { fontSize: '12px', color: c.muted, marginBottom: '14px', padding: '11px', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', border: `1px dashed ${c.border}` };

  const tabBtn = (active) => ({ flex: 1, padding: '11px 15px', borderRadius: '10px', border: `1px solid ${active ? 'rgba(74,168,255,0.45)' : c.border}`, background: active ? 'rgba(74,168,255,0.12)' : 'transparent', color: active ? c.accent : c.muted, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all .18s ease' });

  const th = { textAlign: 'left', padding: '11px 10px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#12172a', zIndex: 1 };
  const td = { padding: '10px', fontSize: '12.5px', color: c.text, borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
  const cellInput = { ...inputStyle, padding: '7px 9px', fontSize: '12px' };

  const emptyState = { textAlign: 'center', padding: '48px 20px', color: c.muted, fontSize: '13px', lineHeight: 1.6 };

  const ImportCard = ({ num, title, desc, columns, field, importLabel, sqlExample, warning, note }) => (
    <div className="imp-card imp-fade" style={panelStyle}>
      <div style={panelHeadStyle}>
        <h3 style={h3Style}>
          <span style={numBadge}>{num}</span> {title}
        </h3>
        <p style={noteStyle}>{desc}</p>
      </div>
      <div style={colBadge}>
        <strong style={{ color: c.text }}>Colunas:</strong>
        <code style={codeStyle}>{columns}</code>
      </div>
      {sqlExample && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11.5px', color: c.muted, marginBottom: '6px' }}>
            Se os dados vêm do Domínio, essa consulta já traz a maior parte das colunas prontas:
          </div>
          <pre style={{
            margin: 0, padding: '10px 12px', borderRadius: '8px', fontSize: '11px', lineHeight: 1.5,
            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', color: '#9fd3ff',
            overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}>{sqlExample}</pre>
        </div>
      )}
      <input className="imp-file imp-input" type="file" accept=".csv,.txt" onChange={(e) => handleFileChange(field, e.target.files?.[0])} style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }} />
      <div style={fileNameBox}>{importedFiles[field] ? importedFiles[field] : 'Nenhum arquivo selecionado'}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="imp-btn" onClick={() => downloadTemplate(field)} style={secondaryButtonStyle}>Baixar modelo</button>
        <button
          type="button"
          className="imp-btn"
          disabled={field === 'employees' && (!importFiles.employees || importing)}
          onClick={field === 'employees' ? handleImportEmployees : undefined}
          style={{ ...buttonStyle, opacity: (field === 'employees' && (!importFiles.employees || importing)) ? 0.5 : 1, cursor: (field === 'employees' && (!importFiles.employees || importing)) ? 'not-allowed' : 'pointer' }}
        >
          {field === 'employees' && importing ? 'Importando...' : importLabel}
        </button>
      </div>
      {warning && (
        <div style={{
          marginTop: '12px', padding: '9px 12px', borderRadius: '8px', fontSize: '11.5px', lineHeight: 1.5,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', color: '#fde68a',
        }}>⚠ {warning}</div>
      )}
      {note && (
        <div style={{
          marginTop: '12px', padding: '9px 12px', borderRadius: '8px', fontSize: '11.5px', lineHeight: 1.5,
          background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.25)', color: '#bcd8ff',
        }}>ℹ {note}</div>
      )}
    </div>
  );


  // Completude real da implantação. Etapa 3 (Ponto) é opcional — não conta
  // como pendência. Etapa 1 (config da loja) e 2 (equipe) são obrigatórias.
  const setupIncompleto = !setupData.pdvs || !setupData.weekdayHours || !setupData.saturdayHours || !setupData.sundayOperation;
  const equipeIncompleta = employees.length === 0;

  return (
    <div style={containerStyle}>
      <style>{globalStyles}</style>
      <div style={arcStyle} />
      <div style={gridBgStyle} />

      {setupToast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
          color: setupToast.type === 'success' ? '#6ee7b7' : '#fca5a5',
          background: setupToast.type === 'success' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
          border: `1px solid ${setupToast.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 20px 40px -16px rgba(0,0,0,0.6)',
          animation: 'imp-fade-up .3s ease both',
        }}>
          {setupToast.type === 'success' ? '✓' : '⚠'} {setupToast.message}
          <button
            onClick={() => setSetupToast(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, opacity: 0.7, marginLeft: 4 }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={contentStyle}>
        {/* Section Head */}
        <div className="imp-fade" style={sectionHeadStyle}>
          <div>
            <span style={eyebrowStyle}><span style={eyebrowDot} /> Começar implantação</span>
            <h2 style={h2Style}>Configure a loja, importe e gerencie os dados do diagnóstico</h2>
          </div>
        </div>

        {/* ============== LINHA 1: CONFIGURAÇÃO (LARGURA TOTAL) ============== */}
        <div style={{ position: 'relative' }}>
          {setupLoaded && setupIncompleto && (
            <div className="imp-callout">
              <div className="imp-callout-bubble">⚠ Configuração incompleta</div>
              <div className="imp-callout-tail" />
            </div>
          )}
          <div className="imp-fade" style={sideHeader()}>
            <span style={sideBar(c.accent)} />
            <h3 style={sideTitle}>Configuração da Loja</h3>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSubmitSetup} className="imp-card imp-fade" style={panelStyle}>
            <div style={panelHeadStyle}>
              <h3 style={h3Style}><span style={numBadge}>1</span> Empresa e operação</h3>
              <p style={noteStyle}>Dados usados nos cálculos e relatórios da implantação.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <label style={labelStackStyle}>
                  <span>Empresa</span>
                  <input className="imp-input" type="text" value={setupData.company} onChange={(e) => handleSetupChange('company', e.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Loja</span>
                  <input className="imp-input" type="text" value={setupData.store} onChange={(e) => handleSetupChange('store', e.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Regime tributário</span>
                  <select className="imp-input" value={setupData.taxRegime} onChange={(e) => handleSetupChange('taxRegime', e.target.value)} style={selectStyle}>
                    <option>Lucro Real</option>
                    <option>Lucro Presumido</option>
                    <option>Simples Nacional</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <label style={labelStackStyle}>
                  <span>PDVs (checkouts físicos da loja)</span>
                  <input className="imp-input" type="number" min="1" placeholder="Ex: 8" value={setupData.pdvs} onChange={(e) => handleSetupChange('pdvs', e.target.value === '' ? '' : parseInt(e.target.value))} style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Corredores</span>
                  <input className="imp-input" type="number" min="1" value={setupData.corredores} onChange={(e) => handleSetupChange('corredores', parseInt(e.target.value))} style={inputStyle} required />
                </label>
                <HourRangeField
                  label="Seg-Sex"
                  value={setupData.weekdayHours}
                  onChange={(v) => handleSetupChange('weekdayHours', v)}
                  inputStyle={inputStyle}
                  labelStackStyle={labelStackStyle}
                  required
                />
                <HourRangeField
                  label="Sábado"
                  value={setupData.saturdayHours}
                  onChange={(v) => handleSetupChange('saturdayHours', v)}
                  inputStyle={inputStyle}
                  labelStackStyle={labelStackStyle}
                  required
                />
                <label style={labelStackStyle}>
                  <span>Domingo</span>
                  <select className="imp-input" value={setupData.sundayOperation} onChange={(e) => handleSetupChange('sundayOperation', e.target.value)} style={selectStyle} required>
                    <option value="" disabled>Selecione...</option>
                    <option value="aberto">Abre aos domingos</option>
                    <option value="fechado">Fecha todos os domingos</option>
                    <option value="parcial">Fecha parte dos domingos</option>
                  </select>
                </label>
                {setupData.sundayOperation !== 'fechado' && (
                  <HourRangeField
                    label="Horário de domingo"
                    value={setupData.sundayHours}
                    onChange={(v) => handleSetupChange('sundayHours', v)}
                    inputStyle={inputStyle}
                    labelStackStyle={labelStackStyle}
                    required
                  />
                )}
              </div>
            </div>

            <button type="submit" className="imp-btn" style={buttonStyle}>Salvar configuração da loja</button>
          </form>
        </div>

        {/* ============== LINHA 2: IMPORTAÇÃO (DUAS COLUNAS) ============== */}
        <div style={{ marginTop: '20px', position: 'relative' }}>
          {employeesLoaded && equipeIncompleta && (
            <div className="imp-callout-left" style={{ top: '380px', left: '-200px' }}>
              <div className="imp-callout-bubble">⚠ Importe a equipe (obrigatório)</div>
              <div className="imp-callout-tail-right" />
            </div>
          )}
          <div className="imp-fade" style={sideHeader()}>
            <span style={sideBar('#fbbf24')} />
            <h3 style={sideTitle}>Importação de Dados</h3>
          </div>

          <div style={columnsWrap}>
            {/* Importar Equipe */}
            <ImportCard
              num="2"
              title="Importar equipe"
              desc="Importe colaboradores de um CSV"
              columns="nome;cpf;sexo;cargo;horas_semanais;salario"
              field="employees"
              importLabel="Importar equipe"
              sqlExample={DOMINIO_SQL_EXEMPLO}
              warning="Esses dados vêm de outro sistema (ex: Domínio) e o CSV é montado por você. Depois de importar, revise sexo e cargo em Gerenciar dados importados — dependendo de como foi cadastrado no seu ERP de origem, esses campos podem vir incorretos. O setor não faz parte do CSV: você atribui cada colaborador a um departamento real (sincronizado do seu sistema de vendas) diretamente em Gerenciar dados importados."
            />

            {/* Importar Ponto */}
            <ImportCard
              num="3"
              title="Importar ponto"
              desc="Registros de entrada/saída real"
              columns="nome;data;entrada;saida"
              field="timecard"
              importLabel="Importar ponto"
              note="Essa etapa é opcional — não é obrigatória pra concluir a implantação."
            />
          </div>
        </div>

        {/* ============== GERENCIAMENTO (LARGURA TOTAL) ============== */}
        <div style={managementWrap}>
          <div className="imp-fade" style={sideHeader()}>
            <span style={sideBar('#34d399')} />
            <h3 style={sideTitle}>Gerenciar Dados Importados</h3>
          </div>

            <div className="imp-card imp-fade" style={panelStyle}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <button type="button" onClick={() => { setActiveTab('employees'); cancelEdit(); }} style={tabBtn(activeTab === 'employees')}>
                  Equipe ({employees.length})
                </button>
                <button type="button" onClick={() => { setActiveTab('timecard'); cancelEdit(); }} style={tabBtn(activeTab === 'timecard')}>
                  Ponto ({timecards.length})
                </button>
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <p style={noteStyle}>
                  {activeTab === 'employees' ? 'Edite, adicione ou remova colaboradores.' : 'Edite ou remova registros de ponto.'}
                </p>
                {activeTab === 'employees' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {addingSetor ? (
                      <>
                        <input
                          className="imp-input" style={{ ...cellInput, width: 180 }} autoFocus
                          placeholder="Nome do setor (ex: Caixa)"
                          value={newSetorName}
                          onChange={(e) => setNewSetorName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addNewSetor()}
                        />
                        <button type="button" className="imp-btn" onClick={addNewSetor} style={{ ...secondaryButtonStyle, opacity: newSetorName.trim() ? 1 : 0.5 }} disabled={!newSetorName.trim()}>Salvar</button>
                        <button type="button" onClick={() => { setAddingSetor(false); setNewSetorName(''); }} style={ghostBtn}>Cancelar</button>
                      </>
                    ) : (
                      <button type="button" className="imp-btn" onClick={() => setAddingSetor(true)} style={secondaryButtonStyle}>+ Novo setor</button>
                    )}
                    <button type="button" className="imp-btn" onClick={addEmployee} style={secondaryButtonStyle}>+ Adicionar</button>
                    <button type="button" className="imp-btn" onClick={() => setShowZonaConfig((v) => !v)} style={secondaryButtonStyle}>
                      {showZonaConfig ? 'Fechar zonas do mapa' : 'Configurar zonas do mapa'}
                    </button>
                  </div>
                )}
              </div>

              {activeTab === 'employees' && showZonaConfig && (
                <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 12, color: c.text, fontWeight: 600, marginBottom: 4 }}>Zona do mapa (Planta da Loja) por setor</div>
                  <p style={{ fontSize: 11, color: c.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
                    Escolha em qual "prédio" do mapa 3D cada setor real do seu catálogo conta. Setores sem escolha ficam no modo automático (adivinha por palavra-chave, pode errar).
                  </p>
                  <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 6 }}>
                    {mercadologicos.map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 12, color: c.text }}>{m.nome}</span>
                        <select
                          className="imp-input" style={{ ...cellInput, width: 220 }}
                          value={m.zona_mapa || ''}
                          onChange={(e) => setZonaMapa(m, e.target.value)}
                        >
                          {ZONAS_MAPA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'employees' && mercadologicos.some((m) => m.erp_id === null) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: c.muted }}>Setores adicionados por você:</span>
                  {mercadologicos.filter((m) => m.erp_id === null).map((m) => (
                    <span key={m.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: c.text,
                      padding: '4px 6px 4px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.border}`,
                    }}>
                      {m.nome}
                      <button
                        type="button" onClick={() => deleteSetor(m)} title="Remover setor"
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '2px 4px' }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Barra de atribuição em massa — aparece só com seleção ativa */}
              {activeTab === 'employees' && selectedIds.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.25)',
                }}>
                  <span style={{ fontSize: 12.5, color: c.text, fontWeight: 600 }}>{selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}</span>
                  <select className="imp-input" style={{ ...cellInput, flex: 1, maxWidth: 260 }} value={bulkSetor} onChange={(e) => setBulkSetor(e.target.value)}>
                    <option value="">Escolher setor...</option>
                    {mercadologicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  <button type="button" className="imp-btn" disabled={!bulkSetor} onClick={applyBulkSetor} style={{ ...buttonStyle, padding: '7px 14px', fontSize: '12px', opacity: bulkSetor ? 1 : 0.5 }}>Aplicar a todos</button>
                  <button type="button" onClick={() => setSelectedIds([])} style={ghostBtn}>Limpar seleção</button>
                </div>
              )}

              {/* Tabela Equipe */}
              {activeTab === 'employees' && (
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 560 }}>
                  {employees.length === 0 ? (
                    <div style={emptyState}>Nenhum colaborador importado ainda.<br />Importe a equipe no painel acima.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, width: 30 }}>
                            <input className="imp-checkbox" type="checkbox" checked={selectedIds.length === employees.length} onChange={toggleSelectAll} />
                          </th>
                          <th style={th}>Nome</th>
                          <th style={th}>Cargo</th>
                          <th style={th}>Setor</th>
                          <th style={th}>Horas</th>
                          <th style={th}>Salário</th>
                          <th style={th}>Turno</th>
                          <th style={th}>Papel</th>
                          <th style={th}>Proficiência</th>
                          <th style={{ ...th, textAlign: 'center' }}>Dom.</th>
                          <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...employees].sort((a, b) => (a.cargo || '').localeCompare(b.cargo || '', 'pt-BR')).map((emp) => {
                          const editing = editingId === rowKey(emp);
                          const key = rowKey(emp);
                          const expanded = expandedId === key;
                          return (
                            <React.Fragment key={key}>
                            <tr className="imp-row" style={expanded ? { background: 'rgba(74,168,255,0.07)', boxShadow: 'inset 3px 0 0 rgba(74,168,255,0.6)' } : undefined}>
                              <td style={td}>
                                <input className="imp-checkbox" type="checkbox" checked={selectedIds.includes(key)} onChange={() => toggleSelected(key)} />
                              </td>
                              {editing ? (
                                <>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.nome || ''} onChange={(e) => setEditRow({ ...editRow, nome: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.cargo || ''} onChange={(e) => setEditRow({ ...editRow, cargo: e.target.value })} /></td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.id_mercadologico || ''} onChange={(e) => setEmployeeSetor(emp, e.target.value)}>
                                      <option value="">Sem setor</option>
                                      {mercadologicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}><input className="imp-input" type="number" style={cellInput} value={editRow.horas_semanais || ''} onChange={(e) => setEditRow({ ...editRow, horas_semanais: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" type="number" style={cellInput} value={editRow.salario || ''} onChange={(e) => setEditRow({ ...editRow, salario: e.target.value })} /></td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.turno || 'flexivel'} onChange={(e) => setEmployeeField(emp, 'turno', e.target.value)}>
                                      {TURNO_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.papel_operacional || 'auto'} onChange={(e) => setEmployeeField(emp, 'papel_operacional', e.target.value)}>
                                      {PAPEL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}>
                                    <select
                                      className="imp-input" style={{ ...cellInput, borderColor: emp.proficiencia ? undefined : 'rgba(251,191,36,0.5)' }}
                                      value={emp.proficiencia || ''} onChange={(e) => setEmployeeField(emp, 'proficiencia', e.target.value)}
                                    >
                                      <option value="">Escolher...</option>
                                      {PROFICIENCIA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={{ ...td, textAlign: 'center' }}>
                                    <input className="imp-checkbox" type="checkbox" checked={emp.pode_domingo !== false} onChange={(e) => setEmployeeField(emp, 'pode_domingo', e.target.checked)} />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" className="imp-btn" onClick={saveEdit} style={{ ...buttonStyle, padding: '7px 13px', fontSize: '11px', marginRight: '6px' }}>Salvar</button>
                                    <button type="button" onClick={cancelEdit} style={ghostBtn}>Cancelar</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ ...td, fontWeight: 600 }}>{emp.nome}</td>
                                  <td style={td}>{emp.cargo}</td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.id_mercadologico || ''} onChange={(e) => setEmployeeSetor(emp, e.target.value)}>
                                      <option value="">Sem setor</option>
                                      {mercadologicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}>{emp.horas_semanais}h</td>
                                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{emp.salario ? Number(emp.salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.turno || 'flexivel'} onChange={(e) => setEmployeeField(emp, 'turno', e.target.value)}>
                                      {TURNO_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={emp.papel_operacional || 'auto'} onChange={(e) => setEmployeeField(emp, 'papel_operacional', e.target.value)}>
                                      {PAPEL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={td}>
                                    <select
                                      className="imp-input" style={{ ...cellInput, borderColor: emp.proficiencia ? undefined : 'rgba(251,191,36,0.5)' }}
                                      value={emp.proficiencia || ''} onChange={(e) => setEmployeeField(emp, 'proficiencia', e.target.value)}
                                    >
                                      <option value="">Escolher...</option>
                                      {PROFICIENCIA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                  </td>
                                  <td style={{ ...td, textAlign: 'center' }}>
                                    <input className="imp-checkbox" type="checkbox" checked={emp.pode_domingo !== false} onChange={(e) => setEmployeeField(emp, 'pode_domingo', e.target.checked)} />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" onClick={() => setExpandedId(expanded ? null : key)} style={{ ...ghostBtn, marginRight: '6px' }}>{expanded ? 'Menos' : 'Mais'}</button>
                                    <button type="button" onClick={() => startEdit(emp)} style={{ ...ghostBtn, marginRight: '6px', color: c.accent, borderColor: 'rgba(74,168,255,0.3)' }}>Editar</button>
                                    <button type="button" onClick={() => deleteRow(emp)} style={{ ...ghostBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Excluir</button>
                                  </td>
                                </>
                              )}
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={11} style={{ ...td, background: 'rgba(74,168,255,0.07)', boxShadow: 'inset 3px 0 0 rgba(74,168,255,0.6)', padding: '14px 16px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: c.muted }}>
                                      CPF
                                      <input className="imp-input" style={cellInput} defaultValue={emp.cpf || ''} onBlur={(e) => setEmployeeField(emp, 'cpf', e.target.value)} />
                                    </label>
                                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: c.muted }}>
                                      Sexo
                                      <select className="imp-input" style={cellInput} value={emp.sexo || 'Feminino'} onChange={(e) => setEmployeeField(emp, 'sexo', e.target.value)}>
                                        <option>Feminino</option>
                                        <option>Masculino</option>
                                      </select>
                                    </label>
                                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: c.muted }}>
                                      Folga preferencial
                                      <select className="imp-input" style={cellInput} value={emp.folga_preferencial || ''} onChange={(e) => setEmployeeField(emp, 'folga_preferencial', e.target.value)}>
                                        {DIAS_SEMANA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                      </select>
                                    </label>
                                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: c.muted }}>
                                      Setores aptos
                                      <input
                                        className="imp-input" style={cellInput} placeholder="Padaria, Hortifruti..."
                                        defaultValue={emp.setores_aptos?.join(', ') || ''}
                                        onBlur={(e) => setEmployeeField(emp, 'setores_aptos', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                                      />
                                    </label>
                                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: c.muted }}>
                                      Restrições
                                      <input
                                        className="imp-input" style={cellInput} placeholder="Sem noite, sem domingo..."
                                        defaultValue={emp.restricoes?.join(', ') || ''}
                                        onBlur={(e) => setEmployeeField(emp, 'restricoes', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
                                      />
                                    </label>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tabela Ponto */}
              {activeTab === 'timecard' && (
                <div style={{ overflowX: 'auto' }}>
                  {timecards.length === 0 ? (
                    <div style={emptyState}>Nenhum registro de ponto importado ainda.<br />Importe o ponto no painel acima.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Nome</th>
                          <th style={th}>Data</th>
                          <th style={th}>Entrada</th>
                          <th style={th}>Saída</th>
                          <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timecards.map((tc) => {
                          const editing = editingId === rowKey(tc);
                          return (
                            <tr key={rowKey(tc)} className="imp-row">
                              {editing ? (
                                <>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.nome || ''} onChange={(e) => setEditRow({ ...editRow, nome: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.data || ''} onChange={(e) => setEditRow({ ...editRow, data: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.entrada || ''} onChange={(e) => setEditRow({ ...editRow, entrada: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.saida || ''} onChange={(e) => setEditRow({ ...editRow, saida: e.target.value })} /></td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" className="imp-btn" onClick={saveEdit} style={{ ...buttonStyle, padding: '7px 13px', fontSize: '11px', marginRight: '6px' }}>Salvar</button>
                                    <button type="button" onClick={cancelEdit} style={ghostBtn}>Cancelar</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ ...td, fontWeight: 600 }}>{tc.nome}</td>
                                  <td style={td}>{tc.data}</td>
                                  <td style={td}>{tc.entrada}</td>
                                  <td style={td}>{tc.saida}</td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" onClick={() => startEdit(tc)} style={{ ...ghostBtn, marginRight: '6px', color: c.accent, borderColor: 'rgba(74,168,255,0.3)' }}>Editar</button>
                                    <button type="button" onClick={() => deleteRow(tc)} style={{ ...ghostBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Excluir</button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
