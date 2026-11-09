import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test_jwt_secret_must_be_at_least_32_characters_long_for_security'
    },
    testTimeout: 25000,
    hookTimeout: 25000,
    fileParallelism: false
    // NOTE: Intencionalmente SEM setupFiles para não carregar o mock de disco (setup-disk.ts)
  }
});
