import { resolve } from 'path'
import { defineConfig } from 'vite'
import fs from 'fs';

let version = "0.5.0";

const copyIndexHtmlPlugin = () => {
    return {
        name: 'copy-index-html',
        apply: 'build',
        writeBundle() {
            const srcPath = resolve(__dirname, "./build/dev.html");
            const destPath = resolve(__dirname, "./index.html");
            let content = fs.readFileSync(srcPath, 'utf-8');
            content = content.replaceAll('./ma', './build/ma');

            let d = new Date();
            let _y = d.getFullYear();
            let _m = (d.getMonth() + 1).toString().padStart(2, "0");
            let _d = d.getDate().toString().padStart(2, "0");
            let buildNumber = version + "_" + _y + _m + _d + "_" + Math.random().toString().substr(2, 8);
            content = content.replace("{version}", version);
            content = content.replaceAll("{build}", buildNumber);
            content = content.replace('.js"', '.js?v=' + buildNumber + '"');

            fs.writeFileSync(destPath, content);
        }
    };
};

export default defineConfig({
    base: "./",
    plugins: [copyIndexHtmlPlugin()],
    build: {
        outDir: './build',
        assetsDir: '',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'dev.html'),
            }
        }
    },
    server: {
        open: '/dev.html',
    }
})