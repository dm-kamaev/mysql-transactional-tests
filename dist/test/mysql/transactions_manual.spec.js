"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = require("../../src/mysql");
const mysql_client_1 = __importDefault(require("../client/mysql_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mysql]: queries with transaction (manual)', () => {
    let mysqlClient;
    let rollback;
    const dbName = mysqlConfig.database;
    beforeEach(() => {
        mysqlClient = new mysql_client_1.default(mysqlConfig);
    });
    afterEach(() => {
        mysqlClient.close();
    });
    afterAll(() => {
        (0, mysql_1.unPatch)();
    });
    it('insert: commit', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const connection = await mysqlClient.getConnection({ autoRelease: false });
        await connection.q('START TRANSACTION');
        await connection.q(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await connection.q('COMMIT');
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const connection = await mysqlClient.getConnection({ autoRelease: false });
        await connection.q('START TRANSACTION');
        await connection.q(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await connection.q('ROLLBACK');
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(3);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
    it('insert: two parallel transcation, one commit, one rollback', async () => {
        (0, mysql_1.setDebug)(true);
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const connection1 = await mysqlClient.getConnection({ autoRelease: false });
        const connection2 = await mysqlClient.getConnection({ autoRelease: false });
        await connection1.q('START TRANSACTION');
        await connection2.q('START TRANSACTION');
        await connection1.q(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await connection2.q(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);
        await connection2.q('ROLLBACK');
        await connection1.q('COMMIT');
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(4);
        const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
        expect(not_found).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=transactions_manual.spec.js.map