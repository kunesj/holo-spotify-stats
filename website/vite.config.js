import { resolve } from 'path';
import { defineConfig } from 'vite';
import BuildStats from './plugins/vite-plugin-build-stats';

export default defineConfig({
    root: 'src',
    publicDir: '../public',  // Relative to the root
    base: '/',
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
        // Builds stats.json
        BuildStats({
            srcDir: resolve(__dirname, '../spotify_stats'),
            destFile: resolve(__dirname, 'dist/stats.json')
        })
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
