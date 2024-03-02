import { startTransaction, unPatch } from '../../src/mysql';
import { Employee } from '../client/Employee.typeorm.entity';
import typeORMClient, { DataSource } from '../client/typeorm_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[typeorm]: queries', () => {
  let mysqlClient: DataSource;
  let rollback;

  beforeEach(async () => {
    mysqlClient = await typeORMClient({ ...mysqlConfig });
  });

  afterEach(async () => {
    await mysqlClient.destroy();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;

    await employeeRepo.save(employee);
    const result = await employeeRepo.find();
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await employeeRepo.find();
    expect(result2).toHaveLength(3);
  });

  it('update', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    const result = await employeeRepo.find({ where: { first_name: 'Lisa' } });
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await employeeRepo.increment({ id }, 'age', 1);
    const result2 = await employeeRepo.find({ where: { first_name: 'Lisa' } });
    expect(result2[0].age).toBe(age + 1);

    await rollback();

    const result3 = await employeeRepo.find({ where: { first_name: 'Lisa' } });
    expect(result3[0].age).toEqual(age);
  });

  it('delete', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    await employeeRepo.delete({});
    const result = await employeeRepo.find();
    expect(result).toHaveLength(0);

    await rollback();

    const result2 = await employeeRepo.find();
    expect(result2).toHaveLength(3);
  });
});
