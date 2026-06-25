import React, { useState, useRef, useEffect } from 'react';

export default function StoreFloorMap({ schedule = {}, demand = {}, employees = [] }) {
  const [floorHour, setFloorHour] = useState(8);
  const [floorDay, setFloorDay] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSector, setSelectedSector] = useState(null);
  const timelineRef = useRef(null);
  const svgRef = useRef(null);

  const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const checkoutCount = employees.filter(e => (e.setor || '').toLowerCase().includes('caixa')).length;
  const pdvs = Math.max(3, Math.ceil(checkoutCount * 0.75));
  const openHour = 8, closeHour = 20;

  // Play animation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setFloorHour(h => h + 0.5 >= closeHour ? closeHour - 0.5 : h + 0.5);
    }, 400);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Add click listeners to sectors
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!svgRef.current) return;
      const texts = svgRef.current.querySelectorAll('text');
      texts.forEach(text => {
        const sectorName = text.textContent.trim();
        const sectors = ['ACOUGUE', 'PADARIA', 'FRIOS', 'HORTI', 'MERCEARIA', 'RECEBIMENTO', 'ESCRITORIO', 'FRENTE DE CAIXA'];
        if (sectors.includes(sectorName)) {
          text.style.cursor = 'pointer';
          text.style.userSelect = 'none';
          text.onclick = (e) => {
            e.stopPropagation();
            setSelectedSector(sectorName);
          };
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [floorHour, floorDay, selectedSector]);

  const zoneOf = (employee) => {
    const setor = (employee.setor || '').toLowerCase();
    const cargo = (employee.cargo || '').toLowerCase();
    const combined = `${setor} ${cargo}`;
    if (combined.includes('açougue') || combined.includes('acougue')) return 'acougue';
    if (combined.includes('padaria')) return 'padaria';
    if (combined.includes('hortifruti')) return 'hortifruti';
    if (combined.includes('frios')) return 'frios';
    if (combined.includes('bebida')) return 'bebida';
    if (combined.includes('caixa') || combined.includes('operador')) return 'checkout';
    if (combined.includes('mercearia')) return 'gondola';
    if (combined.includes('administrativa') || combined.includes('escritorio')) return 'escritorio';
    if (combined.includes('recebimento')) return 'recebimento';
    return 'gondola';
  };

  const isWorking = (employee) => {
    const shifts = schedule[employee.name] || [];
    const dayShift = shifts[floorDay];
    if (!dayShift || dayShift === 'Folga') return false;
    const parts = dayShift.split('·')[0];
    const times = parts.split('-');
    if (times.length !== 2) return false;
    const [h1, m1] = times[0].trim().split(':').map(Number);
    const [h2, m2] = times[1].trim().split(':').map(Number);
    const start = h1 + (m1 || 0) / 60;
    const end = h2 + (m2 || 0) / 60;
    return floorHour >= start && floorHour < end;
  };

  const isOnBreak = (employee) => {
    const shifts = schedule[employee.name] || [];
    const dayShift = shifts[floorDay];
    if (!dayShift) return false;
    const parts = dayShift.split('·');
    if (parts.length < 2) return false;
    const times = parts[0].split('-');
    if (times.length < 2) return false;
    const [h1, m1] = times[0].trim().split(':').map(Number);
    const [h2, m2] = times[1].trim().split(':').map(Number);
    const end1 = h1 + (m1 || 0) / 60;
    const start2 = h2 + (m2 || 0) / 60;
    return floorHour >= end1 && floorHour < start2;
  };

  const TW = 60, TH = 25;
  const ZC = { checkout: '#2563eb', gondola: '#16a34a', acougue: '#dc2626', padaria: '#ea580c', hortifruti: '#65a30d', frios: '#0891b2', bebida: '#1e40af', recebimento: '#7c2d12', escritorio: '#4c1d95' };

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

  const isoLabel = (gx, gy, txt, col, sz) => {
    return `<text x="${isoX(gx, gy)}" y="${isoY(gx, gy)}" text-anchor="middle" fill="${col}" font-size="${sz || 10}" font-weight="500" style="font-family:inherit">${txt}</text>`;
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

  const isoWorker = (gx, gy, color, name, onBreak) => {
    const x = isoX(gx, gy), y = isoY(gx, gy);
    const ini = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const c = onBreak ? '#9e9e9e' : color;
    const firstName = name.split(' ')[0].slice(0, 8);
    const lblW = firstName.length * 4.2 + 6;
    let s = `<g style="cursor:pointer">`;
    s += `<ellipse cx="${x}" cy="${y + 2}" rx="8" ry="4" fill="rgba(0,0,0,.2)"/>`;
    s += `<rect x="${x - 6}" y="${y - 16}" width="12" height="14" rx="3" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
    s += `<circle cx="${x}" cy="${y - 21}" r="5.5" fill="${c}" stroke="#fff" stroke-width="0.8"/>`;
    s += `<text x="${x}" y="${y - 13}" text-anchor="middle" fill="#fff" font-size="6" font-weight="700" style="font-family:inherit;text-shadow:0 1px 2px rgba(0,0,0,.5)">${ini}</text>`;
    s += `<rect x="${x - lblW / 2}" y="${y + 3}" width="${lblW}" height="11" rx="3" fill="rgba(0,0,0,.7)" stroke="rgba(255,255,255,.15)" stroke-width="0.4"/>`;
    s += `<text x="${x}" y="${y + 11}" text-anchor="middle" fill="#e2e8f0" font-size="6.5" font-weight="500" style="font-family:inherit">${firstName}</text>`;
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

    // Status dos setores
    const getZoneStatus = (zone, count) => {
      const statusMap = {
        acougue: { necessary: 2, adequate: 1 },
        padaria: { necessary: 2, adequate: 1 },
        frios: { necessary: 2, adequate: 1 },
        gondola: { necessary: 3, adequate: 2 },
        hortifruti: { necessary: 1, adequate: 1 },
        bebida: { necessary: 1, adequate: 1 },
      };
      const req = statusMap[zone];
      if (!req) return 'unknown';
      if (count === 0) return 'critical';
      if (count < req.adequate) return 'critical';
      if (count < req.necessary) return 'attention';
      return 'adequate';
    };

    // Zonas principais com isoBox (3D)
    h += isoBox(0.5, 0.5, 3, 1.5, 12, mtC, mtD, mtE) + isoLabel(2, 1.5, 'ACOUGUE', '#fff', 8) + isoStatus(3.3, 0.5, byZone.acougue?.length || 0, getZoneStatus('acougue', byZone.acougue?.length || 0));
    h += isoBox(4, 0.5, 3, 1.5, 12, bkC, bkD, bkE) + isoLabel(5.5, 1.5, 'PADARIA', '#fff', 8) + isoStatus(6.8, 0.5, byZone.padaria?.length || 0, getZoneStatus('padaria', byZone.padaria?.length || 0));
    h += isoBox(7.5, 0.5, 4, 1.2, 14, frC, frD, frE) + isoLabel(9.5, 1.3, 'FRIOS', '#fff', 8) + isoStatus(11.3, 0.5, byZone.frios?.length || 0, getZoneStatus('frios', byZone.frios?.length || 0));
    h += isoBox(0.3, 2.5, 1.5, 5.5, 10, '#558b2f', '#33691e', '#1b5e20') + isoLabel(0.8, 4.8, 'HORTI', '#fff', 7) + isoStatus(1.6, 2.5, byZone.hortifruti?.length || 0, getZoneStatus('hortifruti', byZone.hortifruti?.length || 0));

    // Mercearia com gondolas em boxes 3D (prateleiras)
    h += isoLabel(6, 5, 'MERCEARIA', 'rgba(255,255,255,.4)', 9) + isoStatus(9.3, 3, byZone.gondola?.length || 0, getZoneStatus('gondola', byZone.gondola?.length || 0));
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const gx = 3 + col * 0.9;
        const gy = 3 + row * 2.2;
        const colors = ['#e57373', '#64b5f6', '#fff176', '#81c784', '#ce93d8', '#ffb74d'];
        h += isoRect(gx, gy + 0.15, 0.7, 0.5, colors[col], null, 0.6);
      }
    }

    // movimento x, movimento y, aumenta diminui x, aumenta diminui y, aumenta diminui altura
    // Bebidas
    h += isoBox(11.3, 6.2, 0.7, 4.2, 60, beC, beD, beE) + isoLabel(10.6, 6.8, 'BEBIDAS', '#fff', 7);

    // Recebimento (doca) - fora, ao lado do escritório
    h += isoBox(13.5, 5, 3.5, 7.2, 20, rcC, rcD, rcE) + isoLabel(14.75, 7.8, 'RECEBIMENTO', '#fff', 7);
    h += isoRect(15.8, 5, 0.9, 0.4, '#555', 'rgba(0,0,0,.2)', 0.7);
    h += `<text x="${isoX(16.3, 5)}" y="${isoY(16.3, 6) - 7}" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="7" style="font-family:inherit">🚚</text>`;

    // Escritório
    h += isoBox(13, 0.5, 4, 3.5, 80, ofC, ofD, ofE) + isoLabel(12.3, - 0.4, 'ESCRITORIO', '#fff', 8);
    // h += `<line x1="${isoX(13, 3)}" y1="${isoY(13, 3) - 7}" x2="${isoX(12.3, 3.2)}" y2="${isoY(12.3, 3.2)}" stroke="rgba(255,255,255,.15)" stroke-width="1" stroke-dasharray="4,3"/>`;
    h += isoRect(13.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);
    h += isoRect(15.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);
    h += isoRect(14.5, 1.5, 0.8, 0.5, '#2d2760', null, 0.4);
    
    h += isoRect(13.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);
    h += isoRect(14.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);
    h += isoRect(15.6, 2.5, 0.8, 0.5, '#2d2760', null, 0.4);


    const isoDoor = (gx, gy, gw, h, fill) => {
      const pts = [
        `${isoX(gx, gy)},${isoY(gx, gy)}`,
        `${isoX(gx, gy + gw)},${isoY(gx, gy + gw)}`,
        `${isoX(gx, gy + gw)},${isoY(gx, gy + gw) - h}`,
        `${isoX(gx, gy)},${isoY(gx, gy) - h}`
      ].join(' ');
      return `<polygon points="${pts}" fill="${fill}" stroke="#6d6d6da4" stroke-width="0.8"/>`;
    };

    h += isoDoor(13.5, 3.3, 0.3, 28.2, '#6d6d6b31');



    

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

    h += isoLabel(6, 11.5, 'FRENTE DE CAIXA', 'rgba(255,255,255,.35)', 9);
    h += `<text x="${isoX(6, 12)}" y="${isoY(6, 12) + 14}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="9" style="font-family:inherit"><tspan style="font-size:14px">↑</tspan> ENTRADA</text>`;

    return h;
  };

  const svgSector = () => {
    if (!selectedSector) return svg();

    const sectorConfig = {
      'ACOUGUE': { x: 0.5, y: 0.5, w: 3, h: 1.5, ht: 12, mtC: '#451a1a', mtD: '#3a1515', mtE: '#2e1010', zone: 'acougue' },
      'PADARIA': { x: 4, y: 0.5, w: 3, h: 1.5, ht: 12, mtC: '#453520', mtD: '#3a2a18', mtE: '#2e2010', zone: 'padaria' },
      'FRIOS': { x: 7.5, y: 0.5, w: 4, h: 1.2, ht: 14, mtC: '#1a3545', mtD: '#15303e', mtE: '#102530', zone: 'frios' },
      'HORTI': { x: 0.3, y: 2.5, w: 1.5, h: 3, ht: 10, mtC: '#558b2f', mtD: '#33691e', mtE: '#1b5e20', zone: 'hortifruti' },
      'MERCEARIA': { x: 3, y: 3, w: 6, h: 2.2, ht: 12, mtC: '#3a3530', mtD: '#2d2820', mtE: '#221e18', zone: 'gondola' },
      'RECEBIMENTO': { x: 13.5, y: 5, w: 3.5, h: 7.2, ht: 20, mtC: '#3d2a1a', mtD: '#2e1f12', mtE: '#1e150c', zone: 'recebimento' },
      'ESCRITORIO': { x: 13, y: 0.5, w: 4, h: 3.5, ht: 80, mtC: '#1e1b4b', mtD: '#1a1740', mtE: '#151030', zone: 'escritorio' },
      'FRENTE DE CAIXA': { x: 0.5, y: 0.5, w: 11, h: 11, ht: 20, mtC: '#1a4a2a', mtD: '#144020', mtE: '#0e3018', zone: 'checkout' }
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

    let h = `<rect width="860" height="480" fill="#1a3a4a"/>`;

    // Piso e paredes (base)
    for (let gx = 0; gx < 15; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        h += isoRect(gx, gy, 1, 1, (gx + gy) % 2 === 0 ? flA : flB, 'rgba(255,255,255,.03)');
      }
    }

    // Paredes
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${isoX(15, 0)},${isoY(15, 0) - 40} ${isoX(15, 0)},${isoY(15, 0)} ${isoX(0, 0)},${isoY(0, 0)}" fill="${wC}" stroke="${wD}" stroke-width="0.5"/>`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${isoX(0, 12)},${isoY(0, 12) - 40} ${isoX(0, 12)},${isoY(0, 12)} ${isoX(0, 0)},${isoY(0, 0)}" fill="${wD}" stroke="${wC}" stroke-width="0.5"/>`;

    // Setor destacado (maior)
    h += isoBox(conf.x, conf.y, conf.w, conf.h, conf.ht, conf.mtC, conf.mtD, conf.mtE);
    h += isoLabel(conf.x + conf.w / 2, conf.y + conf.h / 2, selectedSector, '#fff', 14);

    // Colaboradores
    const workers = byZone[conf.zone] || [];
    workers.forEach((w, i) => {
      const cols = Math.min(Math.ceil(Math.sqrt(workers.length)), 4);
      const row = Math.floor(i / cols);
      const col = i % cols;
      const tx = cols > 1 ? col / (cols - 1) : 0.5;
      const rowCount = Math.ceil(workers.length / cols);
      const ty = rowCount > 1 ? row / (rowCount - 1) : 0.5;
      const gx = conf.x + tx * conf.w;
      const gy = conf.y + ty * conf.h;
      h += isoWorker(gx, gy, ZC[conf.zone] || '#888', w.name, isOnBreak(w));
    });

    return h;
  };

  const hh = Math.floor(floorHour);
  const mm = Math.round((floorHour - hh) * 60);
  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const activeCount = employees.filter(e => isWorking(e)).length;
  const checkoutActive = employees.filter(e => zoneOf(e) === 'checkout' && isWorking(e)).length;
  const onBreakCount = employees.filter(e => isOnBreak(e)).length;
  const offCount = employees.filter(e => !isWorking(e) && !isOnBreak(e)).length;

  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newHour = openHour + pct * (closeHour - openHour);
    setFloorHour(Math.round(Math.max(openHour, Math.min(closeHour - 0.5, newHour)) * 2) / 2);
  };

  return (
    <div style={{ color: '#eef2f8', background: 'linear-gradient(180deg,#16233a 0%,#111c2e 100%)', border: '1px solid rgba(148,163,184,.14)', borderRadius: '12px', padding: '14px', marginBottom: '10px', boxShadow: '0 20px 50px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Planta da loja</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: isPlaying ? 'rgba(37,99,235,.16)' : 'rgba(148, 163, 184, 0.08)',
              border: `1px solid ${isPlaying ? 'rgba(96,165,250,.5)' : 'rgba(148, 163, 184, 0.18)'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              color: isPlaying ? '#bcd4fb' : 'rgba(203, 213, 225, 0.85)',
              transition: 'all 0.2s',
            }}
          >
            {isPlaying ? '⏸ Parar' : '▶ Simular'}
          </button>
          <div style={{ display: 'flex', gap: '2px' }}>
            {DAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => setFloorDay(i)}
                style={{
                  background: i === floorDay ? '#2563eb' : 'rgba(148, 163, 184, 0.08)',
                  color: i === floorDay ? '#ffffff' : 'rgba(203, 213, 225, 0.85)',
                  border: `1px solid ${i === floorDay ? '#2563eb' : 'rgba(148, 163, 184, 0.18)'}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: i === floorDay ? '600' : '500',
                  cursor: 'pointer',
                  boxShadow: i === floorDay ? '0 4px 14px rgba(37,99,235,.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG */}
      <div style={{ marginBottom: '12px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(0,0,0,.2)', height: '500px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', padding: '8px' }}>
        {selectedSector && (
          <button onClick={() => setSelectedSector(null)} style={{
            background: 'rgba(96,165,250,.2)', border: '1px solid rgba(96,165,250,.5)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', color: '#60a5fa', fontSize: '12px', fontWeight: '600', zIndex: 10
          }}>
            ← Voltar para mapa geral
          </button>
        )}
        <svg ref={svgRef} viewBox="-120 -1 1100 380" style={{ display: 'block', width: '100%', flexGrow: 1 }} dangerouslySetInnerHTML={{ __html: svgSector() }} />
      </div>

      {/* Timeline */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <button onClick={() => setFloorHour(Math.max(openHour, floorHour - 0.5))} style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'rgba(203, 213, 225, 0.9)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>◀</button>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#e8eef5', minWidth: '65px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
          <button onClick={() => setFloorHour(Math.min(closeHour - 0.5, floorHour + 0.5))} style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'rgba(203, 213, 225, 0.9)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>▶</button>
        </div>

        <div ref={timelineRef} onClick={handleTimelineClick} style={{ position: 'relative', height: '32px', cursor: 'pointer', margin: '0 4px' }}>
          <div style={{ position: 'absolute', top: '16px', left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,.1)', borderRadius: '2px' }}></div>
          {/* Marcas */}
          {Array.from({ length: closeHour - openHour + 1 }).map((_, i) => {
            const hr = openHour + i;
            const pct = ((hr - openHour) / (closeHour - openHour)) * 100;
            return (
              <div key={i}>
                <div style={{ position: 'absolute', left: `${pct}%`, top: i % 2 === 0 ? '8px' : '12px', width: '1px', height: i % 2 === 0 ? '20px' : '12px', background: 'rgba(255,255,255,.2)', transform: 'translateX(-0.5px)' }}></div>
                {i % 2 === 0 && <div style={{ position: 'absolute', left: `${pct}%`, top: '32px', transform: 'translateX(-50%)', fontSize: '10px', color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>{String(hr).padStart(2, '0')}h</div>}
              </div>
            );
          })}
          {/* Handle */}
          <div style={{ position: 'absolute', top: '8px', left: `${((floorHour - openHour) / (closeHour - openHour)) * 100}%`, transform: 'translateX(-50%)', cursor: 'grab', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#2563eb', border: '3px solid #fff', boxShadow: '0 1px 6px rgba(37,99,235,.5)' }}></div>
            <div style={{ width: '2px', height: '10px', background: '#2563eb', marginTop: '-1px' }}></div>
          </div>
        </div>

      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: '6px', padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,.6)', margin: 0 }}>Salão</p>
          <p style={{ fontSize: '14px', fontWeight: '600', margin: '2px 0 0', color: '#fff' }}>{activeCount - (employees.filter(e => zoneOf(e) === 'escritorio' && isWorking(e)).length || 0)}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: '6px', padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,.6)', margin: 0 }}>PDVs</p>
          <p style={{ fontSize: '14px', fontWeight: '600', margin: '2px 0 0', color: '#fff' }}>{checkoutActive}/{pdvs}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: '6px', padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,.6)', margin: 0 }}>Intervalo</p>
          <p style={{ fontSize: '14px', fontWeight: '600', margin: '2px 0 0', color: '#fff' }}>{onBreakCount}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: '6px', padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,.6)', margin: 0 }}>Folga</p>
          <p style={{ fontSize: '14px', fontWeight: '600', margin: '2px 0 0', color: '#fff' }}>{offCount}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: '6px', padding: '8px' }}>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,.6)', margin: 0 }}>Total</p>
          <p style={{ fontSize: '14px', fontWeight: '600', margin: '2px 0 0', color: '#fff' }}>{activeCount}/{employees.length}</p>
        </div>
      </div>

    </div>
  );
}
