import { startTransaction, unPatch } from '../../src/mysql2';
import { Employee } from '../client/Employee.mikroorm.entity';
import mikroORMClient, { EM } from '../client/mikroorm_client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mysqlConfig = require('../mysql.config.json');

describe('[mikroorm]: transaction per test', () => {
  let mysqlClient: EM;
  let orm;
  let rollback: () => Promise<void>;

  beforeAll(async () => {
    ({ em: mysqlClient, orm } = await mikroORMClient({ ...mysqlConfig, debug: false }));
  });

  beforeEach(async () => {
    ({ rollback } = await startTransaction());
  });

  afterEach(async () => {
    await rollback();
  });

  afterAll(async () => {
    await orm.close();
    unPatch();
  });

  it('insert', async () => {
    const employee = mysqlClient.create(Employee, {
      first_name: 'Test',
      last_name: 'Test',
      age: 35,
      sex: 'man',
      income: 23405,
    });
    await mysqlClient.persistAndFlush(employee);

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);
  });

  it('update', async () => {
    const result: { id: number; age: number }[] = await mysqlClient.findAll(Employee, {
      fields: ['id', 'age'],
      where: { first_name: 'Lisa' },
      limit: 1,
    });
    const { age } = result[0];
    expect(result).toHaveLength(1);
    result[0].age++;
    await mysqlClient.persistAndFlush(result[0]);

    const result2: { id: number; age: number }[] = await mysqlClient.findAll(Employee, {
      fields: ['id', 'age'],
      where: { first_name: 'Lisa' },
      limit: 1,
    });
    expect(result2[0].age).toBe(age + 1);
  });

  it('delete', async () => {
    const list: { id: number; age: number }[] = await mysqlClient.findAll(Employee, {});
    await mysqlClient.remove(list);
    await mysqlClient.removeAndFlush(list);

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(0);
  });

  it('insert: commit', async () => {
    const em = orm.em.fork();
    await em.begin();
    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;
    em.persist(employee);
    await em.commit();

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(4);
  });

  it('insert: commit (cb trx)', async () => {
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
  });

  it('insert: rollback', async () => {
    const em: EM = orm.em.fork();
    await em.begin();
    const employee = new Employee();
    employee.first_name = 'Test';
    employee.last_name = 'Test';
    employee.age = 35;
    employee.sex = 'man';
    employee.income = 23405;
    em.persist(employee);
    await em.rollback();

    const result = await mysqlClient.findAll(Employee, {});
    expect(result).toHaveLength(3);
  });

  it('insert: rollback (cb trx)', async () => {
    try {
      await mysqlClient.transactional(async (em) => {
        const employee = new Employee();
        employee.first_name = 'Test';
        employee.last_name = 'Test';
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        em.persist(employee);
        throw new Error('Test Rollback');
      });
    } catch (err) {
      const result = await mysqlClient.findAll(Employee, {});
      expect(result).toHaveLength(3);
    }
  });

  it('insert: rollback (cb trx) incorrect field', async () => {
    try {
      await mysqlClient.transactional(async (em) => {
        const employee = new Employee();
        employee.first_name = 'Test';
        employee.last_name = 23 as unknown as string;
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        em.persist(employee);
      });
    } catch (err) {
      const result = await mysqlClient.findAll(Employee, {});
      expect(result).toHaveLength(3);
    }
  });

  it('insert: two sequently transactions: commit then rollback', async () => {
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

    try {
      await mysqlClient.transactional(async (em) => {
        const employee = new Employee();
        employee.first_name = 'Test';
        employee.last_name = 23 as unknown as string;
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        em.persist(employee);
      });
    } catch (err) {
      const result = await mysqlClient.findAll(Employee, {});
      expect(result).toHaveLength(4);
    }
  });
});
