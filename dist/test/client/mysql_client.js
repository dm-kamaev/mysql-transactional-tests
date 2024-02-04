"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = __importDefault(require("mysql"));
class MySQLClient {
    _pool;
    constructor(config) {
        this._pool = mysql_1.default.createPool(config);
    }
    async query(options, values) {
        const connection = await this.getConnection();
        return await connection.q(options, values);
    }
    async getConnection() {
        const connection = await new Promise((resolve, reject) => {
            this._pool.getConnection(function (err, connection) {
                return err ? reject(err) : resolve(connection);
            });
        });
        const output = connection;
        output.q = function query(options, values) {
            return new Promise((resolve, reject) => {
                connection.query(options, values, (err, rows) => {
                    connection.release();
                    err ? reject(err) : resolve(rows);
                });
            });
        };
        return output;
    }
    async beginTransaction({ isolationLevel } = {}) {
        const connection = await this.getConnection();
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
exports.default = MySQLClient;
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
            connection.query(options, values, (err, rows) => {
                err ? reject(err) : resolve(rows);
            });
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
//# sourceMappingURL=mysql_client.js.map