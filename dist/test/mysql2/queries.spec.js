"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const mysql2_client_1 = __importDefault(require("../client/mysql2_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mysql2]: queries', () => {
    let mysqlClient;
    let rollback;
    const dbName = mysqlConfig.database;
    beforeEach(() => {
        mysqlClient = new mysql2_client_1.default({ ...mysqlConfig, debug: false });
    });
    afterEach(() => {
        mysqlClient.close();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.query(`INSERT INTO ${dbName}.employee SET first_name='Test', last_name='Test', age=35, sex='man', income=23405`);
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        console.log('select all', result);
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
    it('update', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
        console.log('origin', result);
        const { id, age } = result[0];
        expect(result).toHaveLength(1);
        await mysqlClient.query(`UPDATE ${dbName}.employee SET age=age+1 WHERE id = ${id}`);
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
        console.log('after update', result2);
        expect(result2[0].age).toBe(age + 1);
        await rollback();
        const result3 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee WHERE first_name = 'Lisa' LIMIT 1`);
        expect(result3[0].age).toEqual(age);
        console.log('rollback to', result3);
    });
    it('delete', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.query(`DELETE FROM ${dbName}.employee`);
        const result = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        console.log('select all', result);
        expect(result).toHaveLength(0);
        await rollback();
        // unPatch();
        const result2 = await mysqlClient.query(`SELECT * FROM ${dbName}.employee`);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
});
//# sourceMappingURL=queries.spec.js.map