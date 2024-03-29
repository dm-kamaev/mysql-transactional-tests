import { startTransaction, unPatch } from '../../src/mysql2';
import type knex from 'knex';
import knexClient from '../client/knex_mysql2_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[knex mysql2]: transaction isolation level', () => {
  let mysqlClient: knex.Knex<any, unknown[]>;
  let rollback;
  const isolationLevel = 'repeatable read';
  // const isolationLevel = 'read uncommitted';
  // const isolationLevel = 'read committed';
  // const isolationLevel = 'snapshot';
  // const isolationLevel = 'serializable';

  beforeEach(() => {
    mysqlClient = knexClient(mysqlConfig);
  });

  afterEach(async () => {
    await mysqlClient.destroy();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction({ isolationLevel });
    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.commit();
    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });

  it('insert: commit (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transaction(
      async (trx) => {
        await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
      },
      { isolationLevel },
    );

    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction({ isolationLevel });
    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.rollback();

    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(3);
    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    try {
      await mysqlClient.transaction(
        async (trx) => {
          await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
          throw new Error('Test Rollback');
        },
        { isolationLevel },
      );
    } catch (err) {
      const result = await mysqlClient('employee').select('*');
      expect(result).toHaveLength(3);

      await rollback();

      const result2 = await mysqlClient('employee').select('*');
      expect(result2).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx1 = await mysqlClient.transaction({ isolationLevel });
    const trx2 = await mysqlClient.transaction({ isolationLevel });

    await trx1('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx2('employee').insert({ first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 11000 });

    await trx2.rollback();
    await trx1.commit();

    const result = await mysqlClient('employee').select('*');
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient('employee').select('*').where('first_name', '=', 'Test2').limit(1);
    expect(not_found).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient('employee').select('*');
    expect(result2).toHaveLength(3);
  });
});
