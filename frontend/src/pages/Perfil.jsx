import React, { useState, useEffect } from 'react';

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

      // Atualiza o nome exibido no App (navbar) sem precisar relogar
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

  const c = {
    bg: '#0a0e1a', panel: 'rgba(255,255,255,0.035)', panelBorder: 'rgba(255,255,255,0.08)',
    text: '#e8eef5', muted: '#94a3b8', accent: '#38bdf8'
  };

  const containerStyle = { background: c.bg, minHeight: '100vh', padding: '28px 32px 48px', color: c.text, fontFamily: 'inherit' };
  const panelStyle = { background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: '14px', padding: '22px', maxWidth: '480px' };
  const inputStyle = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${c.panelBorder}`, background: 'rgba(255,255,255,0.04)', color: c.text, fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const disabledInputStyle = { ...inputStyle, color: c.muted, cursor: 'not-allowed' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: c.muted, marginBottom: '6px' };
  const buttonStyle = { padding: '11px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8, #0369a1)', color: '#06121f', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' };

  return (
    <div style={containerStyle}>
      <p style={{ margin: '0 0 8px', color: c.accent, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Minha conta</p>
      <h2 style={{ margin: '0 0 24px', fontSize: '26px', color: c.text, fontWeight: 700 }}>Perfil</h2>

      <div style={panelStyle}>
        {error && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5' }}>{error}</div>}
        {success && <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#6ee7b7' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={disabledInputStyle} value={email} disabled />
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${c.panelBorder}`, margin: '4px 0' }} />

          <p style={{ margin: 0, fontSize: '12px', color: c.muted }}>Deixe em branco se não quiser trocar a senha</p>

          <div>
            <label style={labelStyle}>Senha atual</label>
            <input type="password" style={inputStyle} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label style={labelStyle}>Nova senha</label>
            <input type="password" style={inputStyle} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>

          <button type="submit" style={buttonStyle} disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar alterações'}</button>
        </form>
      </div>
    </div>
  );
}
