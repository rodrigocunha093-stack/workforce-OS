/**
 * Edição manual de turno — a escala hoje é sempre recalculada do zero
 * (generateGroupedSchedule), então não existia onde persistir um ajuste
 * manual pontual ("troca o turno da Fulana na sexta pra 07:00-15:00").
 * Cada override é uma célula (empresa + colaborador + semana + dia) que
 * sobrescreve o turno gerado automaticamente pra aquela semana específica
 * — não altera a lógica de geração, só o resultado final exibido/exportado.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('schedule_overrides', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('employee_name', 200).notNullable();
    table.date('week_start').notNullable(); // segunda-feira da semana (mesma convenção de mondayOfWeek)
    table.integer('day_index').notNullable(); // 0=segunda..6=domingo
    table.string('shift_text', 200).notNullable(); // "07:00-15:00" ou "Folga"
    table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['company_id', 'employee_name', 'week_start', 'day_index']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('schedule_overrides');
};
