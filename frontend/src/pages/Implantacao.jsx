import React, { useState } from 'react';

export default function Implantacao() {
  const [setupData, setSetupData] = useState({
    company: '',
    store: '',
    taxRegime: 'Lucro Real',
    pdvs: 1,
    operators: 1,
    weekdayHours: '08:00-20:00',
    saturdayHours: '07:00-20:00',
    sundayOperation: 'aberto',
    closedSundays: 0,
    sundayHours: '09:00-18:00'
  });

  const [importedFiles, setImportedFiles] = useState({
    employees: null,
    sales: null,
    merchandise: null,
    revenue: null,
    timecard: null
  });

  const handleSetupChange = (field, value) => {
    setSetupData({ ...setupData, [field]: value });
  };

  const handleFileChange = (field, file) => {
    setImportedFiles({ ...importedFiles, [field]: file?.name || null });
  };

  const handleSubmitSetup = (e) => {
    e.preventDefault();
    console.log('Setup salvo:', setupData);
    alert('Configuração da loja salva com sucesso!');
  };

  const containerStyle = {
    background: '#0a0e1a',
    minHeight: '100vh',
    padding: '25px 28px 38px'
  };

  const sectionHeadStyle = {
    marginBottom: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px'
  };

  const eyebrowStyle = {
    margin: '0 0 7px',
    color: '#0369a1',
    fontSize: '11px',
    fontWeight: '800',
    textTransform: 'uppercase'
  };

  const h2Style = {
    margin: '0',
    fontSize: '25px',
    lineHeight: '1.2',
    maxWidth: '850px',
    color: '#e8eef5'
  };

  const softPillStyle = {
    display: 'inline-block',
    padding: '6px 12px',
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#fcd34d',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  const panelStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  };

  const panelHeadStyle = {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  };

  const h3Style = {
    margin: '0 0 6px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#e8eef5'
  };

  const noteStyle = {
    margin: '0',
    fontSize: '12px',
    color: '#94a3b8'
  };

  const labelStyle = {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    fontSize: '13px',
    color: '#e8eef5'
  };

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e8eef5',
    fontSize: '13px',
    fontFamily: 'inherit'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const buttonStyle = {
    padding: '10px 16px',
    borderRadius: '6px',
    background: '#0369a1',
    color: '#000',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '12px'
  };

  const secondaryButtonStyle = {
    padding: '8px 14px',
    borderRadius: '6px',
    background: 'rgba(59,130,246,0.15)',
    color: '#0ea5e9',
    border: '1px solid rgba(59,130,246,0.3)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const importPanelStyle = {
    ...panelStyle,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    alignItems: 'start'
  };

  return (
    <div style={containerStyle}>
      {/* Section Head */}
      <div style={sectionHeadStyle}>
        <div>
          <p style={eyebrowStyle}>Começar implantação</p>
          <h2 style={h2Style}>Configure a loja e importe os dados necessários para o diagnóstico</h2>
        </div>
        <span style={softPillStyle}>Implantação incompleta</span>
      </div>

      {/* Setup Form */}
      <form onSubmit={handleSubmitSetup} style={panelStyle}>
        <div style={panelHeadStyle}>
          <h3 style={h3Style}>1. Empresa e operação</h3>
          <p style={noteStyle}>Dados usados nos cálculos e relatórios da implantação.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <label style={labelStyle}>
            <span>Empresa</span>
            <input
              type="text"
              value={setupData.company}
              onChange={(e) => handleSetupChange('company', e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Loja</span>
            <input
              type="text"
              value={setupData.store}
              onChange={(e) => handleSetupChange('store', e.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Regime tributário</span>
            <select
              value={setupData.taxRegime}
              onChange={(e) => handleSetupChange('taxRegime', e.target.value)}
              style={selectStyle}
            >
              <option>Lucro Real</option>
              <option>Lucro Presumido</option>
              <option>Simples Nacional</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span>PDVs</span>
            <input
              type="number"
              min="1"
              value={setupData.pdvs}
              onChange={(e) => handleSetupChange('pdvs', parseInt(e.target.value))}
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Operadores</span>
            <input
              type="number"
              min="1"
              value={setupData.operators}
              onChange={(e) => handleSetupChange('operators', parseInt(e.target.value))}
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Seg-Sex</span>
            <input
              type="text"
              value={setupData.weekdayHours}
              onChange={(e) => handleSetupChange('weekdayHours', e.target.value)}
              placeholder="08:00-20:00"
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Sábado</span>
            <input
              type="text"
              value={setupData.saturdayHours}
              onChange={(e) => handleSetupChange('saturdayHours', e.target.value)}
              placeholder="07:00-20:00"
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Domingo</span>
            <select
              value={setupData.sundayOperation}
              onChange={(e) => handleSetupChange('sundayOperation', e.target.value)}
              style={selectStyle}
            >
              <option value="aberto">Abre aos domingos</option>
              <option value="fechado">Fecha todos os domingos</option>
              <option value="parcial">Fecha parte dos domingos</option>
            </select>
          </label>
        </div>

        <button type="submit" style={buttonStyle}>
          💾 Salvar configuração da loja
        </button>
      </form>

      {/* Import Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 1. Importar Equipe */}
        <div style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={h3Style}>2. Importar equipe</h3>
            <p style={noteStyle}>Importe colaboradores de um CSV</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
            <strong style={{ color: '#e8eef5' }}>Colunas:</strong>
            <code style={{ display: 'block', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
              nome;sexo;cargo;setor;horas_semanais;salario
            </code>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange('employees', e.target.files?.[0])}
            style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {importedFiles.employees ? `${importedFiles.employees}` : '⭕ Nenhum arquivo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={secondaryButtonStyle}>📥 Baixar modelo</button>
            <button style={buttonStyle}>Importar equipe</button>
          </div>
        </div>

        {/* 2. Importar Vendas VRSoft */}
        <div style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={h3Style}>3. Importar vendas VRSoft</h3>
            <p style={noteStyle}>Cupom a cupom para ICOC e escala</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
            <strong style={{ color: '#e8eef5' }}>Colunas:</strong>
            <code style={{ display: 'block', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
              id;id_loja;data;numerocupom;matricula;horainicio...
            </code>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange('sales', e.target.files?.[0])}
            style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {importedFiles.sales ? `${importedFiles.sales}` : '⭕ Nenhum arquivo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={secondaryButtonStyle}>📥 Baixar modelo</button>
            <button style={buttonStyle}>Importar VRSoft</button>
          </div>
        </div>

        {/* 3. Importar Mercadológico */}
        <div style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={h3Style}>4. Importar mercadológico 🆕</h3>
            <p style={noteStyle}>Vendas por setor (departamento)</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
            <strong style={{ color: '#e8eef5' }}>Colunas:</strong>
            <code style={{ display: 'block', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
              data;descricao_m1;descricao_m2;qtd_itens...
            </code>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange('merchandise', e.target.files?.[0])}
            style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {importedFiles.merchandise ? `${importedFiles.merchandise}` : '⭕ Nenhum arquivo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={secondaryButtonStyle}>📥 Baixar modelo</button>
            <button style={buttonStyle}>Importar mercado</button>
          </div>
        </div>

        {/* 4. Importar Faturamento */}
        <div style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={h3Style}>5. Importar faturamento 🆕</h3>
            <p style={noteStyle}>Histórico diário (ideal: 12 meses)</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
            <strong style={{ color: '#e8eef5' }}>Colunas:</strong>
            <code style={{ display: 'block', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
              data;faturamento
            </code>
          </div>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => handleFileChange('revenue', e.target.files?.[0])}
            style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {importedFiles.revenue ? `${importedFiles.revenue}` : '⭕ Nenhum arquivo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={secondaryButtonStyle}>📥 Baixar modelo</button>
            <button style={buttonStyle}>Importar faturamento</button>
          </div>
        </div>

        {/* 5. Importar Ponto */}
        <div style={panelStyle}>
          <div style={panelHeadStyle}>
            <h3 style={h3Style}>6. Importar ponto 🆕</h3>
            <p style={noteStyle}>Registros de entrada/saída real</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px' }}>
            <strong style={{ color: '#e8eef5' }}>Colunas:</strong>
            <code style={{ display: 'block', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
              nome;data;entrada;saida
            </code>
          </div>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => handleFileChange('timecard', e.target.files?.[0])}
            style={{ ...inputStyle, marginBottom: '12px', cursor: 'pointer' }}
          />
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
            {importedFiles.timecard ? `${importedFiles.timecard}` : '⭕ Nenhum arquivo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={secondaryButtonStyle}>📥 Baixar modelo</button>
            <button style={buttonStyle}>Importar ponto</button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        background: 'rgba(45,212,191,0.1)',
        border: '1px solid rgba(45,212,191,0.2)',
        borderRadius: '8px',
        padding: '16px',
        marginTop: '24px',
        fontSize: '12px',
        color: '#e8eef5'
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: '600' }}>💡 Dica</p>
        <p style={{ margin: 0, color: '#94a3b8', lineHeight: '1.5' }}>
          Importe os dados nesta ordem para melhores resultados: 1) Empresa, 2) Equipe, 3) Vendas, 4) Mercadológico, 5) Faturamento, 6) Ponto. Quanto mais dados históricos você importar, melhor será a previsão de demanda.
        </p>
      </div>
    </div>
  );
}
