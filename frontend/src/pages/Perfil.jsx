import React, { useState, useEffect } from 'react';

/* ============================================================
   Perfil — Escalágil (redesign moderno)
   Mesma lógica/API do original, visual estilo Dribbble/NEONE:
   glassmorphism, arco de luz, gradientes sutis e animações.
   ============================================================ */

const STYLES = `
.eg-scope {
  --bg: #05070f;
  --bg-2: #080b16;
  --panel: rgba(255,255,255,0.035);
  --panel-hi: rgba(255,255,255,0.09);
  --border: rgba(255,255,255,0.08);
  --text: #eaf1f9;
  --muted: #8c9bb3;
  --accent: #4aa8ff;
  --accent-2: #7c5cff;
  position: relative;
  min-height: 100%;
  color: var(--text);
  background:
    radial-gradient(1200px 520px at 50% -260px, rgba(74,168,255,0.18), transparent 60%),
    radial-gradient(900px 500px at 50% -160px, rgba(124,92,255,0.12), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
  padding: 40px 32px 64px;
  font-family: inherit;
  overflow: hidden;
}

/* arco de luz no topo (estilo referência NEONE) */
.eg-scope::before {
  content: '';
  position: absolute;
  top: -200px; right: -300px;
  width: 900px; height: 900px;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 0 160px 40px rgba(74,168,255,0.28);
  border-top: 2px solid rgba(120,190,255,0.5);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 50%);
          mask-image: linear-gradient(180deg, #000 0%, transparent 50%);
  pointer-events: none;
  animation: eg-breathe 6s ease-in-out infinite;
}
.eg-scope::after {
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(700px 400px at 50% 0%, #000, transparent 70%);
          mask-image: radial-gradient(700px 400px at 50% 0%, #000, transparent 70%);
  opacity: .5;
  pointer-events: none;
}

@keyframes eg-breathe { 0%,100%{opacity:.8} 50%{opacity:1} }
@keyframes eg-rise { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:translateY(0)} }

.eg-inner { position: relative; z-index: 1; max-width: 560px; margin: 0 auto; }

.eg-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  margin: 0 0 14px; padding: 5px 12px;
  border: 1px solid var(--border); border-radius: 999px;
  background: rgba(74,168,255,0.08);
  color: #bcd8ff; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .12em;
  animation: eg-rise .5s ease both;
}
.eg-eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }

.eg-title {
  margin: 0 0 6px; font-size: 34px; font-weight: 800; letter-spacing: -0.02em;
  background: linear-gradient(180deg, #ffffff, #a9c4e6);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: eg-rise .5s ease .05s both;
}
.eg-sub { margin: 0 0 28px; color: var(--muted); font-size: 14px; animation: eg-rise .5s ease .1s both; }

.eg-card {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 28px;
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  backdrop-filter: blur(14px);
  box-shadow: 0 30px 60px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06);
  animation: eg-rise .6s ease .15s both;
}
.eg-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1px;
  background: linear-gradient(140deg, rgba(74,168,255,0.5), transparent 35%, transparent 65%, rgba(124,92,255,0.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none; opacity: .7;
}

.eg-field { margin-bottom: 16px; }
.eg-label { display:block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.eg-input {
  width: 100%; box-sizing: border-box;
  padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.03);
  color: var(--text); font-size: 14px; font-family: inherit;
  outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
}
.eg-input::placeholder { color: #56637a; }
.eg-input:focus {
  border-color: rgba(74,168,255,0.6);
  background: rgba(74,168,255,0.05);
  box-shadow: 0 0 0 4px rgba(74,168,255,0.12);
}
.eg-input:disabled { color: var(--muted); cursor: not-allowed; opacity: .8; }
.eg-input:-webkit-autofill,
.eg-input:-webkit-autofill:hover,
.eg-input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text);
  -webkit-box-shadow: 0 0 0 1000px rgba(20,26,41,1) inset;
  transition: background-color 9999s ease-in-out 0s;
  caret-color: var(--text);
}

.eg-divider { position: relative; margin: 28px 0 20px; padding-top: 16px; border-top: 1px solid rgba(74,168,255,0.15); text-align: center; }
.eg-divider span {
  position: relative; top: 0; left: 0;
  background: transparent; padding-right: 0;
  font-size: 12px; color: var(--text); font-weight: 600;
}

.eg-btn {
  width: 100%; margin-top: 6px;
  padding: 14px 18px; border-radius: 12px; border: none;
  font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
  color: #ffffff;
  background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 12px 28px -10px rgba(74,168,255,0.7), inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s ease, box-shadow .2s ease, filter .2s;
  position: relative; overflow: hidden;
}
.eg-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 34px -10px rgba(74,168,255,0.8); }
.eg-btn:active:not(:disabled) { transform: translateY(0); }
.eg-btn:disabled { filter: grayscale(.4) opacity(.7); cursor: default; }
.eg-btn::after {
  content:''; position:absolute; top:0; left:-120%; width:60%; height:100%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
  transform: skewX(-18deg); transition: left .6s ease;
}
.eg-btn:hover:not(:disabled)::after { left: 130%; }

.eg-alert { margin-bottom: 16px; padding: 12px 15px; border-radius: 12px; font-size: 13.5px; animation: eg-rise .3s ease both; }
.eg-alert.err { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.35); color: #fca5a5; }
.eg-alert.ok  { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.35); color: #6ee7b7; }
`;

export default function Perfil() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/me', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setName(data.user.name);
          setEmail(data.user.email);
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const body = { name };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil');

      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...storedUser, name: data.user.name }));
      window.dispatchEvent(new Event('storage'));

      setSuccess('Perfil atualizado com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="eg-scope">
      <style>{STYLES}</style>
      <div className="eg-inner">
        <span className="eg-eyebrow"><span className="dot" />Minha conta</span>
        <h2 className="eg-title">Perfil</h2>
        <p className="eg-sub">Gerencie suas informações e a segurança da sua conta.</p>

        <div className="eg-card">
          {error && <div className="eg-alert err">{error}</div>}
          {success && <div className="eg-alert ok">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="eg-field">
              <label className="eg-label">Nome</label>
              <input className="eg-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="eg-field">
              <label className="eg-label">Email</label>
              <input className="eg-input" value={email} disabled />
            </div>

            <div className="eg-divider"><span>Trocar senha</span></div>

            <div className="eg-field">
              <label className="eg-label">Senha atual</label>
              <input type="password" className="eg-input" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
            </div>
            <div className="eg-field">
              <label className="eg-label">Nova senha</label>
              <input type="password" className="eg-input" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
            </div>

            <button type="submit" className="eg-btn" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
