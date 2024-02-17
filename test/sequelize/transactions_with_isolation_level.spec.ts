import { startTransaction, unPatch } from '../../src/mysql2';
import sequelizeClient, { Sequelize, Transaction } from '../client/sequelize_client';
const mysqlConfig = require('../mysql.config.json');

describe('[sequelize]: transaction with isolation level', () => {
  let mysqlClient: Sequelize;
  let rollback;
  let EmployeeModel;
  const isolationLevel = Transaction.ISOLATION_LEVELS.REPEATABLE_READ;
  // const isolationLevel = Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED;
  // const isolationLevel = Transaction.ISOLATION_LEVELS.READ_COMMITTED;
  // const isolationLevel = Transaction.ISOLATION_LEVELS.SERIALIZABLE;

  beforeEach(async () => {
    ({ sequelize: mysqlClient, EmployeeModel } = await sequelizeClient({ ...mysqlConfig  }));
  });

  afterEach(async () => {
    await mysqlClient.close();
  });

  afterAll(() => {
    unPatch();
  });

   it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction({ isolationLevel });
    await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
    await trx.commit();

    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

   it('insert: commit (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transaction({ isolationLevel }, async (trx) => {
      await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
    });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction({ isolationLevel }, );
    await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
    await trx.rollback();

    const result =  await EmployeeModel.findAll();
    expect(result).toHaveLength(3);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    try {
      await mysqlClient.transaction({ isolationLevel }, async (trx) => {
        await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
        throw Error('Test Rollback');
      });
    } catch (err) {
      const result =  await EmployeeModel.findAll();
      expect(result).toHaveLength(3);

      await rollback();

      const result2 = await EmployeeModel.findAll();
      expect(result2).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());
    const trx1 = await mysqlClient.transaction({ isolationLevel });
    const trx2 = await mysqlClient.transaction({ isolationLevel });

    await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx1 });
    await EmployeeModel.create({ first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 1100 }, { transaction: trx2 });

    await trx2.rollback();
    await trx1.commit();

    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    const not_found = await EmployeeModel.findAll({ attributes: ['id', 'first_name'], where: { 'first_name': 'Test2' }, limit: 1 });
    expect(not_found).toHaveLength(0);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

});
