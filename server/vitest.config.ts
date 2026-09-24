import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/collector.main.ts',
        'src/app.module.ts',
        'src/collector.module.ts',
        'src/intel/intel.module.ts',
        'src/health/health.module.ts',
        'src/infra/radar-infra.module.ts',
        'src/infra/mysql/**',
        'src/infra/rpc/**',
        'src/infra/http/**',
        'src/ports/**',
        'src/**/*.spec.ts',
        'src/test-support.ts',
      ],
      thresholds: {
        branches: 90,
        lines: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
