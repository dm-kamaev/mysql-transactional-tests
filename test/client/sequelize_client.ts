import { Sequelize, DataTypes } from 'sequelize';
export { Sequelize, Transaction } from 'sequelize';
// const mysqlConfig = require('../mysql.config.json');

export default async function sequelizeClient(config) {
  const sequelize = new Sequelize(config.database, config.user, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    logging: false,
  });

  const EmployeeModel = sequelize.define('employee', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sex: {
      type: DataTypes.ENUM('man', 'woman'),
      allowNull: false
    },
    income: {
      type: DataTypes.BIGINT,
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

// sequelizeClient(mysqlConfig);