import { startTransaction, unPatch } from '../../src/mysql';
import { Employee } from '../client/Employee.typeorm.entity';
import typeORMClient, { DataSource } from '../client/typeorm_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[typeorm]: transaction per test', () => {
  let mysqlClient: DataSource;
  let rollback: () => Promise<void>;

  beforeAll(async () => {
    mysqlClient = await typeORMClient({ ...mysqlConfig });
  });

  beforeEach(async () => {
    ({ rollback } = await startTransaction());
  });

  afterEach(async () => {
    await rollback();
  });

  afterAll(async () => {
    await mysqlClient.destroy();
    unPatch();
  });

  it('insert', async () => {
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
  });

  it('update', async () => {
    const employeeRepo = mysqlClient.getRepository(Employee);
    const result = await employeeRepo.find({ where: { first_name: 'Lisa' } });
    const { id, age } = result[0];
    expect(result).toHaveLength(1);
    await employeeRepo.increment({ id }, 'age', 1);
    const result2 = await employeeRepo.find({ where: { first_name: 'Lisa' } });
    expect(result2[0].age).toBe(age + 1);
  });

  it('delete', async () => {
    const employeeRepo = mysqlClient.getRepository(Employee);
    await employeeRepo.delete({});
    const result = await employeeRepo.find();
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    const employeeRepo = mysqlClient.getRepository(Employee);
    await mysqlClient.transaction(async (em) => {
      const employeeRepo = em.getRepository(Employee);
      const employee = new Employee();
      employee.first_name = 'Test';
      employee.last_name = 'Test';
      employee.age = 35;
      employee.sex = 'man';
      employee.income = 23405;
      await employeeRepo.save(employee);
    });

    const result = await employeeRepo.find();
    expect(result).toHaveLength(4);
  });

  it('insert: rollback (cb trx)', async () => {
    const employeeRepo = mysqlClient.getRepository(Employee);
    try {
      await mysqlClient.transaction(async (em) => {
        const employeeRepo = em.getRepository(Employee);
        const employee = new Employee();
        employee.first_name = 'Test';
        employee.last_name = 'Test';
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        await employeeRepo.save(employee);
        throw new Error('Test Rollback');
      });
    } catch (err) {
      const result = await employeeRepo.find();
      expect(result).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    const employeeRepo = mysqlClient.getRepository(Employee);
    const trx1 = mysqlClient.createQueryRunner();
    const trx2 = mysqlClient.createQueryRunner();

    await trx1.connect();
    await trx2.connect();

    await trx1.startTransaction();
    await trx2.startTransaction();

    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;

    await trx1.manager.save(employee);

    const employee2 = new Employee();
    employee2.first_name = 'Test2';
    employee2.last_name = 'Test2';
    employee2.age = 45;
    employee2.sex = 'woman';
    employee2.income = 1100;

    await trx2.manager.save(employee);

    await trx2.rollbackTransaction();
    await trx1.commitTransaction();

    const result = await trx1.manager.find(Employee);
    expect(result).toHaveLength(4);
    await trx1.release();

    const not_found = await employeeRepo.find({ where: { first_name: 'Test2' } });
    expect(not_found).toHaveLength(0);
  });
});
