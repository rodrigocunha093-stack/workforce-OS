import React, { useState, useEffect } from 'react';

const globalStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] { -moz-appearance: textfield; }

  select option {
    background-color: #141a29;
    color: #e8eef5;
    padding: 8px;
  }
  select option:checked { background-color: #0369a1; color: #fff; }

  .imp-card {
    transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
  }
  .imp-card:hover {
    border-color: rgba(56,189,248,0.35);
    box-shadow: 0 8px 30px rgba(2,8,23,0.5);
  }
  .imp-btn { transition: filter .15s ease, transform .1s ease; }
  .imp-btn:hover { filter: brightness(1.1); }
  .imp-btn:active { transform: translateY(1px); }

  .imp-row { transition: background .15s ease; }
  .imp-row:hover { background: rgba(255,255,255,0.03); }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

  .imp-file::-webkit-file-upload-button {
    background: rgba(56,189,248,0.12);
    color: #38bdf8;
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: 6px;
    padding: 6px 12px;
    margin-right: 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
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
    bg: '#0a0e1a',
    panel: 'rgba(255,255,255,0.035)',
    panelBorder: 'rgba(255,255,255,0.08)',
    text: '#e8eef5',
    muted: '#94a3b8',
    accent: '#38bdf8',
    accentDeep: '#0369a1'
  };

  const containerStyle = { background: c.bg, minHeight: '100vh', padding: '28px 32px 48px', color: c.text, fontFamily: 'inherit' };

  const sectionHeadStyle = { marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' };
  const eyebrowStyle = { margin: '0 0 8px', color: c.accent, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' };
  const h2Style = { margin: 0, fontSize: '26px', lineHeight: 1.2, maxWidth: '760px', color: c.text, fontWeight: 700 };
  const softPillStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };

  const columnsWrap = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' };

  const sideHeader = (color) => ({ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${c.panelBorder}` });
  const sideDot = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}` });
  const sideTitle = { margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.text };

  const panelStyle = { background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: '14px', padding: '22px', marginBottom: '18px' };
  const panelHeadStyle = { marginBottom: '18px', paddingBottom: '14px', borderBottom: `1px solid ${c.panelBorder}` };
  const h3Style = { margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: c.text, display: 'flex', alignItems: 'center', gap: '8px' };
  const noteStyle = { margin: 0, fontSize: '12.5px', color: c.muted };

  const labelStyle = { display: 'grid', gridTemplateColumns: '130px 1fr', alignItems: 'center', gap: '12px', padding: '7px 0', fontSize: '13px', color: c.text };
  const inputStyle = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${c.panelBorder}`, background: 'rgba(255,255,255,0.04)', color: c.text, fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const buttonStyle = { padding: '11px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8, #0369a1)', color: '#06121f', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' };
  const secondaryButtonStyle = { padding: '9px 14px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', color: c.accent, border: '1px solid rgba(56,189,248,0.3)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' };
  const ghostBtn = { padding: '6px 10px', borderRadius: '6px', background: 'transparent', color: c.muted, border: `1px solid ${c.panelBorder}`, fontWeight: 600, cursor: 'pointer', fontSize: '11px' };

  const colBadge = { display: 'block', background: 'rgba(255,255,255,0.025)', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '11px', border: `1px solid ${c.panelBorder}` };
  const codeStyle = { display: 'block', color: c.muted, marginTop: '4px', fontFamily: 'monospace', fontSize: '10.5px' };
  const fileNameBox = { fontSize: '12px', color: c.muted, marginBottom: '14px', padding: '10px', background: 'rgba(255,255,255,0.025)', borderRadius: '8px', border: `1px dashed ${c.panelBorder}` };

  const tabBtn = (active) => ({ flex: 1, padding: '10px 14px', borderRadius: '8px', border: `1px solid ${active ? 'rgba(56,189,248,0.45)' : c.panelBorder}`, background: active ? 'rgba(56,189,248,0.12)' : 'transparent', color: active ? c.accent : c.muted, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' });

  const th = { textAlign: 'left', padding: '10px 10px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, borderBottom: `1px solid ${c.panelBorder}`, whiteSpace: 'nowrap' };
  const td = { padding: '9px 10px', fontSize: '12.5px', color: c.text, borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' };
  const cellInput = { ...inputStyle, padding: '6px 8px', fontSize: '12px' };

  const emptyState = { textAlign: 'center', padding: '40px 20px', color: c.muted, fontSize: '13px' };

  const ImportCard = ({ num, title, badge, desc, columns, field, importLabel }) => (
    <div className="imp-card" style={panelStyle}>
      <div style={panelHeadStyle}>
        <h3 style={h3Style}>
          <span style={{ color: c.accent }}>{num}.</span> {title}
          {badge && <span style={{ fontSize: '10px', color: '#fcd34d' }}>{badge}</span>}
        </h3>
        <p style={noteStyle}>{desc}</p>
      </div>
      <div style={colBadge}>
        <strong style={{ color: c.text }}>Colunas:</strong>
        <code style={codeStyle}>{columns}</code>
      </div>
      <input className="imp-file" type="file" accept=".csv,.txt" onChange={(e) => handleFileChange(field, e.target.files?.[0])} style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }} />
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

      {/* Section Head */}
      <div style={sectionHeadStyle}>
        <div>
          <p style={eyebrowStyle}>Começar implantação</p>
          <h2 style={h2Style}>Configure a loja, importe e gerencie os dados do diagnóstico</h2>
        </div>
        <span style={softPillStyle}>Implantação incompleta</span>
      </div>

      {/* Duas colunas */}
      <div style={columnsWrap}>
        {/* ============== LADO ESQUERDO: IMPORTAÇÃO & CONFIGURAÇÃO ============== */}
        <div>
          <div style={sideHeader()}>
            <span style={sideDot(c.accent)} />
            <h3 style={sideTitle}>Importação & Configuração</h3>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSubmitSetup} className="imp-card" style={panelStyle}>
            <div style={panelHeadStyle}>
              <h3 style={h3Style}><span style={{ color: c.accent }}>1.</span> Empresa e operação</h3>
              <p style={noteStyle}>Dados usados nos cálculos e relatórios da implantação.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '14px' }}>
              <label style={labelStyle}>
                <span>Empresa</span>
                <input type="text" value={setupData.company} onChange={(e) => handleSetupChange('company', e.target.value)} style={inputStyle} required />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                <label style={labelStyle}>
                  <span>Loja</span>
                  <input type="text" value={setupData.store} onChange={(e) => handleSetupChange('store', e.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  <span>Regime tributário</span>
                  <select value={setupData.taxRegime} onChange={(e) => handleSetupChange('taxRegime', e.target.value)} style={selectStyle}>
                    <option>Lucro Real</option>
                    <option>Lucro Presumido</option>
                    <option>Simples Nacional</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={labelStyle}>
                  <span>PDVs</span>
                  <input type="number" min="1" value={setupData.pdvs} onChange={(e) => handleSetupChange('pdvs', parseInt(e.target.value))} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  <span>Corredores</span>
                  <input type="number" min="1" value={setupData.corredores} onChange={(e) => handleSetupChange('corredores', parseInt(e.target.value))} style={inputStyle} required />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={labelStyle}>
                  <span>Seg-Sex</span>
                  <input type="text" value={setupData.weekdayHours} onChange={(e) => handleSetupChange('weekdayHours', e.target.value)} placeholder="08:00-20:00" style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  <span>Sábado</span>
                  <input type="text" value={setupData.saturdayHours} onChange={(e) => handleSetupChange('saturdayHours', e.target.value)} placeholder="07:00-20:00" style={inputStyle} required />
                </label>
              </div>

              <label style={labelStyle}>
                <span>Domingo</span>
                <select value={setupData.sundayOperation} onChange={(e) => handleSetupChange('sundayOperation', e.target.value)} style={selectStyle}>
                  <option value="aberto">Abre aos domingos</option>
                  <option value="fechado">Fecha todos os domingos</option>
                  <option value="parcial">Fecha parte dos domingos</option>
                </select>
              </label>
            </div>

            <button type="submit" className="imp-btn" style={buttonStyle}>Salvar configuração da loja</button>
          </form>

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
            badge="🆕"
            desc="Registros de entrada/saída real"
            columns="nome;data;entrada;saida"
            field="timecard"
            importLabel="Importar ponto"
          />

          {/* Info Box */}
          <div style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '12px', padding: '16px', fontSize: '12px', color: c.text }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Dica</p>
            <p style={{ margin: 0, color: c.muted, lineHeight: 1.5 }}>
              Importe nesta ordem: 1) Empresa, 2) Equipe, 3) Ponto. Quanto mais dados históricos, melhor a previsão de demanda. Depois de importar, gerencie tudo no painel ao lado.
            </p>
          </div>
        </div>

        {/* ============== LADO DIREITO: GERENCIAMENTO ============== */}
        <div>
          <div style={sideHeader()}>
            <span style={sideDot('#34d399')} />
            <h3 style={sideTitle}>Gerenciar Dados Importados</h3>
          </div>

          <div className="imp-card" style={panelStyle}>
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
                  <div style={emptyState}>Nenhum colaborador importado ainda.<br />Importe a equipe no painel ao lado.</div>
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
                                <td style={td}><input style={cellInput} value={editRow.nome || ''} onChange={(e) => setEditRow({ ...editRow, nome: e.target.value })} /></td>
                                <td style={td}>
                                  <select style={cellInput} value={editRow.sexo || 'Feminino'} onChange={(e) => setEditRow({ ...editRow, sexo: e.target.value })}>
                                    <option>Feminino</option>
                                    <option>Masculino</option>
                                  </select>
                                </td>
                                <td style={td}><input style={cellInput} value={editRow.cargo || ''} onChange={(e) => setEditRow({ ...editRow, cargo: e.target.value })} /></td>
                                <td style={td}><input style={cellInput} value={editRow.setor || ''} onChange={(e) => setEditRow({ ...editRow, setor: e.target.value })} /></td>
                                <td style={td}><input type="number" style={cellInput} value={editRow.horas_semanais || ''} onChange={(e) => setEditRow({ ...editRow, horas_semanais: e.target.value })} /></td>
                                <td style={td}><input type="number" style={cellInput} value={editRow.salario || ''} onChange={(e) => setEditRow({ ...editRow, salario: e.target.value })} /></td>
                                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button type="button" className="imp-btn" onClick={saveEdit} style={{ ...buttonStyle, padding: '6px 12px', fontSize: '11px', marginRight: '6px' }}>Salvar</button>
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
                                  <button type="button" onClick={() => startEdit(emp)} style={{ ...ghostBtn, marginRight: '6px', color: c.accent, borderColor: 'rgba(56,189,248,0.3)' }}>Editar</button>
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
                  <div style={emptyState}>Nenhum registro de ponto importado ainda.<br />Importe o ponto no painel ao lado.</div>
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
                                <td style={td}><input style={cellInput} value={editRow.nome || ''} onChange={(e) => setEditRow({ ...editRow, nome: e.target.value })} /></td>
                                <td style={td}><input style={cellInput} value={editRow.data || ''} onChange={(e) => setEditRow({ ...editRow, data: e.target.value })} /></td>
                                <td style={td}><input style={cellInput} value={editRow.entrada || ''} onChange={(e) => setEditRow({ ...editRow, entrada: e.target.value })} /></td>
                                <td style={td}><input style={cellInput} value={editRow.saida || ''} onChange={(e) => setEditRow({ ...editRow, saida: e.target.value })} /></td>
                                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button type="button" className="imp-btn" onClick={saveEdit} style={{ ...buttonStyle, padding: '6px 12px', fontSize: '11px', marginRight: '6px' }}>Salvar</button>
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
                                  <button type="button" onClick={() => startEdit(tc)} style={{ ...ghostBtn, marginRight: '6px', color: c.accent, borderColor: 'rgba(56,189,248,0.3)' }}>Editar</button>
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
