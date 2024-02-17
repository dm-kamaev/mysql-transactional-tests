"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const Employee_entity_1 = require("../client/Employee.entity");
const mikroorm_client_1 = __importDefault(require("../client/mikroorm_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mikroorm]: queries with transaction', () => {
    let mysqlClient;
    let orm;
    let rollback;
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
        await mysqlClient.begin();
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
        });
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
    it('insert: rollback', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await mysqlClient.begin();
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
            });
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
//# sourceMappingURL=transactions.spec.js.map