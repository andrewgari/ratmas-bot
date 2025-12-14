import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**'],
  },
  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,
  // Project rules and Prettier enforcement
  {
    files: ['**/*.ts'],
    plugins: { prettier },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
