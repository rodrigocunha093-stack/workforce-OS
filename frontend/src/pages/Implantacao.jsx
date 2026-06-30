import React, { useState, useEffect } from 'react';

const numberInputStyle = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
  }

  select option {
    background-color: #1a1f2e;
    color: #e8eef5;
    padding: 8px;
  }

  select option:hover {
    background-color: #0369a1;
    color: #fff;
  }

  select option:checked {
    background-color: #0369a1;
    color: #fff;
  }
`;

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

  // Carregar dados salvos ao montar o componente
  useEffect(() => {
    loadSavedSetup();
  }, []);

  const loadSavedSetup = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Carregando setup... Token:', token ? 'presente' : 'ausente');

      const response = await fetch('/api/config/store-hours', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Resposta GET:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Dados recebidos:', data);

        if (data.storeSetup) {
          console.log('Atualizando setupData com:', data.storeSetup);
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
        } else {
          console.log('Nenhum dado salvo no banco ainda');
        }
      } else {
        console.error('Erro na resposta:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Erro ao carregar configuração:', err);
    }
  };

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

  const downloadTemplate = (type) => {
    const templates = {
      employees: 'nome;sexo;cargo;setor;horas_semanais;salario\nLucila;Feminino;Operadora de Caixa;Caixa;44;1650\nEdvania;Feminino;Operadora de Caixa;Caixa;44;1650\nSamara;Feminino;Operadora de Caixa;Caixa;44;1650\nJane;Feminino;Operadora de Caixa;Caixa;44;1650\n',
      sales: 'id;id_loja;data;numerocupom;matricula;horainicio;horatermino;qtd_itens;qtd_unidades;valor_cupom\n747336;1;2026-05-01;153678;200001;07:11:17;07:11:44;1;1.000;29.99\n747337;1;2026-05-01;153679;200001;07:13:25;07:14:13;1;1.000;18.99\n747338;1;2026-05-01;153680;200001;07:21:21;07:21:53;3;2.094;18.02\n',
      merchandise: 'data;descricao_m1;descricao_m2;qtd_itens;qtd_unidades;valor_total\n2026-06-01;PERECIVEIS;ACOUGUE;167;127.965;4027.33\n2026-06-01;PERECIVEIS;PADARIA;91;182.000;789.08\n2026-06-01;PERECIVEIS;FLV;34;36.160;450.54\n2026-06-01;PERECIVEIS;FRIOS E LATICINEOS;312;337.554;3374.62\n2026-06-01;MERCEARIA;MERCEARIA DOCE;958;1223.000;7479.78\n2026-06-01;MERCEARIA;LIMPEZA;351;476.000;2694.76\n',
      revenue: (() => {
        const hoje = new Date();
        const linhas = ['data;faturamento'];
        for (let i = 365; i >= 0; i--) {
          const d = new Date(hoje);
          d.setDate(hoje.getDate() - i);
          if (d.getDay() === 0) continue;
          linhas.push(`${d.toISOString().slice(0, 10)};0.00`);
        }
        return linhas.join('\n');
      })(),
      timecard: 'nome;data;entrada;saida\nLucila;2026-06-09;07:02;15:05\nLucila;2026-06-10;06:58;15:01\nEdvania;2026-06-09;08:03;16:10\nEdvania;2026-06-10;07:55;16:02\nSamara;2026-06-09;10:05;19:03\nJane;2026-06-09;10:01;18:58\n'
    };

    const fileNames = {
      employees: 'modelo-equipe-caixa.csv',
      sales: 'modelo-vendas-vrsoft-detalhado.csv',
      merchandise: 'modelo-vendas-mercadologico.csv',
      revenue: 'modelo-faturamento-diario.csv',
      timecard: 'modelo-ponto.csv'
    };

    const csv = templates[type];
    const link = document.createElement('a');
    const bomContent = (type === 'employees' || type === 'sales') ? csv : '﻿' + csv;
    link.href = URL.createObjectURL(new Blob([bomContent], { type: 'text/csv;charset=utf-8' }));
    link.download = fileNames[type];
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleSubmitSetup = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      console.log('Salvando setup:', setupData);

      const response = await fetch('/api/config/store-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

      console.log('Resposta POST:', response.status);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao salvar configuração');
      }

      const data = await response.json();
      alert(data.message || 'Configuração da loja salva com sucesso!');
      console.log('Setup salvo com sucesso');

      // Recarregar os dados após salvar
      await loadSavedSetup();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar: ' + err.message);
    }
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
      <style>{numberInputStyle}</style>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Empresa - Full Width */}
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

          {/* Loja + Regime Tributário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          </div>

          {/* PDVs + Corredores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <span>Corredores</span>
              <input
                type="number"
                min="1"
                value={setupData.corredores}
                onChange={(e) => handleSetupChange('corredores', parseInt(e.target.value))}
                style={inputStyle}
                required
              />
            </label>
          </div>

          {/* Seg-Sex + Sábado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          </div>

          {/* Domingo - Full Width */}
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
            <button onClick={() => downloadTemplate('employees')} style={secondaryButtonStyle}>📥 Baixar modelo</button>
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
            <button onClick={() => downloadTemplate('sales')} style={secondaryButtonStyle}>📥 Baixar modelo</button>
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
            <button onClick={() => downloadTemplate('merchandise')} style={secondaryButtonStyle}>📥 Baixar modelo</button>
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
            <button onClick={() => downloadTemplate('revenue')} style={secondaryButtonStyle}>📥 Baixar modelo</button>
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
            <button onClick={() => downloadTemplate('timecard')} style={secondaryButtonStyle}>📥 Baixar modelo</button>
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
