import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test_jwt_secret_must_be_at_least_32_characters_long_for_security'
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    setupFiles: ['./tests/setup-disk.ts']
  }
});
