module.exports = {
  root: true,
  extends: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Core JS rules - turn off
    'no-unused-vars': 0,
    'no-useless-escape': 0,
    'no-prototype-builtins': 0,
    'require-await': 0,
    'no-self-assign': 0,
    'no-undef': 0,

    // TypeScript rules - turn off
    '@typescript-eslint/no-unused-vars': 0,
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.expo/',
    'coverage/',
    '*.js',
    'functions/',
    'test-*.js',
  ],
};
