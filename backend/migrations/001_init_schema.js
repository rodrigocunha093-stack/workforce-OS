/**
 * Initial schema setup
 * Replicates current database structure for version control
 */

exports.up = async function(knex) {
  // Tabela de empresas
  await knex.schema.createTable('companies', (table) => {
    table.increments('id').primary();
    table.string('name', 100).unique().notNullable();
    table.string('api_key_hash', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Tabela de usuários
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('email', 100).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['email']);
  });

  // Tabela de setores
  await knex.schema.createTable('setores', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('nome', 55).notNullable();
    table.integer('corredor');
    table.integer('erp_id');
  });

  // Tabela de colaboradores
  await knex.schema.createTable('employees', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('cargo', 100);
    table.integer('id_setor').references('setores.id');
    table.string('proficiencia', 20).defaultTo('pleno');
    table.string('turno', 20).defaultTo('flexivel');
    table.boolean('pode_domingo').defaultTo(true);
    table.string('folga_preferencial', 20);
    table.decimal('desempenho', 3, 1).defaultTo(3.0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['company_id']);
  });

  // Tabela de mercadológicos
  await knex.schema.createTable('mercadologicos', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('nome', 55).notNullable();
    table.integer('erp_id');
  });

  // Tabela de vínculo empregados_mercadologico
  await knex.schema.createTable('empregado_mercadologico', (table) => {
    table.increments('id').primary();
    table.integer('id_employee').notNullable().references('employees.id').onDelete('CASCADE');
    table.integer('id_mercadologico').notNullable().references('mercadologicos.id').onDelete('CASCADE');
  });

  // Tabela de horários da loja
  await knex.schema.createTable('store_hours', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('day_name', 20);
    table.time('open_time');
    table.time('close_time');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Tabela de dados de vendas (VRSoft)
  await knex.schema.createTable('sales_data', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.date('data');
    table.time('hora');
    table.integer('clientes');
    table.integer('itens');
    table.decimal('valor_total', 10, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.integer('erp_id');
    table.index(['company_id']);
  });

  // Tabela de escalas geradas
  await knex.schema.createTable('schedules', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.date('week_start');
    table.jsonb('schedule_data');
    table.string('status', 20).defaultTo('draft');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['company_id']);
  });

  // Tabela de workflow de escala
  await knex.schema.createTable('schedule_workflow', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('status', 20).defaultTo('rascunho');
    table.timestamp('reviewed_at');
    table.string('reviewed_by', 255);
    table.timestamp('published_at');
    table.string('published_by', 255);
    table.timestamp('completed_at');
    table.string('completed_by', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['company_id']);
    table.index(['company_id']);
  });

  // Tabela para períodos fechados
  await knex.schema.createTable('schedule_closed_period', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().references('companies.id').onDelete('CASCADE');
    table.string('label', 100);
    table.date('data_inicio');
    table.date('data_fim');
    table.string('cenario', 50);
    table.jsonb('schedule_data');
    table.timestamp('closed_at');
    table.string('closed_by', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['company_id']);
  });

  // Tabela de configuração da loja
  await knex.schema.createTable('store_setup', (table) => {
    table.increments('id').primary();
    table.integer('company_id').notNullable().unique().references('companies.id').onDelete('CASCADE');
    table.string('empresa', 255);
    table.string('loja', 255);
    table.string('regime_tributario', 50);
    table.integer('corredores').defaultTo(1);
    table.integer('pdvs').defaultTo(3);
    table.string('weekday_hours', 11);
    table.string('saturday_hours', 11);
    table.string('sunday_hours', 11);
    table.string('sunday_operation', 20);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  // Drop tables in reverse order of creation (due to FK constraints)
  await knex.schema.dropTableIfExists('store_setup');
  await knex.schema.dropTableIfExists('schedule_closed_period');
  await knex.schema.dropTableIfExists('schedule_workflow');
  await knex.schema.dropTableIfExists('schedules');
  await knex.schema.dropTableIfExists('sales_data');
  await knex.schema.dropTableIfExists('store_hours');
  await knex.schema.dropTableIfExists('empregado_mercadologico');
  await knex.schema.dropTableIfExists('mercadologicos');
  await knex.schema.dropTableIfExists('employees');
  await knex.schema.dropTableIfExists('setores');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('companies');
};
