import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ArcWalletSDK',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['ethers', 'idb-keyval', '@sentry/browser'],
      output: {
        globals: {
          'ethers': 'ethers',
          'idb-keyval': 'idbKeyval',
          '@sentry/browser': 'Sentry',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
