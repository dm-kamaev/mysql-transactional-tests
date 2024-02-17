"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const sequelize_client_1 = __importDefault(require("../client/sequelize_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[sequelize]: queries with transaction', () => {
    let mysqlClient;
    let EmployeeModel;
    let rollback;
    beforeEach(async () => {
        ({ sequelize: mysqlClient, EmployeeModel } = await (0, sequelize_client_1.default)({ ...mysqlConfig }));
    });
    afterEach(async () => {
        await mysqlClient.close();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert: commit', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx = await mysqlClient.transaction();
        await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
        await trx.commit();
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
    it('insert: commit (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.transaction(async (trx) => {
            await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
        });
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx = await mysqlClient.transaction();
        await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
        await trx.rollback();
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(3);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        try {
            await mysqlClient.transaction(async (trx) => {
                await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx });
                throw Error('Test Rollback');
            });
        }
        catch (err) {
            const result = await EmployeeModel.findAll();
            expect(result).toHaveLength(3);
            await rollback();
            const result2 = await EmployeeModel.findAll();
            expect(result2).toHaveLength(3);
        }
    });
    it('insert: two parallel transcation, one commit, one rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const trx1 = await mysqlClient.transaction();
        const trx2 = await mysqlClient.transaction();
        await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 }, { transaction: trx1 });
        await EmployeeModel.create({ first_name: 'Test2', last_name: 'Test2', age: 45, sex: 'woman', income: 1100 }, { transaction: trx2 });
        await trx2.rollback();
        await trx1.commit();
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(4);
        const not_found = await EmployeeModel.findAll({ attributes: ['id', 'first_name'], where: { 'first_name': 'Test2' }, limit: 1 });
        expect(not_found).toHaveLength(0);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=transactions.spec.js.map