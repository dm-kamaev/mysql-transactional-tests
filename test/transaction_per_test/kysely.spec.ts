import { startTransaction, unPatch } from '../../src/mysql2';
import kyselyClient from '../client/kysely_client';
import { sql } from 'kysely';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

const mysqlClient = kyselyClient(mysqlConfig);

describe('[kysely]: transaction per test', () => {
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
    await mysqlClient
      .insertInto('employee')
      .values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 })
      .execute();
    const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();

    expect(result).toHaveLength(4);
  });

  it('update', async () => {
    const result = await mysqlClient
      .selectFrom('employee')
      .select(['id', 'age'])
      .where('first_name', '=', 'Lisa')
      .limit(1)
      .execute();
    expect(result).toHaveLength(1);

    await mysqlClient
      .updateTable('employee')
      .set({ age: sql`age + 1` })
      .where('id', '=', result[0].id)
      .execute();
    const result2 = await mysqlClient
      .selectFrom('employee')
      .select(['id', 'age'])
      .where('first_name', '=', 'Lisa')
      .limit(1)
      .executeTakeFirstOrThrow();
    expect(result2.age).toBe(result[0].age + 1);
  });

  it('delete', async () => {
    await mysqlClient.deleteFrom('employee').execute();
    const result = await mysqlClient.selectFrom('employee').select('employee.id').execute();
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    await mysqlClient.transaction().execute(async (trx) => {
      return await trx
        .insertInto('employee')
        .values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 })
        .execute();
    });
    const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result).toHaveLength(4);
  });

  it('insert: rollback', async () => {
    try {
      await mysqlClient.transaction().execute(async (trx) => {
        await trx
          .insertInto('employee')
          .values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 })
          .execute();
        throw new Error('Stop');
      });
    } catch (error) {
      const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
      expect(result).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    await mysqlClient.transaction().execute(async (trx) => {
      await trx
        .insertInto('employee')
        .values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 })
        .execute();
    });

    try {
      await mysqlClient.transaction().execute(async (trx) => {
        await trx
          .insertInto('employee')
          .values({ first_name: 'Test', last_name: 'Test', age: 45, sex: 'woman', income: 1100 })
          .execute();
        throw new Error('Error');
      });
    } catch (err) {
      // skip error
    }

    const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient
      .selectFrom('employee')
      .select('id')
      .where('first_name', '=', 'Test2')
      .limit(1)
      .execute();
    expect(not_found).toHaveLength(0);
  });
});
