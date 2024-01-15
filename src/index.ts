import mysql from 'mysql';

type IsolationLevel = 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED';

type QueryOptions =
  [options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined] |
  [options: string | mysql.QueryOptions, values: any, callback?: mysql.queryCallback] |
  [callback?: ((err: mysql.MysqlError) => void) | undefined]
;

type QueryOptionsOut =
  [options?: (mysql.QueryOptions & { __sql__: string }) | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined] |
  [options: string | (mysql.QueryOptions & { __sql__: string }), values: any, callback?: mysql.queryCallback] |
  [callback?: ((err: mysql.MysqlError) => void) | undefined]
;

export function patchMySQL({ isolationLevel, onQuery: inputOnQuery }: { isolationLevel?: IsolationLevel, onQuery?: (input: string | mysql.QueryOptions) => void } = {}) {
  const onQuery = inputOnQuery || function () {};
  const createPoolOrigin = mysql.createPool;
  // let connection: PoolConnection | undefined;
  let pool: mysql.Pool | undefined;
  let getConnectionOrigin: (callback: (err: mysql.MysqlError, connection: mysql.PoolConnection) => void) => void | undefined;
  let trx: Trx | undefined;
  let releaseOrigin: () => void | undefined;
  let rollbackOrigin: {
  (options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined): void;
  (callback: (err: mysql.MysqlError) => void): void;
} | undefined;


  mysql.createPool = function (config: string | mysql.PoolConfig) {
    pool = createPoolOrigin(config);
    getConnectionOrigin = pool.getConnection.bind(pool);

    let counterSavepointId = 1;

    // let beginTransactionOrigin: {
    //   (options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined): void;
    //   (callback: (err: mysql.MysqlError) => void): void;
    // } | undefined;
    // let commitOrigin: {
    //   (options?: mysql.QueryOptions | undefined, callback?: ((err: mysql.MysqlError) => void) | undefined): void;
    //   (callback: (err: mysql.MysqlError) => void): void;
    // } | undefined;
    let queryOrigin: mysql.QueryFunction | undefined;

    pool.getConnection = async function (cb) {
      if (!trx) {
        trx = await createTrx(getConnectionOrigin, isolationLevel);

        const connection = trx.connection;

        // save origin method
        releaseOrigin = connection.release;
        // disable release
        connection.release = () => undefined;

        // save origin methods
        // beginTransactionOrigin = connection.beginTransaction.bind(connection);
        // commitOrigin = connection.commit.bind(connection);
        rollbackOrigin = connection.rollback.bind(connection);
        queryOrigin = connection.query.bind(connection);

        trx.connection.query = function (...input) {
          onQuery(input[0]);
          console.log('[Connection]: query: ', input[0]);
          const sql = input[0] && input[0].__sql__;
          if (sql) {
            input[0].sql = sql;
          }
          return queryOrigin!.apply(trx!.connection, input as any);
        };
      }

      const new_connection = {} as mysql.PoolConnection;
      const keys = getAllPropsOfObj(trx.connection);
      keys.forEach(el => {
        new_connection[el] = trx?.connection[el];
      });

      new_connection.beginTransaction = function (...input: [options?: mysql.QueryOptions, callback?: (err: mysql.MysqlError) => void] | [callback: (err: mysql.MysqlError) => void]) {
        if (!trx) {
          throw new Error('Not found transaction');
        }

        const savepointId = counterSavepointId++;
        const output = addCustomSql('savepoint', input, savepointId);
        let isStartedTrx = false;

        new_connection.query = function (...input) {
          if (!isStartedTrx) {
            onQuery(output[0] as mysql.QueryOptions);
            console.log('[Fake transaction]: Query', output[0]);
            const sql = output[0] && typeof output[0] !== 'string' && typeof output[0] !== 'function' && output[0].__sql__;
            return queryOrigin!(sql as string, (err) => {
              if (err) {
                const cb = input.at(-1);
                return cb(err);
              }
              isStartedTrx = true;
              onQuery(input[0]);
              console.log('[Fake transaction]: Query', input[0]);
              return queryOrigin!.apply(trx!.connection, input as any);
            });
          }
          onQuery(input[0]);
          console.log('[Fake transaction]: Query', input[0]);
          const sql = input[0] && input[0].__sql__;
          if (sql) {
            input[0].sql = sql;
          }
          return queryOrigin!.apply(trx!.connection, input as any);
        };

        new_connection.commit = function (...input: QueryOptions) {
          console.log('==== FAKE commit ====');
          const output = addCustomSql('release', input, savepointId);
          return new_connection.query.apply(trx!.connection, output as any);
        };

        new_connection.rollback = function (...input: QueryOptions) {
          console.log('===== FAKE rollback =====');
          const output = addCustomSql('rollback', input, savepointId);
          return new_connection.query.apply(trx!.connection, output as any);
        };

        const cb: any = input.at(-1)!;
        return cb();
      };

      return cb(null as unknown as mysql.MysqlError, new_connection);
    };

    return pool;
  };

  return {
    unPatchMySQL() {
      mysql.createPool = createPoolOrigin;
      if (pool) {
        pool.getConnection = getConnectionOrigin;
      }
      trx = undefined;
    },
    async rollback() {
      if (trx) {
        trx.connection.release = releaseOrigin;
      }
      if (rollbackOrigin) {
        const rollback = rollbackOrigin;
        await new Promise<void>((resolve, reject) => {
          rollback(function (err) {
            err ? reject(err) : resolve();
          });
        });
        rollbackOrigin = undefined;
      }
      trx = undefined;
    },
  };
}



async function createTrx(
  getConnection: (callback: (err: mysql.MysqlError, connection: mysql.PoolConnection) => void) => void,
  isolationLevel?: IsolationLevel
) {
  const connection = await new Promise<mysql.PoolConnection>((resolve, reject) => {
    getConnection(function (err, connection) {
      return err ? reject(err) : resolve(connection);
    });
  });

  if (isolationLevel) {
    // SELECT @@transaction_ISOLATION
    await new Promise((resolve, reject) => {
      connection.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${isolationLevel}`, function(err) {
        return err ? reject(err) : resolve(undefined);
      });
    });
  }
  return new Promise<Trx>((resolve, reject) => {
    connection.beginTransaction(err => {
      err ? reject(err) : resolve(new Trx(connection));
    });
  });
}


class Trx {
  private readonly rollback_origin: (callback: (err: mysql.MysqlError) => void) => void | ((options?: mysql.QueryOptions, callback?: (err: mysql.MysqlError) => void) => void);
  constructor(public readonly connection: mysql.PoolConnection) {
    this.rollback_origin = this.connection.rollback.bind(this.connection);
  }

  rollback() {
    const connection = this.connection;
    return new Promise<void>((resolve, reject) => {
      this.rollback_origin(function () {
        // console.dir(connection, { depth: 4, colors: true });
        try {
          connection.release();
        } catch (err: any) {
          if (!/Connection\s+already\s+released/i.test(err.message)) {
            return reject(err);
          }
        }
        resolve();
      });
    });
  }
}

function addCustomSql(commandType: 'savepoint' | 'release' | 'rollback', input: QueryOptions, savepointId: number): QueryOptionsOut {
  let command: 'SAVEPOINT' | 'RELEASE SAVEPOINT' | 'ROLLBACK TO SAVEPOINT';
  if (commandType === 'savepoint') {
    command = 'SAVEPOINT';
  } else if (commandType === 'release') {
    command = `RELEASE SAVEPOINT`;
  } else {
    command = `ROLLBACK TO SAVEPOINT`;
  }
  let output: QueryOptionsOut = [];
  if (input.length === 2 && input[0] && typeof input[0] === 'object') {
     output = [{ ...input[0], __sql__: `${command} sp_${savepointId}` }, input[1]];
  } else {
    output = [{ sql: '', __sql__: `${command} sp_${savepointId}` }, input[0]]
  }
  return output;
}


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