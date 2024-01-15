/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['^.+\\.js$'],
  modulePathIgnorePatterns: ['ptm'],

  bail: 1,
  verbose: true,
  // automock: false,
  // setupFilesAfterEnv: ['./test/jest-setup.ts'],
};
