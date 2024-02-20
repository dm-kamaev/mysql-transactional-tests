import { MikroORM, MySqlDriver, SqlEntityManager } from '@mikro-orm/mysql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
// import { Employee } from './Employee.entity';
export { IsolationLevel } from '@mikro-orm/core';

export type EM = SqlEntityManager<MySqlDriver>;

export default async function mikroORMClient(config) {
  const orm = await MikroORM.init({
    entities: ['test/client/*.mikroorm.entity.ts'],
    metadataProvider: TsMorphMetadataProvider,
    clientUrl: `mysql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`,
    debug: false,
  });
  return { em: orm.em.fork(), orm };
}


// void async function main() {
//   const { em: mysqlClient, orm } = await mikroORMClient(require('../mysql.config.json'));
//   const list = await mysqlClient.find(Employee, {});
//   console.log(list);
//   orm.close();
// }();