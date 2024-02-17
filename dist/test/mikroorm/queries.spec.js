"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const Employee_entity_1 = require("../client/Employee.entity");
const mikroorm_client_1 = __importDefault(require("../client/mikroorm_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[mikroORM]: queries', () => {
    let mysqlClient;
    let orm;
    let rollback;
    beforeEach(async () => {
        ({ em: mysqlClient, orm } = await (0, mikroorm_client_1.default)({ ...mysqlConfig, debug: false }));
    });
    afterEach(async () => {
        await orm.close();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const employee = mysqlClient.create(Employee_entity_1.Employee, { first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        await mysqlClient.persistAndFlush(employee);
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
    it('update', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        const { age } = result[0];
        expect(result).toHaveLength(1);
        result[0].age++;
        await mysqlClient.persistAndFlush(result[0]);
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        expect(result2[0].age).toBe(age + 1);
        await rollback();
        const result3 = await mysqlClient.findAll(Employee_entity_1.Employee, { fields: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        expect(result3[0].age).toEqual(age);
    });
    it('delete', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const list = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        await mysqlClient.remove(list);
        await mysqlClient.removeAndFlush(list);
        const result = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result).toHaveLength(0);
        await rollback();
        const result2 = await mysqlClient.findAll(Employee_entity_1.Employee, {});
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=queries.spec.js.map