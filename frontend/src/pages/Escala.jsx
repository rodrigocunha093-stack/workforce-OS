import { useState, useEffect } from 'react';
import axios from 'axios';
import EscalaSchedule from '../components/EscalaSchedule';

export default function Escala({ token }) {
  const [schedule, setSchedule] = useState(null);
  const [demand, setDemand] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      console.error('Token não disponível');
      setLoading(false);
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Token:', token ? 'Presente' : 'Ausente');

      const api = axios.create({
        baseURL: '/api',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const [scheduleRes, demandRes, employeesRes] = await Promise.all([
        api.get('/schedule'),
        api.get('/schedule/demand?day=6'),
        api.get('/employees')
      ]);

      setSchedule(scheduleRes.data);
      setDemand(demandRes.data);
      setEmployees(employeesRes.data);
      console.log('Dados carregados com sucesso');
    } catch (err) {
      console.error('Erro ao carregar dados:', err.response?.status, err.response?.data);
      const errorMsg = err.response?.data?.error || err.message;
      if (err.response?.status === 400 || errorMsg.includes('Configure a loja')) {
        setError('Configure a loja em Implantação antes de gerar a escala');
      } else {
        setError(errorMsg || 'Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: '#0a0e1a',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#e8eef5'
      }}>
        <div style={{ fontSize: '18px' }}>Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#0a0e1a',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '25px 28px 38px'
      }}>
        <div style={{
          maxWidth: '500px',
          background: 'rgba(255, 59, 48, 0.1)',
          border: '1px solid rgba(255, 59, 48, 0.2)',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          color: '#e8eef5'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
          <h2 style={{ fontSize: '20px', margin: '0 0 12px', color: '#e8eef5' }}>Configuração necessária</h2>
          <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>
            {error}
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'implantacao' }))}
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              background: '#0369a1',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            Ir para Implantação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', padding: '25px 28px 38px' }}>
      {schedule && (
        <EscalaSchedule schedule={schedule.schedule} demand={demand} employees={employees} periodo={schedule.periodo} token={token} storeHours={schedule.storeHours} pdvs={schedule.storeHours?.pdvs} />
      )}
    </div>
  );
}
