// @ts-check

import { eslintBaseConfig } from '@swiftpost/config/eslintBaseConfig.mjs';

const eslintConfig = [
  ...eslintBaseConfig,
  {
    files: ['**/*.test.ts'],
    rules: {
      // `node:test` exposes `test()` and `describe()` as promise-returning
      // functions that the runner itself awaits. Calling them without `await`
      // is the documented usage, not a dropped promise.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];

export default eslintConfig;
