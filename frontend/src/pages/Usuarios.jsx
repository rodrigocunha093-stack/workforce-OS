import React, { useState, useEffect } from 'react';

/* ============================================================
   Usuários — Escalágil (redesign moderno)
   Mesma lógica/API do original, visual estilo Dribbble/NEONE.
   ============================================================ */

const EMPTY_FORM = { name: '', email: '', password: '' };

const STYLES = `
.eg-scope {
  --bg: #05070f;
  --bg-2: #080b16;
  --border: rgba(255,255,255,0.08);
  --text: #eaf1f9;
  --muted: #8c9bb3;
  --accent: #4aa8ff;
  position: relative;
  color: var(--text);
  background:
    radial-gradient(1200px 520px at 50% -260px, rgba(74,168,255,0.18), transparent 60%),
    radial-gradient(900px 500px at 50% -160px, rgba(124,92,255,0.12), transparent 55%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
  padding: 40px 32px 48px;
  font-family: inherit;
  overflow: hidden;
}
.eg-scope::before {
  content: '';
  position: absolute;
  top: 30px;              /* ← mudado de -340px para 0 */
  left: 50%;
  width: 900px;
  height: 420px;       /* ← reduzido de 760px para 420px */
  transform: translateX(-50%);
  border-radius: 50%;
  box-shadow: 0 0 140px 30px rgba(74,168,255,0.32);
  border-top: 2px solid rgba(120,190,255,0.5);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 42%);
          mask-image: linear-gradient(180deg, #000 0%, transparent 42%);
  pointer-events: none;
  animation: eg-breathe 6s ease-in-out infinite;
}
.eg-scope::after {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(800px 400px at 50% 0%, #000, transparent 70%);
          mask-image: radial-gradient(800px 400px at 50% 0%, #000, transparent 70%);
  opacity: .5; pointer-events: none;
}
@keyframes eg-breathe { 0%,100%{opacity:.8} 50%{opacity:1} }
@keyframes eg-rise { from{opacity:0; transform:translateY(18px)} to{opacity:1; transform:translateY(0)} }
@keyframes eg-pop { from{opacity:0; transform:scale(.96)} to{opacity:1; transform:scale(1)} }

.eg-inner { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; }

.eg-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  margin: 0 0 14px; padding: 5px 12px;
  border: 1px solid var(--border); border-radius: 999px;
  background: rgba(74,168,255,0.08); color: #bcd8ff;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em;
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

.eg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 24px; }

.eg-card {
  position: relative; border: 1px solid var(--border); border-radius: 20px; padding: 26px;
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  backdrop-filter: blur(14px);
  box-shadow: 0 30px 60px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06);
  animation: eg-rise .6s ease .15s both;
}
.eg-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1px;
  background: linear-gradient(140deg, rgba(74,168,255,0.5), transparent 35%, transparent 65%, rgba(124,92,255,0.4));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: .7;
}
.eg-h3 { margin: 0 0 18px; font-size: 16px; font-weight: 700; color: var(--text); }

.eg-field { margin-bottom: 16px; }
.eg-label { display:block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.eg-input {
  width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--border); background: rgba(255,255,255,0.03);
  color: var(--text); font-size: 14px; font-family: inherit; outline: none;
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.eg-input::placeholder { color: #56637a; }
.eg-input:focus { border-color: rgba(74,168,255,0.6); background: rgba(74,168,255,0.05); box-shadow: 0 0 0 4px rgba(74,168,255,0.12); }

.eg-btn {
  width: 100%; margin-top: 6px; padding: 13px 18px; border-radius: 12px; border: none;
  font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; color: #ffffff;
  background: linear-gradient(135deg, #6cc0ff, #3a7bff);
  box-shadow: 0 12px 28px -10px rgba(74,168,255,0.7), inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform .15s ease, box-shadow .2s ease, filter .2s; position: relative; overflow: hidden;
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

.eg-table-wrap { overflow-x: auto; margin: -6px; padding: 6px; }
.eg-table { width: 100%; border-collapse: collapse; }
.eg-table th {
  text-align: left; padding: 10px 12px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em; color: var(--muted);
  border-bottom: 1px solid var(--border);
}
.eg-table td { padding: 13px 12px; font-size: 13.5px; color: var(--text); border-bottom: 1px solid rgba(255,255,255,0.05); }
.eg-table tbody tr { transition: background .18s; }
.eg-table tbody tr:hover { background: rgba(74,168,255,0.05); }
.eg-name { font-weight: 600; }

.eg-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.eg-badge.sky { background: rgba(56,189,248,0.14); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.25); }
.eg-badge.red { background: rgba(248,113,113,0.12); color: #fca5a5; border: 1px solid rgba(248,113,113,0.25); }
.eg-badge.def { background: rgba(255,255,255,0.06); color: var(--muted); border: 1px solid var(--border); }
.eg-badge .bdot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.eg-del {
  padding: 6px 12px; border-radius: 9px; font-size: 11.5px; font-weight: 600; cursor: pointer;
  background: rgba(248,113,113,0.08); color: #f87171; border: 1px solid rgba(248,113,113,0.28);
  transition: background .18s, transform .12s;
}
.eg-del:hover { background: rgba(248,113,113,0.18); transform: translateY(-1px); }

.eg-empty { color: var(--muted); font-size: 13.5px; padding: 8px 0; }

.eg-alert { margin-bottom: 20px; padding: 12px 15px; border-radius: 12px; font-size: 13.5px; animation: eg-rise .3s ease both; }
.eg-alert.err { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.35); color: #fca5a5; }
.eg-alert.ok  { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.35); color: #6ee7b7; }

.eg-overlay {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(3,6,14,0.7); backdrop-filter: blur(6px); animation: eg-rise .2s ease both;
}
.eg-modal {
  position: relative; width: 100%; max-width: 400px; border-radius: 20px; padding: 26px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, #0d1524, #090d18);
  box-shadow: 0 40px 80px -30px rgba(0,0,0,0.9); animation: eg-pop .25s ease both;
}
.eg-modal h3 { margin: 0 0 10px; font-size: 17px; font-weight: 700; }
.eg-modal p { margin: 0 0 22px; font-size: 13.5px; color: var(--muted); line-height: 1.5; }
.eg-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.eg-cancel {
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
  background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--border); transition: background .18s;
}
.eg-cancel:hover { background: rgba(255,255,255,0.12); }
.eg-confirm {
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
  background: linear-gradient(135deg, #f87171, #dc2626); color: #fff; border: none;
  box-shadow: 0 12px 24px -10px rgba(220,38,38,0.7); transition: transform .12s;
}
.eg-confirm:hover:not(:disabled) { transform: translateY(-1px); }
.eg-confirm:disabled { filter: opacity(.7); cursor: default; }
`;

export default function Usuarios() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    setCurrentUserId(JSON.parse(localStorage.getItem('user') || '{}').id);
  }, []);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const loadCompanyName = async () => {
    try {
      const res = await fetch('/api/me', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCompanyName(data.user?.company_name || '');
      }
    } catch (err) {
      console.error('Erro ao carregar empresa:', err);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { loadUsers(); loadCompanyName(); }, []);

  const handleChange = (field, value) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário');
      setSuccess(`Usuário "${data.user.name}" criado com sucesso.`);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir usuário');
      setSuccess(`Usuário "${deleteTarget.name}" excluído.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="eg-scope">
      <style>{STYLES}</style>
      <div className="eg-inner">
        <span className="eg-eyebrow"><span className="dot" />{companyName || 'Sua empresa'}</span>
        <h2 className="eg-title">Usuários</h2>
        <p className="eg-sub">Adicione, visualize e gerencie o acesso da sua equipe.</p>

        {error && <div className="eg-alert err">{error}</div>}
        {success && <div className="eg-alert ok">{success}</div>}

        <div className="eg-grid">
          <div className="eg-card">
            <h3 className="eg-h3">Adicionar usuário</h3>
            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="eg-field">
                <label className="eg-label">Nome</label>
                <input className="eg-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
              </div>
              <div className="eg-field">
                <label className="eg-label">Email</label>
                <input type="email" autoComplete="new-email" className="eg-input" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
              </div>
              <div className="eg-field">
                <label className="eg-label">Senha inicial</label>
                <input type="password" autoComplete="new-password" className="eg-input" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" className="eg-btn" disabled={submitting}>
                {submitting ? 'Criando...' : 'Criar usuário'}
              </button>
            </form>
          </div>

          <div className="eg-card">
            <h3 className="eg-h3">Usuários cadastrados</h3>
            {loadingUsers ? (
              <p className="eg-empty">Carregando...</p>
            ) : users.length === 0 ? (
              <p className="eg-empty">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="eg-table-wrap">
                <table className="eg-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Tipo</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="eg-name">{u.name}</td>
                        <td>{u.email}</td>
                        <td><span className={`eg-badge ${u.is_admin ? 'sky' : 'def'}`}>{u.is_admin ? 'Admin' : 'Usuário'}</span></td>
                        <td><span className={`eg-badge ${u.ativo ? 'sky' : 'red'}`}><span className="bdot" />{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {u.id !== currentUserId && (
                            <button className="eg-del" onClick={() => setDeleteTarget(u)}>Excluir</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="eg-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="eg-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir usuário?</h3>
            <p>
              Isso vai excluir permanentemente <strong style={{ color: '#eaf1f9' }}>{deleteTarget.name}</strong> ({deleteTarget.email}). Essa ação não pode ser desfeita.
            </p>
            <div className="eg-modal-actions">
              <button className="eg-cancel" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="eg-confirm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
