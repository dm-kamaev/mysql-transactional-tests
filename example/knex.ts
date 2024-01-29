import { startTransaction } from '../src/index';
import knex from 'knex';
const mysqlConfig = require('../test/mysql.config.json');

const db = knex({
  client: 'mysql',
  connection: mysqlConfig,
  pool: { min: 0, max: 7 }
});

void async function () {
  await db('employee').select('*');
  const { rollback } = await startTransaction();
  const resultInsert = await db('employee').insert({ first_name: 'Test', last_name: 'Test', age: 89, sex: 'man', income: 2242 });
  console.log(resultInsert);
  const resultCount = await db('employee').count('id');
  console.log({ resultCount });
  await rollback();
  await db.destroy();
}();