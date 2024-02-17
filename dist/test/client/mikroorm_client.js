"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsolationLevel = void 0;
const mysql_1 = require("@mikro-orm/mysql");
const reflection_1 = require("@mikro-orm/reflection");
// import { Employee } from './Employee.entity';
var core_1 = require("@mikro-orm/core");
Object.defineProperty(exports, "IsolationLevel", { enumerable: true, get: function () { return core_1.IsolationLevel; } });
async function mikroORMClient(config) {
    const orm = await mysql_1.MikroORM.init({
        entities: ['test/client/*.entity.ts'],
        metadataProvider: reflection_1.TsMorphMetadataProvider,
        clientUrl: `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`,
        debug: false,
    });
    return { em: orm.em.fork(), orm };
}
exports.default = mikroORMClient;
// void async function main() {
//   const { em: mysqlClient, orm } = await mikroORMClient(require('../mysql.config.json'));
//   const list = await mysqlClient.find(Employee, {});
//   console.log(list);
//   orm.close();
// }();
//# sourceMappingURL=mikroorm_client.js.map