import { createPool } from 'mysql2';
import { Kysely, MysqlDialect } from 'kysely';

import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface EmployeeTable {
  id: Generated<number>;

  first_name: string;
  last_name: string;
  age: number;
  sex: 'man' | 'woman';
  income: number;
}

export interface Database {
  employee: EmployeeTable;
}

export type Employee = Selectable<EmployeeTable>;
export type Createmployee = Insertable<EmployeeTable>;
export type UpdateEmployee = Updateable<EmployeeTable>;

export type KyselyClient = Kysely<Database>;

// let dialect:  MysqlDialect | undefined;

export default function (config) {
  // if (!dialect) {
  const dialect = new MysqlDialect({
    pool: createPool(config),
  });
  // }

  return new Kysely<Database>({
    dialect,
  });
}
