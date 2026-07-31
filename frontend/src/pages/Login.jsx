import { useState } from 'react';
import axios from 'axios';

/* ============================================================
   Login — Escalágil (redesign premium)
   Mesma lógica/API do original. Visual alinhado aos redesigns
   de Perfil/Usuários/Logs: fundo escuro, arco de luz, grade de
   pontos, glassmorphism, título em gradiente, eyebrow com ponto
   pulsante, fade-up, inputs com glow e botão com brilho.
   100% self-contained (não depende do Tailwind).
   ============================================================ */

const STYLES = `
.egl-scope {
  --bg: #05070f;
  --bg-2: #080b16;
  --border: rgba(255,255,255,0.08);
  --text: #eaf1f9;
  --muted: #8c9bb3;
  --accent: #4aa8ff;
  --accent-2: #7c5cff;
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 56px 20px 48px;
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background:
    radial-gradient(1200px 520px at 50% -260px, rgba(74,168,255,0.18), transparent 60%),
    radial-gradient(900px 500px at 50% -160px, rgba(124,92,255,0.12), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
  overflow: hidden;
}
/* arco de luz no topo */
.egl-scope::before {
  content: '';
  position: absolute;
  top: -260px; left: 50%;
  width: 900px; height: 520px;
  transform: translateX(-50%);
  border-radius: 50%;
  box-shadow: 0 0 140px 30px rgba(74,168,255,0.32);
  border-top: 2px solid rgba(120,190,255,0.5);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 46%);
          mask-image: linear-gradient(180deg, #000 0%, transparent 46%);
  pointer-events: none;
  animation: egl-breathe 6s ease-in-out infinite;
}
/* grade de pontos */
.egl-scope::after {
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(760px 420px at 50% 0%, #000, transparent 72%);
          mask-image: radial-gradient(760px 420px at 50% 0%, #000, transparent 72%);
  opacity: .5;
  pointer-events: none;
}

@keyframes egl-breathe { 0%,100%{opacity:.8} 50%{opacity:1} }
@keyframes egl-rise { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:translateY(0)} }

.egl-inner { position: relative; z-index: 1; width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; }

/* MARCA */
.egl-brand { text-align: center; margin-bottom: 26px; }
.egl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  margin: 0 0 64px; padding: 5px 12px;
  border: 1px solid var(--border); border-radius: 999px;
  background: rgba(74,168,255,0.08); color: #bcd8ff;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
  animation: egl-rise .5s ease both;
}

.egl-brand h1 {
  margin: 0 0 12px; font-size: 46px; line-height: 1.05; font-weight: 800; letter-spacing: -0.03em;
  background: linear-gradient(180deg, #ffffff, #a9c4e6);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: egl-rise .5s ease .05s both;
}
.egl-brand p { margin: 0 auto 22px; max-width: 400px; font-size: 14px; line-height: 1.55; color: var(--muted); animation: egl-rise .5s ease .1s both; }

.egl-feats { display: flex; justify-content: center; gap: 26px; animation: egl-rise .5s ease .15s both; }
.egl-feat-ico {
  width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 8px; color: #cfe0f7;
  background: rgba(255,255,255,0.05); border: 1px solid var(--border);
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.egl-feat:hover .egl-feat-ico { background: rgba(74,168,255,0.12); border-color: rgba(74,168,255,0.35); transform: translateY(-3px); }
.egl-feat span { font-size: 12px; font-weight: 500; color: var(--muted); }

/* CARD */
.egl-card {
  position: relative; width: 100%; box-sizing: border-box;
  padding: 30px 30px 26px; border-radius: 20px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 30px 60px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06);
  animation: egl-rise .6s ease .2s both;
}
.egl-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1px;
  background: linear-gradient(140deg, rgba(74,168,255,0.5), transparent 35%, transparent 65%, rgba(124,92,255,0.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .7;
}
.egl-head { text-align: center; margin-bottom: 22px; }
.egl-head h2 { margin: 0 0 5px; font-size: 21px; font-weight: 700; color: var(--text); }
.egl-head p { margin: 0; font-size: 13px; color: var(--muted); }

.egl-field { margin-bottom: 15px; }
.egl-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.egl-input {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
  padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--border);
  color: var(--muted); transition: border-color .2s, box-shadow .2s, background .2s, color .2s;
}
.egl-input:focus-within {
  border-color: rgba(74,168,255,0.6); color: var(--accent);
  background: rgba(74,168,255,0.05); box-shadow: 0 0 0 4px rgba(74,168,255,0.12);
}
.egl-input input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 14px; font-family: inherit; color: var(--text);
}
.egl-input input::placeholder { color: #56637a; }
/* Corrige o autofill branco do navegador */
.egl-input input:-webkit-autofill,
.egl-input input:-webkit-autofill:hover,
.egl-input input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text);
  -webkit-box-shadow: 0 0 0 1000px transparent inset;
  transition: background-color 9999s ease-in-out 0s;
  caret-color: var(--text);
}
.egl-eye { border: none; background: none; cursor: pointer; padding: 0; display: flex; color: var(--muted); transition: color .16s; }
.egl-eye:hover { color: #cfe0f7; }

.egl-btn {
  width: 100%; margin-top: 6px; padding: 13px 18px; border-radius: 12px; border: none;
  font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; color: #ffffff;
  background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 12px 28px -10px rgba(74,168,255,0.7), inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s ease, box-shadow .2s ease, filter .2s; position: relative; overflow: hidden;
}
.egl-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 34px -10px rgba(74,168,255,0.8); }
.egl-btn:active:not(:disabled) { transform: translateY(0); }
.egl-btn:disabled { filter: grayscale(.4) opacity(.7); cursor: default; }
.egl-btn::after {
  content:''; position:absolute; top:0; left:-120%; width:60%; height:100%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent);
  transform: skewX(-18deg); transition: left .6s ease;
}
.egl-btn:hover:not(:disabled)::after { left: 130%; }

.egl-err {
  margin-bottom: 16px; padding: 11px 14px; border-radius: 12px; font-size: 13.5px;
  background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.35); color: #fca5a5;
  animation: egl-rise .3s ease both;
}
.egl-foot { margin-top: 18px; text-align: center; font-size: 11.5px; color: rgba(214,228,247,0.45); }

@media (max-width: 480px) {
  .egl-brand h1 { font-size: 38px; }
  .egl-feats { gap: 18px; }
}
`;

export default function Login({ onLogin, sessionExpired = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sessionExpired ? 'Sua sessão expirou. Por favor, faça login novamente.' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/auth/login', form);
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const Icon = ({ d, size = 16, stroke = 'currentColor', sw = 2 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );

  const features = [
    { label: 'Escalas', d: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { label: 'Equipes', d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
    { label: 'Relatórios', d: 'M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3' },
  ];

  return (
    <div className="egl-scope">
      <style>{STYLES}</style>

      <div className="egl-inner">
        {/* MARCA */}
        <div className="egl-brand">
          <span className="egl-eyebrow">Plataforma de escalas</span>
          <h1>Escalágil</h1>
          <p>Plataforma inteligente para gestão de escalas, equipes e jornadas de trabalho de forma simples e organizada.</p>
          <div className="egl-feats">
            {features.map((f) => (
              <div className="egl-feat" key={f.label}>
                <div className="egl-feat-ico"><Icon d={f.d} size={20} sw={1.8} /></div>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD */}
        <div className="egl-card">
          <div className="egl-head">
            <h2>Acessar conta</h2>
            <p>Bem-vindo de volta</p>
          </div>

          {error && <div className="egl-err">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="egl-field">
              <label className="egl-label">Email</label>
              <div className="egl-input">
                <Icon d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6" />
                <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="Digite seu email" />
              </div>
            </div>

            <div className="egl-field">
              <label className="egl-label">Senha</label>
              <div className="egl-input">
                <Icon d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" />
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required placeholder="Digite sua senha" />
                <button type="button" className="egl-eye" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Icon d={showPassword
                    ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'
                    : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'} />
                </button>
              </div>
            </div>

            <button type="submit" className="egl-btn" disabled={loading}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

          <p className="egl-foot">© 2026 Escalágil. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}
