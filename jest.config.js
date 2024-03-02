/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['^.+\\.js$'],
  // modulePathIgnorePatterns: ['ptm'],

  bail: 1,
  verbose: true,
  testPathIgnorePatterns: ['dist'],
  coveragePathIgnorePatterns: ['test/client'],
  // automock: false,
  // setupFilesAfterEnv: ['./test/jest-setup.ts'],
  coverageReporters: ['json-summary', 'json-summary', 'text', 'lcov']
};
