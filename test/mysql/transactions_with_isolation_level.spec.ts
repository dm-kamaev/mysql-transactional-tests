import { startTransaction, unPatch } from '../../src/mysql';
import MySQLClient from '../client/mysql_client';
const mysqlConfig = require('../mysql.config.json');

describe('[mysql2]: transaction with isolation level', () => {
  let mysqlClient: MySQLClient;
  let rollback;
  const dbName = mysqlConfig.database;
  const isolationLevel = 'REPEATABLE READ';
  // const isolationLevel = 'READ UNCOMMITTED';
  // const isolationLevel = 'READ COMMITTED';
  // const isolationLevel = 'SERIALIZABLE';


  beforeEach(() => {
    mysqlClient = new MySQLClient(mysqlConfig);
  });

  afterEach(() => {
    mysqlClient.close();
  });

  afterAll(() => {
    unPatch();
  });


  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.beginTransaction({ isolationLevel });
    await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx.commit();

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.beginTransaction({ isolationLevel });
    await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx.rollback();

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(3);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx1 = await mysqlClient.beginTransaction({ isolationLevel });
    const trx2 = await mysqlClient.beginTransaction({ isolationLevel });

    await trx1.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx2.query(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);

    await trx2.rollback();
    await trx1.commit();

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
    expect(not_found).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
  });

});
