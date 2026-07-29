const pool = require('../db/postgres');

// Registra um evento de auditoria (login, criação/ativação de usuário,
// troca de senha). Nunca deve derrubar a requisição principal se falhar.
async function logActivity({ companyId, userId = null, eventType, description, performedBy }) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (company_id, user_id, event_type, description, performed_by) VALUES ($1, $2, $3, $4, $5)',
      [companyId, userId, eventType, description, performedBy]
    );
  } catch (err) {
    console.error('Erro ao registrar log de atividade:', err.message);
  }
}

module.exports = { logActivity };
