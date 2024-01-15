CREATE TABLE employee(
  id int unsigned NOT NULL AUTO_INCREMENT,
  first_name varchar(255) NOT NULL,
  last_name CHAR(255) NOT NULL,
  age int unsigned NOT NULL,
  sex enum('man', 'woman') NOT NULL,
  income bigint NOT NULL,
  PRIMARY KEY (`id`)
);

INSERT INTO employee VALUES
   (DEFAULT, 'Ivan', 'Ivanov', 19, 'man', 2000),
   (DEFAULT, 'Lisa', 'Summer', 20, 'woman', 7000),
   (DEFAULT, 'Victoria', 'Brown', 25, 'man', 5000);