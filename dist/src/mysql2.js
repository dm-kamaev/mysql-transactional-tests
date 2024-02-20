"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDebug = exports.unPatch = exports.startTransaction = void 0;
const mysql2_1 = __importDefault(require("mysql2"));
const options = {};
let transactionStarted = false;
const createPoolOrigin = mysql2_1.default.createPool;
const createConnectionOrigin = mysql2_1.default.createConnection;
let pool;
let getConnectionOrigin;
let connectionGlobalTrx;
let releaseOrigin;
let rollbackOrigin;
let queryTrx;
let counterSavepointId = 1;
let DEBUG = false;
const logger = (...input) => DEBUG ? console.log.apply(console.log, input) : {};
mysql2_1.default.createPool = function (config) {
    pool = createPoolOrigin(config);
    getConnectionOrigin = pool.getConnection.bind(pool);
    pool.getConnection = async function (cb) {
        if (!transactionStarted) {
            return getConnectionOrigin(cb);
        }
        if (!connectionGlobalTrx) {
            await initGlobalTrx();
        }
        const newConnection = {};
        // Rest operator can't copy properties from prototype of object
        const keys = getAllPropsOfObj(connectionGlobalTrx);
        keys.forEach(el => {
            newConnection[el] = connectionGlobalTrx[el];
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
                return queryTrx.apply(connectionGlobalTrx, input);
            }
        };
        newConnection.beginTransaction = function (...input) {
            if (!connectionGlobalTrx) {
                throw new Error('Not found transaction');
            }
            const savepointId = counterSavepointId++;
            const output = addCustomSql('savepoint', input, savepointId);
            // We will start transaction (call "savepoint") when first query was triggered
            let isTrxBegun = false;
            newConnection.query = function (...input) {
                // if transaction not begun then executed "begin" or "start transaction" and call neccessary sql query
                if (!isTrxBegun) {
                    options.onQuery(output[0]);
                    logger('[Fake transaction]: Query', output[0]);
                    const sql = output[0] && typeof output[0] !== 'string' && typeof output[0] !== 'function' && output[0].__sql__;
                    return queryTrx(sql, (err) => {
                        if (err) {
                            const cb = input.at(-1);
                            return cb(err);
                        }
                        isTrxBegun = true;
                        options.onQuery(input[0]);
                        logger('[Fake transaction]: Query', input[0]);
                        return queryTrx.apply(connectionGlobalTrx, input);
                    });
                }
                const firstParam = input[0];
                options.onQuery(firstParam);
                logger('[Fake transaction]: Query', firstParam);
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
                    return queryTrx.apply(connectionGlobalTrx, input);
                }
            };
            newConnection.commit = function (...input) {
                logger('==== FAKE commit ====');
                const output = addCustomSql('release', input, savepointId);
                return newConnection.query.apply(connectionGlobalTrx, output);
            };
            newConnection.rollback = function (...input) {
                logger('===== FAKE rollback =====');
                const output = addCustomSql('rollback', input, savepointId);
                return newConnection.query.apply(connectionGlobalTrx, output);
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
    connection.query = connection.execute = function (...input) {
        if (!transactionStarted) {
            return queryOrigin.apply(connection, input);
        }
        let p = Promise.resolve();
        if (!connectionGlobalTrx) {
            p = p.then(() => initGlobalTrx({ connectionConfig: inputConfig }));
        }
        const sql = (typeof input[0] === 'string' ? input[0] : input[0].sql).trim().toUpperCase();
        p.then(() => {
            if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
                connection.beginTransaction(input.at(-1));
            }
            else {
                connectionGlobalTrx.query.apply(connectionGlobalTrx, input);
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
        if (!connectionGlobalTrx) {
            p = p.then(() => initGlobalTrx({ connectionConfig: inputConfig }));
        }
        const savepointId = counterSavepointId++;
        const output = addCustomSql('savepoint', input, savepointId);
        // We will start transaction (call "savepoint") when first query was triggered
        let isTrxBegun = false;
        connection.query = connection.execute = function (...input) {
            if (!transactionStarted) {
                return queryOrigin.apply(connection, input);
            }
            const firstParam = input[0];
            const cb = input.at(-1);
            const queryTrx = connectionGlobalTrx.query;
            // if transaction not begun then executed "begin" or "start transaction" and call neccessary sql query
            if (!isTrxBegun) {
                const firstParamForBeginTransaction = output[0];
                options.onQuery(firstParamForBeginTransaction);
                logger('[Fake transaction]: Query', output[0]);
                const sql = firstParamForBeginTransaction && typeof firstParamForBeginTransaction !== 'string' && typeof firstParamForBeginTransaction !== 'function' && firstParamForBeginTransaction.__sql__;
                return queryTrx(sql, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    isTrxBegun = true;
                    options.onQuery(firstParam);
                    logger('[Fake transaction]: Query', firstParam);
                    return queryTrx.apply(connectionGlobalTrx, input);
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
                logger('[Fake transaction]: Query', firstParam);
                return queryTrx.apply(connectionGlobalTrx, input);
            }
        };
        connection.commit = function (...input) {
            logger('==== FAKE commit ====');
            const output = addCustomSql('release', input, savepointId);
            return connectionGlobalTrx.query.apply(connectionGlobalTrx, output);
        };
        connection.rollback = function (...input) {
            logger('===== FAKE rollback =====');
            const output = addCustomSql('rollback', input, savepointId);
            return connectionGlobalTrx.query.apply(connectionGlobalTrx, output);
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
            logger("🚀 ~ rollback ~ connectionGlobalTrx:", Boolean(connectionGlobalTrx));
            if (connectionGlobalTrx) {
                connectionGlobalTrx.release = releaseOrigin;
            }
            logger("🚀 ~ rollback ~ rollbackOrigin:", Boolean(rollbackOrigin));
            if (rollbackOrigin) {
                const rollback = rollbackOrigin;
                await new Promise((resolve, reject) => {
                    rollback.call(connectionGlobalTrx, function (err) {
                        err ? reject(err) : resolve();
                    });
                });
                rollbackOrigin = undefined;
            }
            connectionGlobalTrx?.destroy();
            connectionGlobalTrx = undefined;
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
    connectionGlobalTrx = undefined;
    transactionStarted = false;
}
exports.unPatch = unPatch;
function setDebug(debugMode) {
    DEBUG = debugMode;
}
exports.setDebug = setDebug;
async function initGlobalTrx({ connectionConfig } = {}) {
    connectionGlobalTrx = await createGlobalTrx(!connectionConfig ? { getConnection: getConnectionOrigin } : { createConnection: () => createConnectionOrigin(connectionConfig) }, options.isolationLevel);
    // save origin method
    releaseOrigin = connectionGlobalTrx.release;
    // disable release
    connectionGlobalTrx.release = () => undefined;
    // save origin methods
    rollbackOrigin = connectionGlobalTrx.rollback;
    queryTrx = connectionGlobalTrx.query.bind(connectionGlobalTrx);
    connectionGlobalTrx.query = function (...input) {
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
            logger('[Connection]: query: ', firstParam);
            return queryTrx.apply(connectionGlobalTrx, input);
        }
    };
}
async function createGlobalTrx(input, isolationLevel) {
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