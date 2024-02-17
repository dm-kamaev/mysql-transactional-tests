import { Entity, Property, PrimaryKey, Enum } from "@mikro-orm/core";

enum Sex {
  MAN = 'man',
  WOMAN = 'woman',
}

@Entity()
export class Employee {

  @PrimaryKey()
  id!: number;

  @Property()
  first_name!: string;

  @Property()
  last_name!: string;

  @Property()
  age!: number;

  @Enum(() => Sex)
  sex!: string;

  @Property()
  income!: number;
}
