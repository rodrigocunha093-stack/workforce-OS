import { useState, useEffect, Fragment } from 'react';
import {
  Shield, Building2, AlertCircle, Loader2, Check, Lock, LogOut, Plus, Users, X,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, UserPlus, Eye, EyeOff, ScrollText, Pencil, Trash2
} from 'lucide-react';

// Painel interno da Contagil — uso exclusivo do setor administrativo.
// Totalmente separado do app do cliente: login próprio, token próprio
// (chave de localStorage diferente), sem Sidebar/menu do Escalágil.
// Só acessível em /admin-plataforma.

const TOKEN_KEY = 'contagil_platform_token';
const EMPTY_COMPANY_FORM = { companyName: '', clientId: '', adminName: '', adminEmail: '', adminPassword: '' };

// Transforma texto livre em slug: minúsculas, espaços/underscores viram
// hífen, remove acentos e qualquer caractere que não seja a-z0-9-.
// Usado enquanto o usuário digita: não corta hífen no final, senão fica
// impossível digitar "palavra-" e continuar (o hífen sempre seria o último
// caractere naquele instante e seria removido a cada tecla).
function toSlug(value) {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

function Alert({ variant = 'default', children }) {
  const styles = {
    default: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
    destructive: 'border-red-900 bg-red-950/40 text-red-300',
  };
  const Icon = variant === 'destructive' ? AlertCircle : Check;
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${styles[variant]}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300',
    sky: 'bg-sky-500/15 text-sky-400',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function Card({ children, className = '' }) {
  return <div className={`bg-white/[0.035] border border-white/[0.08] rounded-xl ${className}`}>{children}</div>;
}

function Input({ autoComplete = 'off', ...props }) {
  return (
    <input
      autoComplete={autoComplete}
      {...props}
      className={`admin-input w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${props.className || ''}`}
    />
  );
}

function Label({ children }) {
  return <label className="block text-xs font-semibold text-slate-400 mb-1.5">{children}</label>;
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-60',
    outline: 'border border-slate-700 text-slate-200 hover:bg-slate-800',
    ghost: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, description, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0d1420] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const loginGateStyles = `
  .adm-wrap{
    position:relative;min-height:100vh;display:flex;flex-direction:column;
    align-items:center;justify-content:center;padding:24px 20px;overflow:hidden;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    background:radial-gradient(1200px 600px at 50% -10%, #15365c 0%, transparent 60%),
               linear-gradient(160deg,#102a4a 0%,#0a1c33 100%);
  }
  .adm-orb{position:absolute;border-radius:50%;pointer-events:none;}
  .adm-brand{position:relative;text-align:center;max-width:460px;margin-bottom:30px;color:#eaf1fb;}
  .adm-brand h1{
    font-size:40px;font-weight:900;letter-spacing:-1.5px;margin:14px 0 10px;
    color:#ffffff;text-shadow:0 10px 30px rgba(0,0,0,.4), 0 0 20px rgba(59,130,246,.2);
  }
  .adm-brand p{font-size:14px;line-height:1.55;color:rgba(214,228,247,.62);margin:0;}

  .adm-card{
    position:relative;width:100%;max-width:380px;padding:30px 30px 26px;border-radius:18px;
    background:linear-gradient(180deg,#16335a 0%,#102a4d 100%);
    border:1.5px solid rgba(96,165,250,.4);
    box-shadow:0 25px 60px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08);
  }
  .adm-head{text-align:center;margin-bottom:22px;}
  .adm-head h2{font-size:21px;font-weight:700;color:#f3f7fd;margin:0 0 5px;}
  .adm-head p{font-size:13px;color:rgba(214,228,247,.58);margin:0;}

  .adm-field{margin-bottom:15px;}
  .adm-label{display:block;font-size:12.5px;font-weight:600;color:#dbe6f5;margin-bottom:7px;}
  .adm-input{
    display:flex;align-items:center;gap:10px;width:100%;padding:11px 13px;border-radius:10px;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);
    color:rgba(214,228,247,.6);box-sizing:border-box;transition:.16s;
  }
  .adm-input:focus-within{
    border-color:#3b82f6;color:#3b82f6;background:rgba(59,130,246,.08);
    box-shadow:0 0 0 3px rgba(59,130,246,.18);
  }
  .adm-input input{
    flex:1;border:none;outline:none;background:transparent;font-size:14px;color:#f3f7fd;
  }
  .adm-input input::placeholder{color:rgba(214,228,247,.4);}
  .adm-input input:-webkit-autofill,
  .adm-input input:-webkit-autofill:hover,
  .adm-input input:-webkit-autofill:focus{
    -webkit-text-fill-color:#f3f7fd;
    -webkit-box-shadow:0 0 0 1000px transparent inset;
    transition:background-color 9999s ease-in-out 0s;
    caret-color:#f3f7fd;
  }
  .adm-eye{border:none;background:none;cursor:pointer;padding:0;display:flex;color:rgba(214,228,247,.55);}
  .adm-eye:hover{color:#cfe0f7;}

  .adm-btn{
    width:100%;padding:12px;border-radius:10px;background:#2563eb;color:#fff;border:none;
    font-weight:600;font-size:15px;cursor:pointer;margin-top:4px;transition:.16s;
    display:flex;align-items:center;justify-content:center;gap:8px;
  }
  .adm-btn:hover:not(:disabled){background:#1d4ed8;}
  .adm-btn:disabled{opacity:.7;cursor:default;}

  .adm-foot{margin-top:18px;text-align:center;font-size:11.5px;color:rgba(214,228,247,.45);}
  .adm-err{margin-bottom:16px;padding:10px 14px;border-radius:8px;font-size:13px;
    background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#fca5a5;
    display:flex;align-items:center;gap:8px;}
`;

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
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-wrap">
      <style>{loginGateStyles}</style>

      <div className="adm-orb" style={{ top: '4%', left: '14%', width: 280, height: 280, background: 'rgba(56,135,235,.2)', filter: 'blur(100px)' }} />
      <div className="adm-orb" style={{ bottom: '4%', right: '14%', width: 320, height: 320, background: 'rgba(45,160,200,.15)', filter: 'blur(110px)' }} />

      <div className="adm-brand">
        <Shield className="h-12 w-12 mx-auto text-sky-400" />
        <h1>Painel Administrativo</h1>
        <p>Contagil — acesso restrito à equipe interna, para gestão das empresas clientes do Escalágil.</p>
      </div>

      <div className="adm-card">
        <div className="adm-head">
          <h2>Acessar conta</h2>
          <p>Restrito à equipe Contagil</p>
        </div>

        {error && <div className="adm-err"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="adm-field">
            <label className="adm-label">Email</label>
            <div className="adm-input">
              <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="Digite seu email" />
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">Senha</label>
            <div className="adm-input">
              <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Digite sua senha" />
              <button type="button" className="adm-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" className="adm-btn" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? 'Entrando...' : 'Acessar'}
          </button>
        </form>

        <p className="adm-foot">© 2026 Escalágil · Painel Contagil</p>
      </div>
    </div>
  );
}

const EMPTY_USER_FORM = { name: '', email: '', password: '', isAdmin: false };

function CompaniesPanel({ token, onLogout }) {
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

  return (
    <div style={{ background: '#0a0e1a', height: '100vh', overflow: 'hidden' }}>
      <nav className="navbar-gradient" style={{
        background: '#0d171e',
        padding: '16px 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: '76px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%', width: '100%' }}>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-sky-400" />
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#e8eef5' }}>Painel Administrativo Contagil</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Gerenciamento de empresas clientes</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 14px',
              background: 'rgba(59,130,246,0.15)',
              color: '#0ea5e9',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </nav>

      <main
        className="max-w-6xl mx-auto px-4 py-6 w-full"
        style={{ marginTop: '76px', height: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="space-y-4 shrink-0">
          {error && <Alert variant="destructive">{error}</Alert>}
          {success && <Alert>{success}</Alert>}

          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-medium text-slate-400 mb-2">Empresas Cadastradas</p>
              <div className="flex items-center gap-2">
                <Building2 className="h-8 w-8 text-sky-400" />
                <span className="text-3xl font-bold text-slate-100">{companies.length}</span>
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-slate-400 mb-2">Usuários Totais</p>
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-emerald-400" />
                <span className="text-3xl font-bold text-slate-100">
                  {companies.reduce((sum, c) => sum + c.user_count, 0)}
                </span>
              </div>
            </Card>
            <Card className="p-5 flex items-center">
              <Button className="w-full" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" /> Nova Empresa
              </Button>
            </Card>
          </div>
        </div>

        {/* Companies Table */}
        <Card className="mt-6 flex flex-col overflow-hidden" style={{ minHeight: 0, flex: 1 }}>
          <div className="p-5 border-b border-white/[0.08] shrink-0">
            <h2 className="text-base font-bold text-slate-100">Empresas Cadastradas</h2>
            <p className="text-sm text-slate-400 mt-0.5">Empresas clientes e status de integração com o agente</p>
          </div>
          <div className="p-5 overflow-y-auto" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-md bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Nenhuma empresa cadastrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-white/[0.08]">
                      <th className="pb-2 pr-4 font-medium w-8"></th>
                      <th className="pb-2 pr-4 font-medium">#</th>
                      <th className="pb-2 pr-4 font-medium">Empresa</th>
                      <th className="pb-2 pr-4 font-medium">client_id</th>
                      <th className="pb-2 pr-4 font-medium">Usuários</th>
                      <th className="pb-2 font-medium">Criada em</th>
                      <th className="pb-2 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((comp) => {
                      const isExpanded = expandedCompanyId === comp.id;
                      const users = companyUsers[comp.id] || [];
                      return (
                        <Fragment key={comp.id}>
                          <tr
                            className="border-b border-white/[0.06] hover:bg-white/[0.03] cursor-pointer"
                            onClick={() => toggleExpand(comp.id)}
                          >
                            <td className="py-3 pl-1 text-slate-500">
                              {loadingUsersId === comp.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">#{comp.id}</td>
                            <td className="py-3 pr-4 font-medium text-slate-100">{comp.name}</td>
                            <td className="py-3 pr-4">
                              {editingClientId === comp.id ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    autoFocus
                                    value={clientIdDraft}
                                    onChange={(e) => setClientIdDraft(toSlug(e.target.value))}
                                    className="!py-1 !px-2 text-xs w-32"
                                  />
                                  <button
                                    onClick={() => saveClientId(comp.id)}
                                    disabled={savingClientId}
                                    className="text-emerald-400 hover:text-emerald-300"
                                    title="Salvar"
                                  >
                                    {savingClientId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </button>
                                  <button onClick={() => setEditingClientId(null)} className="text-slate-500 hover:text-slate-300" title="Cancelar">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group">
                                  {comp.client_id
                                    ? <Badge tone="sky"><code>{comp.client_id}</code></Badge>
                                    : <Badge>não configurado</Badge>}
                                  <button
                                    onClick={(e) => startEditClientId(comp, e)}
                                    className="
                                      appearance-none
                                      border-0
                                      bg-transparent
                                      p-0
                                      text-slate-500
                                      hover:text-sky-400
                                      opacity-60
                                      hover:opacity-100
                                    "
                                    title="Editar client_id"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-slate-300">{comp.user_count}</td>
                            <td className="py-3 text-slate-400">{new Date(comp.created_at).toLocaleDateString('pt-BR')}</td>
                            <td className="py-3 text-right">
                              <button
                                title="Excluir empresa"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteCompanyTarget(comp);
                                }}
                                className="
                                  appearance-none
                                  border-0
                                  bg-transparent
                                  p-0
                                  text-slate-400
                                  hover:text-red-400
                                "
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${comp.id}-expanded`} className="border-b border-white/[0.06] bg-black/[0.15]">
                              <td colSpan={7} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Usuários de {comp.name}
                                  </h4>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      className="!py-1.5 !px-3 text-xs"
                                      onClick={(e) => { e.stopPropagation(); openLogs(comp); }}
                                    >
                                      <ScrollText className="h-3.5 w-3.5" /> Logs
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="!py-1.5 !px-3 text-xs"
                                      onClick={(e) => { e.stopPropagation(); setNewUserCompanyId(comp.id); setUserForm(EMPTY_USER_FORM); }}
                                    >
                                      <UserPlus className="h-3.5 w-3.5" /> Novo Usuário
                                    </Button>
                                  </div>
                                </div>
                                {users.length === 0 ? (
                                  <p className="text-sm text-slate-500 text-center py-4">Nenhum usuário cadastrado</p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-white/[0.08]">
                                        <th className="pb-2 pr-4 font-medium">Nome</th>
                                        <th className="pb-2 pr-4 font-medium">Email</th>
                                        <th className="pb-2 pr-4 font-medium">Tipo</th>
                                        <th className="pb-2 pr-4 font-medium">Status</th>
                                        <th className="pb-2 font-medium text-right">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {users.map((u) => (
                                        <tr key={u.id} className="border-b border-white/[0.05]">
                                          <td className="py-2.5 pr-4 font-medium text-slate-100">{u.name}</td>
                                          <td className="py-2.5 pr-4 text-slate-300">{u.email}</td>
                                          <td className="py-2.5 pr-4">
                                            <Badge tone={u.is_admin ? 'sky' : 'slate'}>{u.is_admin ? 'Admin' : 'Usuário'}</Badge>
                                          </td>
                                          <td className="py-2.5 pr-4">
                                            <Badge tone={u.ativo ? 'sky' : 'slate'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                          </td>
                                          <td className="py-2.5 text-right">
                                            <button
                                              title={u.ativo ? 'Desativar' : 'Ativar'}
                                              onClick={() => handleToggleUserAtivo(u.id, comp.id)}
                                              className="text-slate-400 hover:text-slate-100"
                                            >
                                              {u.ativo
                                                ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                                                : <ToggleLeft className="h-5 w-5" />}
                                            </button>
                                            <button
                                              title="Excluir usuário"
                                              onClick={() => setDeleteUserTarget({ user: u, companyId: comp.id })}
                                              className="ml-3 p-0 border-0 bg-transparent text-slate-400 hover:text-red-400 inline-flex items-center justify-center"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
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
        </Card>
      </main>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Nova Empresa"
        description="Crie a empresa e o primeiro usuário administrador dela"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 p-4 rounded-lg bg-black/[0.2] border border-white/[0.08]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Building2 className="h-4 w-4" /> Dados da Empresa
            </div>
            <div>
              <Label>Nome da Empresa</Label>
              <Input placeholder="Ex: Mercado Feirão" value={form.companyName} onChange={(e) => handleChange('companyName', e.target.value)} required />
            </div>
            <div>
              <Label>client_id (usado pelo agente do cliente)</Label>
              <Input
                placeholder="ex: mercado-feirao"
                value={form.clientId}
                onChange={(e) => handleChange('clientId', toSlug(e.target.value))}
              />
              <p className="text-xs text-slate-500 mt-1">Opcional aqui — pode deixar em branco e configurar depois. Só letras minúsculas, números e hífen.</p>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-black/[0.2] border border-white/[0.08]">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Users className="h-4 w-4" /> Primeiro Usuário (Administrador)
            </div>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
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
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input type="checkbox" checked={userForm.isAdmin} onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })} />
            Administrador (acessa Implantação e cria outros usuários)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewUserCompanyId(null)}>Cancelar</Button>
            <Button type="submit" disabled={creatingUser}>
              {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
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
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <Badge tone={log.event_type.includes('failed') || log.event_type.includes('blocked') || log.event_type === 'user_deactivated' ? 'sky' : 'sky'}>
                    {EVENT_LABELS[log.event_type] || log.event_type}
                  </Badge>
                  <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-sm text-slate-200">{log.description}</p>
                <p className="text-xs text-slate-500 mt-1">por {log.performed_by}</p>
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
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>Cancelar</Button>
          <Button
            onClick={handleDeleteUser}
            disabled={deletingUser}
            className="!bg-red-600 hover:!bg-red-500 !text-white"
          >
            {deletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deletingUser ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={deleteCompanyTarget !== null}
        onClose={() => setDeleteCompanyTarget(null)}
        title="Excluir empresa?"
        description={
          deleteCompanyTarget
            ? `Excluir ${deleteCompanyTarget.name} removerá a empresa e seus usuários.`
            : ''
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDeleteCompanyTarget(null)}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleDeleteCompany}
            disabled={deletingCompany}
            className="!bg-red-600 hover:!bg-red-500 !text-white"
          >
            {deletingCompany ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            {deletingCompany ? 'Excluindo...' : 'Excluir Empresa'}
          </Button>
        </div>
      </Modal>
    </div>
  );
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

// Neutraliza o fundo branco que o Chrome/Edge aplicam em campos preenchidos
// por autofill/gerenciador de senhas, mantendo o tema escuro da página.
const autofillFixStyles = `
  .admin-input:-webkit-autofill,
  .admin-input:-webkit-autofill:hover,
  .admin-input:-webkit-autofill:focus {
    -webkit-text-fill-color: #f1f5f9;
    -webkit-box-shadow: 0 0 0 1000px #020617 inset;
    transition: background-color 9999s ease-in-out 0s;
    caret-color: #f1f5f9;
  }
`;

export default function AdminPlatform() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <>
      <style>{autofillFixStyles}</style>
      {token ? <CompaniesPanel token={token} onLogout={handleLogout} /> : <LoginGate onLogin={setToken} />}
    </>
  );
}
