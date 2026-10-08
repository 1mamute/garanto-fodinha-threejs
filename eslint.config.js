// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/** Readability limits shared by every TypeScript file. */
const readabilityRules = {
  // SonarSource cognitive complexity: penalises nesting, mixed boolean operators and breaks in flow.
  'sonarjs/cognitive-complexity': ['error', 10],
  complexity: ['error', 12],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
  'max-lines-per-function': ['error', { max: 70, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
  'no-nested-ternary': 'error',
  // Short names are only allowed for coordinates, loop counters and ignored values.
  'id-length': ['error', { min: 2, exceptions: ['x', 'y', 'z', 'i', 'j', '_'], properties: 'never' }],
  eqeqeq: ['error', 'always'],
  curly: ['error', 'multi-line'],
  'no-param-reassign': ['error', { props: false }],
  'prefer-const': 'error',
  'object-shorthand': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.wrangler', '.tools', 'eslint.config.js'] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vite.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs },
    rules: readabilityRules,
  },
  {
    // Tests read best as one scenario per function, so allow longer bodies there.
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      // node:test runs `test()` calls itself; their returned promises need no handling.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['test', 'describe', 'it'] },
          ],
        },
      ],
    },
  },
  prettier,
);
