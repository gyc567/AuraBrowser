/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow up to 100 char header (relaxed from default 72 for tech-heavy commits)
    'header-max-length': [2, 'always', 100],
    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],
    // Type must be in allowed list
    'type-enum': [
      2,
      'always',
      [
        'feat', // new feature
        'fix', // bug fix
        'docs', // documentation only
        'style', // formatting, no code change
        'refactor', // code change without new feature or bug fix
        'perf', // performance improvement
        'test', // adding/correcting tests
        'build', // build system / dependencies
        'ci', // CI configuration
        'chore', // maintenance (non-src)
        'revert', // revert previous commit
        'security', // security fix
      ],
    ],
    // Subject must not end with period
    'subject-full-stop': [2, 'never', '.'],
    // Scope optional, lowercase
    'scope-case': [2, 'always', 'lower-case'],
  },
};
