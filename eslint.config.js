import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

const cliCommandFiles = {
  files: ['**/cli/**/*.ts', '**/observers/**/commands.ts'],
};

export default tseslint.config(
  js.configs.recommended,
  sonarjs.configs.recommended,
  unicorn.configs.recommended,
  perfectionist.configs['recommended-natural'],
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-lines-per-function': ['error', 40],
      'max-params': ['error', 4],
      'max-statements': ['error', 20],
      'no-console': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
    },
  },
  {
    ...cliCommandFiles,
    rules: {
      'unicorn/no-process-exit': 'off',
    },
  },
);
