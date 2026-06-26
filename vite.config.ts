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
