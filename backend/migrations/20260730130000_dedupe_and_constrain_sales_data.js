/**
 * Mescla registros duplicados de sales_data (mesma empresa+data+hora) somando
 * clientes/itens/valor_total numa única linha, e cria uma constraint UNIQUE
 * pra impedir que voltem a existir duplicatas.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.raw(`
    WITH merged AS (
      SELECT
        company_id, data, hora,
        MIN(id) AS keep_id,
        SUM(clientes) AS clientes,
        SUM(itens) AS itens,
        SUM(valor_total) AS valor_total
      FROM sales_data
      GROUP BY company_id, data, hora
      HAVING COUNT(*) > 1
    )
    UPDATE sales_data s
    SET clientes = m.clientes,
        itens = m.itens,
        valor_total = m.valor_total
    FROM merged m
    WHERE s.id = m.keep_id
  `);

  await knex.raw(`
    DELETE FROM sales_data s
    USING sales_data s2
    WHERE s.company_id = s2.company_id
      AND s.data = s2.data
      AND s.hora = s2.hora
      AND s.id > s2.id
  `);

  await knex.schema.alterTable('sales_data', (table) => {
    table.unique(['company_id', 'data', 'hora']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('sales_data', (table) => {
    table.dropUnique(['company_id', 'data', 'hora']);
  });
};
