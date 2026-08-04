import React, { useState, useRef, useEffect } from 'react';
import './StoreFloorMap.responsive.css';

export default function StoreFloorMap({ schedule = {}, demand = {}, employees = [], storeHours = {}, storeConfig = {}, storeHoursByDay = null }) {
  // Constantes de horário - agora recebe da loja do usuário
  const parseHour = (timeStr) => {
    const [hours] = (timeStr || '08:00').split(':');
    return parseInt(hours);
  };

  // Horário real de CADA dia (seg-sex, sábado e domingo têm horários
  // próprios na Implantação) — antes usava sempre o mesmo storeHours pra
  // todo dia, então navegar pra "Dom" continuava mostrando 07h-20h mesmo
  // quando o domingo real é 08h-16h.
  const getHoursForDay = (day) => {
    const range = Array.isArray(storeHoursByDay) ? storeHoursByDay[day] : null;
    if (range) return { open: parseHour(range.openTime), close: parseHour(range.closeTime) };
    return { open: parseHour(storeHours.openTime || '08:00'), close: parseHour(storeHours.closeTime || '20:00') };
  };

  // Inicializa com horário real arredondado para meia hora
  const getInitialTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    let roundedHour = minutes >= 30 ? hours + 0.5 : hours;
    const day = (now.getDay() + 6) % 7; // Converte: dom=0 → 6, seg=1 → 0
    const { open, close } = getHoursForDay(day);

    // Valida se loja está aberta - senão começa com horário de abertura
    if (roundedHour < open || roundedHour >= close) {
      roundedHour = open;
    }

    return { hour: roundedHour, day };
  };

  const initialTime = getInitialTime();
  const [floorHour, setFloorHour] = useState(initialTime.hour);
  const [floorDay, setFloorDay] = useState(initialTime.day);

  const { open: openHour, close: closeHour } = getHoursForDay(floorDay);

  // Atualiza a cada 30 minutos em tempo real
  useEffect(() => {
    const updateTime = () => {
      const { hour, day } = getInitialTime();
      setFloorHour(hour);
      setFloorDay(day);
    };

    // Calcula próxima meia hora
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const msUntilNextHalf = ((30 - (minutes % 30)) * 60 - seconds) * 1000;

    // Aguarda até próxima meia hora
    const timeout = setTimeout(() => {
      updateTime();
      // Depois atualiza a cada 30 minutos (1800000 ms)
      setInterval(updateTime, 1800000);
    }, msUntilNextHalf);

    return () => clearTimeout(timeout);
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSector, setSelectedSector] = useState(null);
  const [hoveredWorker, setHoveredWorker] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timelineRef = useRef(null);
  const svgRef = useRef(null);

  const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const checkoutCount = employees.filter(e => (e.setor || '').toLowerCase().includes('caixa')).length;
  const totalPdvs = storeConfig?.pdvs || 3;

  // Calcula demanda horária (0-1) para a hora/dia atual
  const getHourlyDemand = () => {
    const hourKey = `${String(Math.floor(floorHour)).padStart(2, '0')}:00`;
    const dayKey = DAYS[floorDay].toLowerCase();
    const demandValue = demand?.[dayKey]?.[hourKey];
    return demandValue !== undefined ? demandValue : 0.5; // fallback 50%
  };

  // PDVs ativos = min(operadores, total PDVs, demanda)
  // Se demanda < 0.3 abre menos, se > 0.8 abre mais
  const hourlyDemand = getHourlyDemand();
  const pdvsOpenedByDemand = Math.max(1, Math.ceil(totalPdvs * hourlyDemand));
  const pdvs = Math.min(checkoutCount, totalPdvs, pdvsOpenedByDemand);

  // Play animation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setFloorHour(h => h + 0.5 >= closeHour ? closeHour - 0.5 : h + 0.5);
    }, 400);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Add click listeners to sectors and hover listeners to workers
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!svgRef.current) return;

      const svgContainer = svgRef.current.parentElement;

      // Sector click listeners
      const texts = svgRef.current.querySelectorAll('text');
      texts.forEach(text => {
        // A chave do prédio agora vem do atributo `data-sector` (fixo),
        // não mais do texto exibido (que virou dinâmico — nome real do
        // mercadológico do cliente em vez de um rótulo hardcoded).
        const sectorKey = text.getAttribute('data-sector');
        if (sectorKey) {
          text.style.cursor = 'pointer';
          text.style.userSelect = 'none';
          text.onclick = (e) => {
            e.stopPropagation();
            setSelectedSector(sectorKey);
          };
        }
      });

      // Single mousemove listener on SVG for all workers
      const handleSvgMouseMove = (e) => {
        const target = e.target.closest('.worker-icon');
        const rect = svgContainer.getBoundingClientRect();
        const posX = e.clientX - rect.left;
        const posY = e.clientY - rect.top;

        if (target) {
          const name = target.getAttribute('data-worker-name');
          const cargo = target.getAttribute('data-worker-cargo');
          const setor = target.getAttribute('data-worker-setor');
          setHoveredWorker({ name, cargo, setor });
          setTooltipPos({ x: posX, y: posY });
        } else {
          setHoveredWorker(null);
        }
      };

      const handleSvgMouseLeave = () => {
        setHoveredWorker(null);
      };

      svgRef.current.addEventListener('mousemove', handleSvgMouseMove);
      svgRef.current.addEventListener('mouseleave', handleSvgMouseLeave);

      return () => {
        svgRef.current?.removeEventListener('mousemove', handleSvgMouseMove);
        svgRef.current?.removeEventListener('mouseleave', handleSvgMouseLeave);
      };
    }, 100);
    return () => clearTimeout(timer);
  }, [floorHour, floorDay, selectedSector]);

  const zoneOf = (employee) => {
    // Zona expl\u00edcita configurada pelo admin (mercadologicos.zona_mapa)
    // sempre vence \u2014 a heur\u00edstica por palavra-chave abaixo s\u00f3 roda como
    // fallback pra setor ainda n\u00e3o configurado.
    if (employee.zona_mapa) {
      return employee.zona_mapa === 'loja' ? 'gondola' : employee.zona_mapa;
    }

    // Sem id_mercadologico vinculado (Implantação mostra "Sem setor") ->
    // não adivinha por cargo. Antes isso caía no heurístico abaixo e uma
    // pessoa com cargo "Operador de Loja" (sem setor real nenhum) acabava
    // contando como Frente de Caixa só por causa da palavra "operador".
    if (!employee.id_mercadologico) return 'sem-setor';

    const setor = (employee.setor || '').toLowerCase();
    const cargo = (employee.cargo || '').toLowerCase();
    const combined = `${setor} ${cargo}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (combined.includes('acougue') || combined.includes('carnes')) return 'acougue';
    if (combined.includes('padaria') || combined.includes('confeitaria')) return 'padaria';
    if (combined.includes('hortifruti') || combined.includes('frutas')) return 'hortifruti';
    if (combined.includes('frios') || combined.includes('laticinio')) return 'frios';
    if (combined.includes('recebimento') || combined.includes('estoque') || combined.includes('deposito') || combined.includes('doca') || combined.includes('descarga')) return 'recebimento';
    if (combined.includes('administrativo') || combined.includes('admin') || combined.includes('escritorio') || combined.includes('rh') || combined.includes('financeiro') || combined.includes('contabil') || combined.includes('dp') || combined.includes('departamento pessoal')) return 'escritorio';
    if (combined.includes('comercial') || combined.includes('gerente') || combined.includes('fiscal')) return 'comercial';
    if (combined.includes('mercearia') || combined.includes('gondola') || combined.includes('repositor') || combined.includes('repos')) return 'gondola';
    if (combined.includes('caixa') || combined.includes('frente')) return 'checkout';
    // Qualquer setor real de loja que não seja um "prédio" especial
    // (Bebidas, Higiene Pessoal, Bazar, Perfumaria, Limpeza, Mercearia
    // Doce/Salgada/Seca etc.) conta dentro da LOJA — antes caía num
    // bucket "outro" que não aparecia em lugar nenhum do mapa.
    return 'gondola';
  };

  // Nome do "prédio" exibido (ex: "LOJA") -> chave de zona interna usada
  // por zoneOf — pra montar a legenda de setores reais dentro do drill-down.
  const SECTOR_NAME_TO_ZONE = {
    ACOUGUE: 'acougue', PADARIA: 'padaria', FRIOS: 'frios', HORTI: 'hortifruti',
    LOJA: 'gondola', RECEBIMENTO: 'recebimento', ESCRITORIO: 'escritorio',
    COMERCIAL: 'comercial', 'FRENTE DE CAIXA': 'checkout',
  };

  // Recebimento/Escritório ficam bem mais à direita do desenho (gx ~13-17)
  // que o resto da loja (gx 0-12) — com o viewBox fixo de antes, quando o
  // cliente não tem esses dois prédios (caso comum, como o Super Feirão),
  // sobrava uma faixa vazia enorme do lado direito e o desenho parecia
  // "grudado" na esquerda. Calcula a largura real usada e centraliza em
  // cima dela em vez de sempre assumir o layout completo.
  const hasExtensao = employees.some((e) => {
    const z = zoneOf(e);
    return z === 'recebimento' || z === 'escritorio';
  });
  const buildCenteredViewBox = (rightEdge, bottomEdge) => {
    const leftEdge = 8;
    const topEdge = -12;
    const padX = 60, padTop = 50, padBottom = 60;
    const x = leftEdge - padX;
    const w = (rightEdge - leftEdge) + padX * 2;
    const y = topEdge - padTop;
    const hgt = (bottomEdge - topEdge) + padTop + padBottom;
    return `${x} ${y} ${w} ${hgt}`;
  };
  const mainViewBox = buildCenteredViewBox(hasExtensao ? 880 : 730, hasExtensao ? 400 : 285);
  // Drill-down de setor sempre desenha só o piso 0-12 (nunca tem a extensão
  // de Recebimento/Escritório junto) — mesmo cálculo do mapa geral sem
  // extensão, senão ficava com a mesma sobra de espaço vazio de antes.
  const sectorViewBox = buildCenteredViewBox(730, 285);

  // Rótulo real do prédio no mapa geral: antes era texto fixo ("ACOUGUE",
  // "PADARIA"...) não importava o que o cliente realmente chamava aquele
  // setor. Agora busca o(s) nome(s) reais dos mercadológicos vinculados a
  // essa zona (via zoneOf) — só cai no nome genérico se ainda não tem
  // ninguém vinculado ali (não dá pra saber o nome real de um setor vazio).
  const zoneLabel = (zoneKey, fallback) => {
    const nomes = new Set();
    employees.forEach((e) => { if (zoneOf(e) === zoneKey && e.setor) nomes.add(e.setor.toUpperCase()); });
    if (nomes.size === 0) return fallback;
    const lista = [...nomes];
    return lista.length <= 2 ? lista.join(' / ') : `${lista.slice(0, 2).join(' / ')} +${lista.length - 2}`;
  };

  const parseRanges = (shift) => {
    if (!shift || shift === 'Folga') return null;
    // Remove "Intervalo HH:MM-HH:MM" se existir
    const cleaned = shift.replace(/\s*Intervalo\s+\d{2}:\d{2}-\d{2}:\d{2}/, '');
    // Separa blocos por / ou ·
    const blocks = cleaned.split(/\/|·/).map(b => b.trim()).filter(b => b);
    const ranges = [];
    blocks.forEach(block => {
      const match = block.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
      if (match) {
        const s = parseInt(match[1]) + parseInt(match[2]) / 60;
        const e = parseInt(match[3]) + parseInt(match[4]) / 60;
        if (!isNaN(s) && !isNaN(e)) ranges.push({ s, e });
      }
    });
    return ranges.length ? ranges : null;
  };

  const isOnBreak = (employee) => {
    const shifts = schedule[employee.name] || [];
    const dayShift = shifts[floorDay];
    const ranges = parseRanges(dayShift);
    // Intervalo é o gap entre primeiro e segundo bloco (se existem 2+)
    if (!ranges || ranges.length < 2) return false;
    return floorHour >= ranges[0].e && floorHour < ranges[1].s;
  };

  const isWorking = (employee) => {
    const shifts = schedule[employee.name] || [];
    const dayShift = shifts[floorDay];
    const ranges = parseRanges(dayShift);
    return ranges ? ranges.some(r => floorHour >= r.s && floorHour < r.e) : false;
  };

  // Quais setores REAIS (mercadologico) compõem o prédio selecionado —
  // pra deixar claro o que caiu ali dentro, já que vários setores reais
  // pequenos (Bebidas, Higiene Pessoal, Bazar...) se agrupam num só prédio.
  // Conta só quem está de fato trabalhando no dia/hora selecionados (igual
  // aos bonecos desenhados no SVG) — antes contava TODO mundo vinculado
  // àquele setor (ex.: 39 pessoas do quadro inteiro de Caixa), então o
  // número no badge não batia com a quantidade de bonecos na planta.
  const subSetoresDoZone = selectedSector ? (() => {
    const zoneKey = SECTOR_NAME_TO_ZONE[selectedSector];
    const counts = {};
    employees.forEach((e) => {
      if (zoneOf(e) !== zoneKey) return;
      if (!isWorking(e)) return;
      const nome = e.setor || e.cargo || 'Sem setor';
      counts[nome] = (counts[nome] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })() : [];

  const TW = 60, TH = 25;
  const ZC = { checkout: '#2563eb', gondola: '#16a34a', acougue: '#dc2626', padaria: '#ea580c', hortifruti: '#65a30d', frios: '#0891b2', bebida: '#1e40af', recebimento: '#7c2d12', escritorio: '#4c1d95', comercial: '#9333ea', outro: '#64748b' };

  const isoX = (gx, gy) => 368 + (gx - gy) * TW / 2;
  const isoY = (gx, gy) => 30 + (gx + gy) * TH / 2;

  const isoRect = (gx, gy, gw, gh, fill, stroke, op) => {
    const pts = [[gx, gy], [gx + gw, gy], [gx + gw, gy + gh], [gx, gy + gh]]
      .map(([x, y]) => `${isoX(x, y)},${isoY(x, y)}`)
      .join(' ');
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke || 'none'}" stroke-width="0.5" opacity="${op || 1}"/>`;
  };

  const isoBox = (gx, gy, gw, gh, h, f, d, e) => {
    const top = [[gx, gy], [gx + gw, gy], [gx + gw, gy + gh], [gx, gy + gh]]
      .map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - h}`)
      .join(' ');
    const front = [[gx, gy + gh], [gx + gw, gy + gh]].map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - h}`).join(' ') +
      ' ' + [[gx + gw, gy + gh], [gx, gy + gh]].map(([x, y]) => `${isoX(x, y)},${isoY(x, y)}`).join(' ');
    const side = [isoX(gx + gw, gy), isoY(gx + gw, gy) - h, isoX(gx + gw, gy + gh), isoY(gx + gw, gy + gh) - h, isoX(gx + gw, gy + gh), isoY(gx + gw, gy + gh), isoX(gx + gw, gy), isoY(gx + gw, gy)].join(',');
    return `<polygon points="${top}" fill="${f}" stroke="${d}" stroke-width="0.5"/><polygon points="${front}" fill="${d}" stroke="${e}" stroke-width="0.3"/><polygon points="${side}" fill="${e}" stroke="${e}" stroke-width="0.3"/>`;
  };

  // `sectorKey` (opcional) é a chave FIXA do prédio (ex: "ACOUGUE"), usada
  // só pro clique identificar qual prédio foi clicado — o texto visível
  // (`txt`) agora pode ser dinâmico (nome real do mercadológico), então
  // não dá mais pra clique comparar o texto exibido contra uma lista fixa.
  const isoLabel = (gx, gy, txt, col, sz, sectorKey) => {
    const attr = sectorKey ? ` data-sector="${sectorKey}"` : '';
    return `<text x="${isoX(gx, gy)}" y="${isoY(gx, gy)}" text-anchor="middle" fill="${col}" font-size="${sz || 10}" font-weight="500" style="font-family:inherit"${attr}>${txt}</text>`;
  };

  const isoStatus = (gx, gy, count, status) => {
    const colors = {
      critical: '#dc2626',
      attention: '#eab308',
      adequate: '#16a34a',
      unknown: 'transparent'
    };
    if (status === 'unknown' || count === 0) return '';
    const x = isoX(gx, gy), y = isoY(gx, gy);
    const c = colors[status] || colors.adequate;
    return `<circle cx="${x}" cy="${y - 18}" r="6" fill="${c}" stroke="#fff" stroke-width="1"/><text x="${x}" y="${y - 15}" text-anchor="middle" fill="#fff" font-size="7" font-weight="700" style="font-family:inherit">${count}</text>`;
  };

  const isoWorker = (gx, gy, color, worker, onBreak) => {
    const x = isoX(gx, gy), y = isoY(gx, gy);
    const name = typeof worker === 'string' ? worker : worker.name;
    const setor = typeof worker === 'string' ? '' : (worker.setor || '');
    const cargo = typeof worker === 'string' ? '' : (worker.cargo || '');
    const workerId = typeof worker === 'string' ? name.replace(/\s+/g, '-') : `${worker.name.replace(/\s+/g, '-')}-${Math.random()}`;

    const ini = name[0].toUpperCase();
    const c = onBreak ? '#9e9e9e' : color;
    const firstName = name.split(' ')[0].slice(0, 8);
    const lblW = firstName.length * 4.2 + 6;

    let s = `<g style="cursor:pointer" class="worker-icon" data-worker-id="${workerId}" data-worker-name="${name}" data-worker-cargo="${cargo}" data-worker-setor="${setor}" data-worker-x="${x}" data-worker-y="${y}">`;
    s += `<ellipse cx="${x}" cy="${y + 2}" rx="8" ry="4" fill="rgba(0,0,0,.2)"/>`;
    s += `<rect x="${x - 6}" y="${y - 16}" width="12" height="14" rx="3" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
    s += `<circle cx="${x}" cy="${y - 21}" r="5.5" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
    s += `<text x="${x}" y="${y - 13}" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" style="font-family:inherit;text-shadow:0 1px 2px rgba(0,0,0,.5)">${ini}</text>`;
    s += `<rect x="${x - lblW / 2}" y="${y + 3}" width="${lblW}" height="11" rx="3" fill="${onBreak ? 'rgba(0,0,0,.7)' : 'rgba(255,255,255,.85)'}" stroke="${onBreak ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)'}" stroke-width="0.4"/>`;
    s += `<text x="${x}" y="${y + 11}" text-anchor="middle" fill="${onBreak ? '#e2e8f0' : '#1e293b'}" font-size="6.5" font-weight="500" style="font-family:inherit">${firstName}</text>`;
    if (onBreak) s += `<text x="${x}" y="${y - 28}" text-anchor="middle" font-size="9">☕</text>`;
    s += '</g>';
    return s;
  };

  const svg = () => {
    const dk = true;
    const flA = '#3d3d3d', flB = '#2f2f2f';
    const wC = '#1a2530', wD = '#15202a';
    const mtC = '#451a1a', mtD = '#3a1515', mtE = '#2e1010';
    const bkC = '#453520', bkD = '#3a2a18', bkE = '#2e2010';
    const frC = '#1a3545', frD = '#15303e', frE = '#102530';
    const shC = '#3a3530', shD = '#2d2820', shE = '#221e18';
    const ctC = '#1a4a2a', ctD = '#144020', ctE = '#0e3018';
    const rcC = '#3d2a1a', rcD = '#2e1f12', rcE = '#1e150c';
    const ofC = '#1e1b4b', ofD = '#1a1740', ofE = '#151030';
    const beC = '#1e3a5f', beD = '#0f1f3a', beE = '#0a1425';

    let h = '';

    // Piso
    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        h += isoRect(gx, gy, 1, 1, (gx + gy) % 2 === 0 ? flA : flB, 'rgba(255,255,255,.03)');
      }
    }

    // Paredes
    const wTL = `${isoX(0, 0)},${isoY(0, 0)}`;
    const wTR = `${isoX(12, 0)},${isoY(12, 0)}`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${isoX(12, 0)},${isoY(12, 0) - 40} ${wTR} ${wTL}" fill="${wC}" stroke="${wD}" stroke-width="0.5"/>`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${wTL} ${isoX(0, 12)},${isoY(0, 12)} ${isoX(0, 12)},${isoY(0, 12) - 40}" fill="${wD}" stroke="${wD}" stroke-width="0.5"/>`;

    // Agrupar colaboradores por zona
    const byZone = {};
    employees.forEach(e => {
      if (!isWorking(e)) return;
      const z = zoneOf(e);
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(e);
    });

    // Existência do prédio: baseada em TODOS os funcionários vinculados
    // àquela zona (não só quem está trabalhando agora) — senão o prédio
    // apareceria e desapareceria a cada hora conforme intervalo/folga. Se
    // o cliente não tem ninguém em "Frios"/"Recebimento"/"Escritório" de
    // verdade, o prédio simplesmente não deve existir no mapa.
    const zoneExists = {};
    employees.forEach(e => { zoneExists[zoneOf(e)] = true; });

    // Status dos setores
    const getZoneStatus = (zone, count) => {
      const statusMap = {
        acougue: { necessary: 2, adequate: 1 },
        padaria: { necessary: 2, adequate: 1 },
        frios: { necessary: 2, adequate: 1 },
        gondola: { necessary: 3, adequate: 2 },
        hortifruti: { necessary: 1, adequate: 1 },
        bebida: { necessary: 1, adequate: 1 },
        recebimento: { necessary: 2, adequate: 1 },
        escritorio: { necessary: 1, adequate: 1 },
        checkout: { necessary: 1, adequate: 1 },
        comercial: { necessary: 1, adequate: 1 },
        outro: { necessary: 1, adequate: 0 },
      };
      const req = statusMap[zone];
      if (!req) return 'unknown';
      if (count === 0) return 'critical';
      if (count < req.adequate) return 'critical';
      if (count < req.necessary) return 'attention';
      return 'adequate';
    };

    // Zonas principais com isoBox (3D) — só desenha o prédio se o cliente
    // de fato tem algum funcionário real vinculado àquele setor.
    if (zoneExists.acougue) {
      h += isoBox(0.5, 0.5, 3, 1.5, 12, mtC, mtD, mtE) + isoLabel(2, 1.5, zoneLabel('acougue', 'AÇOUGUE'), '#fff', 8, 'ACOUGUE') + isoStatus(3.3, 0.5, byZone.acougue?.length || 0, getZoneStatus('acougue', byZone.acougue?.length || 0));
    }
    if (zoneExists.padaria) {
      h += isoBox(4, 0.5, 3, 1.5, 12, bkC, bkD, bkE) + isoLabel(5.5, 1.5, zoneLabel('padaria', 'PADARIA'), '#fff', 8, 'PADARIA') + isoStatus(6.8, 0.5, byZone.padaria?.length || 0, getZoneStatus('padaria', byZone.padaria?.length || 0));
    }
    if (zoneExists.frios) {
      h += isoBox(7.5, 0.5, 4, 1.2, 14, frC, frD, frE) + isoLabel(9.5, 1.3, zoneLabel('frios', 'FRIOS'), '#fff', 8, 'FRIOS') + isoStatus(11.3, 0.5, byZone.frios?.length || 0, getZoneStatus('frios', byZone.frios?.length || 0));
    }
    if (zoneExists.hortifruti) {
      h += isoBox(0.3, 2.5, 1.5, 5.5, 10, '#558b2f', '#33691e', '#1b5e20') + isoLabel(0.8, 4.8, zoneLabel('hortifruti', 'HORTI'), '#fff', 7, 'HORTI') + isoStatus(1.6, 2.5, byZone.hortifruti?.length || 0, getZoneStatus('hortifruti', byZone.hortifruti?.length || 0));
    }

    // LOJA com gondolas em boxes 3D (prateleiras)
    if (zoneExists.gondola) {
      h += isoLabel(9, 5.8, zoneLabel('gondola', 'LOJA'), 'rgb(255, 255, 255)', 8, 'LOJA') + isoStatus(9.1, 5.6, byZone.gondola?.length || 0, getZoneStatus('gondola', byZone.gondola?.length || 0));
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
          const gx = 3 + col * 0.9;
          const gy = 3.4 + row * 2.0;
          const colors = ['#e57373', '#64b5f6', '#fff176', '#81c784', '#ce93d8', '#ffb74d'];
          h += isoRect(gx, gy + 0.15, 0.7, 0.5, colors[col], null, 0.6);
        }
      }

      // Corredores entre fileiras da LOJA (onde funcionários transitam)
      for (let row = 0; row < 3; row++) {
        const corridorY = 3.3+ row * 2.0;
        h += isoBox(3, corridorY, 5.2, 0.25, 30, '#a8a8a7', '#464646', '#2c2b2b');
      }
    }

    // Recebimento (doca) - fora, ao lado do escritório
    if (zoneExists.recebimento) {
      h += isoBox(13.5, 5, 3.5, 7.2, 20, rcC, rcD, rcE) + isoLabel(14.75, 7.8, zoneLabel('recebimento', 'RECEBIMENTO'), '#fff', 7, 'RECEBIMENTO') + isoStatus(14.75, 4.8, byZone.recebimento?.length || 0, getZoneStatus('recebimento', byZone.recebimento?.length || 0));
      h += isoRect(15.8, 5, 0.9, 0.4, '#555', 'rgba(0,0,0,.2)', 0.7);
      h += `<text x="${isoX(16.3, 5)}" y="${isoY(16.3, 6) - 7}" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="7" style="font-family:inherit">🚚</text>`;
    }

    // Escritório
    const isoDoor = (gx, gy, gw, h, fill) => {
      const pts = [
        `${isoX(gx, gy)},${isoY(gx, gy)}`,
        `${isoX(gx, gy + gw)},${isoY(gx, gy + gw)}`,
        `${isoX(gx, gy + gw)},${isoY(gx, gy + gw) - h}`,
        `${isoX(gx, gy)},${isoY(gx, gy) - h}`
      ].join(' ');
      return `<polygon points="${pts}" fill="${fill}" stroke="#6d6d6da4" stroke-width="0.8"/>`;
    };

    if (zoneExists.escritorio) {
      h += isoBox(13, 0.5, 4, 3.5, 80, ofC, ofD, ofE) + isoLabel(12.3, - 0.4, zoneLabel('escritorio', 'ESCRITORIO'), '#fff', 8, 'ESCRITORIO') + isoStatus(15, 0.3, byZone.escritorio?.length || 0, getZoneStatus('escritorio', byZone.escritorio?.length || 0));
      h += isoRect(13.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);
      h += isoRect(15.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);
      h += isoRect(14.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);

      h += isoRect(13.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);
      h += isoRect(14.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);
      h += isoRect(15.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);

      h += isoDoor(13.5, 3.3, 0.3, 28.2, '#6d6d6b31');
    }

    // PDVs e colaboradores
    const checkoutWorkers = byZone.checkout || [];
    const pdvSp = Math.min(2.5, 10 / pdvs);
    const pdvSt = (12 - pdvs * pdvSp) / 2;

    // Limitar PDVs ativos pela demanda
    const activePdvs = Math.min(checkoutWorkers.length, pdvs);

    for (let i = 0; i < pdvs; i++) {
      const gx = pdvSt + i * pdvSp;
      const act = i < activePdvs;
      h += isoBox(gx, 9.8, pdvSp * 0.7, 1.2, 6, act ? ctC : '#555', act ? ctD : '#444', act ? ctE : '#333');
      const scrC = act ? '#e0f2e9' : '#333';
      h += isoRect(gx + 0.15, 10.0, 0.4, 0.3, scrC, null, 0.9);
      h += isoLabel(gx + pdvSp * 0.35, 10.7, `PDV ${i + 1}`, act ? '#a5d6a7' : '#555', 6);
    }

    h += isoLabel(6, 11.5, zoneLabel('checkout', 'FRENTE DE CAIXA'), 'rgba(255,255,255,.35)', 9, 'FRENTE DE CAIXA') + isoStatus(6, 11.2, byZone.checkout?.length || 0, getZoneStatus('checkout', byZone.checkout?.length || 0));
    h += `<text x="${isoX(6, 12)}" y="${isoY(6, 12) + 14}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="9" style="font-family:inherit"><tspan style="font-size:14px">↑</tspan> ENTRADA</text>`;

    return h;
  };

  const svgSector = () => {
    if (!selectedSector) return svg();

    const sectorConfig = {
      'ACOUGUE': {
        boxes: [{ x: 0, y: 0, w: 12, h: 12, ht: 12, mtC: '#451a1a', mtD: '#3a1515', mtE: '#2e1010' }],
        zone: 'acougue'
      },
      'PADARIA': {
        boxes: [{ x: 0, y: 0, w: 12, h: 12, ht: 12, mtC: '#453520', mtD: '#2e2010', mtE: '#382611' }],
        zone: 'padaria'
      },
      'FRIOS': {
        boxes: [{ x: 0, y: 0, w: 12, h: 12, ht: 12, mtC: '#1a3545', mtD: '#15303e', mtE: '#102530' }],
        zone: 'frios'
      },
      'HORTI': {
        boxes: [{ x: 0, y: 0, w: 12, h: 12, ht: 12, mtC: '#3c7a10', mtD: '#22530f', mtE: '#0f5c14' },
                ],
        zone: 'hortifruti'
      },
      'LOJA': {
        boxes: [{ x: 2, y: 1, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 1, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 2, y: 3, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 3, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 2, y: 5, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 5, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 2, y: 7, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 7, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 2, y: 9, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 9, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 2, y: 11, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
                { x: 7, y: 11, w: 4, h: 0.30, ht: 40, mtC: '#a8a8a7', mtD: '#464646', mtE: '#2c2b2b' },
        ],
        zone: 'gondola'
      },
      'RECEBIMENTO': {
        boxes: [{ x: 13.5, y: 5, w: 3.5, h: 7.2, ht: 20, mtC: '#3d2a1a', mtD: '#2e1f12', mtE: '#1e150c' }],
        zone: 'recebimento'
      },
      'ESCRITORIO': {
        boxes: [{ x: 13, y: 0.5, w: 4, h: 3.5, ht: 80, mtC: '#1e1b4b', mtD: '#1a1740', mtE: '#151030' }],
        zone: 'escritorio'
      },
      'COMERCIAL': {
        boxes: [{ x: 13, y: 4, w: 4, h: 2, ht: 60, mtC: '#7c1f7e', mtD: '#6b1b6d', mtE: '#55145a' }],
        zone: 'comercial'
      },
      'FRENTE DE CAIXA': {
        boxes: [{ x: 0, y: 0, w: 12, h: 12, ht: 12, mtC: '#11318a', mtD: '#051731', mtE: '#0a2142' }],
        zone: 'checkout'
      }
    };

    const conf = sectorConfig[selectedSector];
    if (!conf) return svg();

    const byZone = {};
    employees.forEach(e => {
      const z = zoneOf(e);
      if (!byZone[z]) byZone[z] = [];
      if (isWorking(e)) byZone[z].push(e);
    });

    const flA = '#3d3d3d', flB = '#2f2f2f';
    const wC = '#1a2530', wD = '#15202a';

    // Sem retângulo de fundo aqui — o mapa geral (svg()) não tem um, e
    // este tinha tamanho fixo (860x480) desalinhado do viewBox real do
    // drill-down ("-120 -1 1100 380"), vazando fora do card arredondado.
    let h = '';

    // Piso e paredes (base)
    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        h += isoRect(gx, gy, 1, 1, (gx + gy) % 2 === 0 ? flA : flB, 'rgba(255,255,255,.03)');
      }
    }

    // Paredes
    const wTL = `${isoX(0, 0)},${isoY(0, 0)}`;
    const wTR = `${isoX(12, 0)},${isoY(12, 0)}`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${isoX(12, 0)},${isoY(12, 0) - 40} ${wTR} ${wTL}" fill="${wC}" stroke="${wD}" stroke-width="0.5"/>`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${wTL} ${isoX(0, 12)},${isoY(0, 12)} ${isoX(0, 12)},${isoY(0, 12) - 40}" fill="${wD}" stroke="${wD}" stroke-width="0.5"/>`;

    // Setores destacados - renderiza todos os boxes
    conf.boxes.forEach(box => {
      h += isoBox(box.x, box.y, box.w, box.h, box.ht, box.mtC, box.mtD, box.mtE);
    });

    // Gôndolas na frente de cada corredor (apenas para LOJA)
    if (selectedSector === 'LOJA') {
      const gondolaColors = ['#e57373', '#64b5f6', '#fff176', '#81c784', '#ce93d8', '#ffb74d'];
      conf.boxes.forEach(box => {
        for (let col = 0; col < 6; col++) {
          const gx = box.x + col * 0.65;
          const gy = box.y + box.h + -0.1;
          h += isoRect(gx, gy, 0.6, 0.21, gondolaColors[col], null, 0.6);
        }
      });
    }

    // Colaboradores - distribuir em cima dos boxes
    const workers = byZone[conf.zone] || [];
    const TH = 25;

    workers.forEach((w, i) => {
      const boxIndex = i % conf.boxes.length;
      const posInBox = Math.floor(i / conf.boxes.length);
      const box = conf.boxes[boxIndex];

      const workersPerBox = Math.ceil(workers.length / conf.boxes.length);
      const cols = Math.min(Math.ceil(Math.sqrt(workersPerBox)), 3);
      const row = Math.floor(posInBox / cols);
      const col = posInBox % cols;

      const marginX = box.w * 0.15;
      const marginY = box.h * 0.15;
      const tx = cols > 1 ? col / (cols - 1) : 0.5;
      const rowCount = Math.ceil(workersPerBox / cols);
      const ty = rowCount > 1 ? row / (rowCount - 1) : 0.5;

      const gx = box.x + marginX + tx * (box.w - marginX * 2);
      const gy = (box.y + marginY + ty * (box.h - marginY * 2)) - (box.ht / TH * 0.8);

      h += isoWorker(gx, gy, ZC[conf.zone] || '#888', w, isOnBreak(w));
    });

    return h;
  };

  const hh = Math.floor(floorHour);
  const mm = Math.round((floorHour - hh) * 60);
  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const activeCount = employees.filter(e => isWorking(e)).length;
  const checkoutActive = employees.filter(e => zoneOf(e) === 'checkout' && isWorking(e)).length;
  const onBreakCount = employees.filter(e => isOnBreak(e)).length;
  const offCount = employees.filter(e => {
    const dayShift = schedule[e.name]?.[floorDay];
    return !dayShift || dayShift === 'Folga';
  }).length;

  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newHour = openHour + pct * (closeHour - openHour);
    setFloorHour(Math.round(Math.max(openHour, Math.min(closeHour - 0.5, newHour)) * 2) / 2);
  };

  // ---------------- Paleta / helpers de estilo (redesign premium) ----------------
  const C = {
    accent: '#4aa8ff',
    grad: 'linear-gradient(135deg,#6cc0ff,#3a7bff)',
    glow: '0 10px 26px -10px rgba(74,168,255,.7), inset 0 1px 0 rgba(255,255,255,.4)',
    text: '#e8eef5',
    muted: '#94a3b8',
    faint: 'rgba(148,163,184,.55)',
    line: 'rgba(255,255,255,.09)',
    surface: 'rgba(255,255,255,.04)',
  };

  const metricCard = {
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: '12px',
    padding: '10px 12px',
  };
  const metricLabel = { fontSize: '10.5px', color: C.muted, margin: 0, fontWeight: 600, letterSpacing: '.3px' };
  const metricValue = { fontSize: '16px', fontWeight: 700, margin: '3px 0 0', color: C.text };
  const metricGridStyle = {
    display: 'grid',
    gridTemplateColumns: (typeof window !== 'undefined' && window.innerWidth < 768) ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(84px, 1fr))',
    gap: (typeof window !== 'undefined' && window.innerWidth < 768) ? '6px' : '8px',
  };

  return (
    <div
      style={{
        position: 'relative',
        color: C.text,
        background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))',
        border: `1px solid ${C.line}`,
        borderRadius: '18px',
        padding: '20px',
        boxShadow: '0 30px 80px -40px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        fontFamily: 'inherit',
      }}
    >
      <style>{`
        .sfm-day, .sfm-play, .sfm-nav, .sfm-back { transition: all .16s ease; }
        .sfm-day:hover:not(.is-active),
        .sfm-play:hover,
        .sfm-nav:hover { background: rgba(74,168,255,.14) !important; border-color: rgba(74,168,255,.4) !important; color: #e8eef5 !important; }
        .sfm-nav:active { transform: translateY(1px); }
        .sfm-metric { transition: border-color .16s ease, transform .16s ease; }
        .sfm-metric:hover { border-color: rgba(74,168,255,.3); transform: translateY(-1px); }
      `}</style>

      {/* Cabeçalho */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '10px', flexWrap: 'wrap',
        paddingBottom: '14px', marginBottom: '16px', borderBottom: `1px solid ${C.line}`,
      }}>
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            fontSize: '10.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#bcd8ff',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
            Operação em tempo real
          </span>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '6px', color: C.text }}>
            {selectedSector ? `Setor: ${zoneLabel(SECTOR_NAME_TO_ZONE[selectedSector], selectedSector)}` : 'Planta da loja'}
          </div>
          {selectedSector && subSetoresDoZone.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {subSetoresDoZone.map(([nome, count]) => (
                <span key={nome} style={{
                  fontSize: '10.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '7px',
                  color: '#bcd8ff', background: 'rgba(74,168,255,.1)', border: '1px solid rgba(74,168,255,.25)',
                }}>{nome} · {count}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="sfm-play"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: isPlaying ? C.grad : C.surface,
              border: `1px solid ${isPlaying ? 'transparent' : C.line}`,
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              color: isPlaying ? '#fff' : 'rgba(203,213,225,.9)',
              boxShadow: isPlaying ? C.glow : 'none',
            }}
          >
            {isPlaying ? '⏸ Parar' : '▶ Simular'}
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {DAYS.map((d, i) => {
              const active = i === floorDay;
              return (
                <button
                  key={i}
                  className={`sfm-day ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setFloorDay(i);
                    // Recentraliza o horário no de abertura do dia escolhido
                    // — cada dia pode ter faixa de funcionamento diferente
                    // (ex.: domingo 08h-16h vs seg-sáb 07h-20h).
                    const { open, close } = getHoursForDay(i);
                    setFloorHour((h) => (h < open || h >= close ? open : h));
                  }}
                  style={{
                    background: active ? C.grad : C.surface,
                    color: active ? '#fff' : 'rgba(203,213,225,.85)',
                    border: `1px solid ${active ? 'transparent' : C.line}`,
                    borderRadius: '9px',
                    padding: '8px 11px',
                    fontSize: '11.5px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: active ? '0 8px 20px -8px rgba(74,168,255,.75), inset 0 1px 0 rgba(255,255,255,.4)' : 'none',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SVG */}
      <div style={{
        position: 'relative', marginBottom: '16px', borderRadius: '14px', overflow: 'hidden',
        background: 'radial-gradient(700px 300px at 50% 0%, rgba(74,168,255,.06), rgba(0,0,0,.28) 70%)',
        border: `1px solid ${C.line}`,
        height: '680px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', padding: '10px',
      }}>
        {selectedSector && (
          <button className="sfm-back" onClick={() => setSelectedSector(null)} style={{
            background: 'rgba(74,168,255,.16)', border: '1px solid rgba(74,168,255,.45)', borderRadius: '10px',
            padding: '7px 13px', cursor: 'pointer', color: '#8cc6ff', fontSize: '12px', fontWeight: 600, zIndex: 10,
          }}>
            ← Voltar para mapa geral
          </button>
        )}
        {/* Mapa geral: viewBox calculado (mainViewBox) pra centralizar de
            verdade conforme o cliente tem ou não Recebimento/Escritório.
            Drill-down de setor: grid fixo 0-12, mantém o enquadramento
            "-15 -25 910 435" que já ficou bom. */}
        <svg ref={svgRef} viewBox={selectedSector ? sectorViewBox : mainViewBox} style={{ display: 'block', width: '100%', flexGrow: 1 }} dangerouslySetInnerHTML={{ __html: svgSector() }} />

        {/* Custom Worker Tooltip */}
        {hoveredWorker && (
          <div style={{
            position: 'absolute',
            left: `${tooltipPos.x + 12}px`,
            top: `${tooltipPos.y - 8}px`,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(74,168,255,.45)',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '12px',
            color: C.text,
            zIndex: 1001,
            boxShadow: '0 14px 30px rgba(0,0,0,.55)',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: '#6cc0ff' }}>{hoveredWorker.name}</div>
            {hoveredWorker.cargo && <div style={{ fontSize: '11px', color: 'rgba(203, 213, 225, 0.8)' }}>{hoveredWorker.cargo}</div>}
            {hoveredWorker.setor && <div style={{ fontSize: '11px', color: 'rgba(203, 213, 225, 0.8)', marginTop: '2px' }}>{hoveredWorker.setor}</div>}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <button className="sfm-nav" onClick={() => setFloorHour(Math.max(openHour, floorHour - 0.5))} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: 'rgba(203,213,225,.9)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◀</button>
          <span style={{
            fontSize: '20px', fontWeight: 800, minWidth: '72px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            background: 'linear-gradient(180deg,#ffffff,#b9d4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>{timeStr}</span>
          <button className="sfm-nav" onClick={() => setFloorHour(Math.min(closeHour - 0.5, floorHour + 0.5))} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: 'rgba(203,213,225,.9)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</button>
        </div>

        <div ref={timelineRef} onClick={handleTimelineClick} style={{ position: 'relative', height: '32px', cursor: 'pointer', margin: '0 4px' }}>
          <div style={{ position: 'absolute', top: '16px', left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,.1)', borderRadius: '2px' }}></div>
          {/* Progresso preenchido até a hora atual */}
          <div style={{ position: 'absolute', top: '16px', left: 0, width: `${((floorHour - openHour) / (closeHour - openHour)) * 100}%`, height: '4px', background: C.grad, borderRadius: '2px', boxShadow: '0 0 12px rgba(74,168,255,.6)' }}></div>
          {/* Marcas */}
          {Array.from({ length: closeHour - openHour + 1 }).map((_, i, arr) => {
            const hr = openHour + i;
            const pct = ((hr - openHour) / (closeHour - openHour)) * 100;
            // Abertura e fechamento reais (Implantação) sempre ganham
            // rótulo, mesmo quando caem num índice "ímpar" da alternância —
            // antes o rótulo alternava por posição, não pela hora, então o
            // horário de fechamento podia ficar sem o texto (ex: 20h).
            const isEdge = i === 0 || i === arr.length - 1;
            const showLabel = isEdge || i % 2 === 0;
            return (
              <div key={i}>
                <div style={{ position: 'absolute', left: `${pct}%`, top: showLabel ? '8px' : '12px', width: '1px', height: showLabel ? '20px' : '12px', background: 'rgba(255,255,255,.2)', transform: 'translateX(-0.5px)' }}></div>
                {showLabel && <div style={{ position: 'absolute', left: `${pct}%`, top: '32px', transform: 'translateX(-50%)', fontSize: '10px', color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>{String(hr).padStart(2, '0')}h</div>}
              </div>
            );
          })}
          {/* Handle */}
          <div style={{ position: 'absolute', top: '8px', left: `${((floorHour - openHour) / (closeHour - openHour)) * 100}%`, transform: 'translateX(-50%)', cursor: 'grab', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#6cc0ff', border: '3px solid #fff', boxShadow: '0 2px 10px rgba(74,168,255,.8)' }}></div>
            <div style={{ width: '2px', height: '10px', background: C.accent, marginTop: '-1px' }}></div>
          </div>
        </div>
      </div>

      {/* Métricas Gerais */}
      <div style={{ ...metricGridStyle, marginBottom: '10px' }}>
        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>No piso</p>
          <p style={metricValue}>{activeCount - (employees.filter(e => {
            const z = zoneOf(e);
            return (z === 'escritorio' || z === 'comercial') && isWorking(e);
          }).length || 0)}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Intervalo</p>
          <p style={metricValue}>{onBreakCount}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Folga</p>
          <p style={metricValue}>{offCount}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Total</p>
          <p style={{ ...metricValue, color: C.accent }}>{activeCount}/{employees.length}</p>
        </div>
      </div>

      {/* Funcionários por Setor */}
      <div style={metricGridStyle}>
        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Caixa</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'checkout' && isWorking(e)).length}/{pdvs}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Loja</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'gondola' && isWorking(e)).length}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Açougue</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'acougue' && isWorking(e)).length}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Padaria</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'padaria' && isWorking(e)).length}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Horti</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'hortifruti' && isWorking(e)).length}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Frios</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'frios' && isWorking(e)).length}</p>
        </div>

        <div className="sfm-metric" style={metricCard}>
          <p style={metricLabel}>Recebimento</p>
          <p style={metricValue}>{employees.filter(e => zoneOf(e) === 'recebimento' && isWorking(e)).length}</p>
        </div>

        {employees.some(e => zoneOf(e) === 'sem-setor') && (
          <div className="sfm-metric" style={{ ...metricCard, borderColor: 'rgba(251,191,36,.4)' }}>
            <p style={{ ...metricLabel, color: '#fbbf24' }}>Sem setor</p>
            <p style={{ ...metricValue, color: '#fbbf24' }}>{employees.filter(e => zoneOf(e) === 'sem-setor').length}</p>
          </div>
        )}
      </div>
    </div>
  );
}