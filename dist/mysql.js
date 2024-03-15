"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDebug = exports.unPatch = exports.startTransaction = void 0;
const mysql_1 = __importDefault(require("mysql"));
const lib_1 = require("./lib");
const options = {};
let patchActivated = false;
const createPoolOrigin = mysql_1.default.createPool;
const createConnectionOrigin = mysql_1.default.createConnection;
let pool;
let getConnectionOrigin;
let globalTrxConnection;
let releaseOrigin;
let rollbackOrigin;
let queryTrx;
let counterSavepointId = 1;
let DEBUG = false;
const logger = (...input) => (DEBUG ? console.log.apply(console.log, input) : {});
mysql_1.default.createPool = function (config) {
    pool = createPoolOrigin(config);
    getConnectionOrigin = pool.getConnection.bind(pool);
    pool.getConnection = async function (cb) {
        if (!patchActivated) {
            return getConnectionOrigin(cb);
        }
        if (!globalTrxConnection) {
            await initGlobalTrx();
        }
        const proxyConnection = {};
        // Rest operator can't copy properties from prototype of object
        const keys = (0, lib_1.getAllPropsOfObj)(globalTrxConnection);
        keys.forEach((el) => {
            proxyConnection[el] = globalTrxConnection[el];
        });
        proxyConnection.query = function (...input) {
            const firstParam = input[0];
            const sql = (typeof firstParam === 'string' ? firstParam : firstParam.sql).trim().toUpperCase();
            const cb = input.at(-1);
            if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
                proxyConnection.beginTransaction(cb);
                return this;
            }
            else if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
                cb();
                return this;
            }
            else {
                options.onQuery(input[0]);
                return queryTrx.apply(globalTrxConnection, input);
            }
        };
        proxyConnection.beginTransaction = function (...input) {
            if (!globalTrxConnection) {
                throw new Error('Not found transaction');
            }
            const savepointId = counterSavepointId++;
            const output = addCustomSql('savepoint', input, savepointId);
            // We will start transaction (call "savepoint") when first query was triggered
            // Briefly, we start transaction only at first query
            let isTrxBegun = false;
            proxyConnection.query = function (...input) {
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
                        return queryTrx.apply(globalTrxConnection, input);
                    });
                }
                const firstParam = input[0];
                options.onQuery(firstParam);
                logger('[Fake transaction]: Query', firstParam);
                const __sql__ = firstParam && firstParam.__sql__;
                if (__sql__) {
                    firstParam.sql = __sql__;
                }
                const sql = (0, lib_1.extractSqlQuery)(firstParam);
                const cb = input.at(-1);
                if (sql.startsWith('COMMIT')) {
                    proxyConnection.commit(cb);
                    return this;
                }
                else if (/^ROLLBACK$/.test(sql)) {
                    // maybe confict with "ROLLBACK TO SAVEPOINT sp_1"
                    proxyConnection.rollback(cb);
                    return this;
                }
                else {
                    return queryTrx.apply(globalTrxConnection, input);
                }
            };
            proxyConnection.commit = function (...input) {
                logger('==== FAKE commit ====');
                const output = addCustomSql('release', input, savepointId);
                return proxyConnection.query.apply(globalTrxConnection, output);
            };
            proxyConnection.rollback = function (...input) {
                logger('===== FAKE rollback =====');
                const output = addCustomSql('rollback', input, savepointId);
                return proxyConnection.query.apply(globalTrxConnection, output);
            };
            // eslint-disable-next-line no-unused-vars
            const cb = input.at(-1);
            return cb();
        };
        return cb(null, proxyConnection);
    };
    return pool;
};
mysql_1.default.createConnection = function (uri) {
    const connection = createConnectionOrigin(uri);
    const queryOrigin = connection.query.bind(connection);
    connection.query = function (...input) {
        if (!patchActivated) {
            return queryOrigin.apply(connection, input);
        }
        let p = Promise.resolve();
        if (!globalTrxConnection) {
            p = p.then(() => initGlobalTrx({ connectionConfig: uri }));
        }
        const sql = (0, lib_1.extractSqlQuery)(input[0]);
        p
            .then(() => {
            // eslint-disable-next-line promise/always-return
            if (sql.startsWith('BEGIN') || sql.startsWith('START TRANSACTION')) {
                connection.beginTransaction(input.at(-1));
            }
            else {
                globalTrxConnection.query.apply(globalTrxConnection, input);
            }
        })
            .catch((err) => console.error('createConnection: ', err));
        return this;
    };
    const queryBeforeStartTrx = connection.query;
    const beginTransactionOrigin = connection.beginTransaction;
    connection.beginTransaction = function (...input) {
        if (!patchActivated) {
            return beginTransactionOrigin.apply(connection, input);
        }
        let p = Promise.resolve();
        if (!globalTrxConnection) {
            p = p.then(() => initGlobalTrx({ connectionConfig: uri }));
        }
        const savepointId = counterSavepointId++;
        const output = addCustomSql('savepoint', input, savepointId);
        // We will start transaction (call "savepoint") when first query was triggered
        // Briefly, we start transaction only at first query
        let isTrxBegun = false;
        connection.query = function (...input) {
            if (!patchActivated) {
                return queryOrigin.apply(connection, input);
            }
            const firstParam = input[0];
            const cb = input.at(-1);
            // if transaction wasn't started (nothing queries were executed)
            // but already call "rollback" then we call only callback (mikroORM use case)
            if (!isTrxBegun && /^ROLLBACK$/.test((0, lib_1.extractSqlQuery)(input[0]))) {
                connection.rollback(cb);
                return this;
            }
            const queryGlobalTrx = globalTrxConnection.query;
            // if transaction not begun then executed "begin" or "start transaction" and call neccessary sql query
            if (!isTrxBegun) {
                const firstParamForBeginTransaction = output[0];
                options.onQuery(firstParamForBeginTransaction);
                logger('[Fake transaction]: Query', output[0]);
                const sql = firstParamForBeginTransaction &&
                    typeof firstParamForBeginTransaction !== 'string' &&
                    typeof firstParamForBeginTransaction !== 'function' &&
                    firstParamForBeginTransaction.__sql__;
                return queryGlobalTrx(sql, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    isTrxBegun = true;
                    options.onQuery(firstParam);
                    logger('[Fake transaction]: Query', firstParam);
                    return queryGlobalTrx.apply(globalTrxConnection, input);
                });
            }
            const __sql__ = firstParam && firstParam.__sql__;
            if (__sql__) {
                firstParam.sql = __sql__;
            }
            const sql = (0, lib_1.extractSqlQuery)(firstParam);
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
                return queryGlobalTrx.apply(globalTrxConnection, input);
            }
        };
        connection.commit = function (...input) {
            logger('==== FAKE commit ====');
            const output = addCustomSql('release', input, savepointId);
            const cbOrigin = output[output.length - 1];
            output[output.length - 1] = function (err, result) {
                if (err) {
                    cbOrigin(err);
                }
                else {
                    connection.query = queryBeforeStartTrx;
                    cbOrigin(null, result);
                }
            };
            return globalTrxConnection.query.apply(globalTrxConnection, output);
        };
        connection.rollback = function (...input) {
            logger('===== FAKE rollback =====');
            const output = addCustomSql('rollback', input, savepointId);
            const cbOrigin = output[output.length - 1];
            output[output.length - 1] = function (err, result) {
                if (err) {
                    cbOrigin(err);
                }
                else {
                    connection.query = queryBeforeStartTrx;
                    cbOrigin(null, result);
                }
            };
            // if transaction wasn't started (nothing queries were executed)
            // but already call "rollback" then we call only callback (mikroORM use case)
            if (!isTrxBegun) {
                const cb = output.at(-1);
                return cb();
            }
            else {
                return globalTrxConnection.query.apply(globalTrxConnection, output);
            }
        };
        const cb = input.at(-1);
        // eslint-disable-next-line promise/no-callback-in-promise
        return p.then(() => cb());
    };
    return connection;
};
async function startTransaction({ isolationLevel, onQuery,
// eslint-disable-next-line no-unused-vars
 } = {}) {
    if (isolationLevel) {
        options.isolationLevel = isolationLevel;
    }
    options.onQuery = onQuery || function () { };
    patchActivated = true;
    return {
        async rollback() {
            logger('🚀 ~ rollback ~ globalTrxConnection:', Boolean(globalTrxConnection));
            if (globalTrxConnection) {
                globalTrxConnection.release = releaseOrigin;
            }
            logger('🚀 ~ rollback ~ rollbackOrigin:', Boolean(rollbackOrigin));
            if (rollbackOrigin) {
                const rollback = rollbackOrigin;
                await new Promise((resolve, reject) => {
                    rollback(function (err) {
                        err ? reject(err) : resolve();
                    });
                });
                rollbackOrigin = undefined;
            }
            globalTrxConnection?.destroy();
            globalTrxConnection = undefined;
            patchActivated = false;
        },
    };
}
exports.startTransaction = startTransaction;
function unPatch() {
    mysql_1.default.createConnection = createConnectionOrigin;
    mysql_1.default.createPool = createPoolOrigin;
    if (pool) {
        pool.getConnection = getConnectionOrigin;
    }
    globalTrxConnection = undefined;
    patchActivated = false;
}
exports.unPatch = unPatch;
function setDebug(debugMode) {
    DEBUG = debugMode;
}
exports.setDebug = setDebug;
async function initGlobalTrx({ connectionConfig } = {}) {
    globalTrxConnection = await createGlobalTrx(!connectionConfig
        ? { getConnection: getConnectionOrigin }
        : { createConnection: () => createConnectionOrigin(connectionConfig) }, options.isolationLevel);
    // save origin method
    releaseOrigin = globalTrxConnection.release;
    // disable release
    globalTrxConnection.release = () => undefined;
    // save origin methods
    rollbackOrigin = globalTrxConnection.rollback.bind(globalTrxConnection);
    queryTrx = globalTrxConnection.query.bind(globalTrxConnection);
    globalTrxConnection.query = function (...input) {
        const firstParam = input[0];
        const __sql__ = firstParam && firstParam.__sql__;
        if (__sql__) {
            firstParam.sql = __sql__;
        }
        const sql = (0, lib_1.extractSqlQuery)(firstParam);
        if (/TRANSACTION\s+ISOLATION\s+LEVEL/.test(sql)) {
            input.at(-1)();
            return this;
        }
        else {
            options.onQuery(firstParam);
            logger('[Connection]: query: ', firstParam);
            return queryTrx.apply(globalTrxConnection, input);
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
        connect.release = () => {
            connect.end(function (err) {
                console.error(err);
            });
        };
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
        connection.beginTransaction((err) => {
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
        command = 'RELEASE SAVEPOINT';
    }
    else {
        command = 'ROLLBACK TO SAVEPOINT';
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
