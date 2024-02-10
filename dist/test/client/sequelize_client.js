"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = exports.Sequelize = void 0;
const sequelize_1 = require("sequelize");
var sequelize_2 = require("sequelize");
Object.defineProperty(exports, "Sequelize", { enumerable: true, get: function () { return sequelize_2.Sequelize; } });
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return sequelize_2.Transaction; } });
// const mysqlConfig = require('../mysql.config.json');
async function sequelizeClient(config) {
    const sequelize = new sequelize_1.Sequelize(config.database, config.user, config.password, {
        host: config.host,
        port: config.port,
        dialect: 'mysql',
        logging: false,
    });
    const EmployeeModel = sequelize.define('employee', {
        id: {
            type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        first_name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false
        },
        last_name: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false
        },
        age: {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false
        },
        sex: {
            type: sequelize_1.DataTypes.ENUM('man', 'woman'),
            allowNull: false
        },
        income: {
            type: sequelize_1.DataTypes.BIGINT,
            allowNull: false
        }
    }, {
        tableName: 'employee',
        createdAt: false,
        updatedAt: false,
        // Other model options go here
    });
    await sequelize.authenticate();
    await sequelize.sync({ force: false, alter: false });
    // const result = await EmployeeModel.create({ first_name: 'Test', last_name: 'Test', age: 35, sex: 'man', income: 23405 });
    // console.log(result);
    return { sequelize, EmployeeModel };
}
exports.default = sequelizeClient;
// sequelizeClient(mysqlConfig);
//# sourceMappingURL=sequelize_client.js.map