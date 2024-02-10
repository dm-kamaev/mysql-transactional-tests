"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = require("mysql2");
const kysely_1 = require("kysely");
// let dialect:  MysqlDialect | undefined;
function default_1(config) {
    // if (!dialect) {
    const dialect = new kysely_1.MysqlDialect({
        pool: (0, mysql2_1.createPool)(config)
    });
    // }
    return new kysely_1.Kysely({
        dialect,
    });
}
exports.default = default_1;
;
//# sourceMappingURL=kysely_client.js.map