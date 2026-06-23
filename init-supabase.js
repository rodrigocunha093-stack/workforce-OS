const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'Ro*3316479#',
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  try {
    console.log('🔄 Conectando ao Supabase...');
    const client = await pool.connect();
    
    console.log('✓ Conectado!\n');
    
    const sql = fs.readFileSync('./create-tables.sql', 'utf8');
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executando:', statement.trim().substring(0, 50) + '...');
        await client.query(statement);
      }
    }
    
    console.log('\n✅ Banco de dados inicializado com sucesso!');
    client.release();
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

initDatabase();
