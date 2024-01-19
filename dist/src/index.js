"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchMySQL = void 0;
const mysql_1 = __importDefault(require("mysql"));
function patchMySQL({ isolationLevel, onQuery: inputOnQuery } = {}) {
    const onQuery = inputOnQuery || function () { };
    const createPoolOrigin = mysql_1.default.createPool;
    // let connection: PoolConnection | undefined;
    let pool;
    let getConnectionOrigin;
    let trx;
    let releaseOrigin;
    let rollbackOrigin;
    mysql_1.default.createPool = function (config) {
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
        let queryOrigin;
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
                    return queryOrigin.apply(trx.connection, input);
                };
            }
            const new_connection = {};
            const keys = getAllPropsOfObj(trx.connection);
            keys.forEach(el => {
                new_connection[el] = trx?.connection[el];
            });
            new_connection.beginTransaction = function (...input) {
                if (!trx) {
                    throw new Error('Not found transaction');
                }
                const savepointId = counterSavepointId++;
                const output = addCustomSql('savepoint', input, savepointId);
                let isStartedTrx = false;
                new_connection.query = function (...input) {
                    if (!isStartedTrx) {
                        onQuery(output[0]);
                        console.log('[Fake transaction]: Query', output[0]);
                        const sql = output[0] && typeof output[0] !== 'string' && typeof output[0] !== 'function' && output[0].__sql__;
                        return queryOrigin(sql, (err) => {
                            if (err) {
                                const cb = input.at(-1);
                                return cb(err);
                            }
                            isStartedTrx = true;
                            onQuery(input[0]);
                            console.log('[Fake transaction]: Query', input[0]);
                            return queryOrigin.apply(trx.connection, input);
                        });
                    }
                    onQuery(input[0]);
                    console.log('[Fake transaction]: Query', input[0]);
                    const sql = input[0] && input[0].__sql__;
                    if (sql) {
                        input[0].sql = sql;
                    }
                    return queryOrigin.apply(trx.connection, input);
                };
                new_connection.commit = function (...input) {
                    console.log('==== FAKE commit ====');
                    const output = addCustomSql('release', input, savepointId);
                    return new_connection.query.apply(trx.connection, output);
                };
                new_connection.rollback = function (...input) {
                    console.log('===== FAKE rollback =====');
                    const output = addCustomSql('rollback', input, savepointId);
                    return new_connection.query.apply(trx.connection, output);
                };
                const cb = input.at(-1);
                return cb();
            };
            return cb(null, new_connection);
        };
        return pool;
    };
    return {
        unPatchMySQL() {
            mysql_1.default.createPool = createPoolOrigin;
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
                await new Promise((resolve, reject) => {
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
exports.patchMySQL = patchMySQL;
async function createTrx(getConnection, isolationLevel) {
    const connection = await new Promise((resolve, reject) => {
        getConnection(function (err, connection) {
            return err ? reject(err) : resolve(connection);
        });
    });
    if (isolationLevel) {
        // SELECT @@transaction_ISOLATION
        await new Promise((resolve, reject) => {
            connection.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${isolationLevel}`, function (err) {
                return err ? reject(err) : resolve(undefined);
            });
        });
    }
    return new Promise((resolve, reject) => {
        connection.beginTransaction(err => {
            err ? reject(err) : resolve(new Trx(connection));
        });
    });
}
class Trx {
    connection;
    rollback_origin;
    constructor(connection) {
        this.connection = connection;
        this.rollback_origin = this.connection.rollback.bind(this.connection);
    }
    rollback() {
        const connection = this.connection;
        return new Promise((resolve, reject) => {
            this.rollback_origin(function () {
                // console.dir(connection, { depth: 4, colors: true });
                try {
                    connection.release();
                }
                catch (err) {
                    if (!/Connection\s+already\s+released/i.test(err.message)) {
                        return reject(err);
                    }
                }
                resolve();
            });
        });
    }
}
function addCustomSql(commandType, input, savepointId) {
    let command;
    if (commandType === 'savepoint') {
        command = 'SAVEPOINT';
    }
    else if (commandType === 'release') {
        command = `RELEASE SAVEPOINT`;
    }
    else {
        command = `ROLLBACK TO SAVEPOINT`;
    }
    let output = [];
    if (input.length === 2 && input[0] && typeof input[0] === 'object') {
        output = [{ ...input[0], __sql__: `${command} sp_${savepointId}` }, input[1]];
    }
    else {
        output = [{ sql: '', __sql__: `${command} sp_${savepointId}` }, input[0]];
    }
    return output;
}
function getAllPropsOfObj(obj) {
    const set = new Set();
    for (; obj != null; obj = Object.getPrototypeOf(obj)) {
        const op = Object.getOwnPropertyNames(obj);
        for (let i = 0; i < op.length; i++) {
            const name = op[i];
            set.add(name);
        }
    }
    return Array.from(set);
}
//# sourceMappingURL=index.js.map