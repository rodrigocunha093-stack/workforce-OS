import { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', orgName: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const response = await axios.post(url, form);
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
    <div className="esc-wrap">
      <style>{`
        .esc-wrap{
          position:relative;min-height:100vh;display:flex;flex-direction:column;
          align-items:center;justify-content:center;padding:24px 20px;overflow:hidden;
          font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
          background:radial-gradient(1200px 600px at 50% -10%, #15365c 0%, transparent 60%),
                     linear-gradient(160deg,#102a4a 0%,#0a1c33 100%);
        }
        .esc-orb{position:absolute;border-radius:50%;pointer-events:none;}
        .esc-brand{position:relative;text-align:center;max-width:460px;margin-bottom:30px;color:#eaf1fb;}
        .esc-brand h1{
          font-size:52px;font-weight:900;letter-spacing:-2px;margin:0 0 10px;
          color:#ffffff;text-shadow:0 10px 30px rgba(0,0,0,.4), 0 0 20px rgba(59,130,246,.2);
        }
        .esc-brand p{font-size:14px;line-height:1.55;color:rgba(214,228,247,.62);margin:0 0 22px;}
        .esc-feats{display:flex;justify-content:center;gap:26px;}
        .esc-feat-ico{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;
          justify-content:center;margin:0 auto 8px;color:#cfe0f7;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);transition:.18s;}
        .esc-feat:hover .esc-feat-ico{background:rgba(255,255,255,.1);transform:translateY(-2px);}
        .esc-feat span{font-size:12px;font-weight:500;color:rgba(214,228,247,.62);}

        .esc-card{
          position:relative;width:100%;max-width:380px;padding:30px 30px 26px;border-radius:18px;
          background:linear-gradient(180deg,#16335a 0%,#102a4d 100%);
          border:1.5px solid rgba(96,165,250,.4);
          box-shadow:0 25px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08);
        }
        .esc-head{text-align:center;margin-bottom:22px;}
        .esc-head h2{font-size:21px;font-weight:700;color:#f3f7fd;margin:0 0 5px;}
        .esc-head p{font-size:13px;color:rgba(214,228,247,.58);margin:0;}

        .esc-field{margin-bottom:15px;}
        .esc-label{display:block;font-size:12.5px;font-weight:600;color:#dbe6f5;margin-bottom:7px;}
        .esc-input{
          display:flex;align-items:center;gap:10px;width:100%;padding:11px 13px;border-radius:10px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);
          color:rgba(214,228,247,.6);box-sizing:border-box;transition:.16s;
        }
        .esc-input:focus-within{
          border-color:#3b82f6;color:#3b82f6;background:rgba(59,130,246,.08);
          box-shadow:0 0 0 3px rgba(59,130,246,.18);
        }
        .esc-input input{
          flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#f3f7fd;
        }
        .esc-input input::placeholder{color:rgba(214,228,247,.4);}
        /* Corrige o autofill branco do navegador */
        .esc-input input:-webkit-autofill,
        .esc-input input:-webkit-autofill:hover,
        .esc-input input:-webkit-autofill:focus{
          -webkit-text-fill-color:#f3f7fd;
          -webkit-box-shadow:0 0 0 1000px transparent inset;
          transition:background-color 9999s ease-in-out 0s;
          caret-color:#f3f7fd;
        }
        .esc-eye{border:none;background:none;cursor:pointer;padding:0;display:flex;color:rgba(214,228,247,.55);}
        .esc-eye:hover{color:#cfe0f7;}

        .esc-btn{
          width:100%;padding:12px;border-radius:10px;background:#2563eb;color:#fff;border:none;
          font-weight:600;font-size:15px;cursor:pointer;margin-top:4px;transition:.16s;
        }
        .esc-btn:hover:not(:disabled){background:#1d4ed8;}
        .esc-btn:disabled{opacity:.7;cursor:default;}

        .esc-link{background:none;border:none;color:#60a5fa;font-size:14px;font-weight:500;cursor:pointer;padding:0;}
        .esc-link:hover{color:#93c5fd;text-decoration:underline;}

        .esc-demo{margin-top:18px;padding:12px 14px;border-radius:10px;font-size:13px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);}
        .esc-demo b{color:#eaf1fb;}
        .esc-demo span{display:block;font-size:12px;color:rgba(214,228,247,.55);margin-top:3px;}
        .esc-foot{margin-top:18px;text-align:center;font-size:11.5px;color:rgba(214,228,247,.45);}
        .esc-err{margin-bottom:16px;padding:10px 14px;border-radius:8px;font-size:13px;
          background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#fca5a5;}
      `}</style>

      <div className="esc-orb" style={{ top: '4%', left: '14%', width: 280, height: 280, background: 'rgba(56,135,235,.2)', filter: 'blur(100px)' }} />
      <div className="esc-orb" style={{ bottom: '4%', right: '14%', width: 320, height: 320, background: 'rgba(45,160,200,.15)', filter: 'blur(110px)' }} />

      {/* MARCA */}
      <div className="esc-brand">
        <h1>Escalágil</h1>
        <p>Plataforma inteligente para gestão de escalas, equipes e jornadas de trabalho de forma simples e organizada.</p>
        <div className="esc-feats">
          {features.map((f) => (
            <div className="esc-feat" key={f.label}>
              <div className="esc-feat-ico"><Icon d={f.d} size={20} sw={1.8} /></div>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CARD */}
      <div className="esc-card">
        <div className="esc-head">
          <h2>{isRegister ? 'Criar conta' : 'Acessar conta'}</h2>
          <p>{isRegister ? 'Preencha os dados para começar' : 'Bem-vindo de volta'}</p>
        </div>

        {error && <div className="esc-err">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="esc-field">
                <label className="esc-label">Usuário</label>
                <div className="esc-input">
                  <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
                  <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Como deseja ser chamado?" />
                </div>
              </div>
              <div className="esc-field">
                <label className="esc-label">Empresa</label>
                <div className="esc-input">
                  <Icon d="M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4 M9 9v.01 M9 12v.01 M9 15v.01" />
                  <input type="text" name="orgName" value={form.orgName} onChange={handleChange} placeholder="Nome da empresa" />
                </div>
              </div>
            </>
          )}

          <div className="esc-field">
            <label className="esc-label">Email</label>
            <div className="esc-input">
              <Icon d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6" />
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="Digite seu email" />
            </div>
          </div>

          <div className="esc-field">
            <label className="esc-label">Senha</label>
            <div className="esc-input">
              <Icon d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4" />
              <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required placeholder="Digite sua senha" />
              <button type="button" className="esc-eye" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                <Icon d={showPassword
                  ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22'
                  : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'} />
              </button>
            </div>
          </div>

          <button type="submit" className="esc-btn" disabled={loading}>
            {loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button className="esc-link" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Já tem conta? Entrar' : 'Criar nova conta'}
          </button>
        </div>

        {!isRegister && (
          <div className="esc-demo">
            <b>Demo:</b>
            <span>Email: demo@test.com</span>
            <span>Senha: 123456</span>
          </div>
        )}

        <p className="esc-foot">© 2026 Escalágil. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}