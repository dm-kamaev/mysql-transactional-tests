import mysql from 'mysql';

interface IQueryFunction {
  <T = unknown>(query: mysql.Query): Promise<T>;
  <T = unknown>(options: string | mysql.QueryOptions): Promise<T>;
  <T = unknown>(options: string | mysql.QueryOptions, values?: any): Promise<T>;
}

interface IPoolConnection extends mysql.PoolConnection {
  q: IQueryFunction;
}


export default class MySQLClient {
  private readonly _pool: mysql.Pool;

  constructor(config: mysql.PoolConfig) {
    this._pool = mysql.createPool(config);
  }


  async query<T = unknown>(options: string | mysql.QueryOptions, values?: any): Promise<T> {
    const connection = await this.getConnection();
    return await connection.q(options, values);
  }

  async getConnection(connectionOptions: { autoRelease?: boolean } = { autoRelease: true }): Promise<IPoolConnection> {
    const connection = await new Promise<mysql.PoolConnection>((resolve, reject) => {
      this._pool.getConnection(function (err, connection) {
        return err ? reject(err) : resolve(connection);
      });
    });

    const output = connection as unknown as IPoolConnection;
    output.q = function query<T = unknown>(options: string | mysql.QueryOptions, values?: any): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        connection.query(options, values, (err, rows) => {
          if (connectionOptions.autoRelease) {
            connection.release();
          }
          err ? reject(err) : resolve(rows);
        });
      });
    };

    return output;
  }

  async beginTransaction({ isolationLevel }: { isolationLevel?: 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED' } = {}) {
    const connection = await this.getConnection();

     if (isolationLevel) {
      await new Promise<void>((resolve, reject) => {
        connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`, (err) => err ? reject(err) : resolve());
      });
    }

    return new Promise<Trx>((resolve, reject) => {
      connection.beginTransaction(err => {
        if (err) {
          connection.release();
          return reject(err);
        }
        return resolve(new Trx(connection));
      });
    });
  }

  close() {
    this._pool.end();
  }
}


class Trx {
  private _status: 'pending' | 'commited' | 'rollbacked' | 'error' = 'pending';
  constructor(public readonly connection: IPoolConnection) {}


  query<T = unknown>(options: string | mysql.QueryOptions, values?: any): Promise<T> {
    if (this._status !== 'pending') {
      throw new Error(`Incorrect status of transaction "${this._status}" must be pending`);
    }
    const connection = this.connection;
    return new Promise<T>((resolve, reject) => {
      connection.query(options, values, (err, rows) => {
        err ? reject(err) : resolve(rows);
      });
    });
  }

  commit() {
    const me = this;
    const connection = this.connection;
    return new Promise<void>((resolve, reject) => {
      const error_trace = new Error('SQL Error');
      connection.commit(function (err) {
        try {
          if (err) {
            return me
              .rollback()
              // succes rollback
              .then(() => {
                err.stack = error_trace.stack + '\n' + err.stack;
                connection.release();
                return reject(err);
              })
              // if rollback is failed
              .catch(err => {
                err.stack = error_trace.stack + '\n' + err.stack;
                me._status = 'error';
                connection.release();
                return reject(err);
              });
          } else {
            connection.release();
            resolve();
          }
        } catch (err: any) {
          if (!/Connection\s+already\s+released/i.test(err.message)) {
            me._status = 'error';
            connection.release();
            reject(err);
          }
        }
      });
    });
  }

  rollback() {
    const me = this;
    const connection = this.connection;
    return new Promise<void>((resolve, reject) => {
      connection.rollback(function (err) {
        // console.dir(connection, { depth: 4, colors: true });
        try {
          connection.release();
          me._status = 'rollbacked';
          return err ? reject(err) : resolve();
        } catch (err: any) {
          if (!/Connection\s+already\s+released/i.test(err.message)) {
            me._status = 'error';
            return reject(err);
          }
        }
      });
    });
  }
}

