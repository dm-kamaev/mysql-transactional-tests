import { startTransaction, unPatch } from '../../src/mysql2';
import { Employee } from '../client/Employee.mikroorm.entity';
import mikroORMClient, { EM, IsolationLevel } from '../client/mikroorm_client';
const mysqlConfig = require('../mysql.config.json');


describe('[mikroorm]: transaction with isolation level', () => {
  let mysqlClient: EM;
  let orm;
  let rollback;
  const isolationLevel = IsolationLevel.READ_UNCOMMITTED;
  // const isolationLevel = IsolationLevel.READ_COMMITTED;
  // const isolationLevel = IsolationLevel.SNAPSHOT;
  // const isolationLevel = IsolationLevel.REPEATABLE_READ;
  // const isolationLevel = IsolationLevel.SERIALIZABLE;

  beforeEach(async () => {
    ({ em: mysqlClient, orm } = await mikroORMClient({ ...mysqlConfig }));
  });

  afterEach(async () => {
    await orm.close();
  });


  afterAll(() => {
    unPatch();
  });


  it('insert: commit', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.begin({ isolationLevel });
    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;
    mysqlClient.persist(employee);
    await mysqlClient.commit();

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

   it('insert: commit (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    await mysqlClient.transactional(async (em) => {
      const employee = new Employee();
      employee.first_name = 'Test';
      employee.last_name = 'Test';
      employee.age = 35;
      employee.sex = 'man';
      employee.income = 23405;
      em.persist(employee);
    }, { isolationLevel });

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());

    await mysqlClient.begin({ isolationLevel });
    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;
    mysqlClient.persist(employee);
    await mysqlClient.rollback();

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(3);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    ({ rollback } = await startTransaction());
    try {
      await mysqlClient.transactional(async (em) => {
        const employee = new Employee();
        employee.first_name = 'Test';
        employee.last_name = 'Test';
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        em.persist(employee);
        throw Error('Test Rollback');
      }, { isolationLevel });
    } catch (err) {
      const result =  await mysqlClient.findAll(Employee, {});
      expect(result).toHaveLength(3);

      await rollback();

      const result2 = await mysqlClient.findAll(Employee, {});
      expect(result2).toHaveLength(3);
    }
  });

});
