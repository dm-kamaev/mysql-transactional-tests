import { IsolationLevel } from '../../src/lib';
import { startTransaction, unPatch } from '../../src/mysql2';
import MySQLClient from '../client/mysql2_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[mysql2]: set isolation level', () => {
  let mysqlClient: MySQLClient;
  let rollback;
  let isolationLevel: IsolationLevel;
  const dbName = mysqlConfig.database;

  beforeAll(() => {
    isolationLevel = 'READ COMMITTED';
    // isolationLevel = 'READ UNCOMMITTED';
    // isolationLevel = 'REPEATABLE READ';
    // isolationLevel = 'SERIALIZABLE';
    mysqlClient = new MySQLClient(mysqlConfig);
  });

  beforeEach(async () => {
    ({ rollback } = await startTransaction({ isolationLevel }));
  });

  afterEach(async () => {
    await rollback();
  });

  afterAll(async () => {
    mysqlClient.close();
    unPatch();
  });

  it('insert', async () => {
    await mysqlClient.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`,
    );
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);
  });

  it('update', async () => {
    const result: { id: number; age: number }[] = await mysqlClient.query(
      `SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`,
    );
    const { id, age } = result[0];
    expect(result).toHaveLength(1);

    await mysqlClient.query(`UPDATE ${dbName}.employee SET age=age+1 WHERE id = ${id}`);
    const result2: { id: number; age: number }[] = await mysqlClient.query(
      `SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`,
    );
    expect(result2[0].age).toBe(age + 1);
  });

  it('delete', async () => {
    await mysqlClient.query(`DELETE FROM ${dbName}.employee`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    const trx = await mysqlClient.beginTransaction();
    await trx.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`,
    );
    await trx.commit();
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);
  });

  it('insert: rollback', async () => {
    const trx = await mysqlClient.beginTransaction();
    await trx.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`,
    );
    await trx.rollback();
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(3);
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    const trx1 = await mysqlClient.beginTransaction();
    const trx2 = await mysqlClient.beginTransaction();

    await trx1.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`,
    );
    await trx2.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`,
    );

    await trx2.rollback();
    await trx1.commit();

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
    expect(not_found).toHaveLength(0);
  });
});
