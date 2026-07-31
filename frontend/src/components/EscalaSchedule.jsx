import React, { useState, useEffect } from 'react';
import axios from 'axios';
import StoreFloorMap from './StoreFloorMap';
import './EscalaSchedule.responsive.css';

export default function EscalaSchedule({ schedule, demand, employees, periodo, token, storeHours = {}, pdvs = 3 }) {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const diasFull = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('atual');
  const [selectedDay, setSelectedDay] = useState('monday');

  // Workflow state
  const [workflowStatus, setWorkflowStatus] = useState('rascunho');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [closedPeriods, setClosedPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSector, setSelectedSector] = useState('Geral');

  // Carregar períodos fechados ao montar
  useEffect(() => {
    loadClosedPeriods();
  }, []);

  const loadClosedPeriods = async () => {
    try {
      const res = await api.get('/schedule/closed-periods');
      setClosedPeriods(res.data.periods || []);
    } catch (err) {
      console.error('Erro ao carregar períodos:', err);
    }
  };

  // Mapeamento de setores
  const getSectorFromEmployee = (employee) => {
    const setor = (employee.setor || '').toLowerCase();
    const cargo = (employee.cargo || '').toLowerCase();
    const combined = `${setor} ${cargo}`;
    if (combined.includes('caixa') || combined.includes('operador')) return 'Caixa';
    if (combined.includes('açougue') || combined.includes('acougue')) return 'Açougue';
    if (combined.includes('padaria')) return 'Padaria';
    if (combined.includes('hortifruti')) return 'Hortifruti';
    if (combined.includes('frios')) return 'Frios';
    if (combined.includes('LOJA') || combined.includes('mercearia') || combined.includes('gondola')) return 'Loja';
    if (combined.includes('recebimento')) return 'Recebimento';
    if (combined.includes('administrativa') || combined.includes('escritorio')) return 'Escritório';
    if (combined.includes('comercial') || combined.includes('gerente') || combined.includes('fiscal')) return 'Comercial';
    return 'Caixa';
  };

  // Obtém lista única de setores dos employees
  const setores = Array.from(new Set(employees.map(getSectorFromEmployee))).sort();

  // Filtra employees pelo setor selecionado
  const filteredEmployees = selectedSector === 'Geral'
    ? employees
    : employees.filter(e => getSectorFromEmployee(e) === selectedSector);

  // Calcula quantos colaboradores estão conformes (44h + 1 folga)
  const conformesCount = filteredEmployees.filter(emp => {
    const shifts = schedule[emp.name] || [];
    const horas = shifts.reduce((sum, shift) => {
      if (!shift || shift === 'Folga') return sum;
      const blocks = shift.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/g) || [];
      let total = 0;
      blocks.forEach(block => {
        const [start, end] = block.split('-');
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let startTime = h1 + m1 / 60;
        let endTime = h2 + m2 / 60;
        if (endTime < startTime) endTime += 24;
        total += endTime - startTime;
      });
      return sum + total;
    }, 0);
    const folgas = shifts.filter(s => s === 'Folga').length;
    return Math.abs(horas - 44) < 0.01 && folgas === 1;
  }).length;

  // Calcula horas de um turno parseando os horários (ex: "08:00-16:00" → 8h)
  const parseHours = (value) => {
    if (!value || value === 'Folga') return 0;

    // Extrai todos os blocos de horário (HH:MM-HH:MM)
    const timeBlocks = value.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/g) || [];
    let totalHours = 0;

    timeBlocks.forEach(block => {
      const [start, end] = block.split('-');
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);

      let startTime = startH + startM / 60;
      let endTime = endH + endM / 60;

      // Se fim < início, assume que passou da meia-noite
      if (endTime < startTime) endTime += 24;

      totalHours += endTime - startTime;
    });

    return totalHours;
  };

  // Formata turno de forma legível e profissional
  const formatShift = (shift) => {
    if (!shift || shift === 'Folga') return 'Folga';

    // Extrai blocos de horário, corrigindo minutos inválidos (60+)
    let cleaned = shift.replace(/(\d{2}):([6-9]\d)/g, (match, hour, min) => {
      const h = parseInt(hour);
      return `${String(h + 1).padStart(2, '0')}:00`;
    });

    const timeBlocks = cleaned.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/g) || [];

    if (timeBlocks.length === 1) {
      // Turno sem pausa
      return timeBlocks[0];
    } else if (timeBlocks.length === 2) {
      // Extrai horários para calcular intervalo
      const match1 = timeBlocks[0].match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
      const match2 = timeBlocks[1].match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);

      if (match1 && match2) {
        const fimPrimeiro = `${match1[3]}:${match1[4]}`;
        const inicioSegundo = `${match2[1]}:${match2[2]}`;
        const intervalo = `Intervalo ${fimPrimeiro}-${inicioSegundo}`;

        return (
          <>
            <div style={{ fontSize: '11px' }}>{timeBlocks[0]} / {timeBlocks[1]}</div>
            <div style={{ fontSize: '9px', color: 'var(--esc-muted)', marginTop: '2px' }}>{intervalo}</div>
          </>
        );
      }
    }

    return cleaned;
  };

  const api = axios.create({
    baseURL: '/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  // Marcar revisado
  const handleMarcarRevisado = async () => {
    try {
      setLoading(true);
      const newStatus = workflowStatus === 'revisado' ? 'rascunho' : 'revisado';
      await api.post('/schedule/status', { status: newStatus });
      setWorkflowStatus(newStatus);
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  // Fechar período
  const handleFecharPeriodo = async () => {
    const inicio = prompt('Data início (YYYY-MM-DD):');
    if (!inicio) return;

    const fim = prompt('Data fim (YYYY-MM-DD):');
    if (!fim) return;

    try {
      setLoading(true);
      await api.post('/schedule/fechar', { dataInicio: inicio, dataFim: fim });
      setWorkflowStatus('publicado');
      setDataInicio(inicio);
      setDataFim(fim);
      alert('Período fechado com sucesso!');
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao fechar período');
    } finally {
      setLoading(false);
    }
  };

  // Exportar
  const handleExportar = async () => {
    if (!schedule || Object.keys(schedule).length === 0) {
      alert('Nenhuma escala gerada para exportar');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/schedule/export', { schedule });
      const win = window.open('', '_blank');
      win.document.write(res.data);
      win.document.close();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao exportar');
    } finally {
      setLoading(false);
    }
  };

  // Reabrir período
  const handleReabrirPeriodo = async (periodId) => {
    if (!window.confirm('Reabrir este período? Voltará ao status de rascunho.')) return;

    try {
      setLoading(true);
      await api.post('/schedule/reabrir', { periodId });
      setWorkflowStatus('rascunho');
      setDataInicio('');
      setDataFim('');
      await loadClosedPeriods();
      alert('Período reabirto com sucesso!');
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao reabrir período');
    } finally {
      setLoading(false);
    }
  };

  // Calcular calendário
  const hoje = new Date();
  const diaSemana = (hoje.getDay() + 6) % 7;
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - diaSemana);

  const datas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      data: d.toISOString().split('T')[0],
      dia: dias[i]
    };
  });

  const todayIdx = diaSemana;
  const totalColaboradores = Object.keys(schedule || {}).length;

  const scenarios = !employees.length ? [] : [
    { id: 'atual', label: 'Atual 6x1 - 44h', hours: 44, pdvs: '—', operators: employees.length, capacity: employees.length * 44 },
    { id: 'transicao', label: 'Transição 5x2 - 42h', hours: 42, pdvs: '—', operators: employees.length, capacity: employees.length * 42 },
    { id: 'final', label: 'Final 5x2 - 40h', hours: 40, pdvs: '—', operators: employees.length, capacity: employees.length * 40 }
  ];

  return (
    <div className="esc-container">
      <style>{`
        @keyframes esc-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: .4; transform: scale(.75); }
        }

        .esc-container{
          --esc-accent:#4aa8ff;
          --esc-accent-2:#6cc0ff;
          --esc-accent-3:#bcd8ff;
          --esc-text:#e8eef5;
          --esc-muted:#94a3b8;
          --esc-faint:rgba(148,163,184,.55);
          --esc-line:rgba(255,255,255,.09);
          --esc-card:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
          --esc-surface:rgba(255,255,255,.04);
          --esc-grad:linear-gradient(135deg,#6cc0ff,#3a7bff);
          --esc-glow:0 12px 28px -12px rgba(74,168,255,.7), inset 0 1px 0 rgba(255,255,255,.4);
          position:relative;display:flex;flex-direction:column;gap:18px;
          color:var(--esc-text);
          font-family:inherit;
          /* container transparente: evita "card dentro de card" */
          background:transparent;
        }

        /* ---------- Section Head ---------- */
        .esc-section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
        .esc-eyebrow{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:5px 12px;border-radius:999px;
          background:rgba(74,168,255,.08);border:1px solid rgba(74,168,255,.22);
          color:#bcd8ff;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;}
        .esc-eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--esc-accent);
          box-shadow:0 0 10px var(--esc-accent);animation:esc-dot 1.8s ease-in-out infinite;}
        .esc-section-head h2{margin:0;font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.02em;max-width:850px;
          background:linear-gradient(180deg,#ffffff 0%,#b9d4ff 100%);
          -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
        .esc-soft-pill{padding:7px 14px;border-radius:999px;font-size:12.5px;font-weight:600;color:#cfe0f7;
          background:var(--esc-surface);border:1px solid var(--esc-line);}

        /* ---------- Generic Panel (glass) ---------- */
        .esc-panel{
          position:relative;padding:20px;border-radius:18px;background:var(--esc-card);
          border:1px solid var(--esc-line);
          box-shadow:0 30px 80px -40px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
        }

        /* ---------- Week Selector ---------- */
        .esc-week-selector{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
        .esc-week-selector label{margin:0;font-weight:600;font-size:13.5px;color:#dbe6f5;}
        .esc-select{
          padding:9px 14px;border-radius:10px;font-size:14px;cursor:pointer;
          background:var(--esc-surface);border:1px solid var(--esc-line);color:var(--esc-text);
          outline:none;transition:.16s;
        }
        .esc-select:focus{border-color:var(--esc-accent);box-shadow:0 0 0 3px rgba(74,168,255,.18);}
        .esc-select option{background:#0f1b33;color:#eef2f8;padding:8px;border:none;}
        .esc-select option:checked{background:var(--esc-accent);color:#fff;}
        .esc-week-hint{min-width:200px;font-size:12.5px;color:var(--esc-muted);}

        /* ---------- Scenario Cards ---------- */
        .esc-scenario-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}
        .esc-scenario-card{
          position:relative;overflow:hidden;padding:18px;border-radius:14px;background:var(--esc-surface);
          border:1px solid var(--esc-line);transition:.18s;
        }
        .esc-scenario-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;
          background:var(--esc-grad);opacity:.85;}
        .esc-scenario-card:hover{border-color:rgba(74,168,255,.4);transform:translateY(-2px);
          box-shadow:0 18px 40px -24px rgba(74,168,255,.5);}
        .esc-scenario-tag{color:var(--esc-faint);font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;}
        .esc-scenario-card h3{margin:12px 0 18px;font-size:17px;font-weight:700;color:var(--esc-text);}
        .esc-scenario-rows{font-size:12.5px;color:var(--esc-muted);line-height:2;}
        .esc-scenario-rows strong{color:#dbe6f5;font-weight:600;}
        .esc-scenario-rows span{float:right;color:var(--esc-text);font-weight:600;}
        .esc-empty{grid-column:1 / -1;padding:32px;text-align:center;color:var(--esc-muted);font-size:14px;
          background:var(--esc-surface);border:1px dashed var(--esc-line);border-radius:14px;}

        /* ---------- Panel Head ---------- */
        .esc-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
          padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--esc-line);}
        .esc-panel-head h3{margin:0 0 6px;font-size:15px;font-weight:700;color:var(--esc-text);}
        .esc-panel-head p{margin:0;font-size:12.5px;color:var(--esc-muted);}

        /* ---------- Buttons ---------- */
        .esc-btn{padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          border:none;background:var(--esc-grad);color:#fff;box-shadow:var(--esc-glow);transition:.16s;}
        .esc-btn:hover{filter:brightness(1.08);}
        .esc-btn:active{transform:translateY(1px);}
        .esc-btn:disabled{opacity:.55;cursor:not-allowed;filter:none;box-shadow:none;}
        .esc-ghost{padding:5px 11px;border-radius:9px;font-size:11px;font-weight:600;cursor:pointer;
          color:#c4ccd8;background:var(--esc-surface);border:1px solid var(--esc-line);transition:.16s;}
        .esc-ghost:hover{background:rgba(74,168,255,.1);border-color:rgba(74,168,255,.32);color:var(--esc-text);}
        .esc-ghost.is-active{background:var(--esc-grad);border-color:transparent;color:#fff;
          box-shadow:0 8px 22px -8px rgba(74,168,255,.7), inset 0 1px 0 rgba(255,255,255,.4);}

        .esc-audit-summary{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;
          color:#86efac;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);}

        /* ---------- Período Box ---------- */
        .esc-periodo-box{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;
          padding:14px 16px;border-radius:12px;margin-bottom:14px;
          background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);}
        .esc-periodo-info{display:flex;flex-direction:column;gap:3px;}
        .esc-periodo-info strong{font-size:13.5px;}
        .esc-periodo-info span{font-size:12.5px;color:#dbe6f5;}
        .esc-periodo-info small{font-size:11.5px;color:var(--esc-muted);}
        .esc-periodo-actions{display:flex;gap:8px;flex-wrap:wrap;}

        /* ---------- CLT Box ---------- */
        .esc-clt-box{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;margin-bottom:14px;
          background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.28);}
        .esc-clt-box strong{font-size:13.5px;}
        .esc-clt-box span{font-size:12px;color:#dbe6f5;}
        .esc-clt-box p{font-size:11px;color:var(--esc-faint);margin:6px 0 0;}

        /* ---------- Week Comparison ---------- */
        .esc-week-comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;}
        .esc-wc-card{padding:14px;border-radius:12px;background:var(--esc-surface);border:1px solid var(--esc-line);
          display:flex;flex-direction:column;gap:5px;transition:.16s;}
        .esc-wc-card:hover{border-color:rgba(74,168,255,.3);}
        .esc-wc-card small{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--esc-faint);}
        .esc-wc-card strong{font-size:18px;font-weight:700;color:var(--esc-text);}
        .esc-wc-detail{font-size:11.5px;color:var(--esc-muted);}

        /* ---------- Week Navigation ---------- */
        .esc-week-nav{display:flex;justify-content:space-between;align-items:center;gap:12px;
          padding:10px 14px;border-radius:12px;margin-bottom:16px;
          background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-week-nav-btn{padding:7px 14px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;
          color:#cfe0f7;background:rgba(255,255,255,.04);border:1px solid var(--esc-line);transition:.16s;}
        .esc-week-nav-btn:hover{background:rgba(74,168,255,.16);border-color:rgba(74,168,255,.4);}
        .esc-week-nav-label{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--esc-text);}
        .esc-today-tag{padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;
          color:#fff;background:var(--esc-grad);box-shadow:0 4px 12px -4px rgba(74,168,255,.7);}

        /* ---------- Weekly Grid ---------- */
        .esc-weekly-grid{display:flex;flex-direction:column;gap:8px;overflow-x:auto;}
        .esc-weekly-row{display:grid;grid-template-columns:1.5fr repeat(7,1fr) 1fr;gap:6px;min-width:780px;}
        .esc-weekly-head{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          padding:10px 6px;border-radius:10px;font-size:12px;font-weight:700;color:var(--esc-muted);
          background:rgba(255,255,255,.03);border:1px solid var(--esc-line);text-align:center;}
        .esc-weekly-head.is-today{color:#fff;border-color:rgba(74,168,255,.5);
          background:linear-gradient(180deg,rgba(74,168,255,.18),rgba(74,168,255,.06));}
        .esc-head-date{font-size:10px;font-weight:500;color:var(--esc-faint);}
        .esc-weekly-head .esc-today-tag{margin-top:2px;}

        .esc-weekly-person{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:10px 12px;
          border-radius:10px;background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-person-name{font-size:13px;font-weight:600;color:var(--esc-text);}
        .esc-person-details{font-size:11px;color:var(--esc-muted);}

        .esc-weekly-shift{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
          min-height:46px;padding:6px;border-radius:10px;font-size:12px;font-weight:600;color:var(--esc-text);
          background:var(--esc-surface);border:1px solid var(--esc-line);text-align:center;transition:outline .16s;}
        .esc-weekly-shift:hover{outline:2px solid rgba(108,192,255,.5);outline-offset:-2px;}
        .esc-weekly-shift.is-today{background:linear-gradient(180deg,rgba(74,168,255,.2),rgba(74,168,255,.08));
          border-color:rgba(108,192,255,.55);box-shadow:inset 0 0 0 1px rgba(108,192,255,.3);}
        .esc-weekly-off{background:rgba(255,255,255,.03);border-color:var(--esc-line);color:var(--esc-faint);}
        .esc-shift-main{font-size:12px;}
        .esc-shift-icons{display:flex;gap:4px;font-size:11px;}
        .esc-role-badge{padding:2px 5px;border-radius:4px;font-size:7px;font-weight:700;text-transform:uppercase;}
        .esc-role-open{background:rgba(34,197,94,.2);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
        .esc-role-close{background:rgba(251,146,60,.2);color:#fb923c;border:1px solid rgba(251,146,60,.3);}

        .esc-weekly-status{display:flex;align-items:center;justify-content:center;padding:8px;border-radius:10px;
          font-size:11px;font-weight:700;text-align:center;}
        .esc-status-valid{color:#86efac;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);}
        .esc-status-invalid{color:#fcd34d;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);}

        .esc-forecast-row{border-bottom:2px solid rgba(74,168,255,.15);padding-bottom:6px;margin-bottom:2px;}
        .esc-forecast-row .esc-weekly-shift{min-height:42px;font-size:10px;color:var(--esc-muted);}
        .esc-forecast-label strong{font-size:13px;color:var(--esc-accent-3);}
        .esc-forecast-label small{font-size:10.5px;color:var(--esc-muted);}

        /* ---------- Placeholder / Heatmap ---------- */
        .esc-subtle-panel{padding:16px;border-radius:12px;margin-bottom:14px;
          background:var(--esc-surface);border:1px solid var(--esc-line);}
        .esc-placeholder{min-height:200px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--esc-muted);
          background:radial-gradient(600px 200px at 50% 0%, rgba(74,168,255,.08), transparent 70%);}
        .esc-placeholder small{color:var(--esc-faint);}
        .esc-subtle-panel > p{margin:0 0 12px;font-size:12.5px;font-weight:700;color:var(--esc-text);}
        .esc-load-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;}
        .esc-load-cell{padding:10px 6px;border-radius:8px;text-align:center;
          background:rgba(255,255,255,.03);border:1px solid var(--esc-line);transition:.16s;}
        .esc-load-cell:hover{border-color:rgba(74,168,255,.35);background:rgba(74,168,255,.06);}
        .esc-load-cell span{font-size:11px;color:var(--esc-muted);}
        .esc-load-cell strong{display:block;margin-top:5px;font-size:14px;color:var(--esc-accent-2);}

        .esc-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
      `}</style>

      {/* Contador de colaboradores */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', fontSize: '13px', color: 'var(--esc-muted)' }}>
        <span>{employees.length} colaboradores</span>
      </div>

      {/* Week Selector Panel */}
      <div className="esc-panel esc-week-selector">
        <label>Analisar por semana do mês:</label>
        <select
          className="esc-select"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
        >
          <option value="">Todos os dados importados (padrão)</option>
          <option value="1">Semana 1 (1-7) - Normal</option>
          <option value="2">Semana 2 (8-14) - Normal</option>
          <option value="3">Semana 3 (15-21) - Normal</option>
          <option value="4">Semana 4 (22-28) - Promoção Iniciando</option>
          <option value="5">Semana 5 (29-05) - Pico de Promoção</option>
        </select>
        <small className="esc-week-hint">
          {selectedWeek ? `Semana ${selectedWeek} selecionada` : 'Nenhuma semana selecionada'}
        </small>
      </div>

      {/* Scenario Cards */}
      <div className="esc-scenario-grid">
        {scenarios.length === 0 ? (
          <div className="esc-empty">
            Importe colaboradores para visualizar cenários
          </div>
        ) : (
          scenarios.map((scenario) => (
            <div key={scenario.id} className="esc-scenario-card">
              <span className="esc-scenario-tag">Simulação</span>
              <h3>{scenario.label}</h3>
              <div className="esc-scenario-rows">
                <div><strong>Horas semanais</strong><span>{scenario.hours}h</span></div>
                <div><strong>PDVs / operadores</strong><span>{scenario.pdvs} / {scenario.operators}</span></div>
                <div><strong>Capacidade</strong><span>{scenario.capacity}h</span></div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Store Floor Map Panel */}
      <StoreFloorMap schedule={schedule} demand={demand} employees={employees} storeConfig={{ pdvs }} storeHours={storeHours} />

      {/* Weekly Panel - Semana Completa */}
      <div className="esc-panel">

        {/* Panel Head */}
        <div className="esc-panel-head">
          <div>
            <h3>Semana completa por colaboradora</h3>
            <p>44h semanais + 1 folga a cada 7 dias (conforme CLT)</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="esc-select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="Geral">Todos os setores</option>
              {setores.map(setor => (
                <option key={setor} value={setor}>{setor}</option>
              ))}
            </select>
            <span className="esc-audit-summary">{conformesCount}/{filteredEmployees.length} conformes{selectedSector !== 'Geral' && ` (${selectedSector})`}</span>
            <button className="esc-btn" onClick={handleExportar} disabled={loading}>
              {loading ? 'Exportando...' : 'Exportar / Imprimir'}
            </button>
          </div>
        </div>

        {/* Período Box */}
        <div className="esc-periodo-box">
          <div>
            <div className="esc-periodo-info">
              <strong style={{ color: workflowStatus === 'publicado' ? '#34d399' : '#fbbf24' }}>
                {workflowStatus === 'rascunho' && 'RASCUNHO — Escala Dinâmica'}
                {workflowStatus === 'revisado' && 'REVISADO — Escala Validada'}
                {workflowStatus === 'publicado' && 'FECHADO — Escala Oficial' + (dataInicio ? ` (${dataInicio} a ${dataFim})` : '')}
              </strong>
              <span>Semana de {datas[0].label} a {datas[6].label}</span>
              <small>
                {workflowStatus === 'rascunho' && 'Esta escala é recalculada automaticamente. Revise e feche para gerar versão oficial.'}
                {workflowStatus === 'revisado' && 'Escala revisada. Feche o período para torná-la imutável.'}
                {workflowStatus === 'publicado' && 'Escala oficial fechada e imutável.'}
              </small>
            </div>
          </div>
          <div className="esc-periodo-actions">
            <button
              className="esc-ghost"
              onClick={handleMarcarRevisado}
              disabled={loading || workflowStatus === 'publicado'}
            >
              {workflowStatus === 'revisado' ? '↩ Voltar para rascunho' : '✓ Marcar revisado'}
            </button>
            <button
              className="esc-btn"
              onClick={handleFecharPeriodo}
              disabled={loading || workflowStatus === 'publicado'}
            >
              {loading ? 'Fechando...' : '🔒 Fechar período'}
            </button>
          </div>
        </div>

        {/* CLT Compliance Box */}
        <div className="esc-clt-box">
          <strong style={{ color: '#34d399' }}>Escala em conformidade CLT</strong>
          <span>✓ Interjornada 11h  ✓ DSR  ✓ Máx 44h/semana  ✓ Máx 10h/dia  ✓ Máx 6h contínuas  ✓ 6 dias consecutivos</span>
          <p>
            Auditoria baseada na CLT federal. Convenções coletivas locais (CCT dos comerciários) podem ter regras adicionais — valide com seu contador/sindicato.
          </p>
        </div>

        {/* Week Comparison Cards */}
        <div className="esc-week-comparison">
          <div className="esc-wc-card">
            <small>Previsão semana</small>
            <strong>—</strong>
            <span className="esc-wc-detail">Importe faturamento</span>
          </div>
          <div className="esc-wc-card">
            <small>Equipe escalada</small>
            <strong>{totalColaboradores} pessoas</strong>
            <span className="esc-wc-detail">{totalColaboradores * 44}h total · {44}h/pessoa</span>
          </div>
          <div className="esc-wc-card">
            <small>Folgas na semana</small>
            <strong>{totalColaboradores} folgas</strong>
            <span className="esc-wc-detail">{(totalColaboradores / totalColaboradores).toFixed(1)} por pessoa</span>
          </div>
          <div className="esc-wc-card">
            <small>Conformidade CLT</small>
            <strong>Conforme</strong>
            <span className="esc-wc-detail">CLT validado</span>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="esc-week-nav">
          <button className="esc-week-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)}>
            ← Anterior
          </button>
          <span className="esc-week-nav-label">
            {datas[0].label} — {datas[6].label}
            {weekOffset === 0 && <span className="esc-today-tag">atual</span>}
          </span>
          <button className="esc-week-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)}>
            Próxima →
          </button>
        </div>

        {/* Weekly Grid */}
        <div className="esc-weekly-grid">
          {/* Header */}
          <div className="esc-weekly-row">
            <div className="esc-weekly-head">Colaborador(a)</div>
            {dias.map((dia, i) => (
              <div
                key={i}
                className={`esc-weekly-head ${i === todayIdx ? 'is-today' : ''}`}
              >
                <span>{dia}</span>
                <span className="esc-head-date">{datas[i].label}</span>
                {i === todayIdx && <span className="esc-today-tag">hoje</span>}
              </div>
            ))}
            <div className="esc-weekly-head">Auditoria</div>
          </div>

          {/* Forecast Row */}
          <div className="esc-weekly-row esc-forecast-row">
            <div className="esc-weekly-person esc-forecast-label">
              <strong>Previsão</strong>
              <small>faturamento dia</small>
            </div>
            {dias.map((_, i) => (
              <div key={i} className="esc-weekly-shift">
                Importe faturamento
              </div>
            ))}
            <div className="esc-weekly-shift" style={{ background: 'transparent', border: 'none' }}></div>
          </div>

          {/* Pessoas */}
          {schedule &&
            filteredEmployees.map((emp, idx) => {
              const shifts = schedule[emp.name] || [];
              const horasTrabalhadas = shifts.reduce((sum, shift) => sum + parseHours(shift), 0);
              const folgas = shifts.filter((s) => s === 'Folga').length;
              const conforme = Math.abs(horasTrabalhadas - 44) < 0.01 && folgas === 1;

              return (
                <div key={idx} className="esc-weekly-row">
                  <div className="esc-weekly-person">
                    <span className="esc-person-name">{emp.name}</span>
                    <span className="esc-person-details">
                      {getSectorFromEmployee(emp)} · {horasTrabalhadas.toFixed(1)}h trab. · {folgas} folga{folgas > 1 ? 's' : ''}
                    </span>
                  </div>
                  {shifts.map((shift, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`esc-weekly-shift ${
                        shift === 'Folga' ? 'esc-weekly-off' : ''
                      } ${dayIdx === todayIdx ? 'is-today' : ''}`}
                    >
                      {shift === 'Folga' ? (
                        <span className="esc-shift-main">Folga</span>
                      ) : (
                        <>
                          <span className="esc-shift-main">{formatShift(shift)}</span>
                          {shift && (
                            <div className="esc-shift-icons">
                              {shift.includes('08') && <span className="esc-role-badge esc-role-open">ABERTURA</span>}
                              {shift.includes('20') && <span className="esc-role-badge esc-role-close">FECHAMENTO</span>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  <div
                    className={`esc-weekly-status ${
                      conforme ? 'esc-status-valid' : 'esc-status-invalid'
                    }`}
                  >
                    {conforme ? '✓ Conforme' : '⚠ Revisar'}
                  </div>
                </div>
              );
            })}
        </div>

      </div>

      {/* Histórico de Períodos Fechados */}
      {closedPeriods.length > 0 && (
        <div className="esc-panel">
          <div className="esc-panel-head">
            <div>
              <h3>Histórico de períodos fechados</h3>
              <p>Últimos {closedPeriods.length} períodos — máximo 12 mantidos</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {closedPeriods.map((period) => (
              <div
                key={period.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--esc-surface)',
                  border: '1px solid var(--esc-line)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <strong style={{ color: '#34d399', fontSize: '13px' }}>{period.label}</strong>
                  <small style={{ color: 'var(--esc-muted)', fontSize: '11px' }}>
                    Fechado por {period.closed_by} em{' '}
                    {new Date(period.closed_at).toLocaleDateString('pt-BR')}
                  </small>
                </div>
                <button
                  className="esc-ghost"
                  onClick={() => handleReabrirPeriodo(period.id)}
                  disabled={loading}
                  title="Reabrir este período voltará ao status de rascunho"
                >
                  ↻ Reabrir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Panel - Demanda VRSoft x Caixas */}
      <div className="esc-panel">
        <div className="esc-panel-head">
          <div>
            <h3>Demanda VRSoft x caixas escalados</h3>
            <p>Comparação entre demanda de clientes e operadores escalados por hora</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="esc-ghost" title="Otimização inteligente">
              Otimização
            </button>
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                className={`esc-ghost ${selectedScenario === scenario.id ? 'is-active' : ''}`}
              >
                {scenario.label.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Day Toolbar */}
        <div className="esc-toolbar">
          {diasFull.map((dia) => (
            <button
              key={dia}
              onClick={() => setSelectedDay(dia.toLowerCase())}
              className={`esc-ghost ${selectedDay === dia.toLowerCase() ? 'is-active' : ''}`}
            >
              {dia}
            </button>
          ))}
        </div>

        {/* Heatmap Placeholder */}
        <div className="esc-subtle-panel esc-placeholder">
          <div>
            <p style={{ margin: 0 }}>Heatmap de demanda por hora</p>
            <small>(Intensidade de demanda ao longo do dia)</small>
          </div>
        </div>

        {/* Cashier Load Panel */}
        <div className="esc-subtle-panel">
          <p>Carga do caixa por hora</p>
          <div className="esc-load-grid">
            {['08h', '10h', '12h', '14h', '16h', '20h', '20h', 'Média'].map((hora, i) => (
              <div key={i} className="esc-load-cell">
                <span>{hora}</span>
                <strong>{Math.floor(Math.random() * 100)}%</strong>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}