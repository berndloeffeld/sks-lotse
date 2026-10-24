import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'reports', '.stryker-tmp', 'src/sks/api/schema.gen.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // The directory split (ADR-0069): src/shared/ is what both sites use, src/sks/ and src/sbf/ each
  // site's own. Shared code imports neither site, and neither site imports the other, so a site's
  // build never pulls in the other's code (the SBF build: no API client, no SKS data, ADR-0067).
  ...[
    { dir: 'shared', forbidden: ['sks', 'sbf'] },
    { dir: 'sks', forbidden: ['sbf'] },
    { dir: 'sbf', forbidden: ['sks'] },
  ].map(({ dir, forbidden }) => ({
    files: [`src/${dir}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: forbidden.map((other) => ({
            regex: `^\\.{1,2}/(\\.\\./)*${other}/`,
            message: `src/${dir}/ may not import from src/${other}/: move what both need to src/shared/ (ADR-0069).`,
          })),
        },
      ],
    },
  })),
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: globals.node },
  },
  eslintConfigPrettier,
)
