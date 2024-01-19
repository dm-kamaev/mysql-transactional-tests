import { patchMySQL } from '../../src/index';
import MySQLClient from '../client/mysql_client';
const mysqlConfig = require('../mysql.config.json');

describe('[mysql]: queries with transaction', () => {
  let mysqlClient: MySQLClient;
  let unPatchMySQL, rollback;
  const dbName = mysqlConfig.database;

  // beforeAll(() => {
  //   ({ unPatchMySQL, rollback } = patchMySQL());
  //   mysqlClient = new MySQLClient(mysqlConfig);
  // });

  beforeEach(() => {
    ({ unPatchMySQL, rollback } = patchMySQL());
    mysqlClient = new MySQLClient(mysqlConfig);
  });

  afterEach(() => {
    mysqlClient.close();
  });



  it('insert: commit', async () => {
    const trx = await mysqlClient.beginTransaction();
    await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx.commit();
    console.log('After commit');
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('select all', result);
    expect(result).toHaveLength(4);
    await rollback();
    unPatchMySQL();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  it('insert: rollback', async () => {
    const trx = await mysqlClient.beginTransaction();
    await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx.rollback();
    console.log('After commit');
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('select all', result);
    expect(result).toHaveLength(3);
    await rollback();
    unPatchMySQL();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    const trx1 = await mysqlClient.beginTransaction();
    const trx2 = await mysqlClient.beginTransaction();

    await trx1.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    await trx2.query(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);

    await trx2.rollback();
    await trx1.commit();

    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('select all', result);
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
    expect(not_found).toHaveLength(0);

    await rollback();
    unPatchMySQL();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  // it('insert: two parallel transcation, one commit, one rollback. inverse close', async () => {
  //   const trx1 = await mysqlClient.beginTransaction();
  //   const trx2 = await mysqlClient.beginTransaction();

  //   await trx1.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
  //   await trx2.query(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);

  //   await trx1.commit();
  //   await trx2.rollback();

  //   const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
  //   console.log('select all', result);
  //   expect(result).toHaveLength(4);

  //   const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
  //   expect(not_found).toHaveLength(0);

  //   await rollback();
  //   unPatchMySQL();

  //   const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
  //   console.log('result 2', result2);
  //   expect(result2).toHaveLength(3);
  //   console.log(result2);
  // });

});
