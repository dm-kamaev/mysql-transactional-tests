"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = __importDefault(require("knex"));
function default_1(config) {
    return (0, knex_1.default)({
        client: 'mysql2',
        connection: config,
        pool: { min: 0, max: 7 }
    });
}
exports.default = default_1;
;
//# sourceMappingURL=knex_mysql2_client.js.map