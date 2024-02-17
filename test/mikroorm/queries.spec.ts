import { startTransaction, unPatch } from '../../src/mysql2';
import { Employee } from '../client/Employee.entity';
import mikroORMClient, { EM } from '../client/mikroorm_client';
const mysqlConfig = require('../mysql.config.json');

describe('[mikroORM]: queries', () => {
  let mysqlClient: EM;
  let orm;
  let rollback;

  beforeEach(async () => {
    ({ em: mysqlClient, orm } = await mikroORMClient({ ...mysqlConfig, debug: false }));
  });

  afterEach(async () => {
    await orm.close();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    const employee = mysqlClient.create(Employee, { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    await mysqlClient.persistAndFlush(employee);

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
    const result: { id: number, age: number }[] = await mysqlClient.findAll(Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    const { age } = result[0];
    expect(result).toHaveLength(1);
    result[0].age++;
    await mysqlClient.persistAndFlush(result[0]);

    const result2: { id: number, age: number }[] = await mysqlClient.findAll(Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    expect(result2[0].age).toBe(age+1);

    await rollback();

    const result3: { id: number, age: number }[] = await mysqlClient.findAll(Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
    expect(result3[0].age).toEqual(age);
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    const list: { id: number, age: number }[] = await mysqlClient.findAll(Employee, {});
    await mysqlClient.remove(list);
    await mysqlClient.removeAndFlush(list);

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

});
