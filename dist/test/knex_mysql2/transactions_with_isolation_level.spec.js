"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const knex_mysql2_client_1 = __importDefault(require("../client/knex_mysql2_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[knex mysql2]: transaction isolation level', () => {
    let mysqlClient;
    let rollback;
    const isolationLevel = 'repeatable read';
    // const isolationLevel = 'read uncommitted';
    // const isolationLevel = 'read committed';
    // const isolationLevel = 'snapshot';
    // const isolationLevel = 'serializable';
    beforeEach(() => {
        mysqlClient = (0, knex_mysql2_client_1.default)(mysqlConfig);
    });
    afterEach(async () => {
        await mysqlClient.destroy();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert: commit', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx = await mysqlClient.transaction({ isolationLevel });
        await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        await trx.commit();
        console.log('After commit');
        const result = await mysqlClient('employee').select(`*`);
        console.log('select all', result);
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient('employee').select(`*`);
        console.log('result 2', result2);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
    it('insert: commit (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.transaction(async (trx) => {
            await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        }, { isolationLevel });
        console.log('After commit');
        const result = await mysqlClient('employee').select(`*`);
        console.log('select all', result);
        expect(result).toHaveLength(4);
        await rollback();
        // unPatchMySQL();
        const result2 = await mysqlClient('employee').select(`*`);
        console.log('result 2', result2);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx = await mysqlClient.transaction({ isolationLevel });
        await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        await trx.rollback();
        console.log('After commit');
        const result = await mysqlClient('employee').select(`*`);
        console.log('select all', result);
        expect(result).toHaveLength(3);
        await rollback();
        // unPatchMySQL();
        const result2 = await mysqlClient('employee').select(`*`);
        console.log('result 2', result2);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
    it('insert: rollback (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        try {
            await mysqlClient.transaction(async (trx) => {
                await trx('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
                throw Error('Test Rollback');
            }, { isolationLevel });
        }
        catch (err) {
            console.log('After commit');
            const result = await mysqlClient('employee').select(`*`);
            console.log('select all', result);
            expect(result).toHaveLength(3);
            await rollback();
            // unPatchMySQL();
            const result2 = await mysqlClient('employee').select(`*`);
            console.log('result 2', result2);
            expect(result2).toHaveLength(3);
            console.log(result2);
        }
    });
    it('insert: two parallel transcation, one commit, one rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx1 = await mysqlClient.transaction({ isolationLevel });
        const trx2 = await mysqlClient.transaction({ isolationLevel });
        await trx1('employee').insert({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        await trx2('employee').insert({ first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 11000 });
        await trx2.rollback();
        await trx1.commit();
        const result = await mysqlClient('employee').select(`*`);
        console.log('select all', result);
        expect(result).toHaveLength(4);
        const not_found = await mysqlClient('employee').select(`*`).where('first_name', '=', 'Test2').limit(1);
        expect(not_found).toHaveLength(0);
        await rollback();
        // unPatchMySQL();
        const result2 = await mysqlClient('employee').select(`*`);
        console.log('result 2', result2);
        expect(result2).toHaveLength(3);
        console.log(result2);
    });
});
//# sourceMappingURL=transactions_with_isolation_level.spec.js.map