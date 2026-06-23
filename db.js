// PostgreSQL direct connection - replaced by Supabase REST API
// This module returns demo/empty data without attempting any DB connection

async function status() {
  return {
    connected: false,
    host: 'supabase-rest',
    port: 443,
    database: 'supabase-rest-api',
    error: null,
    mode: 'rest'
  };
}

async function loadDemandRows() {
  return [];
}

async function loadScenarios() {
  return [];
}

async function appPersistenceStatus() {
  return {
    mode: 'supabase-rest',
    ready: true,
    existing: ['users', 'clients', 'sessions', 'audit'],
    required: ['users', 'clients', 'sessions', 'audit']
  };
}

module.exports = { status, loadDemandRows, loadScenarios, appPersistenceStatus };
