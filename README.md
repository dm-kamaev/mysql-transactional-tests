# MySQL Transactional tests

[![Actions Status](https://github.com/dm-kamaev/mysql-transactional-tests/workflows/Build/badge.svg)](https://github.com/dm-kamaev/mysql-transactional-tests/actions) ![Coverage](https://github.com/dm-kamaev/mysql-transactional-tests/blob/master/coverage/badge-statements.svg)

This library patches drivers [mysql](https://www.npmjs.com/package/mysql) and [mysql2](https://www.npmjs.com/package/mysql2) to allow implementation of transactional tests as it's done in [Ruby on Rails](https://guides.rubyonrails.org/testing.html#testing-parallel-transactions), [Laravel](https://laravel.com/docs/5.4/database-testing#using-transactions) and [Spring](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html).

The main purpose of this library is to make each of your tests run in a separate transaction, rollback after each test, so every change you're making in database disappears.

This allows to focus on testing logic without thinking about clearing database, and it's performed much faster than clearing tables with `DELETE/TRUNCATE`.

The library allows developers to write easy and fast tests which communicates with real database instead of writing tons of mocks and stubs in tests for queries to database. Besides you can persist seeds for database only once before start all tests and then don't think about recreation of state in database after each executed test.

Library supported:
* [Knex](https://knexjs.org/)
* [Kysely](https://kysely.dev/)
* [Sequelize](https://sequelize.org/)
* [TypeORM](https://typeorm.io/)
* [MikroORM](https://mikro-orm.io/)
* and other database client and ORM which using mysql or mysql2 driver


### Install
```sh
npm i mysql-transactional-tests -S
```

### Example
You should import library before import your client for database. If you use database client or ORM which is based on **mysql** driver then you should import `mysql-transactional-tests/mysql` otherwise `mysql-transactional-tests/mysql2` for **mysql2** driver.

```ts
// As early as possible import library (mysql driver)
import { startTransaction, unPatch } from 'mysql-transactional-tests/mysql';
// As early as possible import library (mysql2 driver)
// import { startTransaction, unPatch } from 'mysql-transactional-tests/mysql2';

import MySQLClient from '../client/mysql_client';
const mysqlConfig = require('../mysql.config.json');

const dbName = mysqlConfig.database;
const mysqlClient = new MySQLClient(mysqlConfig);

describe('[mysql]: transaction per test', () => {
  let rollback: () => Promise<void>;

  beforeEach(async () => {
    // Start transaction before each test
    ({ rollback } = await startTransaction());
  });

  afterEach(async () => {
    // Rollback transaction after each test
    await rollback();
  });

  afterAll(async () => {
    // Close connection to db and unpatche driver
    mysqlClient.close();
    unPatch();
  });

  // simple query
  it('insert', async () => {
    await mysqlClient.query(
      `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
    );
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);
  });

  // query in transaction
  it('insert: commit', async () => {
    const trx = await mysqlClient.beginTransaction();
    await trx.query(
      `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
    );
    await trx.commit();
    const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    expect(result).toHaveLength(4);
  });
});
```

[More examples with many library](https://github.com/dm-kamaev/mysql-transactional-tests/tree/master/test)

### How it works
Every test which performs a query is wrapped into a transaction:
```ts
it('insert', async () => {
  await mysqlClient.query(
    `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
  );
  const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
  expect(result).toHaveLength(4);
});
```

Will be producing next SQL:
```sql
-- global transaction was started
BEGIN;
  INSERT INTO employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405;
  SELECT * FROM employee;
-- global transaction was finished
ROLLBACK;
```

Transactions in your code will be converted to savepoints. Operator `BEGIN/START TRANSACTION` will be replaced to `SAVEPOINT`, `COMMIT` to `RELEASE SAVEPOINT`, `ROLLBACK` to `ROLLBACK TO SAVEPOINT`.
```ts
it('insert: commit', async () => {
  const trx = await mysqlClient.beginTransaction();
  await trx.query(
    `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
  );
  await trx.commit();
  const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
  expect(result).toHaveLength(4);
});
```
Will be producing next SQL:
```sql
-- global transaction was started
BEGIN;
  SAVEPOINT sp_1;
  INSERT INTO employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405;
  RELEASE SAVEPOINT sp_1;
  SELECT * FROM employee;
-- global transaction was finished
ROLLBACK;
```

### Restrictions and Corner cases
The library doesn't allow to run test with parallel transactions because the library creates one connection (with transaction) for all queries.
```ts
it('insert: two parallel transcations: one commit, one rollback', async () => {
  const [ trx1, trx2 ] = await Promise.all([
    mysqlClient.beginTransaction(),
    mysqlClient.beginTransaction(),
  ]);

  await trx1.query(
    `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
  );
  await trx2.query(
    `INSERT INTO ${dbName}.employee SET first_name='Matthew', last_name='Black', age=45, sex='woman', income=11000`,
  );

  // Maybe generate error ❌
  await Promise.all([
    trx1.commit,
    trx2.rollback,
  ]);
});
```
This is because the order of commit/rollback of the transactions are not guaranteed when they are executed in parallel.
Usually, it's not important for real transactions. Since the library transforms transactions in savepoints, the order release/rollback is very significant.

For example:
```sql
-- global transaction was started
BEGIN;

  SAVEPOINT sp_1;
  INSERT INTO employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405;
  SAVEPOINT sp_2;
  INSERT INTO employee SET first_name='Matthew', last_name='Black', age=45, sex='woman', income=11000;

  -- ✅
  RELEASE SAVEPOINT sp_2;
  RELEASE SAVEPOINT sp_1;

  -- ❌
  RELEASE SAVEPOINT sp_1;
  -- Not found savepoint sp_2
  RELEASE SAVEPOINT sp_2;

-- global transaction was finished
ROLLBACK;
```
Based on the above, you can use this library with tests which sequenctly open/close transactions (inside tested code) or with parallel transaction which are opened/closed based on principle LIFO (last in, first out):

```ts
it('insert: two parallel transcation, one commit, one rollback', async () => {
  // start two parallel transaction
  const trx1 = await mysqlClient.beginTransaction();
  const trx2 = await mysqlClient.beginTransaction();

  await trx1.query(
    `INSERT INTO ${dbName}.employee SET first_name='John', last_name='Brown', age=35, sex='man', income=23405`,
  );
  await trx2.query(
    `INSERT INTO ${dbName}.employee SET first_name='Matthew', last_name='Black', age=45, sex='woman', income=11000`,
  );

  // ✅
  await trx2.rollback();
  await trx1.commit();

  // ❌
  await trx1.commit();
  await trx2.rollback();

  const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
  expect(result).toHaveLength(4);

  const notFound = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Matthew' LIMIT 1`);
  expect(notFound).toHaveLength(0);
});
```

### Debug and Isolation Level
Debug mode can be enabled with method `setDebug`:
```ts
import { setDebug } from 'mysql-transactional-tests/mysql';
// import { setDebug } from 'mysql-transactional-tests/mysql2';

setDebug(true);
```

You can set isolation level for transaction:
```ts
beforeEach(async () => {
  // Start transaction before each test
  ({ rollback } = await startTransaction({ isolationLevel: 'READ UNCOMMITTED' }));
});
```