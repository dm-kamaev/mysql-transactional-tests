import { startTransaction, unPatch, setDebug } from '../../src/mysql2';
import sequelizeClient, { Sequelize } from '../client/sequelize_client';
const mysqlConfig = require('../mysql.config.json');

describe('[sequelize]: queries', () => {
  let mysqlClient: Sequelize;
  let EmployeeModel;
  let rollback;

  beforeEach(async () => {
    ({ sequelize: mysqlClient, EmployeeModel } = await sequelizeClient({ ...mysqlConfig }));
  });

  afterEach(async () => {
    await mysqlClient.close();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
    const result: { id: number, age: number }[] = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await EmployeeModel.increment('age', { where: { id } });
    const result2: { id: number, age: number }[] = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    expect(result2[0].age).toBe(age+1);

    await rollback();

    const result3: { id: number, age: number }[] = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    expect(result3[0].age).toEqual(age);
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    await EmployeeModel.destroy({
      where: {},
    });
    const result = await EmployeeModel.findAll();
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await EmployeeModel.findAll();
    expect(result2).toHaveLength(3);
  });

});
