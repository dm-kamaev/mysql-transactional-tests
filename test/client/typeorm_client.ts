import { DataSource } from 'typeorm';

export { DataSource } from 'typeorm';
export { Employee } from './Employee.typeorm.entity';

export default async function typeORMClient(config) {
  const myDataSource = new DataSource({
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password,
    database: config.database,
    entities: ['test/client/Employee.typeorm.entity.ts'],
    logging: false,
    // synchronize: true,
  });
  return myDataSource.initialize();
}

// const mysqlConfig = require('../mysql.config.json');
// void async function example() {
//   const mysqlClient = await typeORMClient(mysqlConfig);
//   const employeeRepo = mysqlClient.getRepository(Employee);
//   const list = await employeeRepo.find();
//   console.log(list);
//   // mysqlClient
// }();
