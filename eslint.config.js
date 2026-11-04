import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.data']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `motion` is used as <motion.div>; core no-unused-vars does not see JSX member usage.
      'no-unused-vars': ['error', { varsIgnorePattern: '^([A-Z_]|motion$)', argsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Server code (Vercel function, API, scripts) runs on Node.
    files: ['server/**/*.js', 'api/**/*.js', 'scripts/**/*.js', 'shared/**/*.js', '*.config.js', 'server.js', 'migrate.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Context/UI modules intentionally export hooks alongside components.
    files: ['src/context/**/*.jsx', 'src/admin/ui.jsx', 'src/admin/fields.jsx', 'src/components/Cards.jsx', 'src/components/Reveal.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
