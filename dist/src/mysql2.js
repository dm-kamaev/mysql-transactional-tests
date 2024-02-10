"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unPatch = exports.startTransaction = void 0;
const mysql2_1 = __importDefault(require("mysql2"));
const options = {};
let transactionStarted = false;
const createPoolOrigin = mysql2_1.default.createPool;
const createConnectionOrigin = mysql2_1.default.createConnection;
let pool;
let getConnectionOrigin;
let connectionWithTrx;
let releaseOrigin;
let rollbackOrigin;
let queryTrx;
let counterSavepointId = 1;
mysql2_1.default.createPool = function (config) {
    pool = createPoolOrigin(config);
    getConnectionOrigin = pool.getConnection.bind(pool);
    pool.getConnection = async function (cb) {
        if (!transactionStarted) {
            return getConnectionOrigin(cb);
        }
        if (!connectionWithTrx) {
            await initTrx();
        }
        const newConnection = {};
        // Rest operator can't copy properties from prototype of object
        const keys = getAllPropsOfObj(connectionWithTrx);
        keys.forEach(el => {
            newConnection[el] = connectionWithTrx[el];
        });
        newConnection.query = function (...input) {
            const firstParam = input[0];
            const sql = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
            const cb = input.at(-1);
            if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
                newConnection.beginTransaction(cb);
                return this;
            }
            else if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
                cb();
                return this;
            }
            else {
                return queryTrx.apply(connectionWithTrx, input);
            }
        };
        newConnection.beginTransaction = function (...input) {
            if (!connectionWithTrx) {
                throw new Error('Not found transaction');
            }
            const savepointId = counterSavepointId++;
            const output = addCustomSql('savepoint', input, savepointId);
            // We will start transaction (call "savepoint") when first query was triggered
            let isStartedTrx = false;
            newConnection.query = function (...input) {
                if (!isStartedTrx) {
                    options.onQuery(output[0]);
                    console.log('[Fake transaction]: Query', output[0]);
                    const sql = output[0] && typeof output[0] !== 'string' && typeof output[0] !== 'function' && output[0].__sql__;
                    return queryTrx(sql, (err) => {
                        if (err) {
                            const cb = input.at(-1);
                            return cb(err);
                        }
                        isStartedTrx = true;
                        options.onQuery(input[0]);
                        console.log('[Fake transaction]: Query', input[0]);
                        return queryTrx.apply(connectionWithTrx, input);
                    });
                }
                const firstParam = input[0];
                options.onQuery(firstParam);
                console.log('[Fake transaction]: Query', firstParam);
                const __sql__ = firstParam && firstParam.__sql__;
                if (__sql__) {
                    firstParam.sql = __sql__;
                }
                const sql = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
                const cb = input.at(-1);
                if (sql.startsWith('COMMIT')) {
                    newConnection.commit(cb);
                    return this;
                }
                else if (/^ROLLBACK$/.test(sql)) { // maybe confict with "ROLLBACK TO SAVEPOINT sp_1"
                    newConnection.rollback(cb);
                    return this;
                }
                else {
                    return queryTrx.apply(connectionWithTrx, input);
                }
            };
            newConnection.commit = function (...input) {
                console.log('==== FAKE commit ====');
                const output = addCustomSql('release', input, savepointId);
                return newConnection.query.apply(connectionWithTrx, output);
            };
            newConnection.rollback = function (...input) {
                console.log('===== FAKE rollback =====');
                const output = addCustomSql('rollback', input, savepointId);
                return newConnection.query.apply(connectionWithTrx, output);
            };
            const cb = input.at(-1);
            return cb(null);
        };
        return cb(null, newConnection);
    };
    return pool;
};
mysql2_1.default.createConnection = function (inputConfig) {
    const connection = createConnectionOrigin(inputConfig);
    const queryOrigin = connection.query.bind(connection);
    connection.query = function (...input) {
        if (!transactionStarted) {
            return queryOrigin.apply(connection, input);
        }
        let p = Promise.resolve();
        if (!connectionWithTrx) {
            p = p.then(() => initTrx({ connectionConfig: inputConfig }));
        }
        const sql = typeof input[0] === 'string' ? input[0] : input[0].sql;
        p.then(() => {
            if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
                connection.beginTransaction(input.at(-1));
            }
            else {
                connectionWithTrx.query.apply(connectionWithTrx, input);
            }
        }).catch(err => console.error('createConnection: ', err));
        return this;
    };
    const beginTransactionOrigin = connection.beginTransaction;
    connection.beginTransaction = function (...input) {
        if (!transactionStarted) {
            return beginTransactionOrigin.apply(connection, input);
        }
        let p = Promise.resolve();
        if (!connectionWithTrx) {
            p = p.then(() => initTrx({ connectionConfig: inputConfig }));
        }
        const savepointId = counterSavepointId++;
        const output = addCustomSql('savepoint', input, savepointId);
        // We will start transaction (call "savepoint") when first query was triggered
        let isStartedTrx = false;
        connection.query = function (...input) {
            if (!transactionStarted) {
                return queryOrigin.apply(connection, input);
            }
            const firstParam = input[0];
            const cb = input.at(-1);
            const queryTrx = connectionWithTrx.query;
            if (!isStartedTrx) {
                const firstParamForBeginTransaction = output[0];
                options.onQuery(firstParamForBeginTransaction);
                console.log('[Fake transaction]: Query', output[0]);
                const sql = firstParamForBeginTransaction && typeof firstParamForBeginTransaction !== 'string' && typeof firstParamForBeginTransaction !== 'function' && firstParamForBeginTransaction.__sql__;
                return queryTrx(sql, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    isStartedTrx = true;
                    options.onQuery(firstParam);
                    console.log('[Fake transaction]: Query', firstParam);
                    return queryTrx.apply(connectionWithTrx, input);
                });
            }
            const __sql__ = firstParam && firstParam.__sql__;
            if (__sql__) {
                firstParam.sql = __sql__;
            }
            const sql = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
            if (sql.startsWith('COMMIT')) {
                connection.commit(cb);
                return this;
            }
            else if (sql.startsWith('ROLLBACK')) {
                connection.rollback(cb);
                return this;
            }
            else {
                options.onQuery(firstParam);
                console.log('[Fake transaction]: Query', firstParam);
                return queryTrx.apply(connectionWithTrx, input);
            }
        };
        connection.commit = function (...input) {
            console.log('==== FAKE commit ====');
            const output = addCustomSql('release', input, savepointId);
            return connectionWithTrx.query.apply(connectionWithTrx, output);
        };
        connection.rollback = function (...input) {
            console.log('===== FAKE rollback =====');
            const output = addCustomSql('rollback', input, savepointId);
            return connectionWithTrx.query.apply(connectionWithTrx, output);
        };
        const cb = input.at(-1);
        return p.then(() => cb());
    };
    return connection;
};
async function startTransaction({ isolationLevel, onQuery } = {}) {
    if (isolationLevel) {
        options.isolationLevel = isolationLevel;
    }
    options.onQuery = onQuery || function () { };
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
                await new Promise((resolve, reject) => {
                    rollback.call(connectionWithTrx, function (err) {
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
exports.startTransaction = startTransaction;
function unPatch() {
    mysql2_1.default.createConnection = createConnectionOrigin;
    mysql2_1.default.createPool = createPoolOrigin;
    if (pool && getConnectionOrigin) {
        pool.getConnection = getConnectionOrigin;
    }
    connectionWithTrx = undefined;
    transactionStarted = false;
}
exports.unPatch = unPatch;
async function initTrx({ connectionConfig } = {}) {
    connectionWithTrx = await createTrx(!connectionConfig ? { getConnection: getConnectionOrigin } : { createConnection: () => createConnectionOrigin(connectionConfig) }, options.isolationLevel);
    // save origin method
    releaseOrigin = connectionWithTrx.release;
    // disable release
    connectionWithTrx.release = () => undefined;
    // save origin methods
    // console.log('SET rollback origin', connectionWithTrx.rollback.bind(connectionWithTrx).toString());
    rollbackOrigin = connectionWithTrx.rollback;
    queryTrx = connectionWithTrx.query.bind(connectionWithTrx);
    connectionWithTrx.query = function (...input) {
        const firstParam = input[0];
        const __sql__ = firstParam && firstParam.__sql__;
        if (__sql__) {
            firstParam.sql = __sql__;
        }
        const sql = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
        if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
            input.at(-1)();
            return this;
        }
        else {
            options.onQuery(firstParam);
            console.log('[Connection]: query: ', firstParam);
            return queryTrx.apply(connectionWithTrx, input);
        }
    };
}
async function createTrx(input, isolationLevel) {
    let connection;
    if (input.getConnection) {
        const getConnection = input.getConnection;
        connection = await new Promise((resolve, reject) => {
            getConnection(function (err, connection) {
                return err ? reject(err) : resolve(connection);
            });
        });
    }
    else if (input.createConnection) {
        const connect = input.createConnection();
        connect.release = () => { connect.end(function (err) { console.error(err); }); };
        connection = connect;
    }
    if (isolationLevel) {
        // SELECT @@transaction_ISOLATION
        await new Promise((resolve, reject) => {
            connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`, function (err) {
                return err ? reject(err) : resolve(undefined);
            });
        });
    }
    return new Promise((resolve, reject) => {
        connection.beginTransaction(err => {
            err ? reject(err) : resolve(connection);
        });
    });
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
/**
 * get all properties from prototype of object
 * @param obj
 * @returns
 */
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
//# sourceMappingURL=mysql2.js.map