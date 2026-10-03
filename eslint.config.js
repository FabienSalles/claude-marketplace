import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['plugins/goal/scripts/**/*.ts', 'plugins/goal/src/**/*.ts', 'plugins/goal/tests/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { project: './tsconfig.json' },
  },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    '@typescript-eslint/strict-boolean-expressions': 'error',
  },
});
