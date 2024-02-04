"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = require("../src/mysql");
const knex_1 = __importDefault(require("knex"));
const mysqlConfig = require('../test/mysql.config.json');
const db = (0, knex_1.default)({
    client: 'mysql',
    connection: mysqlConfig,
    pool: { min: 0, max: 7 }
});
void async function () {
    await db('employee').select('*');
    const { rollback } = await (0, mysql_1.startTransaction)();
    const resultInsert = await db('employee').insert({ first_name: 'Test', last_name: 'Test', age: 89, sex: 'man', income: 2242 });
    console.log(resultInsert);
    const resultCount = await db('employee').count('id');
    console.log({ resultCount });
    await rollback();
    await db.destroy();
}();
//# sourceMappingURL=knex.js.map