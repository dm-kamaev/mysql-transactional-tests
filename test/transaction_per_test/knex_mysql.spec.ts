import { startTransaction, unPatch } from '../../src/mysql';
import knexClient from '../client/knex_mysql_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

const mysqlClient = knexClient(mysqlConfig);

describe('[knex mysql]: transaction per test', () => {
  let rollback: () => Promise<void>;

  beforeEach(async () => {
    ({ rollback } = await startTransaction());
  });

  afterEach(async () => {
    await rollback();
  });

  afterAll(async () => {
    await mysqlClient.destroy();
    unPatch();
  });

  it('insert', async () => {
    await mysqlClient('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);
  });

  it('update', async () => {
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
  });

  it('delete', async () => {
    await mysqlClient('employee').del();
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    const trx = await mysqlClient.transaction();

    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.commit();

    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);
  });

  it('insert: rollback', async () => {
    const trx = await mysqlClient.transaction();
    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.rollback();

    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(3);
  });

  it('insert: commit (cb trx)', async () => {
    await mysqlClient.transaction(async (trx) => {
      await trx('employee').insert({ first_name: 'COmmit', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    });
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);
  });

  it('insert: rollback (cb trx)', async () => {
    try {
      await mysqlClient.transaction(async (trx) => {
        await trx('employee').insert({ first_name: 'ROllback', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        throw new Error('Test Rollback');
      });
    } catch (err) {
      const result = await mysqlClient('employee').select('*');
      expect(result).toHaveLength(3);
    }
  });
});
