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
const Employee_entity_1 = require("../client/Employee.entity");
const mikroorm_client_1 = __importStar(require("../client/mikroorm_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mikroorm]: transaction with isolation level', () => {
    let mysqlClient;
    let orm;
    let rollback;
    const isolationLevel = mikroorm_client_1.IsolationLevel.READ_UNCOMMITTED;
    // const isolationLevel = IsolationLevel.READ_COMMITTED;
    // const isolationLevel = IsolationLevel.SNAPSHOT;
    // const isolationLevel = IsolationLevel.REPEATABLE_READ;
    // const isolationLevel = IsolationLevel.SERIALIZABLE;
    beforeEach(async () => {
        ({ em: mysqlClient, orm } = await (0, mikroorm_client_1.default)({ ...mysqlConfig }));
    });
    afterEach(async () => {
        await orm.close();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert: commit', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.begin({ isolationLevel });
        const employee = new Employee_entity_1.Employee();
        employee.first_name = 'Test';
        employee.last_name = 'Test';
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        mysqlClient.persist(employee);
        await mysqlClient.commit();
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
    it('insert: commit (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.transactional(async (em) => {
            const employee = new Employee_entity_1.Employee();
            employee.first_name = 'Test';
            employee.last_name = 'Test';
            employee.age = 35;
            employee.sex = 'man';
            employee.income = 23405;
            em.persist(employee);
        }, { isolationLevel });
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.begin({ isolationLevel });
        const employee = new Employee_entity_1.Employee();
        employee.first_name = 'Test';
        employee.last_name = 'Test';
        employee.age = 35;
        employee.sex = 'man';
        employee.income = 23405;
        mysqlClient.persist(employee);
        await mysqlClient.rollback();
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(3);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback (cb trx)', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        try {
            await mysqlClient.transactional(async (em) => {
                const employee = new Employee_entity_1.Employee();
                employee.first_name = 'Test';
                employee.last_name = 'Test';
                employee.age = 35;
                employee.sex = 'man';
                employee.income = 23405;
                em.persist(employee);
                throw Error('Test Rollback');
            }, { isolationLevel });
        }
        catch (err) {
            const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
            expect(result).toHaveLength(3);
            await rollback();
            const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
            expect(result2).toHaveLength(3);
        }
    });
});
//# sourceMappingURL=transactions_with_isolation_level.spec.js.map