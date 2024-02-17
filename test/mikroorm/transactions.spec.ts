import { startTransaction, unPatch } from '../../src/mysql2';
import { Employee } from '../client/Employee.entity';
import mikroORMClient, { EM } from '../client/mikroorm_client';
const mysqlConfig = require('../mysql.config.json');


describe('[mikroorm]: queries with transaction', () => {
  let mysqlClient: EM;
    let orm;
  let rollback;

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
    await mysqlClient.begin();
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
    });

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);

    await rollback();

    const result2 = await mysqlClient.findAll(Employee, {});
    expect(result2).toHaveLength(3);
  });

  it('insert: rollback', async () => {
    ({ rollback } = await startTransaction());

    await mysqlClient.begin();
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
      });
    } catch (err) {
      const result =  await mysqlClient.findAll(Employee, {});
      expect(result).toHaveLength(3);

      await rollback();

      const result2 = await mysqlClient.findAll(Employee, {});
      expect(result2).toHaveLength(3);
    }
  });

});
