module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname
  },
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'off',

    // General
    'no-console': 'off', // We use console for CLI output
    'prefer-const': 'error',
    'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
    
    // Prettier integration
    'prettier/prettier': 'error'
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    'coverage/**/*',
    '*.cjs'
  ]
};