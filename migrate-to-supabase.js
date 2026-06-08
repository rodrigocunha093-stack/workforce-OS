const { Pool } = require('pg');

const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'escala_5x2',
  user: 'postgres',
  password: 'Ro*3316479',
});

const targetPool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'Ro*3316479#',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Testando conexões...\n');
    
    const localTest = await sourcePool.query('SELECT version()');
    console.log('✓ Banco local conectado');
    
    const supabaseTest = await targetPool.query('SELECT version()');
    console.log('✓ Supabase conectado com sucesso!');
    
    const tables = await sourcePool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`\n✓ Tabelas no banco local: ${tables.rows.length}`);
    if (tables.rows.length > 0) {
      tables.rows.forEach(t => console.log(`  📊 ${t.table_name}`));
      console.log('\n📌 Próximos passos:');
      console.log('   1. Abra pgAdmin');
      console.log('   2. Clique direito em "escala_5x2" → Backup');
      console.log('   3. Salve o arquivo .sql');
      console.log('   4. Importe no Supabase Dashboard');
    } else {
      console.log('  (Nenhuma tabela encontrada)');
    }
    
    console.log('\n✅ Ambas as conexões estão funcionando!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

migrate();
