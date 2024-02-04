"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = __importDefault(require("mysql2"));
// type Rows = mysql.OkPacket | mysql.RowDataPacket[] | mysql.ResultSetHeader[] | mysql.RowDataPacket[][] | mysql.OkPacket[] | mysql.ProcedureCallPacket;
class MySQL2Client {
    _pool;
    constructor(config) {
        this._pool = mysql2_1.default.createPool(config);
    }
    query(options, values) {
        return new Promise((resolve, reject) => {
            if (typeof options === 'string') {
                this._pool.query(options, values, function (err, rows, _fields) {
                    err ? reject(err) : resolve(rows);
                });
            }
            else {
                this._pool.query(options, values, function (err, rows, _fields) {
                    err ? reject(err) : resolve(rows);
                });
            }
        });
    }
    async beginTransaction({ isolationLevel } = {}) {
        const connection = await new Promise((resolve, reject) => {
            this._pool.getConnection(function (err, connection) {
                return err ? reject(err) : resolve(connection);
            });
        });
        if (isolationLevel) {
            await new Promise((resolve, reject) => {
                connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`, (err) => err ? reject(err) : resolve());
            });
        }
        return new Promise((resolve, reject) => {
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
exports.default = MySQL2Client;
class Trx {
    connection;
    _status = 'pending';
    constructor(connection) {
        this.connection = connection;
    }
    query(options, values) {
        if (this._status !== 'pending') {
            throw new Error(`Incorrect status of transaction "${this._status}" must be pending`);
        }
        const connection = this.connection;
        return new Promise((resolve, reject) => {
            if (typeof options === 'string') {
                connection.query(options, values, function (err, rows, _fields) {
                    err ? reject(err) : resolve(rows);
                });
            }
            else {
                connection.query(options, values, function (err, rows, _fields) {
                    err ? reject(err) : resolve(rows);
                });
            }
        });
    }
    commit() {
        const me = this;
        const connection = this.connection;
        return new Promise((resolve, reject) => {
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
                    }
                    else {
                        console.log('Call resolve');
                        connection.release();
                        resolve();
                    }
                }
                catch (err) {
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
        return new Promise((resolve, reject) => {
            connection.rollback(function (err) {
                // console.dir(connection, { depth: 4, colors: true });
                try {
                    connection.release();
                    me._status = 'rollbacked';
                    return err ? reject(err) : resolve();
                }
                catch (err) {
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
//# sourceMappingURL=mysql2_client.js.map