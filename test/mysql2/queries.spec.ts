import { startTransaction, unPatch } from '../../src/mysql2';
import MySQLClient from '../client/mysql2_client';
const mysqlConfig = require('../mysql.config.json');

describe('[mysql2]: queries', () => {
  let mysqlClient: MySQLClient;
  let rollback;
  const dbName = mysqlConfig.database;

  beforeEach(() => {
    mysqlClient = new MySQLClient({ ...mysqlConfig, debug: false });
  });

  afterEach(() => {
    mysqlClient.close();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
    const result: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await mysqlClient.query(`UPDATE ${dbName}.employee SET age=age+1 WHERE id = ${id}`);
    const result2: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    expect(result2[0].age).toBe(age+1);

    await rollback();

    const result3: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    expect(result3[0].age).toEqual(age);
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.query(`DELETE FROM ${dbName}.employee`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
  });

});
