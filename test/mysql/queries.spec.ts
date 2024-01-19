import { patchMySQL } from '../../src/index';
import MySQLClient from '../client/mysql_client';
const mysqlConfig = require('../mysql.config.json');

describe('[mysql]: queries', () => {
  let mysqlClient: MySQLClient;
  let unPatchMySQL, rollback;
  const dbName = mysqlConfig.database;

  beforeEach(() => {
    ({ unPatchMySQL, rollback } = patchMySQL());
    mysqlClient = new MySQLClient(mysqlConfig);
  });

  afterEach(() => {
    mysqlClient.close();
  });

  // afterAll(async () => {
  //   // await rollback();
  //   // unPatchMySQL();
  //   mysqlClient.close();
  // });


  // before(() => {
  //   process.env.KNEX_PATH = '../knex.js';
  // });


  it('insert', async () => {
    await mysqlClient.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('select all', result);
    expect(result).toHaveLength(4);
    await rollback();
    unPatchMySQL();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  it('update', async () => {
    const result: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    console.log('origin', result);
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await mysqlClient.query(`UPDATE ${dbName}.employee SET age=age+1 WHERE id = ${id}`);
    const result2: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    console.log('after update', result2);
    expect(result2[0].age).toBe(age+1);
    await rollback();
    unPatchMySQL();

    const result3: { id: number, age: number }[] = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
    expect(result3[0].age).toEqual(age);
    console.log('rollback to', result3);
  });

  it('delete', async () => {
    await mysqlClient.query(`DELETE FROM ${dbName}.employee`);
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    console.log('select all', result);
    expect(result).toHaveLength(0);
    await rollback();
    unPatchMySQL();

    const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

});
