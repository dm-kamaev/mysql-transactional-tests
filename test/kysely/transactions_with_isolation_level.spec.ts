import { startTransaction, unPatch } from '../../src/mysql2';
import kyselyClient, { KyselyClient } from '../client/kysely_client';
const mysqlConfig = require('../mysql.config.json');

describe('[kysely]: transaction with isolation level', () => {
  let mysqlClient: KyselyClient;
  let rollback;
  const isolationLevel = 'repeatable read';
  // const isolationLevel = 'read uncommitted';
  // const isolationLevel = 'read committed';
  // const isolationLevel = 'snapshot';
  // const isolationLevel = 'serializable';


  beforeEach(() => {
    mysqlClient = kyselyClient(mysqlConfig);
  });

  afterEach(async () => {
    await mysqlClient.destroy();
  });

  afterAll(() => {
    unPatch();
  });


  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transaction().setIsolationLevel(isolationLevel).execute(async (trx) => {
      return await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
    });
    const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());
    try {
      await mysqlClient.transaction().setIsolationLevel(isolationLevel).execute(async (trx) => {
        await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
        throw new Error('Stop');
      });
    } catch (error) {
      const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
      expect(result).toHaveLength(3);

      await rollback();

      const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
      expect(result2).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());

    await mysqlClient.transaction().setIsolationLevel(isolationLevel).execute(async (trx) => {
      await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
    });

    try {
      await mysqlClient.transaction().setIsolationLevel(isolationLevel).execute(async (trx) => {
        await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 45, sex: 'woman', income: 1100 }).execute();
        throw new Error('Error');
      });
    } catch (err) {
      // skip error
    }

    const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient.selectFrom('employee').select('id').where('first_name', '=', 'Test2').limit(1).execute();
    expect(not_found).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result2).toHaveLength(3);
  });

});
