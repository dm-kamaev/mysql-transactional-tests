import { startTransaction, unPatch } from '../../src/mysql';
import type knex from 'knex';
import knexClient from '../client/knex_mysql_client';
const mysqlConfig = require('../mysql.config.json');


describe('[knex mysql]: queries with transaction', () => {
  let mysqlClient: knex.Knex<any, unknown[]>;
  let rollback;

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
    const trx = await mysqlClient.transaction();
    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.commit();
    console.log('After commit');
    const result = await mysqlClient('employee').select(`*`);
    console.log('select all', result);
    expect(result).toHaveLength(4);
    await rollback();
    // unPatchMySQL();

    const result2 = await mysqlClient('employee').select(`*`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

   it('insert: commit (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transaction(async (trx) => {
      await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    });
    console.log('After commit');
    const result = await mysqlClient('employee').select(`*`);
    console.log('select all', result);
    expect(result).toHaveLength(4);

    await rollback();
    // unPatchMySQL();

    const result2 = await mysqlClient('employee').select(`*`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction();
    await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx.rollback();
    console.log('After commit');
    const result =  await mysqlClient('employee').select(`*`);
    console.log('select all', result);
    expect(result).toHaveLength(3);
    await rollback();
    // unPatchMySQL();

    const result2 = await mysqlClient('employee').select(`*`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

  it('insert: rollback (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    try {
      await mysqlClient.transaction(async (trx) => {
        await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        throw Error('Test Rollback');
      });
    } catch (err) {
      console.log('After commit');
      const result =  await mysqlClient('employee').select(`*`);
      console.log('select all', result);
      expect(result).toHaveLength(3);
      await rollback();
      // unPatchMySQL();

      const result2 = await mysqlClient('employee').select(`*`);
      console.log('result 2', result2);
      expect(result2).toHaveLength(3);
      console.log(result2);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx1 = await mysqlClient.transaction();
    const trx2 = await mysqlClient.transaction();

    await trx1('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await trx2('employee').insert({ first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 11000 });

    await trx2.rollback();
    await trx1.commit();

    const result = await mysqlClient('employee').select(`*`);
    console.log('select all', result);
    expect(result).toHaveLength(4);

    const not_found = await mysqlClient('employee').select(`*`).where('first_name', '=', 'Test2').limit(1);
    expect(not_found).toHaveLength(0);

    await rollback();
    // unPatchMySQL();

    const result2 = await mysqlClient('employee').select(`*`);
    console.log('result 2', result2);
    expect(result2).toHaveLength(3);
    console.log(result2);
  });

});
