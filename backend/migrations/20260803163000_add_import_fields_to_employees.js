/**
 * Campos vindos da importação de equipe (CSV do cliente): CPF, horas
 * semanais e salário. O setor não vem mais do CSV — o cliente costuma
 * digitar nomes que não batem com o catálogo real de mercadológicos
 * sincronizado do ERP dele, e isso fazia o funcionário sumir
 * silenciosamente do dashboard ICOS. Agora o setor é escolhido em
 * Gerenciar Dados Importados a partir da lista real (`id_mercadologico`),
 * não digitado livremente.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.string('cpf', 20);
    table.integer('horas_semanais');
    table.decimal('salario', 10, 2);
    table.integer('id_mercadologico').references('mercadologicos.id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('employees', (table) => {
    table.dropColumn('cpf');
    table.dropColumn('horas_semanais');
    table.dropColumn('salario');
    table.dropColumn('id_mercadologico');
  });
};
