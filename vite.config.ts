import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'node:path';

// MessageDock のビルド設定。
// - renderer (React) は src/renderer をルートに
// - main / preload は vite-plugin-electron でバンドル
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [
    react(),
    electron([
      {
        // メインプロセス
        entry: resolve(__dirname, 'src/main/main.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron'),
          },
        },
      },
      {
        // preload スクリプト
        entry: resolve(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          // preload を再ビルドしたらリロード
          options.reload();
        },
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron'),
            // preload は ESM の .mjs として出力する。
            // package.json が "type": "module" のため、preload を .js にすると
            // Electron は CJS として読もうとして import 文で失敗し、
            // window.workOne が undefined になる。.mjs なら ESM preload として
            // 正しく読み込まれる（Electron 28+ / 本プロジェクトは 31）。
            rollupOptions: {
              output: {
                entryFileNames: 'preload.mjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
