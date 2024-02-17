"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const sequelize_client_1 = __importStar(require("../client/sequelize_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[sequelize]: transaction with isolation level', () => {
    let mysqlClient;
    let rollback;
    let EmployeeModel;
    const isolationLevel = sequelize_client_1.Transaction.ISOLATION_LEVELS.REPEATABLE_READ;
    // const isolationLevel = Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED;
    // const isolationLevel = Transaction.ISOLATION_LEVELS.READ_COMMITTED;
    // const isolationLevel = Transaction.ISOLATION_LEVELS.SERIALIZABLE;
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
        const trx = await mysqlClient.transaction({ isolationLevel });
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
        await mysqlClient.transaction({ isolationLevel }, async (trx) => {
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
        const trx = await mysqlClient.transaction({ isolationLevel });
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
            await mysqlClient.transaction({ isolationLevel }, async (trx) => {
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
        const trx1 = await mysqlClient.transaction({ isolationLevel });
        const trx2 = await mysqlClient.transaction({ isolationLevel });
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
//# sourceMappingURL=transactions_with_isolation_level.spec.js.map