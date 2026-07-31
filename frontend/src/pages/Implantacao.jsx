import React, { useState, useEffect } from 'react';

const globalStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] { -moz-appearance: textfield; }

  select option {
    background-color: #101827;
    color: #e8eef5;
    padding: 8px;
  }
  select option:checked { background-color: #1e4b7a; color: #fff; }

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
    transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
  }
  .imp-card:hover {
    border-color: rgba(74,168,255,0.35);
    transform: translateY(-2px);
    box-shadow: 0 24px 60px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(74,168,255,0.12);
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
`;

const EMPTY_EMPLOYEE = { nome: '', sexo: 'Feminino', cargo: '', setor: '', horas_semanais: 44, salario: '' };

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
  sexo: pick(e, ['sexo', 'sex', 'genero', 'gender']) || 'Feminino',
  cargo: pick(e, ['cargo', 'role', 'funcao', 'position']),
  setor: pick(e, ['setor', 'sector', 'departamento', 'department', 'area']),
  horas_semanais: pick(e, ['horas_semanais', 'horas', 'carga_horaria', 'weekly_hours', 'hours', 'jornada']),
  salario: pick(e, ['salario', 'salary', 'wage', 'remuneracao']),
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

export default function Implantacao() {
  const [setupData, setSetupData] = useState({
    company: '',
    store: '',
    taxRegime: 'Lucro Real',
    corredores: 1,
    pdvs: 3,
    weekdayHours: '08:00-20:00',
    saturdayHours: '07:00-20:00',
    sundayOperation: 'aberto',
    closedSundays: 0,
    sundayHours: '09:00-18:00'
  });

  const [importedFiles, setImportedFiles] = useState({ employees: null, timecard: null });
  const [clientId, setClientId] = useState(null);

  // Lado direito: dados gerenciáveis
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [timecards, setTimecards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);

  useEffect(() => {
    loadSavedSetup();
    loadEmployees();
    loadTimecards();
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
            pdvs: data.storeSetup.pdvs || 3,
            weekdayHours: data.storeSetup.weekdayHours || '08:00-20:00',
            saturdayHours: data.storeSetup.saturdayHours || '07:00-20:00',
            sundayHours: data.storeSetup.sundayHours || '09:00-18:00',
            sundayOperation: data.storeSetup.sundayOperation || 'aberto'
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configuração:', err);
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
    }
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
  const handleFileChange = (field, file) => setImportedFiles({ ...importedFiles, [field]: file?.name || null });

  const downloadTemplate = (type) => {
    const templates = {
      employees: 'nome;sexo;cargo;setor;horas_semanais;salario\nLucila;Feminino;Operadora de Caixa;Caixa;44;1650\nEdvania;Feminino;Operadora de Caixa;Caixa;44;1650\nSamara;Feminino;Operadora de Caixa;Caixa;44;1650\nJane;Feminino;Operadora de Caixa;Caixa;44;1650\n',
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
      alert(data.message || 'Configuração da loja salva com sucesso!');
      await loadSavedSetup();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
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

  const th = { textAlign: 'left', padding: '11px 10px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' };
  const td = { padding: '10px', fontSize: '12.5px', color: c.text, borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
  const cellInput = { ...inputStyle, padding: '7px 9px', fontSize: '12px' };

  const emptyState = { textAlign: 'center', padding: '48px 20px', color: c.muted, fontSize: '13px', lineHeight: 1.6 };

  const ImportCard = ({ num, title, desc, columns, field, importLabel }) => (
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
      <input className="imp-file imp-input" type="file" accept=".csv,.txt" onChange={(e) => handleFileChange(field, e.target.files?.[0])} style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }} />
      <div style={fileNameBox}>{importedFiles[field] ? importedFiles[field] : 'Nenhum arquivo selecionado'}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="imp-btn" onClick={() => downloadTemplate(field)} style={secondaryButtonStyle}>Baixar modelo</button>
        <button type="button" className="imp-btn" style={buttonStyle}>{importLabel}</button>
      </div>
    </div>
  );

  const rowKey = (r) => r.id ?? r._tempId;

  return (
    <div style={containerStyle}>
      <style>{globalStyles}</style>
      <div style={arcStyle} />
      <div style={gridBgStyle} />

      <div style={contentStyle}>
        {/* Section Head */}
        <div className="imp-fade" style={sectionHeadStyle}>
          <div>
            <span style={eyebrowStyle}><span style={eyebrowDot} /> Começar implantação</span>
            <h2 style={h2Style}>Configure a loja, importe e gerencie os dados do diagnóstico</h2>
          </div>
          <span style={softPillStyle}>Implantação incompleta</span>
        </div>

        {/* ============== LINHA 1: CONFIGURAÇÃO (LARGURA TOTAL) ============== */}
        <div>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '16px' }}>
                <label style={labelStackStyle}>
                  <span>PDVs</span>
                  <input className="imp-input" type="number" min="1" value={setupData.pdvs} onChange={(e) => handleSetupChange('pdvs', parseInt(e.target.value))} style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Corredores</span>
                  <input className="imp-input" type="number" min="1" value={setupData.corredores} onChange={(e) => handleSetupChange('corredores', parseInt(e.target.value))} style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Seg-Sex</span>
                  <input className="imp-input" type="text" value={setupData.weekdayHours} onChange={(e) => handleSetupChange('weekdayHours', e.target.value)} placeholder="08:00-20:00" style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Sábado</span>
                  <input className="imp-input" type="text" value={setupData.saturdayHours} onChange={(e) => handleSetupChange('saturdayHours', e.target.value)} placeholder="07:00-20:00" style={inputStyle} required />
                </label>
                <label style={labelStackStyle}>
                  <span>Domingo</span>
                  <select className="imp-input" value={setupData.sundayOperation} onChange={(e) => handleSetupChange('sundayOperation', e.target.value)} style={selectStyle}>
                    <option value="aberto">Abre aos domingos</option>
                    <option value="fechado">Fecha todos os domingos</option>
                    <option value="parcial">Fecha parte dos domingos</option>
                  </select>
                </label>
              </div>
            </div>

            <button type="submit" className="imp-btn" style={buttonStyle}>Salvar configuração da loja</button>

            {clientId && (
              <div style={{ marginTop: '16px', background: 'rgba(74,168,255,0.08)', border: '1px solid rgba(74,168,255,0.25)', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Código de integração do agente
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <code style={{ fontSize: '13px', color: c.text, fontFamily: 'monospace' }}>{clientId}</code>
                  <button
                    type="button"
                    className="imp-btn"
                    onClick={() => navigator.clipboard.writeText(clientId)}
                    style={{ ...ghostBtn, color: c.accent, borderColor: 'rgba(74,168,255,0.3)' }}
                  >
                    Copiar
                  </button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: c.muted }}>
                  Use este valor como <code>client_id</code> na configuração do agente instalado no cliente.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* ============== LINHA 2: IMPORTAÇÃO (DUAS COLUNAS) ============== */}
        <div style={{ marginTop: '20px' }}>
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
              columns="nome;sexo;cargo;setor;horas_semanais;salario"
              field="employees"
              importLabel="Importar equipe"
            />

            {/* Importar Ponto */}
            <ImportCard
              num="3"
              title="Importar ponto"
              desc="Registros de entrada/saída real"
              columns="nome;data;entrada;saida"
              field="timecard"
              importLabel="Importar ponto"
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
                  <button type="button" className="imp-btn" onClick={addEmployee} style={secondaryButtonStyle}>+ Adicionar</button>
                )}
              </div>

              {/* Tabela Equipe */}
              {activeTab === 'employees' && (
                <div style={{ overflowX: 'auto' }}>
                  {employees.length === 0 ? (
                    <div style={emptyState}>Nenhum colaborador importado ainda.<br />Importe a equipe no painel acima.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>Nome</th>
                          <th style={th}>Sexo</th>
                          <th style={th}>Cargo</th>
                          <th style={th}>Setor</th>
                          <th style={th}>Horas</th>
                          <th style={th}>Salário</th>
                          <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp) => {
                          const editing = editingId === rowKey(emp);
                          return (
                            <tr key={rowKey(emp)} className="imp-row">
                              {editing ? (
                                <>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.nome || ''} onChange={(e) => setEditRow({ ...editRow, nome: e.target.value })} /></td>
                                  <td style={td}>
                                    <select className="imp-input" style={cellInput} value={editRow.sexo || 'Feminino'} onChange={(e) => setEditRow({ ...editRow, sexo: e.target.value })}>
                                      <option>Feminino</option>
                                      <option>Masculino</option>
                                    </select>
                                  </td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.cargo || ''} onChange={(e) => setEditRow({ ...editRow, cargo: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" style={cellInput} value={editRow.setor || ''} onChange={(e) => setEditRow({ ...editRow, setor: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" type="number" style={cellInput} value={editRow.horas_semanais || ''} onChange={(e) => setEditRow({ ...editRow, horas_semanais: e.target.value })} /></td>
                                  <td style={td}><input className="imp-input" type="number" style={cellInput} value={editRow.salario || ''} onChange={(e) => setEditRow({ ...editRow, salario: e.target.value })} /></td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" className="imp-btn" onClick={saveEdit} style={{ ...buttonStyle, padding: '7px 13px', fontSize: '11px', marginRight: '6px' }}>Salvar</button>
                                    <button type="button" onClick={cancelEdit} style={ghostBtn}>Cancelar</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ ...td, fontWeight: 600 }}>{emp.nome}</td>
                                  <td style={td}>{emp.sexo}</td>
                                  <td style={td}>{emp.cargo}</td>
                                  <td style={td}>{emp.setor}</td>
                                  <td style={td}>{emp.horas_semanais}h</td>
                                  <td style={td}>{emp.salario ? `R$ ${emp.salario}` : '-'}</td>
                                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button type="button" onClick={() => startEdit(emp)} style={{ ...ghostBtn, marginRight: '6px', color: c.accent, borderColor: 'rgba(74,168,255,0.3)' }}>Editar</button>
                                    <button type="button" onClick={() => deleteRow(emp)} style={{ ...ghostBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Excluir</button>
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
