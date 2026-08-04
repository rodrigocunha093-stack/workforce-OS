/**
 * Campos de preferência de escala usados pelo motor (turno, papel
 * operacional, proficiência, setores aptos, restrições, folga
 * preferencial) — portados do projeto modelo. `proficiencia` já existia
 * com default 'pleno': aqui o default é removido a pedido explícito do
 * usuário — esse campo deve ficar vazio até o gestor escolher, nunca
 * preenchido sozinho, porque pesa na escolha de quem assume liderança
 * de turno.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('employees', (table) => {
    table.string('papel_operacional', 20).defaultTo('auto');
    table.specificType('setores_aptos', 'text[]');
    table.specificType('restricoes', 'text[]');
  });
  await knex.raw('ALTER TABLE employees ALTER COLUMN proficiencia DROP DEFAULT');
  await knex.raw('UPDATE employees SET proficiencia = NULL WHERE proficiencia = \'pleno\'');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw("ALTER TABLE employees ALTER COLUMN proficiencia SET DEFAULT 'pleno'");
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('papel_operacional');
    table.dropColumn('setores_aptos');
    table.dropColumn('restricoes');
  });
};
