import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue()],
    root: resolve(__dirname, 'src/frontend'),
    build: {
        outDir: resolve(__dirname, 'dist-frontend'),
        emptyOutDir: true,
    },
    server: {
        port: 3000,
        proxy: {
            '/api': 'http://localhost:8081',
            '/firmware': 'http://localhost:8081'
        }
    }

});
