import knex from 'knex';

export default function (config) {
  return knex({
    client: 'mysql',
    connection: config,
    pool: { min: 0, max: 7 }
  });
};