import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    publicDir: '../public',  // Relative to the root
    base: '/website/dist/',
    build: {
        outDir: '../dist',  // Relative to the root
        sourcemap: true,
        minify: 'esbuild',
        cssMinify: true,
        rollupOptions: {
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                quietDeps: true
            }
        },
        devSourcemap: true
    },
    plugins: [
    ],
    resolve: {
        alias: {
            '~': resolve(__dirname, 'src')
        }
    },
    server: {
        port: 8080,
        hot: true
    }
});
