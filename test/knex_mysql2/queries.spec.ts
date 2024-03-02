import { startTransaction, unPatch } from '../../src/mysql2';
import type knex from 'knex';
import knexClient from '../client/knex_mysql2_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[knex mysql2]: queries', () => {
  let mysqlClient: knex.Knex<any, unknown[]>;
  let rollback;

  beforeEach(() => {
    mysqlClient = knexClient(mysqlConfig);
  });

  afterEach(async () => {
    await mysqlClient.destroy();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
    const result: { id: number; age: number }[] = await mysqlClient('employee')
      .select('*')
      .where('first_name', '=', 'Lisa')
      .limit(1);
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await mysqlClient('employee').increment('age', 1).where({ id });
    const result2: { id: number; age: number }[] = await mysqlClient('employee')
      .select('*')
      .where('first_name', '=', 'Lisa')
      .limit(1);
    expect(result2[0].age).toBe(age + 1);

    await rollback();

    const result3: { id: number; age: number }[] = await mysqlClient('employee')
      .select('*')
      .where('first_name', '=', 'Lisa')
      .limit(1);
    expect(result3[0].age).toEqual(age);
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient('employee').del();
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });
});
