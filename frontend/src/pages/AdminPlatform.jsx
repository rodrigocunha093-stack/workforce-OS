import { useState, useEffect, Fragment } from 'react';
import {
  Shield, Building2, AlertCircle, Loader2, Check, Lock, LogOut, Plus, Users, X,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, UserPlus, Eye, EyeOff, ScrollText, Pencil, Trash2, Play, Mail
} from 'lucide-react';

/* ============================================================
   Painel Administrativo — Contagil (redesign premium v2)
   Uso exclusivo do setor administrativo. Totalmente separado do
   app do cliente: login próprio, token próprio (chave de
   localStorage diferente), sem Sidebar/menu do Escalágil.
   Só acessível em /admin-plataforma.

   Visual premium: fundo escuro com glow suave (sem grade de
   pontos), glass, KPIs com tiles de ícone, card CTA dedicado,
   tabela com avatares e hierarquia clara, badges refinados.
   100% self-contained (não depende do Tailwind). Lógica, estados
   e chamadas de API idênticas ao original.
   ============================================================ */

const TOKEN_KEY = 'contagil_platform_token';
const DEPT_KEY = 'contagil_platform_department';
const EMPTY_COMPANY_FORM = { companyName: '', clientId: '', adminName: '', adminEmail: '', adminPassword: '' };
const EMPTY_USER_FORM = { name: '', email: '', password: '', isAdmin: false };

// Transforma texto livre em slug: minúsculas, espaços/underscores viram
// hífen, remove acentos e qualquer caractere que não seja a-z0-9-.
// Usado enquanto o usuário digita: não corta hífen no final, senão fica
// impossível digitar "palavra-" e continuar (o hífen sempre seria o último
// caractere naquele instante e seria removido a cada tecla).
function toSlug(value) {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-/, '');
}

// Usado só no envio final (submit/save): aí sim remove hífen sobrando
// no começo/fim, já que o texto está "fechado".
function finalizeSlug(value) {
  return toSlug(value).replace(/-$/, '');
}

// Iniciais para avatar (até 2 letras).
function getInitials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const EVENT_LABELS = {
  login_success: 'Login',
  login_failed: 'Login falhou',
  login_blocked: 'Login bloqueado',
  user_created: 'Usuário criado',
  user_activated: 'Usuário ativado',
  user_deactivated: 'Usuário desativado',
  password_changed: 'Senha alterada',
};

const STYLES = `
.adm-scope select option {
  background-color: #101827;
  color: #e8eef5;
  padding: 8px;
}
.adm-scope select option:checked { background-color: #1e4b7a; color: #fff; }

.adm-scope {
  --bg: #060b18;
  --bg-2: #0b1428;
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.13);
  --text: #eaf1f9;
  --muted: #93a1b8;
  --faint: #5b6880;
  --accent: #4c9dff;
  --accent-2: #7c8bff;
  --green: #37d39a;
  --red: #f2657a;
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.adm-scope *, .adm-scope *::before, .adm-scope *::after { box-sizing: border-box; }

@keyframes adm-breathe { 0%,100%{opacity:.75} 50%{opacity:1} }
@keyframes adm-rise { from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:translateY(0)} }
@keyframes adm-pop { from{opacity:0; transform:scale(.96)} to{opacity:1; transform:scale(1)} }
@keyframes adm-dot { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:.4; transform:scale(.75)} }
@keyframes adm-spin { to { transform: rotate(360deg); } }
.adm-spin { animation: adm-spin .9s linear infinite; }
@keyframes adm-aurora-a { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(6%,4%,0) scale(1.12)} }
@keyframes adm-aurora-b { 0%,100%{transform:translate3d(0,0,0) scale(1.05)} 50%{transform:translate3d(-5%,-3%,0) scale(1)} }

/* ---------- Tela de login ---------- */
.adm-gate {
  position: relative; min-height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start; padding: 56px 20px 48px; overflow: hidden;
  background:
    radial-gradient(1200px 520px at 50% -260px, rgba(74,168,255,0.18), transparent 60%),
    radial-gradient(900px 500px at 50% -160px, rgba(124,92,255,0.12), transparent 55%),
    linear-gradient(180deg, #080b16, #05070f);
}
.adm-gate::before {
  content: ''; position: absolute; top: -260px; left: 50%;
  width: 900px; height: 520px; transform: translateX(-50%); border-radius: 50%;
  box-shadow: 0 0 140px 30px rgba(74,168,255,0.32);
  border-top: 2px solid rgba(120,190,255,0.5);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 46%);
          mask-image: linear-gradient(180deg, #000 0%, transparent 46%);
  pointer-events: none; animation: adm-breathe 6s ease-in-out infinite;
}
.adm-gate-inner { position: relative; z-index: 1; width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; }

.adm-brand { text-align: center; margin-bottom: 26px; }
.adm-eyebrow {
  display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 5px 12px;
  border: 1px solid var(--border-strong); border-radius: 999px; background: rgba(76,157,255,0.08);
  color: #bcd8ff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
  animation: adm-rise .5s ease both;
}
.adm-eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: adm-dot 1.8s ease-in-out infinite; }
.adm-brand-ico {
  width: 58px; height: 58px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--accent); background: linear-gradient(180deg, rgba(76,157,255,0.16), rgba(76,157,255,0.06));
  border: 1px solid rgba(76,157,255,0.3);
  box-shadow: 0 0 34px -6px rgba(76,157,255,0.55), inset 0 1px 0 rgba(255,255,255,0.12); animation: adm-rise .5s ease .05s both;
}
.adm-brand h1 {
  margin: 18px 0 10px; font-size: 34px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em;
  background: linear-gradient(180deg, #ffffff, #a9c4e6);
  -webkit-background-clip: text; background-clip: text; color: transparent; animation: adm-rise .5s ease .1s both;
}
.adm-brand p { margin: 0 auto; max-width: 380px; font-size: 14px; line-height: 1.55; color: var(--muted); animation: adm-rise .5s ease .15s both; }

.adm-card {
  position: relative; border: 1px solid var(--border); border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 30px 60px -30px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06);
}
.adm-card.glow::before {
  content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1px;
  background: linear-gradient(140deg, rgba(76,157,255,0.5), transparent 35%, transparent 65%, rgba(124,139,255,0.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .7;
}
.adm-gate-card { width: 100%; box-sizing: border-box; padding: 30px 30px 26px; animation: adm-rise .6s ease .2s both; }
.adm-gate-head { text-align: center; margin-bottom: 22px; }
.adm-gate-head h2 { margin: 0 0 5px; font-size: 21px; font-weight: 700; color: var(--text); }
.adm-gate-head p { margin: 0; font-size: 13px; color: var(--muted); }

.adm-field { margin-bottom: 15px; }
.adm-field-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.adm-inputbox {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: var(--muted);
  transition: border-color .2s, box-shadow .2s, background .2s, color .2s;
}
.adm-inputbox > svg { flex-shrink: 0; }
.adm-inputbox:focus-within { border-color: rgba(76,157,255,0.6); color: var(--accent); background: rgba(76,157,255,0.05); box-shadow: 0 0 0 4px rgba(76,157,255,0.12); }
.adm-inputbox input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-size: 14px; font-family: inherit; color: var(--text); }
.adm-inputbox input::placeholder { color: var(--faint); }
.adm-eye { border: none; background: none; cursor: pointer; padding: 0; display: flex; color: var(--muted); transition: color .16s; }
.adm-eye:hover { color: #cfe0f7; }

.adm-gate-foot { margin-top: 18px; text-align: center; font-size: 11.5px; color: rgba(214,228,247,0.45); }

/* ---------- App / painel ---------- */
.adm-app {
  position: relative; height: 100vh; overflow: hidden;
  background:
    /* foco de luz central atrás do navbar + card */
    radial-gradient(900px 520px at 50% 8%, rgba(58,120,210,0.18), transparent 62%),
    /* vinheta escura nas bordas para dar profundidade/sombra */
    radial-gradient(1200px 900px at 50% 40%, transparent 55%, rgba(3,6,14,0.55) 100%),
    /* base azul-marinho profunda */
    linear-gradient(180deg, #08101f 0%, #060b17 46%, #04070f 100%);
}
/* brilho azul central e discreto (estilo Auctus, mais escuro) */
.adm-app::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(760px 480px at 50% 120%, rgba(70,140,230,0.22), transparent 60%),
    radial-gradient(460px 320px at 50% 132%, rgba(110,170,240,0.14), transparent 60%);
  filter: blur(2px); animation: adm-breathe 9s ease-in-out infinite;
}
/* grade de pontos sutil, esmaecendo perto do brilho inferior */
.adm-app::after {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.4px);
  background-size: 42px 42px;
  -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 55%, transparent 88%);
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 55%, transparent 88%);
  opacity: .6;
}

.adm-nav {
  position: fixed; top: 18px; left: 0; right: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 0 24px; pointer-events: none;
}
.adm-nav-row {
  pointer-events: auto;
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  width: 100%; max-width: 1180px; height: 62px; padding: 0 14px 0 18px;
  border-radius: 999px; border: 1px solid rgba(120,160,220,0.16);
  background: linear-gradient(180deg, rgba(18,26,44,0.82), rgba(11,17,32,0.66));
  backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%);
  box-shadow: 0 20px 50px -24px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08);
}
.adm-nav-brand { display: flex; align-items: center; gap: 13px; }
.adm-nav-ico {
  width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
  color: #cfe4ff; background: linear-gradient(150deg, rgba(76,157,255,0.4), rgba(124,139,255,0.18));
  border: 1px solid rgba(120,180,255,0.45);
  box-shadow: 0 8px 24px -8px rgba(76,157,255,0.7), inset 0 1px 0 rgba(255,255,255,0.22);
}
.adm-nav-brand h1 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.adm-nav-brand p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }

.adm-nav-actions { display: flex; align-items: center; gap: 12px; }
.adm-dept-badge {
  display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; color: #cfe4ff;
  background: linear-gradient(150deg, rgba(76,157,255,0.22), rgba(124,139,255,0.1));
  border: 1px solid rgba(120,180,255,0.4);
}

.adm-logout {
  display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: 11px; cursor: pointer;
  font-size: 12.5px; font-weight: 600; color: #cfe0f7; font-family: inherit;
  background: rgba(255,255,255,0.04); border: 1px solid var(--border-strong); transition: background .16s, transform .12s, border-color .16s;
}
.adm-logout:hover { background: rgba(242,101,122,0.12); border-color: rgba(242,101,122,0.4); color: #ffb3bf; transform: translateY(-1px); }

.adm-main {
  position: relative; z-index: 1; max-width: 1180px; width: 100%; margin: 0 auto;
  padding: 24px 28px 24px; margin-top: 96px; height: calc(100vh - 96px);
  display: flex; flex-direction: column; overflow: hidden;
}

.adm-stack { display: flex; flex-direction: column; gap: 14px; flex-shrink: 0; }

/* Alertas */
.adm-alert {
  display: flex; align-items: flex-start; gap: 8px; padding: 12px 14px; border-radius: 12px; font-size: 13.5px;
  animation: adm-rise .3s ease both;
}
.adm-alert svg { margin-top: 1px; flex-shrink: 0; }
.adm-alert.err { background: rgba(242,101,122,0.1); border: 1px solid rgba(242,101,122,0.35); color: #ffb3bf; }
.adm-alert.ok { background: rgba(55,211,154,0.1); border: 1px solid rgba(55,211,154,0.35); color: #7ff0c6; }

/* KPIs */
.adm-kpis { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 860px) { .adm-kpis { grid-template-columns: 1fr 1fr 1.4fr; } }

.adm-kpi {
  position: relative; padding: 22px 22px 20px; border-radius: 18px; overflow: hidden;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); animation: adm-rise .5s ease both;
}
.adm-kpi::before {
  content: ''; position: absolute; top: 0; left: 22px; right: 22px; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, var(--kpi-accent, var(--accent)), transparent 80%); opacity: .8;
}
.adm-kpi-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.adm-kpi-ico {
  width: 42px; height: 42px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--kpi-accent, var(--accent));
  background: color-mix(in srgb, var(--kpi-accent, var(--accent)) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--kpi-accent, var(--accent)) 32%, transparent);
}
.adm-kpi-label { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
.adm-kpi-value { font-size: 36px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
.adm-kpi-sub { margin: 8px 0 0; font-size: 12px; color: var(--faint); }

/* Card CTA */
.adm-cta {
  position: relative; display: flex; flex-direction: column; justify-content: center; gap: 14px;
  padding: 22px; border-radius: 18px; overflow: hidden;
  border: 1px solid rgba(76,157,255,0.28);
  background:
    radial-gradient(420px 200px at 100% 0%, rgba(76,157,255,0.16), transparent 70%),
    linear-gradient(180deg, rgba(76,157,255,0.08), rgba(124,139,255,0.03));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); animation: adm-rise .5s ease .05s both;
}
.adm-cta-title { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--text); }
.adm-cta-desc { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--muted); max-width: 320px; }

/* Painel / tabela */
.adm-panel {
  position: relative; margin-top: 20px; display: flex; flex-direction: column; overflow: hidden; min-height: 0; flex: 1;
  border-radius: 20px; border: 1px solid rgba(120,160,220,0.18);
  background:
    radial-gradient(900px 320px at 50% -8%, rgba(76,157,255,0.14), transparent 62%),
    linear-gradient(180deg, rgba(23,35,60,0.72), rgba(13,21,38,0.62) 60%, rgba(10,16,30,0.66));
  box-shadow: 0 40px 80px -44px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.02) inset, inset 0 1px 0 rgba(255,255,255,0.08);
  animation: adm-rise .6s ease .1s both;
}
/* faixa de acento no topo do card */
.adm-panel::before {
  content: ''; position: absolute; top: 0; left: 24px; right: 24px; height: 1px; z-index: 2; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(76,157,255,0.7) 25%, rgba(124,139,255,0.6) 75%, transparent);
}
.adm-panel::after {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none; border-radius: 20px;
  background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1.4px);
  background-size: 34px 34px;
  -webkit-mask-image: linear-gradient(180deg, transparent 30%, #000 100%);
          mask-image: linear-gradient(180deg, transparent 30%, #000 100%);
  opacity: .5;
}
.adm-panel > * { position: relative; z-index: 1; }
.adm-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px; flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
}
.adm-panel-head h2 { margin: 0; font-size: 15px; font-weight: 700; color: var(--text); }
.adm-panel-head p { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
.adm-count-pill { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #bcd8ff; background: rgba(76,157,255,0.12); border: 1px solid rgba(76,157,255,0.28); }
.adm-panel-body { padding: 10px 14px 16px; overflow-y: auto; min-height: 0; }

.adm-table-wrap { overflow-x: auto; }
.adm-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
.adm-table thead th {
  text-align: left; padding: 10px 16px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .08em; color: var(--faint); white-space: nowrap;
}
.adm-table tbody td { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); color: var(--text); vertical-align: middle; }
.adm-row { transition: background .16s; cursor: pointer; }
.adm-row > td:first-child { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
.adm-row > td:last-child { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
.adm-row:hover > td { background: rgba(76,157,255,0.06); }
.adm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--faint); }
.adm-td-name { font-weight: 600; color: var(--text); }
.adm-td-muted { color: var(--muted); }
.adm-table th.adm-right, .adm-table td.adm-right { text-align: right; }
.adm-row-static:hover > td { background: rgba(255,255,255,0.025); }

.adm-chevron { color: var(--faint); display: inline-flex; transition: color .16s; }
.adm-row:hover .adm-chevron { color: var(--accent); }

/* Avatares */
.adm-company-cell, .adm-user-cell { display: flex; align-items: center; gap: 11px; }
.adm-avatar {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; letter-spacing: .02em; color: #eaf1f9;
  border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
}
.adm-avatar.blue { background: linear-gradient(150deg, #3f7fd6, #2a4d99); }
.adm-avatar.green { background: linear-gradient(150deg, #2ea982, #1e6f57); }
.adm-avatar.sm { width: 30px; height: 30px; border-radius: 9px; font-size: 11px; }

.adm-users-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--muted); background: rgba(255,255,255,0.05); border: 1px solid var(--border); }

/* Bloco expandido */
.adm-expand > td { padding: 10px 8px 14px !important; border-top: 0 !important; }
.adm-expand-inner {
  position: relative; padding: 18px 20px; border-radius: 16px; border: 1px solid rgba(120,160,220,0.16);
  background:
    radial-gradient(600px 180px at 0% 0%, rgba(76,157,255,0.10), transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
  box-shadow: 0 18px 40px -28px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07);
  animation: adm-pop .25s ease both;
}
.adm-expand-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.adm-expand-head h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--text); }
.adm-expand-head h4 svg { color: var(--accent); }
.adm-expand-actions { display: flex; gap: 8px; }
.adm-subtable td { border-top: 1px solid rgba(255,255,255,0.04); }
.adm-subtable tr:first-child td { border-top: 0; }

/* Badges */
.adm-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.adm-badge.sky { background: rgba(76,157,255,0.14); color: #9cc7ff; border: 1px solid rgba(76,157,255,0.28); }
.adm-badge.green { background: rgba(55,211,154,0.14); color: #7ff0c6; border: 1px solid rgba(55,211,154,0.3); }
.adm-badge.slate { background: rgba(255,255,255,0.05); color: var(--muted); border: 1px solid var(--border); }
.adm-badge.red { background: rgba(242,101,122,0.14); color: #ffb3bf; border: 1px solid rgba(242,101,122,0.32); }
.adm-badge.violet { background: rgba(167,139,250,0.14); color: #c4b5fd; border: 1px solid rgba(167,139,250,0.32); }
.adm-badge.amber { background: rgba(251,191,36,0.14); color: #fcd34d; border: 1px solid rgba(251,191,36,0.32); }
.adm-badge.brown { background: rgba(120,72,42,0.28); color: #c99a6d; border: 1px solid rgba(120,72,42,0.55); }
.adm-badge code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* Tabs de seção (Empresas / Sincronização, Logs / Agendamento) */
.adm-view-tabs { flex-shrink: 0; margin-bottom: 16px; }
.adm-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); }
.adm-tab {
  padding: 8px 15px; border-radius: 9px; border: none; cursor: pointer; font-family: inherit;
  font-size: 12.5px; font-weight: 700; color: var(--muted); background: transparent; transition: all .16s ease;
}
.adm-tab:hover { color: var(--text); }
.adm-tab.active { color: #fff; background: linear-gradient(135deg, #6cc0ff, #3a7bff); box-shadow: 0 6px 16px -8px rgba(76,157,255,0.8); }
.adm-subtabs-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; flex-shrink: 0; }

/* Filtros da tela de logs */
.adm-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.adm-filters select.adm-input, .adm-filters input.adm-input { width: auto; min-width: 150px; padding: 9px 12px; font-size: 13px; }

/* Cards de agendamento (um por módulo) */
.adm-sched-grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
@media (min-width: 760px) { .adm-sched-grid { grid-template-columns: 1fr 1fr 1fr; } }
.adm-sched-card {
  padding: 18px; border-radius: 16px; border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
  display: flex; flex-direction: column; gap: 12px;
}
.adm-sched-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.adm-sched-head h4 { margin: 0; font-size: 13.5px; font-weight: 800; letter-spacing: .02em; color: var(--text); text-transform: uppercase; }
.adm-toggle { position: relative; width: 40px; height: 22px; border-radius: 999px; border: none; cursor: pointer; background: rgba(255,255,255,0.12); transition: background .18s ease; flex-shrink: 0; }
.adm-toggle.on { background: linear-gradient(135deg, #37d39a, #1fae7c); }
.adm-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .18s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
.adm-toggle.on::after { transform: translateX(18px); }
.adm-sched-hint { margin: 0; font-size: 11px; color: var(--faint); line-height: 1.5; }
.adm-sched-target { position: relative; }
.adm-sched-target-btn {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 11px; border-radius: 9px; border: 1px solid var(--border-strong);
  background: rgba(255,255,255,0.04); color: var(--text); font-family: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: background .16s, border-color .16s;
}
.adm-sched-target-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(76,157,255,0.35); }
.adm-sched-target-btn:disabled { opacity: .6; cursor: default; }
.adm-sched-target-list {
  position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0; max-height: 200px; overflow-y: auto;
  padding: 8px; border-radius: 12px; border: 1px solid var(--border-strong);
  background: linear-gradient(180deg, #101a30, #0b1428); box-shadow: 0 20px 40px -16px rgba(0,0,0,0.9);
}
.adm-sched-target-item { display: flex; align-items: center; gap: 8px; padding: 7px 6px; border-radius: 8px; font-size: 12.5px; color: var(--text); cursor: pointer; }
.adm-sched-target-item:hover { background: rgba(255,255,255,0.05); }
.adm-sched-target-item input { width: 14px; height: 14px; accent-color: var(--accent); flex-shrink: 0; }
.adm-sched-status { margin: 0; font-size: 11.5px; font-weight: 600; height: 15px; display: flex; align-items: center; gap: 5px; }
.adm-sched-status.saving { color: var(--muted); }
.adm-sched-status.saved { color: var(--green); }

/* Painéis que não devem esticar até o fim da tela (conteúdo curto) */
.adm-panel.auto { flex: none; }

/* Botões */
.adm-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 16px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: inherit;
  cursor: pointer; border: 1px solid transparent; transition: transform .15s ease, box-shadow .2s ease, background .16s, filter .2s; position: relative; overflow: hidden;
}
.adm-btn:disabled { filter: grayscale(.3) opacity(.7); cursor: default; }
.adm-btn.block { width: 100%; }
.adm-btn.sm { padding: 7px 12px; font-size: 12px; border-radius: 9px; }
.adm-btn.primary {
  color: #fff; background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 12px 28px -12px rgba(76,157,255,0.7), inset 0 1px 0 rgba(255,255,255,0.4);
}
.adm-btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 34px -12px rgba(76,157,255,0.85); }
.adm-btn.primary::after {
  content:''; position:absolute; top:0; left:-120%; width:60%; height:100%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent);
  transform: skewX(-18deg); transition: left .6s ease;
}
.adm-btn.primary:hover:not(:disabled)::after { left: 130%; }
.adm-btn.outline { color: var(--text); background: rgba(255,255,255,0.04); border-color: var(--border-strong); }
.adm-btn.outline:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(76,157,255,0.35); }
.adm-btn.ghost { color: var(--muted); background: transparent; }
.adm-btn.ghost:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--text); }
.adm-btn.danger {
  color: #fff; background: linear-gradient(135deg, #ff7d90, #e23b54);
  box-shadow: 0 12px 24px -12px rgba(226,59,84,0.7);
}
.adm-btn.danger:hover:not(:disabled) { transform: translateY(-1px); }

/* Ícone-ação (editar/excluir/toggle) */
.adm-iconbtn { appearance: none; border: 0; background: transparent; padding: 6px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); transition: color .16s, background .16s, opacity .16s; }
.adm-iconbtn:hover { background: rgba(255,255,255,0.06); }
.adm-iconbtn.dim { opacity: .55; }
.adm-iconbtn.dim:hover { opacity: 1; }
.adm-iconbtn.edit:hover { color: var(--accent); }
.adm-iconbtn.del:hover { color: var(--red); background: rgba(242,101,122,0.12); }
.adm-iconbtn.ok { color: var(--green); }
.adm-iconbtn.ok:hover { color: #7ff0c6; }
.adm-iconbtn.mut:hover { color: var(--text); }
.adm-clientid-edit { display: flex; align-items: center; gap: 6px; }
.adm-clientid-view { display: flex; align-items: center; gap: 6px; }

/* Loading skeleton */
.adm-skel { height: 54px; border-radius: 12px; background: rgba(255,255,255,0.045); animation: adm-breathe 1.4s ease-in-out infinite; }
.adm-empty { text-align: center; color: var(--muted); font-size: 13.5px; padding: 34px 0; }

/* Inputs de formulário (modais) */
.adm-input {
  width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(140,170,220,0.22);
  background: rgba(255,255,255,0.07); color: var(--text); font-size: 14px; font-family: inherit;
  outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
}
.adm-input::placeholder { color: rgba(200,214,235,0.5); }
.adm-input:hover { background: rgba(255,255,255,0.09); border-color: rgba(140,170,220,0.3); }
.adm-input:focus { border-color: rgba(76,157,255,0.7); background: rgba(76,157,255,0.09); box-shadow: 0 0 0 4px rgba(76,157,255,0.15); }
.adm-input.mini { padding: 6px 9px; font-size: 12px; width: 150px; }
.adm-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }

/* Modal */
.adm-overlay {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(3,6,14,0.72); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: adm-rise .2s ease both;
}
.adm-modal {
  position: relative; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
  border-radius: 20px; padding: 24px; border: 1px solid var(--border-strong);
  background: linear-gradient(180deg, #0e1626, #090d18);
  box-shadow: 0 40px 90px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.06); animation: adm-pop .25s ease both;
}
.adm-modal.sm { max-width: 430px; }
.adm-modal-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 12px; }
.adm-modal-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--text); }
.adm-modal-head p { margin: 4px 0 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
.adm-modal-close { border: 0; background: transparent; cursor: pointer; color: var(--muted); display: flex; padding: 4px; border-radius: 8px; transition: color .16s, background .16s; }
.adm-modal-close:hover { color: var(--text); background: rgba(255,255,255,0.06); }

.adm-form { display: flex; flex-direction: column; gap: 16px; }
.adm-fieldset { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px; background: rgba(255,255,255,0.035); border: 1px solid rgba(120,160,220,0.14); }
.adm-fieldset-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text); }
.adm-fieldset-title svg { color: var(--accent); }
.adm-hint { font-size: 12px; color: var(--faint); margin: 6px 0 0; line-height: 1.45; }
.adm-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer; }
.adm-check input { width: 15px; height: 15px; accent-color: var(--accent); }
.adm-modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }

/* Lista de logs no modal */
.adm-logs { display: flex; flex-direction: column; gap: 10px; max-height: 24rem; overflow-y: auto; }
.adm-logs.full { max-height: none; }
.adm-log { padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
.adm-log-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 10px; }
.adm-log-time { font-size: 11.5px; color: var(--faint); white-space: nowrap; }
.adm-log-desc { margin: 0; font-size: 13.5px; color: var(--text); }
.adm-log-by { margin: 4px 0 0; font-size: 11.5px; color: var(--faint); }

.adm-loading-center { display: flex; justify-content: center; padding: 32px 0; color: var(--muted); }

/* Autofill escuro */
.adm-input:-webkit-autofill,
.adm-input:-webkit-autofill:hover,
.adm-input:-webkit-autofill:focus,
.adm-inputbox input:-webkit-autofill,
.adm-inputbox input:-webkit-autofill:hover,
.adm-inputbox input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text);
  -webkit-box-shadow: 0 0 0 1000px #0a1120 inset;
  transition: background-color 9999s ease-in-out 0s;
  caret-color: var(--text);
}
`;

/* ---------- Componentes de UI ---------- */

function Alert({ variant = 'default', children }) {
  const Icon = variant === 'destructive' ? AlertCircle : Check;
  return (
    <div className={`adm-alert ${variant === 'destructive' ? 'err' : 'ok'}`}>
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

function Avatar({ name, tone = 'blue', size = '' }) {
  return <span className={`adm-avatar ${tone} ${size}`}>{getInitials(name)}</span>;
}

function Card({ children, className = '' }) {
  return <div className={`adm-card glow ${className}`}>{children}</div>;
}

function Input({ autoComplete = 'off', className = '', ...props }) {
  return (
    <input
      autoComplete={autoComplete}
      {...props}
      className={`adm-input ${className}`}
    />
  );
}

function Label({ children }) {
  return <label className="adm-label">{children}</label>;
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button {...props} className={`adm-btn ${variant} ${className}`}>
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, description, children, size = '' }) {
  if (!open) return null;
  return (
    <div className="adm-overlay">
      <div className={`adm-modal ${size}`}>
        <div className="adm-modal-head">
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <button onClick={onClose} className="adm-modal-close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Sincronização (logs + agendamento) ---------- */

const SYNC_MODULE_LABELS = { vendas: 'Vendas', mercadologico: 'Mercadológico', setores: 'Setores' };
const SYNC_MODULE_TONE = { vendas: 'amber', mercadologico: 'violet', setores: 'brown' };

function SyncPanel({ token }) {
  const [subView, setSubView] = useState('logs');
  const [clients, setClients] = useState([]); // [{ clientId, name }] das empresas com client_id configurado

  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch('/api/superadmin/companies', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setClients((data.companies || []).filter((c) => c.client_id).map((c) => ({ clientId: c.client_id, name: c.name })));
        }
      } catch (err) {
        console.error('Erro ao carregar lista de clientes:', err);
      }
    };
    loadClients();
  }, [token]);

  return (
    <>
      <div className="adm-subtabs-row">
        <div className="adm-tabs">
          <button className={`adm-tab ${subView === 'logs' ? 'active' : ''}`} onClick={() => setSubView('logs')}>Logs de sincronização</button>
          <button className={`adm-tab ${subView === 'schedules' ? 'active' : ''}`} onClick={() => setSubView('schedules')}>Agendamento</button>
        </div>
      </div>
      {subView === 'logs' ? <SyncLogsPanel token={token} clients={clients} /> : <SyncSchedulesPanel token={token} clients={clients} />}
    </>
  );
}

function SyncLogsPanel({ token, clients }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ module: '', status: '', clientId: '', dateFrom: '', dateTo: '' });

  const authHeaders = () => ({ 'Authorization': `Bearer ${token}` });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.module) params.set('module', filters.module);
      if (filters.status) params.set('status', filters.status);
      if (filters.clientId) params.set('clientId', filters.clientId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('limit', '150');

      const res = await fetch(`/api/superadmin/sync/logs?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs de sincronização:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [filters.module, filters.status, filters.clientId, filters.dateFrom, filters.dateTo]);

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>Logs de sincronização</h2>
          <p>Histórico de execução dos jobs de vendas, mercadológico e setores por cliente</p>
        </div>
        <span className="adm-count-pill">{logs.length} {logs.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div className="adm-panel-body">
        <div className="adm-filters" style={{ marginBottom: 16 }}>
          <select className="adm-input" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}>
            <option value="">Todos os módulos</option>
            <option value="vendas">Vendas</option>
            <option value="mercadologico">Mercadológico</option>
            <option value="setores">Setores</option>
          </select>
          <select className="adm-input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos os status</option>
            <option value="success">Sucesso</option>
            <option value="error">Erro</option>
          </select>
          <select className="adm-input" value={filters.clientId} onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>{c.name} · {c.clientId}</option>
            ))}
          </select>
          <input
            type="date"
            className="adm-input"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            title="Data inicial"
          />
          <input
            type="date"
            className="adm-input"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            title="Data final"
          />
          <Button variant="outline" className="sm" onClick={loadLogs}>Atualizar</Button>
          <Button
            variant="ghost"
            className="sm"
            onClick={() => setFilters({ module: '', status: '', clientId: '', dateFrom: '', dateTo: '' })}
            disabled={!filters.module && !filters.status && !filters.clientId && !filters.dateFrom && !filters.dateTo}
          >
            Limpar filtros
          </Button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 4px' }}>
            {[1, 2, 3].map((i) => <div key={i} className="adm-skel" />)}
          </div>
        ) : logs.length === 0 ? (
          <p className="adm-empty">Nenhum registro de sincronização ainda.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Status</th>
                  <th>Cliente</th>
                  <th>Task</th>
                  <th>ID Consulta</th>
                  <th className="adm-right">Quando</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="adm-row-static">
                    <td style={{ fontWeight: 500, fontSize: 12.5, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--muted)' }}>{SYNC_MODULE_LABELS[log.module] || log.module}</td>
                    <td><Badge tone={log.status === 'error' ? 'red' : 'green'}>{log.status === 'error' ? 'Erro' : 'Sucesso'}</Badge></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.client_id}</div>
                      {log.company_name && <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{log.company_name}</div>}
                    </td>
                    <td><code>{log.task_id}</code></td>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.status === 'error'
                        ? <span style={{ color: '#ffb3bf' }} title={log.message}>{log.message}</span>
                        : log.consulta_id
                          ? <code className="adm-mono" title={log.consulta_id}>{log.consulta_id.slice(0, 8)}</code>
                          : <span style={{ color: 'var(--faint)' }}>—</span>}
                    </td>
                    <td className="adm-right" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncSchedulesPanel({ token, clients }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [statusByModule, setStatusByModule] = useState({}); // module -> 'saving' | 'saved' | null
  const [error, setError] = useState('');
  const [pickerOpenModule, setPickerOpenModule] = useState(null);
  const [selectedClients, setSelectedClients] = useState({}); // module -> [clientId, ...] (vazio = todos)

  const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/sync/schedules', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
        const nextDrafts = {};
        (data.schedules || []).forEach((s) => { nextDrafts[s.module] = s.cron_expression; });
        setDrafts(nextDrafts);
      }
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSchedules(); }, []);

  // Acompanha se algum módulo está executando agora (disparo manual ou
  // cron), pra desabilitar o botão de disparo manual enquanto isso — sem
  // sobrescrever o que o usuário estiver digitando no campo de cron.
  const pollRunning = async () => {
    try {
      const res = await fetch('/api/superadmin/sync/schedules', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSchedules((prev) => prev.map((s) => {
          const fresh = (data.schedules || []).find((f) => f.module === s.module);
          return fresh ? { ...s, running: fresh.running } : s;
        }));
      }
    } catch (err) {
      // silencioso — é só um polling de status
    }
  };

  useEffect(() => {
    const interval = setInterval(pollRunning, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerRun = async (module) => {
    setError('');
    setPickerOpenModule(null);
    setSchedules((prev) => prev.map((s) => (s.module === module ? { ...s, running: true } : s)));
    try {
      const res = await fetch(`/api/superadmin/sync/run/${module}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ clientIds: selectedClients[module] || [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao disparar sincronização');
    } catch (err) {
      setError(err.message);
      setSchedules((prev) => prev.map((s) => (s.module === module ? { ...s, running: false } : s)));
    }
  };

  const toggleClientSelection = (module, clientId) => {
    setSelectedClients((prev) => {
      const current = prev[module] || [];
      const next = current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId];
      return { ...prev, [module]: next };
    });
  };

  // Salva automaticamente — sem botão "Salvar": ativar/desativar salva na
  // hora, e o horário salva ao sair do campo (blur) ou apertar Enter.
  const saveSchedule = async (module, cronExpression, enabled) => {
    setStatusByModule((prev) => ({ ...prev, [module]: 'saving' }));
    setError('');
    try {
      const res = await fetch(`/api/superadmin/sync/schedules/${module}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ cronExpression, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar agendamento');
      setSchedules((prev) => prev.map((s) => (s.module === module ? { ...s, cron_expression: cronExpression, enabled } : s)));
      setStatusByModule((prev) => ({ ...prev, [module]: 'saved' }));
      setTimeout(() => setStatusByModule((prev) => ({ ...prev, [module]: null })), 2500);
    } catch (err) {
      setError(err.message);
      setStatusByModule((prev) => ({ ...prev, [module]: null }));
    }
  };

  const handleCronBlur = (s) => {
    const value = (drafts[s.module] || '').trim();
    if (value && value !== s.cron_expression) {
      saveSchedule(s.module, value, s.enabled);
    }
  };

  return (
    <div className="adm-panel auto">
      <div className="adm-panel-head">
        <div>
          <h2>Agendamento de sincronização</h2>
          <p>Horário (formato cron) em que cada job roda pra todos os clientes — salva automaticamente</p>
        </div>
      </div>
      <div className="adm-panel-body">
        {error && <Alert variant="destructive">{error}</Alert>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 4px' }}>
            {[1, 2, 3].map((i) => <div key={i} className="adm-skel" />)}
          </div>
        ) : (
          <div className="adm-sched-grid">
            {schedules.map((s) => (
              <div key={s.module} className="adm-sched-card">
                <div className="adm-sched-head">
                  <h4>{SYNC_MODULE_LABELS[s.module] || s.module}</h4>
                  <button
                    className={`adm-toggle ${s.enabled ? 'on' : ''}`}
                    onClick={() => saveSchedule(s.module, drafts[s.module] || s.cron_expression, !s.enabled)}
                    disabled={statusByModule[s.module] === 'saving'}
                    title={s.enabled ? 'Ativado — clique pra desativar' : 'Desativado — clique pra ativar'}
                  />
                </div>
                <Input
                  className="mini"
                  style={{ width: '100%' }}
                  value={drafts[s.module] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [s.module]: e.target.value })}
                  onBlur={() => handleCronBlur(s)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                  placeholder="0 6 * * *"
                />
                <p className="adm-sched-hint">Formato cron: minuto hora dia mês dia-da-semana. Ex.: <code>0 6 * * *</code> = 6h todo dia.</p>
                <p className={`adm-sched-status ${statusByModule[s.module] || ''}`}>
                  {statusByModule[s.module] === 'saving' && <><Loader2 className="h-3 w-3 adm-spin" /> Salvando...</>}
                  {statusByModule[s.module] === 'saved' && <><Check className="h-3 w-3" /> Salvo</>}
                </p>
                <div className="adm-sched-target">
                  <button
                    type="button"
                    className="adm-sched-target-btn"
                    onClick={() => setPickerOpenModule(pickerOpenModule === s.module ? null : s.module)}
                    disabled={s.running}
                  >
                    {(selectedClients[s.module]?.length || 0) > 0
                      ? `${selectedClients[s.module].length} cliente(s) selecionado(s)`
                      : 'Todos os clientes'}
                    {pickerOpenModule === s.module ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {pickerOpenModule === s.module && (
                    <div className="adm-sched-target-list">
                      {clients.length === 0 && <p className="adm-sched-hint" style={{ padding: '8px 0' }}>Nenhum cliente com client_id configurado.</p>}
                      {clients.map((c) => (
                        <label key={c.clientId} className="adm-sched-target-item">
                          <input
                            type="checkbox"
                            checked={(selectedClients[s.module] || []).includes(c.clientId)}
                            onChange={() => toggleClientSelection(s.module, c.clientId)}
                          />
                          {c.name} <span style={{ color: 'var(--faint)' }}>· {c.clientId}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="sm block"
                  onClick={() => triggerRun(s.module)}
                  disabled={s.running}
                >
                  {s.running ? <Loader2 className="h-4 w-4 adm-spin" /> : <Play className="h-4 w-4" />}
                  {s.running ? 'Executando...' : 'Disparar agora'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Tela de login ---------- */

function LoginGate({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/platform-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao autenticar');
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(DEPT_KEY, data.admin?.department || '');
      onLogin(data.token, data.admin?.department || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-gate">
      <div className="adm-gate-inner">
        <div className="adm-brand">
          <span className="adm-eyebrow">Acesso restrito</span>
          <div>
            <span className="adm-brand-ico"><Shield className="h-7 w-7" /></span>
          </div>
          <h1>Painel Administrativo</h1>
          <p>Contagil — acesso restrito à equipe interna, para gestão das empresas clientes do Escalágil.</p>
        </div>

        <div className="adm-card glow adm-gate-card">
          <div className="adm-gate-head">
            <h2>Acessar conta</h2>
            <p>Restrito à equipe Contagil</p>
          </div>

          {error && <div className="adm-alert err"><AlertCircle className="h-4 w-4" />{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="adm-field">
              <label className="adm-field-label">Email</label>
              <div className="adm-inputbox">
                <Mail className="h-4 w-4" />
                <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="Digite seu email" />
              </div>
            </div>

            <div className="adm-field">
              <label className="adm-field-label">Senha</label>
              <div className="adm-inputbox">
                <Lock className="h-4 w-4" />
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Digite sua senha" />
                <button type="button" className="adm-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="adm-btn primary block" disabled={loading}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

          <p className="adm-gate-foot">© 2026 Escalágil · Painel Contagil</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Painel de empresas ---------- */

function CompaniesPanel({ token, department, onLogout }) {
  const [activeView, setActiveView] = useState('companies');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expandir empresa / gerenciar usuários
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [companyUsers, setCompanyUsers] = useState({});
  const [loadingUsersId, setLoadingUsersId] = useState(null);
  const [newUserCompanyId, setNewUserCompanyId] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [creatingUser, setCreatingUser] = useState(false);

  // Logs de auditoria por empresa
  const [logsCompany, setLogsCompany] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Edição inline do client_id
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientIdDraft, setClientIdDraft] = useState('');
  const [savingClientId, setSavingClientId] = useState(false);

  // Excluir usuário
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Excluir empresa
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(false);

  const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/companies', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      } else if (res.status === 401 || res.status === 403) {
        onLogout();
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleChange = (field, value) => setForm({ ...form, [field]: value });

  const fetchCompanyUsers = async (companyId) => {
    const res = await fetch(`/api/superadmin/companies/${companyId}/users`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setCompanyUsers((prev) => ({ ...prev, [companyId]: data.users || [] }));
    }
  };

  const toggleExpand = async (companyId) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }
    setExpandedCompanyId(companyId);
    if (!companyUsers[companyId]) {
      setLoadingUsersId(companyId);
      try {
        await fetchCompanyUsers(companyId);
      } finally {
        setLoadingUsersId(null);
      }
    }
  };

  const handleToggleUserAtivo = async (userId, companyId) => {
    try {
      const res = await fetch(`/api/superadmin/users/${userId}/toggle-ativo`, {
        method: 'PATCH',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Erro ao alterar status do usuário');
      await fetchCompanyUsers(companyId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/users/${deleteUserTarget.user.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário');
      setSuccess(`Usuário "${deleteUserTarget.user.name}" excluído.`);
      const companyId = deleteUserTarget.companyId;
      setDeleteUserTarget(null);
      await fetchCompanyUsers(companyId);
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingUser(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyTarget) return;

    setDeletingCompany(true);
    setError('');

    try {
      const res = await fetch(
        `/api/superadmin/companies/${deleteCompanyTarget.id}`,
        {
          method: 'DELETE',
          headers: authHeaders()
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir empresa');
      }

      setSuccess(`Empresa "${deleteCompanyTarget.name}" excluída.`);
      setDeleteCompanyTarget(null);

      await loadCompanies();

    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingCompany(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/companies/${newUserCompanyId}/users`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário');
      setSuccess(`Usuário "${data.user.name}" criado com sucesso!`);
      setUserForm(EMPTY_USER_FORM);
      const companyId = newUserCompanyId;
      setNewUserCompanyId(null);
      await fetchCompanyUsers(companyId);
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const openLogs = async (comp) => {
    setLogsCompany(comp);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/superadmin/companies/${comp.id}/logs`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const startEditClientId = (comp, e) => {
    e.stopPropagation();
    setEditingClientId(comp.id);
    setClientIdDraft(comp.client_id || '');
    setError('');
  };

  const saveClientId = async (companyId) => {
    setSavingClientId(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/client-id`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ clientId: finalizeSlug(clientIdDraft) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar client_id');
      setEditingClientId(null);
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingClientId(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/companies', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, clientId: form.clientId ? finalizeSlug(form.clientId) : '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar empresa');
      setSuccess(`Empresa "${data.company.name}" cadastrada com sucesso!`);
      setForm(EMPTY_COMPANY_FORM);
      setIsModalOpen(false);
      await loadCompanies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalUsers = companies.reduce((sum, c) => sum + c.user_count, 0);

  return (
    <div className="adm-app">
      <nav className="adm-nav">
        <div className="adm-nav-row">
          <div className="adm-nav-brand">
            <span className="adm-nav-ico"><Shield className="h-5 w-5" /></span>
            <div>
              <h1>Painel Administrativo Contagil</h1>
              <p>Gerenciamento de empresas clientes</p>
            </div>
          </div>
          <div className="adm-nav-actions">
            {department && <span className="adm-dept-badge">{department}</span>}
            <button onClick={onLogout} className="adm-logout">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="adm-main">
        {department === 'NPD' && (
          <div className="adm-view-tabs">
            <div className="adm-tabs">
              <button className={`adm-tab ${activeView === 'companies' ? 'active' : ''}`} onClick={() => setActiveView('companies')}>Empresas</button>
              <button className={`adm-tab ${activeView === 'sync' ? 'active' : ''}`} onClick={() => setActiveView('sync')}>Sincronização</button>
            </div>
          </div>
        )}
        {activeView === 'sync' && department === 'NPD' ? (
          <SyncPanel token={token} />
        ) : (
        <>
        <div className="adm-stack">
          {error && <Alert variant="destructive">{error}</Alert>}
          {success && <Alert>{success}</Alert>}

          {/* KPIs */}
          <div className="adm-kpis">
            <div className="adm-kpi" style={{ '--kpi-accent': '#4c9dff' }}>
              <div className="adm-kpi-top">
                <span className="adm-kpi-ico"><Building2 className="h-5 w-5" /></span>
                <p className="adm-kpi-label">Empresas cadastradas</p>
              </div>
              <div className="adm-kpi-value">{companies.length}</div>
              <p className="adm-kpi-sub">empresas clientes na plataforma</p>
            </div>

            <div className="adm-kpi" style={{ '--kpi-accent': '#37d39a' }}>
              <div className="adm-kpi-top">
                <span className="adm-kpi-ico"><Users className="h-5 w-5" /></span>
                <p className="adm-kpi-label">Usuários totais</p>
              </div>
              <div className="adm-kpi-value">{totalUsers}</div>
              <p className="adm-kpi-sub">contas ativas e inativas somadas</p>
            </div>

            <div className="adm-cta">
              <div>
                <p className="adm-cta-title">Adicionar empresa</p>
                <p className="adm-cta-desc">Cadastre uma nova empresa cliente junto do seu primeiro usuário administrador.</p>
              </div>
              <Button className="block" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </div>
          </div>
        </div>

        {/* Companies Table */}
        <div className="adm-panel">
          <div className="adm-panel-head">
            <div>
              <h2>Empresas cadastradas</h2>
              <p>Empresas clientes e status de integração com o agente</p>
            </div>
            {!loading && companies.length > 0 && (
              <span className="adm-count-pill">{companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}</span>
            )}
          </div>
          <div className="adm-panel-body">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 4px' }}>
                {[1, 2, 3].map((i) => <div key={i} className="adm-skel" />)}
              </div>
            ) : companies.length === 0 ? (
              <p className="adm-empty">Nenhuma empresa cadastrada</p>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>#</th>
                      <th>Empresa</th>
                      <th>client_id</th>
                      <th>Usuários</th>
                      <th>Criada em</th>
                      <th className="adm-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((comp) => {
                      const isExpanded = expandedCompanyId === comp.id;
                      const users = companyUsers[comp.id] || [];
                      return (
                        <Fragment key={comp.id}>
                          <tr className="adm-row" onClick={() => toggleExpand(comp.id)}>
                            <td>
                              <span className="adm-chevron">
                                {loadingUsersId === comp.id
                                  ? <Loader2 className="h-4 w-4 adm-spin" />
                                  : isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </span>
                            </td>
                            <td className="adm-mono">#{comp.id}</td>
                            <td>
                              <div className="adm-company-cell">
                                <Avatar name={comp.name} tone="blue" />
                                <span className="adm-td-name">{comp.name}</span>
                              </div>
                            </td>
                            <td>
                              {editingClientId === comp.id ? (
                                <div className="adm-clientid-edit" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    autoFocus
                                    value={clientIdDraft}
                                    onChange={(e) => setClientIdDraft(toSlug(e.target.value))}
                                    className="mini"
                                  />
                                  <button onClick={() => saveClientId(comp.id)} disabled={savingClientId} className="adm-iconbtn ok" title="Salvar">
                                    {savingClientId ? <Loader2 className="h-4 w-4 adm-spin" /> : <Check className="h-4 w-4" />}
                                  </button>
                                  <button onClick={() => setEditingClientId(null)} className="adm-iconbtn mut" title="Cancelar">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="adm-clientid-view">
                                  {comp.client_id
                                    ? <Badge tone="sky"><code>{comp.client_id}</code></Badge>
                                    : <Badge>não configurado</Badge>}
                                  <button onClick={(e) => startEditClientId(comp, e)} className="adm-iconbtn edit dim" title="Editar client_id">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>
                              <span className="adm-users-pill"><Users className="h-3.5 w-3.5" />{comp.user_count}</span>
                            </td>
                            <td className="adm-td-muted">{new Date(comp.created_at).toLocaleDateString('pt-BR')}</td>
                            <td className="adm-right">
                              <button
                                title="Excluir empresa"
                                onClick={(e) => { e.stopPropagation(); setDeleteCompanyTarget(comp); }}
                                className="adm-iconbtn del"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${comp.id}-expanded`} className="adm-expand">
                              <td colSpan={7}>
                                <div className="adm-expand-inner">
                                  <div className="adm-expand-head">
                                    <h4><Users className="h-4 w-4" /> Usuários de {comp.name}</h4>
                                    <div className="adm-expand-actions">
                                      <Button variant="outline" className="sm" onClick={(e) => { e.stopPropagation(); openLogs(comp); }}>
                                        <ScrollText className="h-3.5 w-3.5" /> Logs
                                      </Button>
                                      <Button variant="outline" className="sm" onClick={(e) => { e.stopPropagation(); setNewUserCompanyId(comp.id); setUserForm(EMPTY_USER_FORM); }}>
                                        <UserPlus className="h-3.5 w-3.5" /> Novo Usuário
                                      </Button>
                                    </div>
                                  </div>
                                  {users.length === 0 ? (
                                    <p className="adm-empty" style={{ padding: '16px 0' }}>Nenhum usuário cadastrado</p>
                                  ) : (
                                    <table className="adm-table adm-subtable">
                                      <thead>
                                        <tr>
                                          <th>Nome</th>
                                          <th>Email</th>
                                          <th>Tipo</th>
                                          <th>Status</th>
                                          <th className="adm-right">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {users.map((u) => (
                                          <tr key={u.id}>
                                            <td>
                                              <div className="adm-user-cell">
                                                <Avatar name={u.name} tone={u.is_admin ? 'blue' : 'green'} size="sm" />
                                                <span className="adm-td-name">{u.name}</span>
                                              </div>
                                            </td>
                                            <td className="adm-td-muted">{u.email}</td>
                                            <td><Badge tone={u.is_admin ? 'sky' : 'slate'}>{u.is_admin ? 'Admin' : 'Usuário'}</Badge></td>
                                            <td><Badge tone={u.ativo ? 'green' : 'slate'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                                            <td className="adm-right">
                                              <button title={u.ativo ? 'Desativar' : 'Ativar'} onClick={() => handleToggleUserAtivo(u.id, comp.id)} className="adm-iconbtn mut">
                                                {u.ativo
                                                  ? <ToggleRight className="h-5 w-5" style={{ color: '#37d39a' }} />
                                                  : <ToggleLeft className="h-5 w-5" />}
                                              </button>
                                              <button title="Excluir usuário" onClick={() => setDeleteUserTarget({ user: u, companyId: comp.id })} className="adm-iconbtn del" style={{ marginLeft: 6 }}>
                                                <Trash2 className="h-4 w-4" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </main>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Nova Empresa"
        description="Crie a empresa e o primeiro usuário administrador dela"
      >
        <form onSubmit={handleSubmit} className="adm-form">
          <div className="adm-fieldset">
            <div className="adm-fieldset-title"><Building2 className="h-4 w-4" /> Dados da Empresa</div>
            <div>
              <Label>Nome da Empresa</Label>
              <Input placeholder="Ex: Mercado Feirão" value={form.companyName} onChange={(e) => handleChange('companyName', e.target.value)} required />
            </div>
            <div>
              <Label>client_id (usado pelo agente do cliente)</Label>
              <Input placeholder="ex: mercado-feirao" value={form.clientId} onChange={(e) => handleChange('clientId', toSlug(e.target.value))} />
              <p className="adm-hint">Opcional aqui — pode deixar em branco e configurar depois. Só letras minúsculas, números e hífen.</p>
            </div>
          </div>

          <div className="adm-fieldset">
            <div className="adm-fieldset-title"><Users className="h-4 w-4" /> Primeiro Usuário (Administrador)</div>
            <div>
              <Label>Nome</Label>
              <Input name="new-admin-name" placeholder="Nome de quem vai acessar" value={form.adminName} onChange={(e) => handleChange('adminName', e.target.value)} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" name="new-admin-email" placeholder="email@cliente.com" value={form.adminEmail} onChange={(e) => handleChange('adminEmail', e.target.value)} required />
            </div>
            <div>
              <Label>Senha inicial</Label>
              <Input type="password" name="new-admin-password" autoComplete="new-password" placeholder="Senha temporária" value={form.adminPassword} onChange={(e) => handleChange('adminPassword', e.target.value)} required />
            </div>
          </div>

          <div className="adm-modal-actions">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 adm-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? 'Cadastrando...' : 'Cadastrar Empresa'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={newUserCompanyId !== null}
        onClose={() => setNewUserCompanyId(null)}
        title="Novo Usuário"
        description="Crie um novo usuário para esta empresa"
        size="sm"
      >
        <form onSubmit={handleCreateUser} className="adm-form">
          <div>
            <Label>Nome</Label>
            <Input name="new-user-name" placeholder="Nome do usuário" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" name="new-user-email" placeholder="email@cliente.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
          </div>
          <div>
            <Label>Senha inicial</Label>
            <Input type="password" name="new-user-password" autoComplete="new-password" placeholder="Senha temporária" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          </div>
          <label className="adm-check">
            <input type="checkbox" checked={userForm.isAdmin} onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })} />
            Administrador (acessa Implantação e cria outros usuários)
          </label>
          <div className="adm-modal-actions">
            <Button type="button" variant="outline" onClick={() => setNewUserCompanyId(null)}>Cancelar</Button>
            <Button type="submit" disabled={creatingUser}>
              {creatingUser ? <Loader2 className="h-4 w-4 adm-spin" /> : <UserPlus className="h-4 w-4" />}
              {creatingUser ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={logsCompany !== null}
        onClose={() => setLogsCompany(null)}
        title="Logs de auditoria"
        description={logsCompany ? `Eventos de autenticação de ${logsCompany.name}` : ''}
      >
        {loadingLogs ? (
          <div className="adm-loading-center"><Loader2 className="h-6 w-6 adm-spin" /></div>
        ) : logs.length === 0 ? (
          <p className="adm-empty">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="adm-logs">
            {logs.map((log) => (
              <div key={log.id} className="adm-log">
                <div className="adm-log-top">
                  <Badge tone="sky">{EVENT_LABELS[log.event_type] || log.event_type}</Badge>
                  <span className="adm-log-time">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="adm-log-desc">{log.description}</p>
                <p className="adm-log-by">por {log.performed_by}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteUserTarget !== null}
        onClose={() => setDeleteUserTarget(null)}
        title="Excluir usuário?"
        description={deleteUserTarget ? `Isso vai excluir permanentemente ${deleteUserTarget.user.name} (${deleteUserTarget.user.email}). Essa ação não pode ser desfeita.` : ''}
        size="sm"
      >
        <div className="adm-modal-actions">
          <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteUser} disabled={deletingUser}>
            {deletingUser ? <Loader2 className="h-4 w-4 adm-spin" /> : <Trash2 className="h-4 w-4" />}
            {deletingUser ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteCompanyTarget !== null}
        onClose={() => setDeleteCompanyTarget(null)}
        title="Excluir empresa?"
        description={deleteCompanyTarget ? `Excluir ${deleteCompanyTarget.name} removerá a empresa e seus usuários.` : ''}
        size="sm"
      >
        <div className="adm-modal-actions">
          <Button variant="outline" onClick={() => setDeleteCompanyTarget(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDeleteCompany} disabled={deletingCompany}>
            {deletingCompany ? <Loader2 className="h-4 w-4 adm-spin" /> : <Trash2 className="h-4 w-4" />}
            {deletingCompany ? 'Excluindo...' : 'Excluir Empresa'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminPlatform() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [department, setDepartment] = useState(localStorage.getItem(DEPT_KEY) || '');

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEPT_KEY);
    setToken(null);
    setDepartment('');
  };

  const handleLogin = (newToken, newDepartment) => {
    setToken(newToken);
    setDepartment(newDepartment);
  };

  return (
    <div className="adm-scope">
      <style>{STYLES}</style>
      {token ? <CompaniesPanel token={token} department={department} onLogout={handleLogout} /> : <LoginGate onLogin={handleLogin} />}
    </div>
  );
}
