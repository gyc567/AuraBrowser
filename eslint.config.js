// ESLint flat config for OpenBrowser monorepo (ESLint 9+).
//
// Strategy: Phase 0 only strictly lints core modules (security + correctness critical).
// Other modules run Prettier (formatting) only. As Phase 2 / 3 refactor, expand strict set.
//
// Core modules (strict ESLint):
// - Browserapp/main.js (main process entry, IPC hub)
// - Browserapp/cdp.js (CDP client, security boundary)
// - Browserapp/automation/local-api-server.js (HTTP API)
// - Browserapp/automation/mcp-server.js (MCP stdio)
// - Browserapp/automation/isolation.js (profile lock, security)
// - Browserapp/automation/fingerprint.js (fingerprint injection)
// - Browserapp/automation/cloud-sync.js (cloud credentials)
// - Browserapp/automation/rpa-engine.js (RPA execution)
// - Browserapp/proxy-forwarder.js (proxy with credentials)
// - Browserapp/lib/** (new shared utilities)
//
// Other modules: Prettier only.
'use strict';

const globals = require('globals');

const strictRules = {
  // Security: no console.* in main process — use lib/log.js
  'no-console': ['error', { allow: ['warn', 'error'] }],
  // Correctness
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'prefer-const': 'error',
  'no-var': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-throw-literal': 'error',
  'no-implicit-globals': 'error',
  // Style — only enforce string rules; indent/trailing-whitespace/line-endings
  // are owned by Prettier (configured in .prettierrc.json).
  quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
  semi: ['error', 'always'],
};

const lenientRules = {
  'no-console': 'off',
  'no-unused-vars': 'off',
};

const coreMain = {
  files: [
    'Browserapp/main.js',
    'Browserapp/cdp.js',
    'Browserapp/lib/**/*.js',
    'Browserapp/automation/local-api-server.js',
    'Browserapp/automation/mcp-server.js',
    'Browserapp/automation/isolation.js',
    'Browserapp/automation/fingerprint.js',
    'Browserapp/automation/cloud-sync.js',
    'Browserapp/automation/rpa-engine.js',
    'Browserapp/proxy-forwarder.js',
  ],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'commonjs',
    globals: { ...globals.node },
  },
  rules: strictRules,
};

const coreTests = {
  files: ['**/tests/**/*.test.js', '**/*.test.js', '**/*-selftest.js'],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'commonjs',
    globals: { ...globals.node },
  },
  rules: { ...strictRules, 'no-console': 'off' },
};

const otherMain = {
  files: [
    'Browserapp/**/*.js',
    '!Browserapp/main.js',
    '!Browserapp/cdp.js',
    '!Browserapp/lib/**/*.js',
    '!Browserapp/automation/local-api-server.js',
    '!Browserapp/automation/mcp-server.js',
    '!Browserapp/automation/isolation.js',
    '!Browserapp/automation/fingerprint.js',
    '!Browserapp/automation/cloud-sync.js',
    '!Browserapp/automation/rpa-engine.js',
    '!Browserapp/proxy-forwarder.js',
    '!Browserapp/tests/**',
    '!Browserapp/bundled-extension/**',
    '!Browserapp/kernels/**',
    '!Browserapp/renderer/**',
  ],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'commonjs',
    globals: { ...globals.node, ...globals.browser },
  },
  rules: lenientRules,
};

const renderer = {
  files: ['Browserapp/renderer/**/*.js'],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'script',
    globals: { ...globals.browser },
  },
  rules: lenientRules,
};

const esmScripts = {
  files: ['Browserapp/scripts/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    globals: { ...globals.node },
  },
  rules: lenientRules,
};

module.exports = [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '.pnpm-store/',
      'Browserapp/kernels/**',
      'Browserapp/browser-profiles-v2/**',
      'Browserapp/bundled-extension/.cache/**',
      '**/openbrowser-local-settings.json',
      '**/local-api-key.txt',
      '**/*-selftest-data/**',
      '**/.test-tmp/**',
      'Browserapp/assets/vendor/**', // third-party minified
      'pnpm-lock.yaml',
    ],
  },

  coreMain,
  coreTests,
  otherMain,
  renderer,
  esmScripts,
];
