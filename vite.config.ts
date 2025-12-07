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
      // Remove console.log in production builds
      minify: 'esbuild',
      // Code splitting for better bundle size
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Separate ethers into its own chunk (largest dependency)
            if (id.includes('node_modules/ethers')) {
              return 'vendor-ethers';
            }
            // React core libraries
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'vendor-react';
            }
            // UI libraries
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react') || id.includes('node_modules/react-hot-toast')) {
              return 'vendor-ui';
            }
          },
        },
      },
      // Increase chunk size warning limit (ethers is large)
      chunkSizeWarningLimit: 600,
    },
    esbuild: {
      // Drop console.log and debugger in production
      drop: isProd ? ['console', 'debugger'] : [],
    },
  };
});
