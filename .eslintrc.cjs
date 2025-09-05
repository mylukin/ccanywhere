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
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'off',

    // General
    'no-console': 'off', // We use console for CLI output
    'prefer-const': 'warn',
    'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
    
    // Prettier integration - changed from 'error' to 'warn' to be less strict
    'prettier/prettier': ['warn', {
      endOfLine: 'auto' // Be more flexible with line endings
    }]
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    'coverage/**/*',
    '*.cjs'
  ]
};