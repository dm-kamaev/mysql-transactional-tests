"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const kysely_client_1 = __importDefault(require("../client/kysely_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[kysely]: queries with transaction', () => {
    let mysqlClient;
    let rollback;
    beforeEach(() => {
        mysqlClient = (0, kysely_client_1.default)(mysqlConfig);
    });
    afterEach(async () => {
        await mysqlClient.destroy();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert: commit', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.transaction().execute(async (trx) => {
            return await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
        });
        const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        try {
            await mysqlClient.transaction().execute(async (trx) => {
                await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
                throw new Error('Stop');
            });
        }
        catch (error) {
            const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
            expect(result).toHaveLength(3);
            await rollback();
            const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
            expect(result2).toHaveLength(3);
        }
    });
    it('insert: two parallel transcation, one commit, one rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.transaction().execute(async (trx) => {
            await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }).execute();
        });
        try {
            await mysqlClient.transaction().execute(async (trx) => {
                await trx.insertInto('employee').values({ first_name: 'Test', last_name: 'Test', age: 45, sex: 'woman', income: 1100 }).execute();
                throw new Error('Error');
            });
        }
        catch (err) {
            // skip error
        }
        const result = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result).toHaveLength(4);
        const not_found = await mysqlClient.selectFrom('employee').select('id').where('first_name', '=', 'Test2').limit(1).execute();
        expect(not_found).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient.selectFrom('employee').selectAll('employee').execute();
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=transactions.spec.js.map