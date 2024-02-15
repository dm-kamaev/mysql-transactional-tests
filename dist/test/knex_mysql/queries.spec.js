"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = require("../../src/mysql");
const knex_mysql_client_1 = __importDefault(require("../client/knex_mysql_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[knex mysql]: queries', () => {
    let mysqlClient;
    let rollback;
    beforeEach(() => {
        mysqlClient = (0, knex_mysql_client_1.default)(mysqlConfig);
    });
    afterEach(async () => {
        await mysqlClient.destroy();
    });
    afterAll(() => {
        (0, mysql_1.unPatch)();
    });
    it('insert', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        await mysqlClient('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        const result = await mysqlClient('employee').select('*');
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient('employee').select('*');
        expect(result2).toHaveLength(3);
    });
    it('update', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        const result = await mysqlClient('employee').select('*').where('first_name', '=', 'Lisa').limit(1);
        const { id, age } = result[0];
        expect(result).toHaveLength(1);
        await mysqlClient('employee').increment('age', 1).where({ id });
        const result2 = await mysqlClient('employee').select('*').where('first_name', '=', 'Lisa').limit(1);
        expect(result2[0].age).toBe(age + 1);
        await rollback();
        const result3 = await mysqlClient('employee').select('*').where('first_name', '=', 'Lisa').limit(1);
        expect(result3[0].age).toEqual(age);
    });
    it('delete', async () => {
        ({ rollback } = await (0, mysql_1.startTransaction)());
        await mysqlClient('employee').del();
        const result = await mysqlClient('employee').select('*');
        expect(result).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient('employee').select('*');
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=queries.spec.js.map