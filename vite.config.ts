import {defineConfig, PluginOption} from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import {viteSingleFile} from "vite-plugin-singlefile";

// Check if SSL certificates exist
const keyPath = path.resolve(__dirname, 'certs/key.pem')
const certPath = path.resolve(__dirname, 'certs/cert.pem')
const certsExist = fs.existsSync(keyPath) && fs.existsSync(certPath)

const renamePlugin: PluginOption = {
    name: 'rename',
    enforce: 'post',
    generateBundle(options, bundle) {
        bundle['index.html'].fileName = 'quar.html';
    }
};

const isSingleFile = process.env.VITE_APP_SINGLE_FILE === 'true'

export default defineConfig({
    base: process.env.VITE_APP_PUBLIC_PATH ?? "/",
    plugins: [vue(), ...(isSingleFile ? [viteSingleFile(), renamePlugin] : [])],
    server: {
        port: 3000,
        host: '0.0.0.0',
        ...(certsExist && {
            https: {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            }
        })
    }
})