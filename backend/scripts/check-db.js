const db = require('./db');

(async () => {
  const connection = await db.status();
  console.log(JSON.stringify(connection, null, 2));
  if (connection.connected) {
    console.log(`Linhas de demanda: ${(await db.loadDemandRows()).length}`);
    console.log(`Cenários: ${(await db.loadScenarios()).length}`);
  }
  await db.pool.end();
  process.exit(connection.connected ? 0 : 1);
})();
