import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

enum Sex {
  MAN = 'man',
  WOMAN = 'woman',
}

@Entity()
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  first_name!: string;

  @Column()
  last_name!: string;

  @Column()
  age!: number;

  @Column({
    type: 'enum',
    enum: Sex,
  })
  sex!: string;

  @Column()
  income!: number;
}
