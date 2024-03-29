import { startTransaction, unPatch } from '../../src/mysql';
import { Employee } from '../client/Employee.typeorm.entity';
import typeORMClient, { DataSource } from '../client/typeorm_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[typeorm]: transaction with isolation level', () => {
  let mysqlClient: DataSource;
  let rollback;
  const isolationLevel = 'READ UNCOMMITTED';
  // const isolationLevel = 'READ COMMITTED';
  // const isolationLevel = 'REPEATABLE READ';
  // const isolationLevel = 'SERIALIZABLE';

  beforeEach(async () => {
    mysqlClient = await typeORMClient({ ...mysqlConfig });
  });

  afterEach(async () => {
    await mysqlClient.destroy();
  });

  afterAll(() => {
    unPatch();
  });

  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    await mysqlClient.transaction(isolationLevel, async (em) => {
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

    await rollback();

    const result2 = await employeeRepo.find();
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    try {
      await mysqlClient.transaction(isolationLevel, async (em) => {
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

      await rollback();

      const result2 = await employeeRepo.find();
      expect(result2).toHaveLength(3);
    }
  });

  it('insert: two parallel transcation, one commit, one rollback', async () => {
    ({ rollback } = await startTransaction());
    const employeeRepo = mysqlClient.getRepository(Employee);
    const trx1 = mysqlClient.createQueryRunner();
    const trx2 = mysqlClient.createQueryRunner();

    await trx1.connect();
    await trx2.connect();

    await trx1.startTransaction(isolationLevel);
    await trx2.startTransaction(isolationLevel);

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

    await rollback();

    const result2 = await employeeRepo.find();
    expect(result2).toHaveLength(3);
  });
});
