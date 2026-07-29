import React, { useState, useEffect } from 'react';

const EMPTY_FORM = { name: '', email: '', password: '' };
const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;

export default function Usuarios() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

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

  useEffect(() => { loadUsers(); }, []);

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

  const c = {
    bg: '#0a0e1a', panel: 'rgba(255,255,255,0.035)', panelBorder: 'rgba(255,255,255,0.08)',
    text: '#e8eef5', muted: '#94a3b8', accent: '#38bdf8'
  };

  const containerStyle = { background: c.bg, minHeight: '100vh', padding: '28px 32px 48px', color: c.text, fontFamily: 'inherit' };
  const panelStyle = { background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: '14px', padding: '22px' };
  const inputStyle = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${c.panelBorder}`, background: 'rgba(255,255,255,0.04)', color: c.text, fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: c.muted, marginBottom: '6px' };
  const buttonStyle = { padding: '11px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8, #0369a1)', color: '#06121f', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' };
  const th = { textAlign: 'left', padding: '10px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: c.muted, borderBottom: `1px solid ${c.panelBorder}` };
  const td = { padding: '10px', fontSize: '13px', color: c.text, borderBottom: `1px solid ${c.panelBorder}` };
  const badgeStyle = (tone) => ({
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 600,
    background: tone === 'sky' ? 'rgba(56,189,248,0.15)' : tone === 'red' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.08)',
    color: tone === 'sky' ? '#38bdf8' : tone === 'red' ? '#f87171' : c.muted,
  });

  return (
    <div style={containerStyle}>
      <p style={{ margin: '0 0 8px', color: c.accent, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sua empresa</p>
      <h2 style={{ margin: '0 0 24px', fontSize: '26px', color: c.text, fontWeight: 700 }}>Usuários</h2>

      {error && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{error}</div>}
      {success && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7' }}>{success}</div>}

      <div style={{ ...panelStyle, maxWidth: '480px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: c.text }}>Adicionar usuário</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" style={inputStyle} value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Senha inicial</label>
            <input type="password" style={inputStyle} value={form.password} onChange={(e) => handleChange('password', e.target.value)} required />
          </div>
          <button type="submit" style={buttonStyle} disabled={submitting}>{submitting ? 'Criando...' : 'Criar usuário'}</button>
        </form>
      </div>

      <div style={panelStyle}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: c.text }}>Usuários cadastrados</h3>
        {loadingUsers ? (
          <p style={{ color: c.muted, fontSize: 13 }}>Carregando...</p>
        ) : users.length === 0 ? (
          <p style={{ color: c.muted, fontSize: 13 }}>Nenhum usuário cadastrado.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Nome</th>
                  <th style={th}>Email</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{u.name}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}><span style={badgeStyle(u.is_admin ? 'sky' : 'default')}>{u.is_admin ? 'Admin' : 'Usuário'}</span></td>
                    <td style={td}><span style={badgeStyle(u.ativo ? 'sky' : 'red')}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          style={{ padding: '5px 10px', borderRadius: '6px', background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ ...panelStyle, maxWidth: '380px', background: '#0d1420' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: c.text }}>Excluir usuário?</h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: c.muted }}>
              Isso vai excluir permanentemente <strong style={{ color: c.text }}>{deleteTarget.name}</strong> ({deleteTarget.email}). Essa ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '9px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: c.text, border: `1px solid ${c.panelBorder}`, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '9px 16px', borderRadius: '8px', background: '#dc2626', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
