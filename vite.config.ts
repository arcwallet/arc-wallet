import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/passkeys': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {
      // Polyfill for Circle SDK (uses Node.js globals)
      global: 'globalThis',
    },
    optimizeDeps: {
      // Prevent Vite from trying to prebundle the local SDK as a package
      exclude: ['@arc/wallet-sdk'],
      include: ['util'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Use source during local dev; use built dist during production builds
        '@arc/wallet-sdk': path.resolve(
          __dirname,
          isProd ? './packages/sdk/dist/index.mjs' : './packages/sdk/src/index.ts'
        ),
        // Node.js polyfills for Circle SDK
        util: 'util',
      }
    },
    build: {
      rollupOptions: {
        plugins: [],
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
