const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA = path.join(__dirname, 'data');
const SQL = path.join(__dirname, 'sql', '001_multiempresa.sql');
const APPLY = process.argv.includes('--apply');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

async function main() {
  const status = await db.status();
  if (!status.connected) throw new Error(`PostgreSQL indisponível: ${status.error}`);

  const users = readJson(path.join(DATA, 'users.json'), []);
  const sessions = readJson(path.join(DATA, 'sessions.json'), {});
  const summary = {
    mode: APPLY ? 'apply' : 'audit',
    users: users.length,
    clientStates: users.filter((user) => fs.existsSync(path.join(DATA, 'clients', `${user.id}.json`))).length,
    sessions: Object.keys(sessions).length,
    auditEvents: users.reduce((sum, user) => sum + readJson(path.join(DATA, 'audit', `${user.id}.json`), []).length, 0)
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) {
    console.log('Auditoria concluída. Execute novamente com --apply para migrar.');
    return;
  }

  await db.pool.query(fs.readFileSync(SQL, 'utf8'));
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const user of users) {
      const state = readJson(path.join(DATA, 'clients', `${user.id}.json`), { profile: {}, employees: [], salesRows: [], updatedAt: null });
      const organizationName = state.profile?.empresa || `Organização de ${user.name}`;
      const organizationId = user.id;
      await client.query(
        `INSERT INTO app_organizations(id, name) VALUES ($1,$2)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`,
        [organizationId, organizationName]
      );
      await client.query(
        `INSERT INTO app_users(id, organization_id, name, email, password_salt, password_hash, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, organizationId, user.name, user.email, user.passwordSalt, user.passwordHash, user.createdAt]
      );
      await client.query(
        `INSERT INTO app_client_states(organization_id, profile, employees, sales_rows, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (organization_id) DO UPDATE SET profile=EXCLUDED.profile, employees=EXCLUDED.employees, sales_rows=EXCLUDED.sales_rows, updated_at=EXCLUDED.updated_at`,
        [organizationId, state.profile || {}, state.employees || [], state.salesRows || [], state.updatedAt]
      );
      for (const event of readJson(path.join(DATA, 'audit', `${user.id}.json`), [])) {
        await client.query(
          `INSERT INTO app_audit_events(organization_id, user_id, action, detail, created_at)
           SELECT $1,$2,$3,$4,$5
           WHERE NOT EXISTS (SELECT 1 FROM app_audit_events WHERE user_id=$2 AND action=$3 AND created_at=$5)`,
          [organizationId, user.id, event.action, event.detail || {}, event.at]
        );
      }
    }
    for (const [tokenHash, session] of Object.entries(sessions)) {
      await client.query(
        `INSERT INTO app_sessions(token_hash, user_id, expires_at) VALUES ($1,$2,to_timestamp($3 / 1000.0))
         ON CONFLICT (token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
        [tokenHash, session.userId, session.expiresAt]
      );
    }
    await client.query('COMMIT');
    console.log('Migração concluída. Os arquivos locais foram preservados como fallback.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.pool.end());
