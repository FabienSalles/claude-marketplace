import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['plugins/goal/**/*.ts', 'scripts/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { project: './tsconfig.json' },
  },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      { allowString: false, allowNumber: false, allowNullableObject: false },
    ],
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  },
});
