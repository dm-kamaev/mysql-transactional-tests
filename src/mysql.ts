import mysql from 'mysql';

type IsolationLevel = 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED';

type QueryOptions =
  [options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined] |
  [options: string | mysql.QueryOptions, values: any, callback?: mysql.queryCallback] |
  [callback?: ((err: mysql.MysqlError) => void) | undefined]
;

type QueryOptionsPatched =
  [options?: (mysql.QueryOptions & { __sql__: string }) | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined] |
  [options: string | (mysql.QueryOptions & { __sql__: string }), values: any, callback?: mysql.queryCallback] |
  [callback?: ((err: mysql.MysqlError) => void) | undefined]
;

const options: { isolationLevel?: IsolationLevel, onQuery?: (input: string | mysql.QueryOptions) => void } = {};
let transactionStarted = false;
const createPoolOrigin = mysql.createPool;
const createConnectionOrigin = mysql.createConnection;
let pool: mysql.Pool | undefined;
let getConnectionOrigin: (callback: (err: mysql.MysqlError, connection: mysql.PoolConnection) => void) => void | undefined;
let connectionWithTrx: mysql.PoolConnection | undefined;
let releaseOrigin: () => void | undefined;
let rollbackOrigin: {
  (options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined): void;
  (callback: (err: mysql.MysqlError) => void): void;
} | undefined;
let queryTrx: mysql.QueryFunction | undefined;

let counterSavepointId = 1;

mysql.createPool = function (config: string | mysql.PoolConfig) {
  pool = createPoolOrigin(config);
  getConnectionOrigin = pool.getConnection.bind(pool);

  pool.getConnection = async function (cb) {
    if (!transactionStarted) {
      return getConnectionOrigin(cb);
    }

    if (!connectionWithTrx) {
      await initTrx();
    }

    const newConnection = {} as mysql.PoolConnection;
    // Rest operator can't copy properties from prototype of object
    const keys = getAllPropsOfObj(connectionWithTrx);
    keys.forEach(el => {
      newConnection[el] = connectionWithTrx![el];
    });

    newConnection.beginTransaction = function (...input: [options?: mysql.QueryOptions, callback?: (err: mysql.MysqlError) => void] | [callback: (err: mysql.MysqlError) => void]) {
      if (!connectionWithTrx) {
        throw new Error('Not found transaction');
      }

      const savepointId = counterSavepointId++;
      const output = addCustomSql('savepoint', input, savepointId);
      // We will start transaction (call "savepoint") when first query was triggered
      let isStartedTrx = false;

      newConnection.query = function (...input) {
        if (!isStartedTrx) {
          options.onQuery!(output[0] as mysql.QueryOptions);
          console.log('[Fake transaction]: Query', output[0]);
          const sql = output[0] && typeof output[0] !== 'string' && typeof output[0] !== 'function' && output[0].__sql__;
          return queryTrx!(sql as string, (err) => {
            if (err) {
              const cb = input.at(-1);
              return cb(err);
            }
            isStartedTrx = true;
            options.onQuery!(input[0]);
            console.log('[Fake transaction]: Query', input[0]);
            return queryTrx!.apply(connectionWithTrx, input as any);
          });
        }
        options.onQuery!(input[0]);
        console.log('[Fake transaction]: Query', input[0]);
        const sql = input[0] && input[0].__sql__;
        if (sql) {
          input[0].sql = sql;
        }
        return queryTrx!.apply(connectionWithTrx, input as any);
      };

      newConnection.commit = function (...input: QueryOptions) {
        console.log('==== FAKE commit ====');
        const output = addCustomSql('release', input, savepointId);
        return newConnection.query.apply(connectionWithTrx, output as any);
      };

      newConnection.rollback = function (...input: QueryOptions) {
        console.log('===== FAKE rollback =====');
        const output = addCustomSql('rollback', input, savepointId);
        return newConnection.query.apply(connectionWithTrx, output as any);
      };

      const cb = input.at(-1)! as ((err?: mysql.MysqlError) => void);
      return cb();
    };

    return cb(null as unknown as mysql.MysqlError, newConnection);
  };

  return pool;
};


mysql.createConnection = function (uri: string | mysql.ConnectionConfig) {
  const connection = createConnectionOrigin(uri);
  const queryOrigin: mysql.QueryFunction = connection.query.bind(connection);

  connection.query = function (...input) {
    if (!transactionStarted) {
      return queryOrigin.apply(connection, input as any);
    }

    let p = Promise.resolve();
    if (!connectionWithTrx) {
      p = p.then(() => initTrx({ connectionConfig: uri }));
    }
    const sql: string = typeof input[0] === 'string' ? input[0] : input[0].sql;
    p.then(() => {
      if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
        connection.beginTransaction(input.at(-1));
      } else {
        connectionWithTrx!.query.apply(connectionWithTrx, input as any)
      }
    }).catch(err => console.error('createConnection: ',err)) as unknown as mysql.Query;
    return this;
  };

  const beginTransactionOrigin = connection.beginTransaction;

  connection.beginTransaction = function (...input: [options?: mysql.QueryOptions, callback?: (err: mysql.MysqlError) => void] | [callback: (err: mysql.MysqlError) => void]) {
     if (!transactionStarted) {
      console.log('USE REAL!!!!');
      return beginTransactionOrigin.apply(connection, input as any);
    }

    let p = Promise.resolve();
    if (!connectionWithTrx) {
      p = p.then(() => initTrx({ connectionConfig: uri }));
    }

    const savepointId = counterSavepointId++;
    const output = addCustomSql('savepoint', input, savepointId);
    // We will start transaction (call "savepoint") when first query was triggered
    let isStartedTrx = false;

    connection.query = function (...input) {
      if (!transactionStarted) {
        console.log('USE REAL!!!!');
        return queryOrigin.apply(connection, input as any);
      }
      const firstParam = input[0];
      const cb = input.at(-1);

      const queryTrx = connectionWithTrx!.query;
      if (!isStartedTrx) {
        const firstParamForBeginTransaction = output[0];
        options.onQuery!(firstParamForBeginTransaction as mysql.QueryOptions);
        console.log('[Fake transaction]: Query', output[0]);
        const sql = firstParamForBeginTransaction && typeof firstParamForBeginTransaction !== 'string' && typeof firstParamForBeginTransaction !== 'function' && firstParamForBeginTransaction.__sql__;
        return queryTrx(sql as string, (err) => {
          if (err) {
            return cb(err);
          }
          isStartedTrx = true;
          options.onQuery!(firstParam);
          console.log('[Fake transaction]: Query', firstParam);
          return queryTrx.apply(connectionWithTrx, input as any);
        });
      }
      const __sql__ = firstParam && firstParam.__sql__;
      if (__sql__) {
        firstParam.sql = __sql__;
      }
      const sql: string = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
      if (sql.startsWith('COMMIT')) {
        connection.commit(cb);
        return this;
      } else if (sql.startsWith('ROLLBACK')) {
        connection.rollback(cb);
        return this;
      }
      // else if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
      //   cb();
      //   return this;
      // }
      else {
        options.onQuery!(firstParam);
        console.log('[Fake transaction]: Query', firstParam);
        return queryTrx!.apply(connectionWithTrx, input as any);
      }
    };

    connection.commit = function (...input: QueryOptions) {
      console.log('==== FAKE commit ====');
      const output = addCustomSql('release', input, savepointId);
      return connectionWithTrx!.query.apply(connectionWithTrx, output as any);
    };

    connection.rollback = function (...input: QueryOptions) {
      console.log('===== FAKE rollback =====');
      const output = addCustomSql('rollback', input, savepointId);
      return connectionWithTrx!.query.apply(connectionWithTrx, output as any);
    };

    const cb: any = input.at(-1)!;
    return p.then(() => cb());
  };

  return connection;
};



export async function startTransaction({ isolationLevel, onQuery }: { isolationLevel?: IsolationLevel, onQuery?: (input: string | mysql.QueryOptions) => void } = {}) {
  if (isolationLevel) {
    options.isolationLevel = isolationLevel;
  }
  options.onQuery = onQuery || function() {};

  transactionStarted = true;

  return {
    async rollback() {
      console.log("🚀 ~ rollback ~ connectionWithTrx:", Boolean(connectionWithTrx));
      if (connectionWithTrx) {
        connectionWithTrx.release = releaseOrigin;
      }
      console.log("🚀 ~ rollback ~ rollbackOrigin:", Boolean(rollbackOrigin));
      if (rollbackOrigin) {
        const rollback = rollbackOrigin;
        await new Promise<void>((resolve, reject) => {
          rollback(function (err) {
            err ? reject(err) : resolve();
          });
        });
        rollbackOrigin = undefined;
      }
      connectionWithTrx?.destroy();
      connectionWithTrx = undefined;
      transactionStarted = false;
    },
  };
}

export function unPatch() {
  mysql.createConnection = createConnectionOrigin;
  mysql.createPool = createPoolOrigin;
  if (pool) {
    pool.getConnection = getConnectionOrigin;
  }
  connectionWithTrx = undefined;
  transactionStarted = false;
}

async function initTrx({ connectionConfig }: { connectionConfig?: string | mysql.ConnectionConfig } = { }) {
  connectionWithTrx = await createTrx(
    !connectionConfig ? { getConnection: getConnectionOrigin } : { createConnection: () => createConnectionOrigin(connectionConfig) },
    options.isolationLevel
  );

  // save origin method
  releaseOrigin = connectionWithTrx.release;
  // disable release
  connectionWithTrx.release = () => undefined;

  // save origin methods
  rollbackOrigin = connectionWithTrx.rollback.bind(connectionWithTrx);
  queryTrx = connectionWithTrx.query.bind(connectionWithTrx);

  connectionWithTrx.query = function (...input) {
    const firstParam = input[0];
    const __sql__ = firstParam && firstParam.__sql__;
    if (__sql__) {
      firstParam.sql = __sql__;
    }

    const sql = typeof firstParam === 'string' ? firstParam : firstParam.sql;

    if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
      input.at(-1)();
      return this;
    } else {
      options.onQuery!(firstParam);
      console.log('[Connection]: query: ', firstParam);
      return queryTrx!.apply(connectionWithTrx, input as any);
    }
  };
}


async function createTrx(
  input: {
    getConnection?: (callback: (err: mysql.MysqlError, connection: mysql.PoolConnection) => void) => void;
    createConnection?: () => mysql.Connection;
  },
  isolationLevel?: IsolationLevel
) {
  let connection: mysql.PoolConnection;
  if (input.getConnection) {
    const getConnection = input.getConnection;
    connection = await new Promise<mysql.PoolConnection>((resolve, reject) => {
      getConnection(function (err, connection) {
        return err ? reject(err) : resolve(connection);
      });
    });
  } else if (input.createConnection) {
    const connect = input.createConnection();
    (connect as mysql.PoolConnection).release = () => {     console.log('THIS !!!'); connect.end(function (err) { console.error(err); }) };
    connection = connect as mysql.PoolConnection;
  }


  if (isolationLevel) {
    // SELECT @@transaction_ISOLATION
    await new Promise((resolve, reject) => {
      connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`, function(err) {
        return err ? reject(err) : resolve(undefined);
      });
    });
  }
  return new Promise<mysql.PoolConnection>((resolve, reject) => {
    connection.beginTransaction(err => {
      err ? reject(err) : resolve(connection);
    });
  });
}


function addCustomSql(commandType: 'savepoint' | 'release' | 'rollback', input: QueryOptions, savepointId: number): QueryOptionsPatched {
  let command: 'SAVEPOINT' | 'RELEASE SAVEPOINT' | 'ROLLBACK TO SAVEPOINT';
  if (commandType === 'savepoint') {
    command = 'SAVEPOINT';
  } else if (commandType === 'release') {
    command = `RELEASE SAVEPOINT`;
  } else {
    command = `ROLLBACK TO SAVEPOINT`;
  }
  let output: QueryOptionsPatched = [];
  if (input.length === 2 && input[0] && typeof input[0] === 'object') {
     output = [{ ...input[0], __sql__: `${command} sp_${savepointId}` }, input[1]];
  } else {
    output = [{ sql: '', __sql__: `${command} sp_${savepointId}` }, input[0]]
  }
  return output;
}

/**
 * get all properties from prototype of object
 * @param obj
 * @returns
 */
function getAllPropsOfObj(obj) {
  const set = new Set<string>();
  for (; obj != null; obj = Object.getPrototypeOf(obj)) {
    const op = Object.getOwnPropertyNames(obj);
    for (let i=0; i<op.length; i++) {
      const name = op[i];
      set.add(name);
    }
  }
  return Array.from(set);
}