"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("../../src/mysql2");
const sequelize_client_1 = __importDefault(require("../client/sequelize_client"));
const mysqlConfig = require('../mysql.config.json');
describe('[sequelize]: queries', () => {
    let mysqlClient;
    let EmployeeModel;
    let rollback;
    beforeEach(async () => {
        ({ sequelize: mysqlClient, EmployeeModel } = await (0, sequelize_client_1.default)({ ...mysqlConfig, debug: false }));
    });
    afterEach(async () => {
        await mysqlClient.close();
    });
    afterAll(() => {
        (0, mysql2_1.unPatch)();
    });
    it('insert', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(4);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
    it('update', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        const result = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        const { id, age } = result[0];
        expect(result).toHaveLength(1);
        await EmployeeModel.increment('age', { where: { id } });
        const result2 = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        expect(result2[0].age).toBe(age + 1);
        await rollback();
        const result3 = await EmployeeModel.findAll({ attributes: ['id', 'age'], where: { first_name: 'Lisa' }, limit: 1 });
        expect(result3[0].age).toEqual(age);
    });
    it('delete', async () => {
        ({ rollback } = await (0, mysql2_1.startTransaction)());
        await EmployeeModel.destroy({
            where: {},
        });
        const result = await EmployeeModel.findAll();
        expect(result).toHaveLength(0);
        await rollback();
        const result2 = await EmployeeModel.findAll();
        expect(result2).toHaveLength(3);
    });
});
//# sourceMappingURL=queries.spec.js.map