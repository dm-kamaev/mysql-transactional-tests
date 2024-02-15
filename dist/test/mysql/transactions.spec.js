"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = require("../../src/mysql");
const mysql_client_1 = __importDefault(require("../client/mysql_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mysql]: queries with transaction', () => {
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
        const trx = await mysqlClient.beginTransaction();
        await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await trx.commit();
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const trx = await mysqlClient.beginTransaction();
        await trx.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await trx.rollback();
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(3);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
    it('insert: two parallel transcation, one commit, one rollback', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const trx1 = await mysqlClient.beginTransaction();
        const trx2 = await mysqlClient.beginTransaction();
        await trx1.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        await trx2.query(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);
        await trx2.rollback();
        await trx1.commit();
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result).toHaveLength(4);
        const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
        expect(not_found).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
    });
    // it('insert: two parallel transcation, one commit, one rollback. inverse close', async () => {
    //   const trx1 = await mysqlClient.beginTransaction();
    //   const trx2 = await mysqlClient.beginTransaction();
    //   await trx1.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
    //   await trx2.query(`INSERT INTO ${dbName}.employee SET first_name='Test2', last_name='Test2', age=45, sex='woman', income=11000`);
    //   await trx1.commit();
    //   await trx2.rollback();
    //   const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    //   console.log('select all', result);
    //   expect(result).toHaveLength(4);
    //   const not_found = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name='Test2' LIMIT 1`);
    //   expect(not_found).toHaveLength(0);
    //   await rollback();
    //   unPatchMySQL();
    //   const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
    //   console.log('result 2', result2);
    //   expect(result2).toHaveLength(3);
    //   console.log(result2);
    // });
});
//# sourceMappingURL=transactions.spec.js.map