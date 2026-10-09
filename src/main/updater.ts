import { app, type BrowserWindow } from 'electron';
import { spawnSync } from 'node:child_process';
import updaterPkg from 'electron-updater';

const { autoUpdater } = updaterPkg;

// 自動アップデート（GitHub Releases の latest-mac.yml を参照）。
// macOS の自動更新は署名済みアプリでのみ動作するため、未署名ビルドや開発時は
// 何もしない。その場合は従来どおり UpdateBanner がリリースページへ案内する。

type Status = {
  state: 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
};

export function setupAutoUpdate(getWindow: () => BrowserWindow | null): boolean {
  if (!app.isPackaged || process.env.WORKONE_DISABLE_AUTOUPDATE) return false;
  // 署名が無いと Squirrel.Mac が更新を適用できない
  if (process.platform === 'darwin' && !isSigned()) {
    return false;
  }
  const send = (s: Status) => getWindow()?.webContents.send('update-status', s);

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }));
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }));
  autoUpdater.on('error', () => send({ state: 'error' }));

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 10000);
  setInterval(check, 6 * 60 * 60 * 1000);
  return true;
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}

// 実行中のアプリが Developer ID で署名されているか（codesign -dv は情報を stderr に出す）
function isSigned(): boolean {
  try {
    const appPath = app.getPath('exe').replace(/\/Contents\/MacOS\/[^/]+$/, '');
    const r = spawnSync('codesign', ['-dv', appPath], { encoding: 'utf8' });
    return /Authority=Developer ID Application/.test(`${r.stdout}${r.stderr}`);
  } catch {
    return false;
  }
}
