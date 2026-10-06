import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['plugins/superpowers/skills/systematic-debugging/condition-based-waiting-example.ts'] },
  {
    files: ['plugins/**/*.ts', 'scripts/**/*.ts'],
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
  },
);
