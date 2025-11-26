import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
    plugins: [
      react(),
      // Polyfills for Circle SDK (uses Node.js modules like util, stream, etc.)
      nodePolyfills({
        include: ['util', 'stream', 'buffer', 'process', 'events'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    optimizeDeps: {
      // Prevent Vite from trying to prebundle the local SDK as a package
      exclude: ['@arc/wallet-sdk'],
      include: ['@circle-fin/w3s-pw-web-sdk'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Use source during local dev; use built dist during production builds
        '@arc/wallet-sdk': path.resolve(
          __dirname,
          isProd ? './packages/sdk/dist/index.mjs' : './packages/sdk/src/index.ts'
        ),
      }
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
