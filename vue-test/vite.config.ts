import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import * as path from "node:path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        preserveSymlinks: true,
        alias: {
            'react': path.resolve(__dirname, '../packages/react'),
            'react-dom': path.resolve(__dirname, '../packages/react-dom'),
            '@react-vue/adapter': path.resolve(__dirname, '../packages/adapter'),
            '@react-vue/react': path.resolve(__dirname, '../packages/react'),
            '@react-vue/react-dom': path.resolve(__dirname, '../packages/react-dom')
        },
        external: ['react', 'react-dom']
    },
    optimizeDeps: {
        exclude: ['react', 'react-dom', '@react-vue/adapter'], // 禁止预构建这些依赖
    },

})
