import { startTransaction, unPatch, setDebug } from '../../src/mysql';
import MySQLClient from '../client/mysql_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[mysql]: set debug', () => {
  let mysqlClient: MySQLClient;
  let rollback;
  let mockConsoleLog;
  const dbName = mysqlConfig.database;

  beforeAll(() => {
    setDebug(true);
  });

  beforeEach(() => {
    console.log = mockConsoleLog = jest.fn();
    mysqlClient = new MySQLClient(mysqlConfig);
  });

  afterEach(() => {
    mysqlClient.close();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.query(
      `INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`,
    );

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);

    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
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

    await rollback();

    const result3: { id: number; age: number }[] = await mysqlClient.query(
      `SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`,
    );
    expect(result3[0].age).toEqual(age);

    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.query(`DELETE FROM ${dbName}.employee`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);

    expect(mockConsoleLog).toHaveBeenCalled();
  });
});
