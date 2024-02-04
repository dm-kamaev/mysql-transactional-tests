import mysql from 'mysql2';


// type Rows = mysql.OkPacket | mysql.RowDataPacket[] | mysql.ResultSetHeader[] | mysql.RowDataPacket[][] | mysql.OkPacket[] | mysql.ProcedureCallPacket;
export default class MySQL2Client {
  private readonly _pool: mysql.Pool;

  constructor(config: mysql.ConnectionConfig) {
    this._pool = mysql.createPool(config);
  }


  query<T>(options: string | mysql.QueryOptions, values?: any): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      if (typeof options === 'string') {
        this._pool.query(options, values, function (err, rows, _fields) {
          err ? reject(err) : resolve(rows as T[]);
        });
      } else {
        this._pool.query(options, values, function (err, rows, _fields) {
          err ? reject(err) : resolve(rows as T[]);
        });
      }
    });
  }

  async beginTransaction({ isolationLevel }: { isolationLevel?: 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED' } = {}) {
    const connection = await new Promise<mysql.PoolConnection>((resolve, reject) => {
      this._pool.getConnection(function (err, connection) {
        return err ? reject(err) : resolve(connection);
      });
    });

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
  constructor(public readonly connection: mysql.PoolConnection) {}


  query(options: string | mysql.QueryOptions, values?: any) {
    if (this._status !== 'pending') {
      throw new Error(`Incorrect status of transaction "${this._status}" must be pending`);
    }
    const connection = this.connection;

    return new Promise((resolve, reject) => {
      if (typeof options === 'string') {
        connection.query(options, values, function (err, rows, _fields) {
          err ? reject(err) : resolve(rows);
        });
      } else {
        connection.query(options, values, function (err, rows, _fields) {
          err ? reject(err) : resolve(rows);
        });
      }
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
            console.log('Call resolve');
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


// const mysqlConfig = require('../mysql.config.json');
// void async function () {
//   const mysqlClient = new MySQL2Client(mysqlConfig);
//   const result = await mysqlClient.query(`SELECT * FROM employee`);
//   console.log(result);

//   const trx = await mysqlClient.beginTransaction();
//   await trx.query(`INSERT INTO ${mysqlConfig.database}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
//   await trx.rollback();
//   mysqlClient.close();
// }();