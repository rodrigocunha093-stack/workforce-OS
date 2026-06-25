import { useState, useEffect } from 'react';
import axios from 'axios';
import EscalaSchedule from '../components/EscalaSchedule';

export default function Escala({ token }) {
  const [schedule, setSchedule] = useState(null);
  const [demand, setDemand] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [scheduleRes, demandRes, employeesRes] = await Promise.all([
        api.get('/schedule'),
        api.get('/schedule/demand?day=6'),
        api.get('/employees')
      ]);

      setSchedule(scheduleRes.data);
      setDemand(demandRes.data);
      setEmployees(employeesRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
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

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', padding: '25px 28px 38px' }}>
      {schedule && (
        <EscalaSchedule schedule={schedule.schedule} demand={demand} employees={employees} periodo={schedule.periodo} token={token} />
      )}
    </div>
  );
}
