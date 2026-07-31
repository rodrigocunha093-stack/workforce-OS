/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Em bancos novos, 001_init_schema.js já cria "companies" sem "cnpj"
  // (a coluna foi removida do schema inicial depois que essa migration foi
  // escrita) — sem esse guard, rodar do zero quebra aqui.
  const hasColumn = await knex.schema.hasColumn('companies', 'cnpj');
  if (!hasColumn) return;

  return knex.schema.table('companies', (table) => {
    table.dropColumn('cnpj');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('companies', (table) => {
    table.string('cnpj', 14);
  });
};
