"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kysely_1 = require("kysely");
const mysql2_1 = require("../../src/mysql2");
const kysely_client_1 = __importDefault(require("../client/kysely_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[kysely]: queries', () => {
    let mysqlClient;
    let rollback;
    beforeEach(() => {
        mysqlClient = (0, kysely_client_1.default)({ ...mysqlConfig, debug: false });
    });
    afterEach(async () => {
        await mysqlClient.destroy();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
        const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result2).toHaveLength(3);
    });
    it('update', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const result = await mysqlClient.selectFrom('employee').select(['id', 'age']).where('first_name', '=', 'Lisa').limit(1).execute();
        expect(result).toHaveLength(1);
        await mysqlClient.updateTable('employee').set({ age: (0, kysely_1.sql) `age + 1` }).where('id', '=', result[0].id).execute();
        const result2 = await mysqlClient.selectFrom('employee').select(['id', 'age']).where('first_name', '=', 'Lisa').limit(1).executeTakeFirstOrThrow();
        expect(result2.age).toBe(result[0].age + 1);
        await rollback();
        const result3 = await mysqlClient.selectFrom('employee').select(['id', 'age']).where('first_name', '=', 'Lisa').limit(1).executeTakeFirstOrThrow();
        expect(result3.age).toEqual(result[0].age);
    });
    it('delete', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.deleteFrom('employee').execute();
        const result = await mysqlClient.selectFrom('employee').select('employee.id').execute();
        expect(result).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient.selectFrom('employee').select('employee.id').execute();
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=queries.spec.js.map