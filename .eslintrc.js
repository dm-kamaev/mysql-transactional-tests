module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
    commonjs: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier', 'promise', 'no-unsafe-regex', 'new-with-error'],
  ignorePatterns: ['.eslintrc.js'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:promise/recommended',
    'plugin:prettier/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    'max-len': [
      2,
      {
        code: 200,
        tabWidth: 2,
        ignoreComments: true,
        ignoreUrls: true,
      },
    ],
    indent: ['error', 2, { SwitchCase: 1, ignoredNodes: ['TemplateLiteral *', 'PropertyDefinition'] }],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'require-atomic-updates': 'off',
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '_',
        argsIgnorePattern: '_',
      },
    ],
    'no-use-before-define': ['error', { functions: false, classes: false }],
    'no-multi-spaces': ['error'],
    'array-callback-return': ['error'],
    'block-scoped-var': ['error'],
    curly: ['error'],
    'no-throw-literal': ['error'],
    'guard-for-in': ['error'],
    'no-extend-native': ['error'],

    eqeqeq: ['error', 'always'],
    'no-extra-boolean-cast': ['off'],
    'no-console': ['off'],
    'no-useless-escape': ['off'],

    // === node js
    'handle-callback-err': ['error'],
    'global-require': ['error'],
    'callback-return': ['error'],
    'no-buffer-constructor': ['error'],
    'no-new-require': ['error'],
    // ===

    // === promise
    'promise/no-promise-in-callback': 'off',

    // === no-unsafe-regex
    'no-unsafe-regex/no-unsafe-regex': 2,

    // always 'new' for throw
    'new-with-error/new-with-error': 2,

    // typescript
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/explicit-module-boundary-types': ['off'],
    '@typescript-eslint/no-this-alias': ['off'],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '_',
        argsIgnorePattern: '_',
      },
    ],
  },
};
