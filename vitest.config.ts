import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './test/setup.ts',
        css: true,
        // Exclude Hardhat tests (use npx hardhat test) and E2E tests (use npx playwright test)
        exclude: [
            '**/node_modules/**',
            'test/*.spec.ts',           // Hardhat smart contract tests
            'tests/e2e/**',             // Playwright E2E tests
            'backend/**',               // Backend tests
            'packages/sdk/test/**',     // SDK tests (complex mocks, run separately)
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData',
                'dist/',
                'backend/',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
