import { startTransaction, unPatch } from '../../src/mysql2';
import sequelizeClient, { Sequelize } from '../client/sequelize_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[sequelize]: transaction per test', () => {
  let mysqlClient: Sequelize;
  let EmployeeModel;
  let rollback: () => Promise<void>;

  beforeAll(async () => {
    ({ sequelize: mysqlClient, EmployeeModel } = await sequelizeClient({ ...mysqlConfig }));
  });

  beforeEach(async () => {
    ({ rollback } = await startTransaction());
  });

  afterEach(async () => {
    await rollback();
  });

  afterAll(async () => {
    mysqlClient.close();
    unPatch();
  });

  it('insert', async () => {
    await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);
  });

  it('update', async () => {
    const result: { id: number; age: number }[] = await EmployeeModel.findAll({
      attributes: ['id', 'age'],
      where: { first_name: 'Lisa' },
      limit: 1,
    });
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await EmployeeModel.increment('age', { where: { id } });
    const result2: { id: number; age: number }[] = await EmployeeModel.findAll({
      attributes: ['id', 'age'],
      where: { first_name: 'Lisa' },
      limit: 1,
    });
    expect(result2[0].age).toBe(age + 1);
  });

  it('delete', async () => {
    await EmployeeModel.destroy({
      where: {},
    });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    const trx = await mysqlClient.transaction();
    await EmployeeModel.create(
      { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 },
      { transaction: trx },
    );
    await trx.commit();

    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

  it('insert: commit (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transaction(async (trx) => {
      await EmployeeModel.create(
        { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 },
        { transaction: trx },
      );
    });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    const trx = await mysqlClient.transaction();
    await EmployeeModel.create(
      { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 },
      { transaction: trx },
    );
    await trx.rollback();

    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    try {
      await mysqlClient.transaction(async (trx) => {
        await EmployeeModel.create(
          { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 },
          { transaction: trx },
        );
        throw new Error('Test Rollback');
      });
    } catch (err) {
      const result = await EmployeeModel.findAll();
      expect(result).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    const trx1 = await mysqlClient.transaction();
    const trx2 = await mysqlClient.transaction();

    await EmployeeModel.create(
      { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 },
      { transaction: trx1 },
    );
    await EmployeeModel.create(
      { first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 1100 },
      { transaction: trx2 },
    );

    await trx2.rollback();
    await trx1.commit();

    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    const not_found = await EmployeeModel.findAll({
      attributes: ['id', 'first_name'],
      where: { first_name: 'Test2' },
      limit: 1,
    });
    expect(not_found).toHaveLength(0);
  });
});
