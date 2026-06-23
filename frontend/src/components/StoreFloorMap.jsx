import React, { useState, useRef, useEffect } from 'react';

export default function StoreFloorMap({ schedule = {}, demand = {}, employees = [] }) {
  const [floorHour, setFloorHour] = useState(8);
  const [floorDay, setFloorDay] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const timelineRef = useRef(null);

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

  const zoneOf = (employee) => {
    const setor = (employee.setor || '').toLowerCase();
    const cargo = (employee.cargo || '').toLowerCase();
    const combined = `${setor} ${cargo}`;
    if (combined.includes('acougue')) return 'acougue';
    if (combined.includes('padaria')) return 'padaria';
    if (combined.includes('hortifruti')) return 'hortifruti';
    if (combined.includes('frios')) return 'frios';
    if (combined.includes('bebida')) return 'bebida';
    if (combined.includes('caixa') || combined.includes('operador')) return 'checkout';
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

  const TW = 56, TH = 28;
  const isoX = (gx, gy) => 340 + (gx - gy) * TW / 2;
  const isoY = (gx, gy) => 60 + (gx + gy) * TH / 2;

  const svg = () => {
    const dk = true; // dark mode
    const flA = '#2a2520', flB = '#252018';
    const wC = '#1a2530', wD = '#15202a';
    const mtC = '#451a1a', mtD = '#3a1515', mtE = '#2e1010';
    const bkC = '#453520', bkD = '#3a2a18', bkE = '#2e2010';
    const frC = '#1a3545', frD = '#15303e', frE = '#102530';
    const shC = '#3a3530', shD = '#2d2820', shE = '#221e18';
    const ctC = '#1a4a2a', ctD = '#144020', ctE = '#0e3018';
    const rcC = '#3d2a1a', rcD = '#2e1f12', rcE = '#1e150c';
    const ofC = '#1e1b4b', ofD = '#1a1740', ofE = '#151030';

    const ZC = { checkout: '#2563eb', gondola: '#16a34a', acougue: '#dc2626', padaria: '#ea580c', hortifruti: '#65a30d', frios: '#0891b2', bebida: '#1e40af', recebimento: '#7c2d12', escritorio: '#1e1b4b' };

    let h = '';

    // Piso
    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 12; gy++) {
        const pts = [[gx, gy], [gx + 1, gy], [gx + 1, gy + 1], [gx, gy + 1]]
          .map(([x, y]) => `${isoX(x, y)},${isoY(x, y)}`)
          .join(' ');
        h += `<polygon points="${pts}" fill="${(gx + gy) % 2 === 0 ? flA : flB}" stroke="rgba(255,255,255,.03)" stroke-width="0.5"/>`;
      }
    }

    // Paredes
    const wTL = `${isoX(0, 0)},${isoY(0, 0)}`;
    const wTR = `${isoX(12, 0)},${isoY(12, 0)}`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${isoX(12, 0)},${isoY(12, 0) - 40} ${wTR} ${wTL}" fill="${wC}" stroke="${wD}" stroke-width="0.5"/>`;
    h += `<polygon points="${isoX(0, 0)},${isoY(0, 0) - 40} ${wTL} ${isoX(0, 12)},${isoY(0, 12)} ${isoX(0, 12)},${isoY(0, 12) - 40}" fill="${wD}" stroke="${wD}" stroke-width="0.5"/>`;

    // Zonas principais
    const zones = [
      { box: [0.5, 0.5, 3, 1.5], h: 12, f: mtC, d: mtD, e: mtE, label: 'ACOUGUE', lx: 2, ly: 1.5 },
      { box: [4, 0.5, 3, 1.5], h: 12, f: bkC, d: bkD, e: bkE, label: 'PADARIA', lx: 5.5, ly: 1.5 },
      { box: [7.5, 0.5, 4, 1.2], h: 14, f: frC, d: frD, e: frE, label: 'FRIOS', lx: 9.5, ly: 1.3 },
      { box: [0.3, 2.5, 1.5, 3], h: 10, f: '#558b2f', d: '#33691e', e: '#1b5e20', label: 'HORTI', lx: 1, ly: 4.2 },
      // Novos setores
      { box: [9.8, 2.5, 2, 2.5], h: 11, f: '#1e3a5f', d: '#0f1f3a', e: '#0a1425', label: 'BEBIDAS', lx: 10.8, ly: 3.8 },
      { box: [9.5, 5.2, 2.5, 1.8], h: 10, f: rcC, d: rcD, e: rcE, label: 'RECEB.', lx: 10.8, ly: 6.1 },
      { box: [9.5, 7.2, 2.5, 2], h: 11, f: ofC, d: ofD, e: ofE, label: 'ESCRIT.', lx: 10.8, ly: 8.2 },
    ];

    zones.forEach(z => {
      const [gx, gy, gw, gh] = z.box;
      const top = [[gx, gy], [gx + gw, gy], [gx + gw, gy + gh], [gx, gy + gh]]
        .map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - z.h}`)
        .join(' ');
      const front = [[gx, gy + gh], [gx + gw, gy + gh]].map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - z.h}`).join(' ') +
        ' ' + [[gx + gw, gy + gh], [gx, gy + gh]].map(([x, y]) => `${isoX(x, y)},${isoY(x, y)}`).join(' ');
      const side = [isoX(gx + gw, gy), isoY(gx + gw, gy) - z.h, isoX(gx + gw, gy + gh), isoY(gx + gw, gy + gh) - z.h, isoX(gx + gw, gy + gh), isoY(gx + gw, gy + gh), isoX(gx + gw, gy), isoY(gx + gw, gy)].join(',');
      h += `<polygon points="${top}" fill="${z.f}" stroke="${z.d}" stroke-width="0.5"/>`;
      h += `<polygon points="${front}" fill="${z.d}" stroke="${z.e}" stroke-width="0.3"/>`;
      h += `<text x="${isoX(z.lx, z.ly)}" y="${isoY(z.lx, z.ly)}" text-anchor="middle" fill="#fff" font-size="7" font-weight="500">${z.label}</text>`;
    });

    // Mercearia com gondolas (tiles coloridas)
    const gondolaColors = ['#dc2626', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
    let gondolaIdx = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const gx = 2.5 + col * 0.95;
        const gy = 3 + row * 2.2;
        const pts = [[gx, gy], [gx + 0.85, gy], [gx + 0.85, gy + 0.8], [gx, gy + 0.8]]
          .map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - 10}`)
          .join(' ');
        const color = gondolaColors[gondolaIdx % gondolaColors.length];
        h += `<polygon points="${pts}" fill="${color}" stroke="rgba(0,0,0,.4)" stroke-width="0.3" opacity="0.7"/>`;
        gondolaIdx++;
      }
    }
    h += `<text x="${isoX(6, 5)}" y="${isoY(6, 5)}" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="9" font-weight="600">MERCEARIA</text>`;

    // PDVs e colaboradores
    const checkoutWorkers = employees.filter(e => zoneOf(e) === 'checkout' && isWorking(e));
    const pdvSp = Math.min(2.5, 10 / pdvs);
    const pdvSt = (12 - pdvs * pdvSp) / 2;

    // Limitar PDVs ativos pela demanda
    const hourDemand = Math.ceil(checkoutWorkers.length * 0.8); // Demanda base
    const activePdvs = Math.min(checkoutWorkers.length, pdvs, hourDemand);

    for (let i = 0; i < pdvs; i++) {
      const gx = pdvSt + i * pdvSp;
      const act = i < activePdvs;
      const pts = [[gx, 9.8], [gx + pdvSp * 0.7, 9.8], [gx + pdvSp * 0.7, 11], [gx, 11]]
        .map(([x, y]) => `${isoX(x, y)},${isoY(x, y) - 6}`)
        .join(' ');
      h += `<polygon points="${pts}" fill="${act ? ctC : '#555'}" stroke="${act ? ctD : '#444'}" stroke-width="0.5"/>`;
      h += `<text x="${isoX(gx + pdvSp * 0.35, 10.7)}" y="${isoY(gx + pdvSp * 0.35, 10.7)}" text-anchor="middle" fill="${act ? '#a5d6a7' : '#555'}" font-size="6" font-weight="500">PDV ${i + 1}</text>`;

      if (i < activePdvs && i < checkoutWorkers.length) {
        const w = checkoutWorkers[i];
        const x = isoX(gx + pdvSp * 0.35, 9.2);
        const y = isoY(gx + pdvSp * 0.35, 9.2);
        const ini = w.name.split(' ').map(s => s[0]).join('').slice(0, 2);
        const fname = w.name.split(' ')[0].slice(0, 8);
        const lblW = fname.length * 4.2 + 6;
        h += `<ellipse cx="${x}" cy="${y + 2}" rx="8" ry="4" fill="rgba(0,0,0,.2)"/>`;
        h += `<rect x="${x - 6}" y="${y - 16}" width="12" height="14" rx="3" fill="${ZC.checkout}" stroke="#fff" stroke-width="0.8"/>`;
        h += `<circle cx="${x}" cy="${y - 21}" r="5.5" fill="${ZC.checkout}" stroke="#fff" stroke-width="0.8"/>`;
        h += `<text x="${x}" y="${y - 13}" text-anchor="middle" fill="#fff" font-size="6" font-weight="700">${ini}</text>`;
        h += `<rect x="${x - lblW / 2}" y="${y + 3}" width="${lblW}" height="11" rx="3" fill="rgba(0,0,0,.7)" stroke="rgba(255,255,255,.15)" stroke-width="0.4"/>`;
        h += `<text x="${x}" y="${y + 11}" text-anchor="middle" fill="#e2e8f0" font-size="6.5" font-weight="500">${fname}</text>`;
        if (isOnBreak(w)) h += `<text x="${x}" y="${y - 28}" text-anchor="middle" font-size="8" fill="#94a3b8">INTERVALO</text>`;
      }
    }

    // Colaboradores excedentes (sem PDV)
    for (let i = activePdvs; i < checkoutWorkers.length; i++) {
      const w = checkoutWorkers[i];
      const gx = 3 + ((i - activePdvs) % 4) * 1.8;
      const gy = 8 + Math.floor((i - activePdvs) / 4) * 0.6;
      const x = isoX(gx, gy);
      const y = isoY(gx, gy);
      const ini = w.name.split(' ').map(s => s[0]).join('').slice(0, 2);
      const fname = w.name.split(' ')[0].slice(0, 8);
      const lblW = fname.length * 4.2 + 6;
      h += `<ellipse cx="${x}" cy="${y + 2}" rx="8" ry="4" fill="rgba(0,0,0,.2)"/>`;
      h += `<rect x="${x - 6}" y="${y - 16}" width="12" height="14" rx="3" fill="#64748b" stroke="#fff" stroke-width="0.8"/>`;
      h += `<circle cx="${x}" cy="${y - 21}" r="5.5" fill="#64748b" stroke="#fff" stroke-width="0.8"/>`;
      h += `<text x="${x}" y="${y - 13}" text-anchor="middle" fill="#fff" font-size="6" font-weight="700">${ini}</text>`;
      h += `<rect x="${x - lblW / 2}" y="${y + 3}" width="${lblW}" height="11" rx="3" fill="rgba(0,0,0,.7)" stroke="rgba(255,255,255,.15)" stroke-width="0.4"/>`;
      h += `<text x="${x}" y="${y + 11}" text-anchor="middle" fill="#e2e8f0" font-size="6.5" font-weight="500">${fname}</text>`;
    }

    // Agrupar colaboradores por zona
    const byZone = {};
    employees.forEach(e => {
      if (!isWorking(e)) return;
      const z = zoneOf(e);
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(e);
    });

    // Status indicators por zona
    const zoneStatusPos = {
      acougue: [3.3, 0.5],
      padaria: [6.8, 0.5],
      frios: [11.3, 0.5],
      hortifruti: [1.6, 2.5],
      bebida: [10.8, 2.5],
      gondola: [6, 6.5]
    };

    Object.entries(zoneStatusPos).forEach(([zone, [gx, gy]]) => {
      const count = (byZone[zone] || []).length;
      if (count > 0) {
        const x = isoX(gx, gy);
        const y = isoY(gx, gy);
        h += `<circle cx="${x}" cy="${y - 18}" r="6" fill="#dc2626" stroke="#fff" stroke-width="1"/>`;
        h += `<text x="${x}" y="${y - 15}" text-anchor="middle" fill="#fff" font-size="7" font-weight="700">${count}</text>`;
      }
    });

    const zonePos = {
      gondola: { gx: [2.8, 9.2], gy: [3.2, 7.8] },
      acougue: { gx: [0.8, 3], gy: [2.3, 2.6] },
      padaria: { gx: [4.3, 6.5], gy: [2.3, 2.6] },
      frios: { gx: [7.8, 9.5], gy: [2, 2.5] },
      hortifruti: { gx: [0.3, 1.5], gy: [6, 7.5] },
      bebida: { gx: [10, 11.7], gy: [2.7, 5] },
    };

    Object.entries(byZone).forEach(([z, workers]) => {
      if (z === 'checkout') return;
      const pos = zonePos[z];
      if (!pos) return;
      workers.forEach((w, i) => {
        let gx, gy;
        if (z === 'gondola') {
          gx = 3.5 + (i % 4) * 1.8;
          gy = 4 + Math.floor(i / 4) * 1.5;
        } else {
          const cols = Math.ceil(Math.sqrt(workers.length));
          const row = Math.floor(i / cols);
          const col = i % cols;
          const tx = cols > 1 ? col / (cols - 1) : 0.5;
          gx = pos.gx[0] + tx * (pos.gx[1] - pos.gx[0]);
          gy = pos.gy[0] + (workers.length > 1 ? (row / (Math.ceil(workers.length / cols) - 1)) : 0.5) * (pos.gy[1] - pos.gy[0]);
        }
        const x = isoX(gx, gy);
        const y = isoY(gx, gy);
        const ini = w.name.split(' ').map(s => s[0]).join('').slice(0, 2);
        const fname = w.name.split(' ')[0].slice(0, 8);
        const lblW = fname.length * 4.2 + 6;
        const color = ZC[z] || '#888';
        h += `<ellipse cx="${x}" cy="${y + 2}" rx="8" ry="4" fill="rgba(0,0,0,.2)"/>`;
        h += `<rect x="${x - 6}" y="${y - 16}" width="12" height="14" rx="3" fill="${color}" stroke="#fff" stroke-width="0.8"/>`;
        h += `<circle cx="${x}" cy="${y - 21}" r="5.5" fill="${color}" stroke="#fff" stroke-width="0.8"/>`;
        h += `<text x="${x}" y="${y - 13}" text-anchor="middle" fill="#fff" font-size="6" font-weight="700">${ini}</text>`;
        h += `<rect x="${x - lblW / 2}" y="${y + 3}" width="${lblW}" height="11" rx="3" fill="rgba(0,0,0,.7)" stroke="rgba(255,255,255,.15)" stroke-width="0.4"/>`;
        h += `<text x="${x}" y="${y + 11}" text-anchor="middle" fill="#e2e8f0" font-size="6.5" font-weight="500">${fname}</text>`;
      });
    });

    h += `<text x="${isoX(6, 11.5)}" y="${isoY(6, 11.5)}" text-anchor="middle" fill="rgba(255,255,255,.35)" font-size="9" font-weight="500">FRENTE DE LOJA</text>`;
    h += `<text x="${isoX(6, 12)}" y="${isoY(6, 12) + 14}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="9">↑ ENTRADA</text>`;

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
    <div style={{ color: '#e8eef5', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px', marginBottom: '10px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Planta da loja</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: 'transparent',
              border: '0.5px solid rgba(255,255,255,.2)',
              borderRadius: '8px',
              padding: '3px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              color: 'rgba(255,255,255,.6)',
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
                  background: i === floorDay ? '#0ea5e9' : 'rgba(14, 165, 233, 0.12)',
                  color: '#ffffff',
                  border: `1px solid ${i === floorDay ? '#0ea5e9' : 'rgba(14, 165, 233, 0.3)'}`,
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: i === floorDay ? '600' : '500',
                  cursor: 'pointer',
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
      <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg viewBox="-10 0 860 480" style={{ display: 'block', width: '95%', height: 'auto', minHeight: '120px' }} dangerouslySetInnerHTML={{ __html: svg() }} />
      </div>

      {/* Timeline */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <button onClick={() => setFloorHour(Math.max(openHour, floorHour - 0.5))} style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#0ea5e9', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>◀</button>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#e8eef5', minWidth: '65px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
          <button onClick={() => setFloorHour(Math.min(closeHour - 0.5, floorHour + 0.5))} style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#0ea5e9', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>▶</button>
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
