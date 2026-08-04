import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import StoreFloorMap from './StoreFloorMap';
import './EscalaSchedule.responsive.css';

export default function EscalaSchedule({ schedule, demand, employees, periodo, token, storeHours = {}, pdvs = 3, revenueByDay = [], activitySuggestionByDay = [], scenarioSchedules = null, storeHoursByDay = null, weekOffset = 0, onWeekOffsetChange = () => {}, forecastConfianca = null, complianceViolations = [], weekStart = null, onScheduleChanged = () => {} }) {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const diasFull = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const [selectedScenario, setSelectedScenario] = useState('atual');
  // dow na convenção SQL (0=domingo..6=sábado), igual /api/controller-caixa
  // espera — já começa marcado no dia real de hoje, não sempre segunda.
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [caixaHoras, setCaixaHoras] = useState([]);
  const [caixaLoading, setCaixaLoading] = useState(false);

  // Workflow state
  const [workflowStatus, setWorkflowStatus] = useState('rascunho');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [closedPeriods, setClosedPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSector, setSelectedSector] = useState('Geral');

  // Modais da caixa "Escala em conformidade CLT" — réplica do projeto
  // modelo (Alertas/Bloqueios e Avisos abrem lista real de violações,
  // Regras CLT/CCT abre form de configuração persistido em store_setup.clt_rules)
  // Edição manual de turno (réplica do projeto modelo) — clica numa célula
  // da grade, escolhe um preset ou digita um horário customizado, "Aplicar"
  // salva em schedule_overrides e recarrega a escala. Só disponível com o
  // período ainda em rascunho/revisado (publicado é imutável).
  const [editingCell, setEditingCell] = useState(null); // { name, dayIdx, top, left } | null
  const [customShiftInput, setCustomShiftInput] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const SHIFT_PRESETS = ['Folga', '07:00-15:00', '08:00-16:00', '10:00-18:00', '10:00-19:00', '08:00-12:00'];

  const applyShiftOverride = async (shiftText) => {
    if (!editingCell || !weekStart) return;
    try {
      setSavingOverride(true);
      await api.put('/schedule/override', {
        employeeName: editingCell.name,
        weekStart,
        dayIndex: editingCell.dayIdx,
        shiftText,
      });
      setEditingCell(null);
      setCustomShiftInput('');
      await onScheduleChanged();
    } catch (err) {
      console.error('Erro ao editar turno:', err);
      alert(err.response?.data?.error || 'Erro ao editar turno');
    } finally {
      setSavingOverride(false);
    }
  };

  const restaurarTurnoAutomatico = async () => {
    if (!editingCell || !weekStart) return;
    try {
      setSavingOverride(true);
      await api.delete('/schedule/override', {
        data: { employeeName: editingCell.name, weekStart, dayIndex: editingCell.dayIdx },
      });
      setEditingCell(null);
      setCustomShiftInput('');
      await onScheduleChanged();
    } catch (err) {
      console.error('Erro ao restaurar turno:', err);
      alert(err.response?.data?.error || 'Erro ao restaurar turno');
    } finally {
      setSavingOverride(false);
    }
  };

  const [cltModal, setCltModal] = useState(null); // 'alertas' | 'avisos' | 'regras' | null
  const [cltRules, setCltRules] = useState(null);
  const [cltRulesDraft, setCltRulesDraft] = useState(null);
  const [cltRulesSaving, setCltRulesSaving] = useState(false);

  const loadCltRules = async () => {
    try {
      const res = await api.get('/schedule/clt-rules');
      setCltRules(res.data.cltRules);
      setCltRulesDraft(res.data.cltRules);
    } catch (err) {
      console.error('Erro ao carregar regras CLT:', err);
    }
  };

  const openCltModal = (modal) => {
    setCltModal(modal);
    if (modal === 'regras' && !cltRules) loadCltRules();
  };

  const saveCltRules = async () => {
    try {
      setCltRulesSaving(true);
      const res = await api.put('/schedule/clt-rules', { cltRules: cltRulesDraft });
      setCltRules(res.data.cltRules);
      setCltRulesDraft(res.data.cltRules);
      setCltModal(null);
    } catch (err) {
      console.error('Erro ao salvar regras CLT:', err);
      alert('Erro ao salvar regras CLT');
    } finally {
      setCltRulesSaving(false);
    }
  };

  const restaurarCltPadrao = async () => {
    try {
      const res = await api.get('/schedule/clt-rules');
      setCltRulesDraft(res.data.defaults);
    } catch (err) {
      console.error('Erro ao restaurar padrão CLT:', err);
    }
  };

  // Carregar períodos fechados ao montar
  useEffect(() => {
    loadClosedPeriods();
  }, []);

  // Carga real do caixa por hora (Erlang-C, mesmo motor do Controlador de
  // Frente de Caixa) — troca sempre que o dia selecionado no toolbar muda.
  useEffect(() => {
    loadCaixaHoras(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  const loadCaixaHoras = async (dow) => {
    try {
      setCaixaLoading(true);
      const res = await api.get(`/controller-caixa?dow=${dow}`);
      setCaixaHoras(res.data.horas || []);
    } catch (err) {
      console.error('Erro ao carregar carga do caixa:', err);
      setCaixaHoras([]);
    } finally {
      setCaixaLoading(false);
    }
  };

  const loadClosedPeriods = async () => {
    try {
      const res = await api.get('/schedule/closed-periods');
      setClosedPeriods(res.data.periods || []);
    } catch (err) {
      console.error('Erro ao carregar períodos:', err);
    }
  };

  // Mapeamento de setores — usa o MESMO critério do backend
  // (scheduleGroupKey em schedule.js), que é quem realmente decide como a
  // escala é agrupada/gerada. Antes esse componente reconstruía o setor com
  // sua própria lista de palavras-chave, independente do `id_mercadologico`
  // real e do agrupamento que efetivamente gerou a escala — podia mostrar
  // um setor diferente do que foi usado pra calcular abridor/fechador.
  const getSectorFromEmployee = (employee) => {
    // Nunca usa o cargo como "setor" de propósito — cargo é função
    // (ADMINISTRADOR, ANALISTA COMERCIAL...), não mercadológico. Sem
    // e.setor (id_mercadologico vinculado), a pessoa é "Sem setor" mesmo,
    // pra aparecer separado na lista em vez de virar um item falso a mais.
    if (employee.setor) return employee.setor;
    return 'Sem setor';
  };

  // Split das violações reais (checkComplianceCLT no backend) por
  // `blocks` — regra marcada como bloqueante vira "Alerta/Bloqueio",
  // regra marcada como só-aviso vira "Aviso". Nada aqui é estimado no
  // front: vem pronto do backend, mensagem incluída.
  const alertasCLT = complianceViolations.filter(v => v.blocks !== false);
  const avisosCLT = complianceViolations.filter(v => v.blocks === false);

  // Obtém lista única de setores dos employees
  const setores = Array.from(new Set(employees.map(getSectorFromEmployee))).sort();

  // Filtra employees pelo setor selecionado
  const filteredEmployees = selectedSector === 'Geral'
    ? employees
    : employees.filter(e => getSectorFromEmployee(e) === selectedSector);

  // Escala exibida: a "atual" (prop `schedule`) ou a recalculada de verdade
  // pro cenário 5x2 selecionado (scenarioSchedules vem do backend, mesma
  // função generateGroupedSchedule, só com targetHours/targetDaysOff diferentes).
  const activeScenario = scenarioSchedules?.[selectedScenario];
  const displaySchedule = activeScenario ? activeScenario.schedule : schedule;
  const targetHours = activeScenario ? activeScenario.targetHours : 44;
  const targetDaysOff = activeScenario ? activeScenario.targetDaysOff : 1;

  // Calcula quantos colaboradores estão conformes (jornada-alvo do cenário + folgas)
  const conformesCount = filteredEmployees.filter(emp => {
    const shifts = displaySchedule[emp.name] || [];
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
    // >= e não === : ver comentário equivalente mais abaixo, no cálculo por
    // linha — folga a mais (rodízio de domingo) não é irregularidade.
    return Math.abs(horas - targetHours) <= 0.5 && folgas >= targetDaysOff;
  }).length;

  const formatMoney = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

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

  // Detecta se o turno realmente abre ou fecha a loja, comparando com o
  // horário real de funcionamento (storeHours) — antes isso era feito
  // checando se a string do turno continha literalmente "08" ou "20", o
  // que só funcionava por coincidência quando a loja abria às 08h e
  // fechava às 20h. Pra lojas com outro horário (ex: 07h-19h), ou turnos
  // que não começam exatamente na hora cheia do texto comparado, o badge
  // simplesmente não aparecia.
  const getShiftRole = (shift) => {
    if (!shift || shift === 'Folga') return null;
    const blocks = shift.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/g) || [];
    if (!blocks.length) return null;
    const toHours = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h + m / 60;
    };
    const first = blocks[0].match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    const last = blocks[blocks.length - 1].match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    const start = toHours(first[1]);
    const end = toHours(last[2]);
    const open = storeHours.openTime ? toHours(storeHours.openTime) : null;
    const close = storeHours.closeTime ? toHours(storeHours.closeTime) : null;
    const abre = open !== null && start <= open;
    const fecha = close !== null && end >= close;
    if (abre && fecha) return 'abertura-fechamento';
    if (abre) return 'abertura';
    if (fecha) return 'fechamento';
    return null;
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
        const intervalo = `int. ${fimPrimeiro}-${inicioSegundo}`;

        return (
          <>
            <div style={{ fontSize: '10px' }}>{timeBlocks[0]} / {timeBlocks[1]}</div>
            <div style={{ fontSize: '8px', color: 'var(--esc-muted)', marginTop: '1px' }}>{intervalo}</div>
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

    // Respeita o filtro de setor selecionado — antes exportava a escala
    // inteira da empresa mesmo com um setor específico escolhido no filtro.
    const scheduleParaExportar = selectedSector === 'Geral'
      ? schedule
      : Object.fromEntries(
          Object.entries(schedule).filter(([nome]) => filteredEmployees.some(e => e.name === nome))
        );

    try {
      setLoading(true);
      const res = await api.post('/schedule/export', {
        schedule: scheduleParaExportar,
        setor: selectedSector !== 'Geral' ? selectedSector : undefined,
      });
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

  // Calcular calendário — `seg` (segunda-feira exibida) precisa somar o
  // weekOffset, senão "← Anterior/Próxima →" e o seletor de semana do mês
  // trocam o número mas a grade continua sempre mostrando a semana atual.
  const hoje = new Date();
  const diaSemana = (hoje.getDay() + 6) % 7;
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - diaSemana + weekOffset * 7);

  const datas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      data: d.toISOString().split('T')[0],
      dia: dias[i]
    };
  });

  // "Hoje" só faz sentido destacar quando a semana exibida é a atual.
  const todayIdx = weekOffset === 0 ? diaSemana : -1;
  const totalColaboradores = Object.keys(schedule || {}).length;

  const scenarios = !employees.length || !scenarioSchedules ? [] : [
    { id: 'atual', label: 'Atual 6x1 - 44h' },
    { id: 'transicao', label: 'Transição 5x2 - 42h' },
    { id: 'final', label: 'Final 5x2 - 40h' },
  ].map((s) => {
    const info = scenarioSchedules[s.id];
    return {
      ...s,
      hours: info?.targetHours ?? '—',
      pdvs: pdvs ?? '—',
      operators: employees.length,
      capacity: info?.targetHours ? info.targetHours * employees.length : '—',
    };
  });

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
        /* Mesma borda em gradiente diagonal do Perfil/Usuários/Controlador
           (padrão do produto) — antes só essas páginas tinham esse detalhe. */
        .esc-panel::before{
          content:"";position:absolute;inset:0;border-radius:18px;padding:1px;
          background:linear-gradient(140deg, rgba(74,168,255,.5), transparent 35%, transparent 65%, rgba(124,92,255,.4));
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor;mask-composite:exclude;
          pointer-events:none;opacity:.7;
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
        .esc-clt-tag{font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px;color:#dbe6f5;
          background:rgba(255,255,255,.04);border:1px solid var(--esc-line);}

        /* ---------- Modais CLT ---------- */
        .esc-modal-overlay{position:fixed;inset:0;background:rgba(8,12,20,.6);display:flex;align-items:center;
          justify-content:center;z-index:1000;padding:20px;}
        .esc-modal{background:#151b28;border:1px solid var(--esc-line);border-radius:14px;padding:20px 22px;
          width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;gap:4px;
          box-shadow:0 24px 60px -20px rgba(0,0,0,.6);}
        .esc-modal-wide{max-width:640px;}
        .esc-modal-header{display:flex;justify-content:space-between;align-items:center;}
        .esc-modal-header h3{margin:0;font-size:15px;color:var(--esc-text);}
        .esc-modal-close{background:none;border:none;color:var(--esc-faint);font-size:20px;cursor:pointer;line-height:1;}
        .esc-modal-close:hover{color:var(--esc-text);}
        .esc-modal-subtitle{font-size:12px;color:var(--esc-muted);margin:0 0 8px;}
        .esc-modal-body{overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px;}
        .esc-modal-empty{font-size:12.5px;color:var(--esc-faint);}
        .esc-modal-group{padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);
          border:1px solid var(--esc-line);}
        .esc-modal-group strong{font-size:12.5px;color:#7dd3fc;}
        .esc-modal-group ul{margin:6px 0 0;padding-left:18px;}
        .esc-modal-group li{font-size:12px;color:var(--esc-muted);margin-bottom:3px;}
        .esc-modal-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;
          margin-top:14px;padding-top:14px;border-top:1px solid var(--esc-line);}

        .esc-clt-rule-card{padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.025);
          border:1px solid var(--esc-line);}
        .esc-clt-rule-card-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
        .esc-clt-rule-check{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--esc-text);}
        .esc-clt-rule-artigo{font-size:10.5px;font-weight:600;color:var(--esc-faint);white-space:nowrap;}
        .esc-clt-rule-desc{font-size:11.5px;color:var(--esc-muted);margin:4px 0 10px;line-height:1.4;}
        .esc-clt-rule-fields{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;}
        .esc-clt-field{display:flex;flex-direction:column;gap:4px;min-width:120px;}
        .esc-clt-field label{font-size:10.5px;color:var(--esc-faint);font-weight:600;}
        .esc-clt-field-input{display:flex;align-items:center;gap:6px;}
        .esc-clt-field-input input{width:100%;padding:6px 8px;border-radius:7px;background:var(--esc-surface);
          border:1px solid var(--esc-line);color:var(--esc-text);font-size:12.5px;}
        .esc-clt-field-input span{font-size:11px;color:var(--esc-faint);}
        .esc-clt-field-select{flex:1;min-width:160px;}
        .esc-clt-field-select select{width:100%;padding:6px 8px;border-radius:7px;background:var(--esc-surface);
          border:1px solid var(--esc-line);color:var(--esc-text);font-size:12px;}
        @media (max-width:520px){
          .esc-clt-rule-fields{flex-direction:column;align-items:stretch;}
        }

        /* ---------- Editor de turno (clique na célula) ---------- */
        .esc-shift-editor{position:absolute;top:calc(100% + 4px);left:0;z-index:50;width:264px;
          background:linear-gradient(180deg, rgba(30,38,56,.98), rgba(19,24,36,.98));
          border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 16px;
          box-shadow:0 24px 60px -16px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.05);
          backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
          text-align:left;cursor:default;}
        .esc-shift-editor-head{display:flex;justify-content:space-between;align-items:center;gap:8px;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--esc-line);}
        .esc-shift-editor-head strong{font-size:12.5px;color:var(--esc-text);font-weight:700;}
        .esc-shift-editor-label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
          color:var(--esc-faint);margin:0 0 6px;}
        .esc-shift-editor-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;}
        .esc-shift-editor-presets .esc-preset-btn{
          padding:7px 8px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;text-align:center;
          color:#c4ccd8;background:rgba(255,255,255,.03);border:1px solid var(--esc-line);transition:.14s;}
        .esc-shift-editor-presets .esc-preset-btn:hover{background:rgba(74,168,255,.14);
          border-color:rgba(74,168,255,.4);color:#fff;}
        .esc-shift-editor-presets .esc-preset-btn:disabled{opacity:.5;cursor:not-allowed;}
        .esc-shift-editor-presets .esc-preset-btn.is-folga{grid-column:1 / -1;color:#fca5a5;
          border-color:rgba(248,113,113,.25);}
        .esc-shift-editor-presets .esc-preset-btn.is-folga:hover{background:rgba(248,113,113,.12);
          border-color:rgba(248,113,113,.4);color:#fecaca;}
        .esc-shift-editor-custom{display:flex;gap:8px;}
        .esc-shift-editor-custom input{flex:1;min-width:0;padding:8px 10px;border-radius:8px;
          background:var(--esc-surface);border:1px solid var(--esc-line);color:var(--esc-text);font-size:12px;
          font-variant-numeric:tabular-nums;outline:none;transition:.16s;}
        .esc-shift-editor-custom input:focus{border-color:var(--esc-accent);box-shadow:0 0 0 3px rgba(74,168,255,.16);}
        .esc-shift-editor-custom .esc-btn{padding:8px 14px;font-size:11.5px;white-space:nowrap;}
        .esc-shift-editor-restore{display:block;width:100%;margin-top:12px;padding-top:10px;
          border-top:1px solid var(--esc-line);background:none;border-left:none;border-right:none;border-bottom:none;
          color:var(--esc-faint);font-size:11px;font-weight:600;cursor:pointer;text-align:center;
          font-family:inherit;transition:.14s;}
        .esc-shift-editor-restore:hover{color:#fca5a5;}
        .esc-shift-editor-restore:disabled{opacity:.5;cursor:not-allowed;}

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
        .esc-weekly-grid{display:flex;flex-direction:column;gap:4px;overflow:auto;max-height:640px;}
        .esc-weekly-row.esc-head-row{position:sticky;top:0;z-index:5;background:#0d1220;padding-top:3px;padding-bottom:3px;}
        .esc-weekly-row{display:grid;grid-template-columns:1.5fr repeat(7,1fr) 1fr;gap:4px;min-width:780px;}
        .esc-weekly-head{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
          padding:6px 4px;border-radius:8px;font-size:11px;font-weight:700;color:var(--esc-muted);
          background:rgba(255,255,255,.03);border:1px solid var(--esc-line);text-align:center;}
        .esc-weekly-head.is-today{color:#fff;border-color:rgba(74,168,255,.5);
          background:linear-gradient(180deg,rgba(74,168,255,.18),rgba(74,168,255,.06));}
        .esc-head-date{font-size:9px;font-weight:500;color:var(--esc-faint);}
        .esc-weekly-head .esc-today-tag{margin-top:1px;}

        .esc-weekly-person{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:6px 10px;
          border-radius:8px;background:rgba(0,0,0,.35);border:1px solid var(--esc-line);
          box-shadow:inset 3px 0 0 rgba(74,168,255,.5);}
        .esc-person-name{font-size:12px;font-weight:700;color:#fff;}
        .esc-person-details{font-size:9.5px;color:var(--esc-muted);}

        .esc-weekly-shift{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
          min-height:32px;padding:4px;border-radius:8px;font-size:11px;font-weight:600;color:var(--esc-text);
          background:var(--esc-surface);border:1px solid var(--esc-line);text-align:center;transition:outline .16s;}
        .esc-weekly-shift:hover{outline:2px solid rgba(108,192,255,.5);outline-offset:-2px;}
        .esc-weekly-shift.is-today{background:linear-gradient(180deg,rgba(74,168,255,.2),rgba(74,168,255,.08));
          border-color:rgba(108,192,255,.55);box-shadow:inset 0 0 0 1px rgba(108,192,255,.3);}
        .esc-weekly-off{background:rgba(255,255,255,.03);border-color:var(--esc-line);color:var(--esc-faint);}
        .esc-shift-main{font-size:11px;}
        .esc-shift-icons{display:flex;gap:3px;font-size:10px;}
        .esc-role-badge{padding:1px 4px;border-radius:3px;font-size:6.5px;font-weight:700;text-transform:uppercase;}
        .esc-role-open{background:rgba(34,197,94,.2);color:#22c55e;border:1px solid rgba(34,197,94,.3);}
        .esc-role-close{background:rgba(251,146,60,.2);color:#fb923c;border:1px solid rgba(251,146,60,.3);}

        .esc-weekly-status{display:flex;align-items:center;justify-content:center;padding:5px;border-radius:8px;
          font-size:10px;font-weight:700;text-align:center;}
        .esc-status-valid{color:#86efac;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.3);}
        .esc-status-invalid{color:#fcd34d;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);}

        .esc-forecast-row{border-bottom:2px solid rgba(74,168,255,.15);padding-bottom:4px;margin-bottom:1px;}
        .esc-forecast-row .esc-weekly-shift{min-height:32px;font-size:9.5px;color:var(--esc-muted);gap:3px;}
        .esc-atv-badge{font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap;}
        .esc-atv-embalagem{color:#fcd34d;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.3);}
        .esc-atv-reposicao{color:#93c5fd;background:rgba(74,168,255,.12);border:1px solid rgba(74,168,255,.3);}
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
      <StoreFloorMap schedule={schedule} demand={demand} employees={employees} storeConfig={{ pdvs }} storeHours={storeHours} storeHoursByDay={storeHoursByDay} />

      {/* Weekly Panel - Semana Completa */}
      <div className="esc-panel">

        {/* Panel Head */}
        <div className="esc-panel-head">
          <div>
            <h3>Semana completa por colaboradora</h3>
            <p>{targetHours}h semanais + {targetDaysOff} folga{targetDaysOff > 1 ? 's' : ''} por semana (conforme CLT)</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

        {/* CLT Compliance Box — auditoria real (checkComplianceCLT), não
            mais texto fixo. "Alertas/Bloqueios" = violação de regra dura
            (interjornada, DSR, máx 44h/semana, máx 10h/dia, máx 6 dias
            consecutivos); "Avisos" = gente com jornada/folgas fora do
            alvo do cenário (linhas marcadas "Revisar" na grade). */}
        <div className="esc-clt-box">
          <strong style={{ color: alertasCLT.length === 0 ? '#34d399' : '#fbbf24' }}>
            {alertasCLT.length === 0 ? 'Escala em conformidade CLT' : `${alertasCLT.length} ponto(s) de atenção na CLT`}
          </strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <span
              className="esc-clt-tag"
              role="button"
              tabIndex={0}
              onClick={() => openCltModal('alertas')}
              style={{ cursor: 'pointer', borderColor: alertasCLT.length ? 'rgba(248,113,113,.35)' : undefined, color: alertasCLT.length ? '#fca5a5' : undefined }}
            >
              Alertas/Bloqueios ({alertasCLT.length})
            </span>
            <span
              className="esc-clt-tag"
              role="button"
              tabIndex={0}
              onClick={() => openCltModal('avisos')}
              style={{ cursor: 'pointer', borderColor: avisosCLT.length ? 'rgba(251,191,36,.35)' : undefined, color: avisosCLT.length ? '#fcd34d' : undefined }}
            >
              Avisos ({avisosCLT.length})
            </span>
            <span className="esc-clt-tag" role="button" tabIndex={0} onClick={() => openCltModal('regras')} style={{ cursor: 'pointer' }}>
              Regras CLT/CCT
            </span>
          </div>
          <p>
            Auditoria baseada na CLT federal (interjornada 11h, DSR, máx 44h/semana, máx 10h/dia, máx 6 dias consecutivos). Convenções coletivas locais (CCT dos comerciários) podem ter regras adicionais — valide com seu contador/sindicato.
          </p>
        </div>

        {cltModal === 'alertas' && createPortal(
          <CltViolationsModal
            title="Alertas/Bloqueios"
            subtitle="Violações de regras que travam a publicação da escala."
            violations={alertasCLT}
            onClose={() => setCltModal(null)}
          />,
          document.body
        )}
        {cltModal === 'avisos' && createPortal(
          <CltViolationsModal
            title="Avisos"
            subtitle="Pontos que não travam a publicação, mas merecem revisão."
            violations={avisosCLT}
            onClose={() => setCltModal(null)}
          />,
          document.body
        )}
        {cltModal === 'regras' && createPortal(
          <CltRulesModal
            draft={cltRulesDraft}
            onChange={setCltRulesDraft}
            onRestaurarPadrao={restaurarCltPadrao}
            onSave={saveCltRules}
            onClose={() => setCltModal(null)}
            saving={cltRulesSaving}
          />,
          document.body
        )}

        {/* Week Comparison Cards */}
        <div className="esc-week-comparison">
          <div className="esc-wc-card">
            <small>Previsão semana</small>
            <strong>{revenueByDay.length ? formatMoney(revenueByDay.reduce((a, b) => a + b, 0)) : '—'}</strong>
            <span className="esc-wc-detail">{revenueByDay.length ? 'baseado no histórico sincronizado' : 'sem histórico de vendas ainda'}</span>
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
          <button className="esc-week-nav-btn" onClick={() => onWeekOffsetChange(weekOffset - 1)}>
            ← Anterior
          </button>
          <span className="esc-week-nav-label">
            {datas[0].label} — {datas[6].label}
            {weekOffset === 0 && <span className="esc-today-tag">atual</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <button className="esc-week-nav-btn" onClick={() => onWeekOffsetChange(weekOffset + 1)}>
              Próxima →
            </button>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="esc-weekly-grid">
          {/* Header */}
          <div className="esc-weekly-row esc-head-row">
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
            {dias.map((_, i) => {
              const atv = activitySuggestionByDay[i];
              return (
                <div key={i} className="esc-weekly-shift" title={atv ? atv.motivo : undefined}>
                  <span>{revenueByDay[i] ? formatMoney(revenueByDay[i]) : 'Sem histórico'}</span>
                  {atv && (
                    <span className={`esc-atv-badge esc-atv-${atv.atividade}`}>
                      {atv.atividade === 'embalagem' ? `🛒 ${atv.excedentes} emb` : `📦 ${atv.excedentes} rep`}
                    </span>
                  )}
                </div>
              );
            })}
            <div className="esc-weekly-shift" style={{ background: 'transparent', border: 'none' }}></div>
          </div>

          {/* Pessoas */}
          {displaySchedule &&
            filteredEmployees.map((emp, idx) => {
              const shifts = displaySchedule[emp.name] || [];
              const horasTrabalhadas = shifts.reduce((sum, shift) => sum + parseHours(shift), 0);
              const folgas = shifts.filter((s) => s === 'Folga').length;
              // >= e não === : no 6x1 quem cai no rodízio de domingo daquela
              // semana descansa 2 dias em vez de 1 (folga fixa + domingo) —
              // isso é folga A MAIS, não uma irregularidade. Com === estrito,
              // essa pessoa aparecia como "Revisar" sem ter feito nada errado.
              const conforme = Math.abs(horasTrabalhadas - targetHours) <= 0.5 && folgas >= targetDaysOff;

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
                      style={{ cursor: weekStart && workflowStatus !== 'publicado' ? 'pointer' : undefined }}
                      onClick={(e) => {
                        if (!weekStart || workflowStatus === 'publicado') return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setCustomShiftInput(shift === 'Folga' ? '' : shift);
                        setEditingCell({ name: emp.name, dayIdx, top: rect.bottom + 4, left: rect.left });
                      }}
                    >
                      {shift === 'Folga' ? (
                        <span className="esc-shift-main">Folga</span>
                      ) : (
                        <>
                          <span className="esc-shift-main">{formatShift(shift)}</span>
                          {shift && (() => {
                            const role = getShiftRole(shift);
                            if (!role) return null;
                            return (
                              <div className="esc-shift-icons">
                                {(role === 'abertura' || role === 'abertura-fechamento') && <span className="esc-role-badge esc-role-open">ABERTURA</span>}
                                {(role === 'fechamento' || role === 'abertura-fechamento') && <span className="esc-role-badge esc-role-close">FECHAMENTO</span>}
                              </div>
                            );
                          })()}
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

      {/* Editor de turno — portal pra fora do grid com overflow:auto, senão
          o popup ficava cortado (mesmo problema resolvido antes no
          Controlador com os cards de previsão). */}
      {editingCell && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setEditingCell(null)} />
          <div className="esc-shift-editor" style={{ position: 'fixed', top: editingCell.top, left: editingCell.left }} onClick={(e) => e.stopPropagation()}>
            <div className="esc-shift-editor-head">
              <strong>{editingCell.name} · {dias[editingCell.dayIdx]}</strong>
              <button className="esc-modal-close" onClick={() => setEditingCell(null)}>×</button>
            </div>
            <p className="esc-shift-editor-label">Horários rápidos</p>
            <div className="esc-shift-editor-presets">
              {SHIFT_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`esc-preset-btn ${p === 'Folga' ? 'is-folga' : ''}`}
                  disabled={savingOverride}
                  onClick={() => applyShiftOverride(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="esc-shift-editor-label">Horário customizado</p>
            <div className="esc-shift-editor-custom">
              <input
                type="text"
                placeholder="HH:MM-HH:MM"
                value={customShiftInput}
                onChange={(e) => setCustomShiftInput(e.target.value)}
              />
              <button className="esc-btn" disabled={savingOverride || !customShiftInput.trim()} onClick={() => applyShiftOverride(customShiftInput.trim())}>
                Aplicar
              </button>
            </div>
            <button className="esc-shift-editor-restore" disabled={savingOverride} onClick={restaurarTurnoAutomatico}>
              ↩ Restaurar automático
            </button>
          </div>
        </>,
        document.body
      )}

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
            <button className="esc-ghost" disabled style={{ opacity: 0.4, cursor: 'not-allowed' }} title="Ainda não implementado — simulação de otimização automática de turnos">
              Otimização
            </button>
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                className={`esc-ghost ${selectedScenario === scenario.id ? 'is-active' : ''}`}
                title={scenario.id === 'atual' ? 'Regime atual: 6 dias trabalhados, domingo em rodízio' : 'Simulação real: 5 dias trabalhados, domingo fixo de folga'}
              >
                {scenario.label.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Day Toolbar — diasFull[0]='Segunda' -> dow SQL 1, ..., [6]='Domingo' -> dow 0 */}
        <div className="esc-toolbar">
          {diasFull.map((dia, i) => {
            const dow = i === 6 ? 0 : i + 1;
            return (
            <button
              key={dia}
              onClick={() => setSelectedDay(dow)}
              className={`esc-ghost ${selectedDay === dow ? 'is-active' : ''}`}
            >
              {dia}
            </button>
            );
          })}
        </div>

        {/* Heatmap real — intensidade de clientes/hora (Erlang-C), mesmo
            dado usado pelo Controlador de Frente de Caixa */}
        <div className="esc-subtle-panel">
          <p style={{ margin: '0 0 10px' }}>Heatmap de demanda por hora</p>
          {caixaLoading ? (
            <small style={{ color: 'var(--esc-muted)' }}>Carregando...</small>
          ) : caixaHoras.length === 0 ? (
            <small style={{ color: 'var(--esc-muted)' }}>Sem histórico de vendas suficiente pra esse dia.</small>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              {caixaHoras.map((h, i) => {
                const maxClientes = Math.max(...caixaHoras.map((x) => x.clientes || 0), 1);
                const pct = Math.max(6, Math.round(((h.clientes || 0) / maxClientes) * 100));
                return (
                  <div key={i} title={`${h.hora} · ${h.clientes} clientes/h`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${pct}%`, borderRadius: 4, background: 'linear-gradient(180deg, rgba(74,168,255,.9), rgba(74,168,255,.25))' }} />
                    </div>
                    <small style={{ fontSize: 9, color: 'var(--esc-faint)' }}>{h.hora}</small>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cashier Load Panel — utilização real (Erlang-C): escalados vs
            necessários, mesmo motor do Controlador de Frente de Caixa. */}
        <div className="esc-subtle-panel">
          <p>Carga do caixa por hora</p>
          <div className="esc-load-grid">
            {caixaHoras.length === 0 ? (
              <small style={{ color: 'var(--esc-muted)' }}>{caixaLoading ? 'Carregando...' : 'Sem histórico de vendas suficiente pra esse dia.'}</small>
            ) : (
              <>
                {caixaHoras.map((h, i) => (
                  <div key={i} className="esc-load-cell" title={`${h.operadoresEscalados} escalado(s) · ${h.operadoresRecomendados} recomendado(s) · ${h.status}`}>
                    <span>{h.hora}</span>
                    <strong>{h.utilizacao !== null ? `${h.utilizacao}%` : '—'}</strong>
                  </div>
                ))}
                <div className="esc-load-cell">
                  <span>Média</span>
                  <strong>
                    {Math.round(
                      caixaHoras.reduce((sum, h) => sum + (h.utilizacao || 0), 0) / caixaHoras.length
                    )}%
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Modal de lista — usado tanto pra "Alertas/Bloqueios" quanto "Avisos".
// Agrupa por funcionário e mostra a mensagem real que veio do backend
// (checkComplianceCLT), sem inventar nenhum valor (ex: nada de "ajuda de
// custo de R$X" que a gente não tem configurado de verdade).
function CltViolationsModal({ title, subtitle, violations, onClose }) {
  const porFuncionario = {};
  violations.forEach(v => {
    if (!porFuncionario[v.name]) porFuncionario[v.name] = [];
    porFuncionario[v.name].push(v);
  });
  const nomes = Object.keys(porFuncionario).sort();

  const icone = title === 'Avisos' ? 'ⓘ' : '🚫';
  return (
    <div className="esc-modal-overlay" onClick={onClose}>
      <div className="esc-modal" onClick={e => e.stopPropagation()}>
        <div className="esc-modal-header">
          <h3>{icone} {title}</h3>
          <button className="esc-modal-close" onClick={onClose}>×</button>
        </div>
        <p className="esc-modal-subtitle">{subtitle}</p>
        <div className="esc-modal-body">
          {nomes.length === 0 && <p className="esc-modal-empty">Nenhum item nesta categoria.</p>}
          {nomes.map(nome => (
            <div key={nome} className="esc-modal-group">
              <strong>{nome}</strong>
              <ul>
                {porFuncionario[nome].map((v, i) => (
                  <li key={i}>{v.message || v.type}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="esc-modal-footer">
          <div />
          <button className="esc-ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

const CLT_RULE_LABELS = {
  maxWeeklyHours: {
    label: 'Limite de jornada semanal', artigo: 'CLT art. 58',
    descricao: 'Soma das horas trabalhadas na semana (descontado o intervalo) não pode passar do limite.',
  },
  interjornada: {
    label: 'Interjornada (descanso entre turnos)', artigo: 'CLT art. 66',
    descricao: 'Descanso mínimo entre o fim de uma jornada e o início da próxima.',
  },
  intervalo: {
    label: 'Intervalo dentro da jornada', artigo: 'CLT art. 71',
    descricao: 'Jornada acima de X horas exige um intervalo mínimo (almoço/descanso).',
  },
  dsr: {
    label: 'Descanso semanal (DSR)', artigo: 'CLT art. 67',
    descricao: 'Em toda janela de 7 dias deve haver ao menos N folgas.',
  },
  maxDailyHours: {
    label: 'Limite de jornada diária', artigo: 'CLT art. 59',
    descricao: 'Horas trabalhadas por dia não podem passar do limite (8h + extras).',
  },
  maxConsecutiveDays: {
    label: 'Dias consecutivos trabalhados', artigo: 'Súmula 146 TST',
    descricao: 'Número máximo de dias seguidos trabalhados sem folga.',
  },
};

// Modal de configuração — réplica do projeto modelo: cada regra tem
// enabled/valor/bloqueia-ou-avisa, persistido em store_setup.clt_rules.
function CltRulesModal({ draft, onChange, onRestaurarPadrao, onSave, onClose, saving }) {
  if (!draft) {
    return (
      <div className="esc-modal-overlay" onClick={onClose}>
        <div className="esc-modal" onClick={e => e.stopPropagation()}>
          <div className="esc-modal-header">
            <h3>Regras CLT/CCT</h3>
            <button className="esc-modal-close" onClick={onClose}>×</button>
          </div>
          <p className="esc-modal-empty">Carregando...</p>
        </div>
      </div>
    );
  }

  const updateRule = (key, field, value) => {
    onChange({ ...draft, [key]: { ...draft[key], [field]: value } });
  };

  return (
    <div className="esc-modal-overlay" onClick={onClose}>
      <div className="esc-modal esc-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="esc-modal-header">
          <h3>⚖ Regras CLT/CCT da empresa</h3>
          <button className="esc-modal-close" onClick={onClose}>×</button>
        </div>
        <p className="esc-modal-subtitle">
          Ajuste os valores e se cada regra <strong>bloqueia</strong> a publicação ou <strong>só avisa</strong>. Desmarcar = regra desligada. "Restaurar padrão" volta à CLT federal.
        </p>
        <div className="esc-modal-body">
          {Object.keys(CLT_RULE_LABELS).map(key => {
            const rule = draft[key] || {};
            const meta = CLT_RULE_LABELS[key];
            return (
              <div key={key} className="esc-clt-rule-card">
                <div className="esc-clt-rule-card-head">
                  <label className="esc-clt-rule-check">
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={e => updateRule(key, 'enabled', e.target.checked)}
                    />
                    <span>{meta.label}</span>
                  </label>
                  <span className="esc-clt-rule-artigo">{meta.artigo}</span>
                </div>
                <p className="esc-clt-rule-desc">{meta.descricao}</p>
                <div className="esc-clt-rule-fields">
                  {key === 'intervalo' ? (
                    <>
                      <div className="esc-clt-field">
                        <label>Intervalo mínimo</label>
                        <div className="esc-clt-field-input">
                          <input
                            type="number"
                            value={rule.minMinutes ?? ''}
                            onChange={e => updateRule(key, 'minMinutes', Number(e.target.value))}
                          />
                          <span>min</span>
                        </div>
                      </div>
                      <div className="esc-clt-field">
                        <label>Exigido acima de</label>
                        <div className="esc-clt-field-input">
                          <input
                            type="number"
                            value={rule.acimaDeHoras ?? ''}
                            onChange={e => updateRule(key, 'acimaDeHoras', Number(e.target.value))}
                          />
                          <span>h</span>
                        </div>
                      </div>
                    </>
                  ) : key === 'dsr' ? (
                    <div className="esc-clt-field">
                      <label>Folgas por semana</label>
                      <div className="esc-clt-field-input">
                        <input
                          type="number"
                          value={rule.folgasPerWeek ?? ''}
                          onChange={e => updateRule(key, 'folgasPerWeek', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="esc-clt-field">
                      <label>{key === 'maxWeeklyHours' ? 'Máx. horas por semana' : key === 'interjornada' ? 'Mín. horas de descanso' : key === 'maxDailyHours' ? 'Máx. horas por dia' : 'Máx. dias seguidos'}</label>
                      <div className="esc-clt-field-input">
                        <input
                          type="number"
                          value={rule.value ?? ''}
                          onChange={e => updateRule(key, 'value', Number(e.target.value))}
                        />
                        {key !== 'maxConsecutiveDays' && <span>h</span>}
                      </div>
                    </div>
                  )}
                  <div className="esc-clt-field esc-clt-field-select">
                    <label>Quando violada</label>
                    <select
                      value={rule.blocks === false ? 'avisa' : 'bloqueia'}
                      onChange={e => updateRule(key, 'blocks', e.target.value === 'bloqueia')}
                    >
                      <option value="bloqueia">Bloqueia publicação</option>
                      <option value="avisa">Só avisa</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="esc-modal-footer">
          <button className="esc-ghost" onClick={onRestaurarPadrao} disabled={saving}>Restaurar padrão CLT federal</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="esc-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="esc-btn" onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}