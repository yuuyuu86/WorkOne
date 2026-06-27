import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  session,
  Notification,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dev サーバー URL（vite-plugin-electron が注入）
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const RENDERER_DIST = path.join(__dirname, '../dist');
// アイコン等のリソース置き場（dev は repo の build/、本番は resources/build/）
const RESOURCES_DIR = VITE_DEV_SERVER_URL
  ? path.join(__dirname, '..', 'build')
  : path.join(process.resourcesPath, 'build');

// アプリ名を明示（開発時の "Electron" 表示や通知タイトルを WorkOne に）
app.setName('WorkOne');

// 改名前（MessageDock）のデータを一度だけ新名称（WorkOne）へ移行する。
// これでログイン・設定・履歴をそのまま引き継ぐ（userData フォルダごとリネーム）。
try {
  const appData = app.getPath('appData');
  const oldDir = path.join(appData, 'MessageDock');
  const newDir = path.join(appData, 'WorkOne');
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
    fs.renameSync(oldDir, newDir);
  }
  // セッション領域フォルダも persist:messagedock -> persist:workone へリネーム
  const partDir = path.join(newDir, 'Partitions');
  const oldPart = path.join(partDir, 'persist%3Amessagedock');
  const newPart = path.join(partDir, 'persist%3Aworkone');
  if (fs.existsSync(oldPart) && !fs.existsSync(newPart)) {
    fs.renameSync(oldPart, newPart);
  }
} catch {
  /* 移行失敗時は新規データで起動（その場合は再ログインが必要） */
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// --- ウィンドウのサイズ・位置を記憶する ---
const windowStatePath = () =>
  path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): { width: number; height: number; x?: number; y?: number } {
  try {
    const s = JSON.parse(fs.readFileSync(windowStatePath(), 'utf-8'));
    if (s && typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch {
    /* 初回は無し */
  }
  return { width: 1280, height: 820 };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return;
  const b = mainWindow.getBounds();
  try {
    fs.writeFileSync(windowStatePath(), JSON.stringify(b));
  } catch {
    /* 失敗は無視 */
  }
}

// アプリ全体の User-Agent を「素の Chrome」に正規化する。
// Electron 標準 UA に含まれる "Electron/x.y.z"（およびアプリ名トークン）を
// 取り除く。中身は本物の Chromium なのでエンジンと矛盾しない範囲の調整で、
// Slack など一部サービスの「未対応ブラウザ」判定を回避するため。
// 表記上の Chrome メジャーバージョン下限。
// Electron 31 のエンジンは Chrome 126 相当だが、Slack などは古い Chrome を
// 「未対応ブラウザ」として弾くため、UA 上のバージョンだけ新しめに引き上げる。
const MIN_CHROME_MAJOR = 140;

// 全サービスで共有する Web 表示プロファイル（renderer 側の SHARED_PARTITION と一致）
const SHARED_PARTITION = 'persist:workone';

function normalizedUserAgent(): string {
  return app.userAgentFallback
    .replace(/\sElectron\/[\d.]+/i, '')
    .replace(/\sworkone\/[\d.]+/i, '')
    .replace(/Chrome\/(\d+)(\.[\d.]+)/i, (full, major: string, rest: string) =>
      Number(major) < MIN_CHROME_MAJOR ? `Chrome/${MIN_CHROME_MAJOR}${rest}` : full
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'WorkOne',
    backgroundColor: '#F5F5F7',
    titleBarStyle: 'hiddenInset',
    icon: path.join(RESOURCES_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // --- セキュリティ設定（仕様の必須条件） ---
      nodeIntegration: false, // レンダラーで Node を無効化
      contextIsolation: true, // コンテキスト分離を有効化
      sandbox: false, // preload で contextBridge を使うため false（Node API は使わない）
      webviewTag: true, // 各サービスを <webview> で表示するため有効化
    },
  });

  // メインウィンドウ（React UI）からのウィンドウ要求を処理する。
  // - frameName が 'workone-pin' のものは「小窓で固定」専用ウィンドウとして開く。
  //   window.open はトリガーにだけ使い、ウィンドウ生成はメイン側で手動で行う。
  //   （window.open 経由の allow だと親=デフォルトセッションを引き継いでしまい、
  //   共有プロファイルのログインが保持されないため、deny して自分で作る）
  // - それ以外の外部リンクは外部ブラウザへ
  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName === 'workone-pin' && /^https?:\/\//i.test(url)) {
      openPinnedWindow(url);
      return { action: 'deny' };
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // サイズ・位置の保存
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  // ウィンドウを閉じても終了せず、バックグラウンドに常駐する
  // （各サービスの webview を生かしたまま通知を受け続けるため）。
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      saveWindowState();
      mainWindow?.hide();
      if (process.platform === 'darwin') app.dock?.hide?.();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showMainWindow() {
  if (process.platform === 'darwin') app.dock?.show?.();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// 登録可能ドメイン（おおよその eTLD+1）を求める。
// 例: app.slack.com -> slack.com / mail.google.com -> google.com /
//     mail.yahoo.co.jp -> yahoo.co.jp
function registrableDomain(host: string): string {
  const multiPartTld = new Set([
    'co.jp', 'ne.jp', 'ac.jp', 'or.jp', 'go.jp', 'ed.jp',
    'co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.kr', 'com.br',
  ]);
  const parts = host.toLowerCase().split('.');
  if (parts.length >= 3 && multiPartTld.has(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isSameSite(a: string, b: string): boolean {
  try {
    return (
      registrableDomain(new URL(a).hostname) ===
      registrableDomain(new URL(b).hostname)
    );
  } catch {
    return false;
  }
}

// http(s) など Web 標準のスキームかどうか
function isWebUrl(url: string): boolean {
  return /^(https?|about|data|blob):/i.test(url);
}

// <webview> が attach されたときの挙動制御。
app.on('web-contents-created', (_event, contents) => {
  // すべての webContents（webview / 子ウィンドウ）で、外部アプリを起動する
  // カスタムスキーム（slack:// / zoommtg:// / msteams:// など）への遷移を阻止する。
  // これがないと「ブラウザで使う」つもりでもデスクトップアプリが起動してしまう。
  const blockExternalScheme = (e: Electron.Event, url: string) => {
    if (!isWebUrl(url)) {
      e.preventDefault();
    }
  };
  contents.on('will-navigate', blockExternalScheme);
  contents.on('will-redirect', blockExternalScheme);

  if (contents.getType() === 'webview') {
    // 各 webview の UA を確実に素の Chrome に設定（属性／fallback の取りこぼし対策）
    contents.setUserAgent(normalizedUserAgent());

    // ポップアップをアプリ内の子ウィンドウで開く設定（共有プロファイルでログイン継続）。
    const openInChildWindow = {
      action: 'allow' as const,
      overrideBrowserWindowOptions: {
        width: 1100,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
          partition: SHARED_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
        },
      },
    };

    contents.setWindowOpenHandler(({ url }) => {
      // 同一サービス内の通常リンク（例: Slack のワークスペースを開く）は
      // 同じ画面内で遷移させる（余計なウィンドウを増やさない）。
      if (/^https?:\/\//i.test(url) && isSameSite(url, contents.getURL())) {
        contents.loadURL(url);
        return { action: 'deny' };
      }
      // about:blank 経由のポップアップ（Slack 等が後から URL を差し込む方式）や
      // 別サイトのログイン/SSO ポップアップは、アプリ内の子ウィンドウで開く。
      // ここを拒否すると「クリックしても何も起きない」状態になる。
      if (
        url === 'about:blank' ||
        url === '' ||
        /^https?:\/\//i.test(url)
      ) {
        return openInChildWindow;
      }
      // slack:// などのアプリ起動スキームは無視
      return { action: 'deny' };
    });

    // 「アプリで開きますか？」中継ページの自動スキップ。
    // デスクトップアプリ起動（slack:// 等）は既にブロックしているので、
    // ページ内に残る「ブラウザで使用する / continue in browser」リンクを
    // 自動でクリックして、Web 版へ進める。見つからなければ何もしない（安全）。
    const INTERSTITIAL_HOSTS = [
      'slack.com',
      'app.slack.com',
      'zoom.us',
      'meet.google.com',
      'teams.microsoft.com',
    ];
    contents.on('did-finish-load', () => {
      let host = '';
      try {
        host = new URL(contents.getURL()).hostname;
      } catch {
        return;
      }
      if (!INTERSTITIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
        return;
      }
      contents
        .executeJavaScript(
          `(function(){try{
            var re=[/ブラウザ.{0,6}(使用|続行|開く|利用)/,/(use|open|continue|launch).{0,20}browser/i,/in your browser/i,/web ?app/i];
            var els=[].slice.call(document.querySelectorAll('a,button,[role=button]'));
            for(var i=0;i<els.length;i++){var t=(els[i].innerText||els[i].textContent||'').trim();
              if(t&&re.some(function(p){return p.test(t);})){els[i].click();return true;}}
            return false;
          }catch(e){return false;}})();`
        )
        .catch(() => {});
    });
  }
});

// 外部リンクを明示的に開きたいときの IPC（preload 経由で renderer から呼ぶ）
ipcMain.handle('open-external', async (_event, url: string) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// Web 表示の共有プロファイルのキャッシュ／ログインセッション（Cookie 等）を削除する。
// partitions には削除したいパーティション名（既定では共有の persist:workone）を渡す。
// これにより全サービスからログアウト状態になり、キャッシュもクリアされる。
ipcMain.handle('clear-web-cache', async (_event, partitions: string[]) => {
  const targets = [
    session.defaultSession,
    ...(Array.isArray(partitions)
      ? partitions.map((p) => session.fromPartition(p))
      : []),
  ];
  for (const s of targets) {
    try {
      await s.clearStorageData(); // Cookie / localStorage / IndexedDB など
      await s.clearCache(); // HTTP キャッシュ
    } catch {
      // 個別の失敗は無視して続行
    }
  }
  return true;
});

// OS 通知を出す（将来の API 連携や、未読バッジ増加時のトリガーから呼ばれる）。
ipcMain.handle('notify', (_event, title: string, body: string) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title: title || 'WorkOne', body: body || '' });
  n.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  n.show();
  return true;
});

// 会議などを「小窓で常駐」させる: 常に最前面の小型ウィンドウで URL を開く。
// 共有プロファイル(SHARED_PARTITION)を使うので、本体と同じログイン状態を引き継ぐ。
let pinnedWindow: BrowserWindow | null = null;
function openPinnedWindow(url: string): boolean {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  // 既に小窓がある場合は再利用
  if (pinnedWindow && !pinnedWindow.isDestroyed()) {
    pinnedWindow.loadURL(url);
    pinnedWindow.show();
    pinnedWindow.focus();
    return true;
  }
  pinnedWindow = new BrowserWindow({
    width: 440,
    height: 340,
    alwaysOnTop: true,
    fullscreenable: false,
    show: false,
    title: 'WorkOne - 小窓',
    webPreferences: {
      partition: SHARED_PARTITION, // 共有プロファイルでログイン継続
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // フルスクリーンの会議アプリの上にも出るように、最上位レベル＋全 Space 表示
  pinnedWindow.setAlwaysOnTop(true, 'screen-saver');
  pinnedWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pinnedWindow.once('ready-to-show', () => {
    pinnedWindow?.show();
    pinnedWindow?.focus();
    pinnedWindow?.moveTop();
  });
  pinnedWindow.loadURL(url);
  pinnedWindow.on('closed', () => {
    pinnedWindow = null;
  });
  return true;
}

// preload 経由でも呼べるよう IPC も用意（将来用）
ipcMain.handle('open-pinned', (_event, url: string) => openPinnedWindow(url));

// データ全消去前の確認ダイアログ（OS ネイティブ）
ipcMain.handle('confirm-dialog', async (_event, message: string) => {
  if (!mainWindow) return false;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['キャンセル', '削除する'],
    defaultId: 0,
    cancelId: 0,
    message,
  });
  return response === 1;
});

// IP から現在地を推定（メインプロセスで実行。renderer/file:// からだと 403 になるため）。
// 複数プロバイダを順に試す。成功結果は renderer 側で保存し、以後は呼ばれない想定。
ipcMain.handle('detect-location', async () => {
  // ipwho.is（精度・寛容さが良い）→ ipapi.co の順
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const j: any = await res.json();
      if (j.success && typeof j.latitude === 'number') {
        return {
          lat: j.latitude,
          lon: j.longitude,
          label: j.city || j.region || '現在地',
        };
      }
    }
  } catch {
    /* 次へ */
  }
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const j: any = await res.json();
      if (typeof j.latitude === 'number') {
        return {
          lat: j.latitude,
          lon: j.longitude,
          label: j.city || j.region || '現在地',
        };
      }
    }
  } catch {
    /* 失敗 */
  }
  return null;
});

// 都市名→座標（日本語に強い Nominatim を優先、失敗時 Open-Meteo）。メインで実行。
ipcMain.handle('geocode-city', async (_event, query: string) => {
  const q = String(query || '').trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ja&q=${encodeURIComponent(
      q
    )}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WorkOne/0.1 (desktop app)' },
    });
    if (res.ok) {
      const j: any = await res.json();
      const r = j[0];
      if (r) return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.name || q };
    }
  } catch {
    /* 次へ */
  }
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      q
    )}&count=1&language=ja&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const j: any = await res.json();
      const r = j.results?.[0];
      if (r) return { lat: r.latitude, lon: r.longitude, label: r.name };
    }
  } catch {
    /* 失敗 */
  }
  return null;
});

// --- 更新チェック（無料・署名/Apple ID 不要の「通知のみ」方式） ---
// 配布先の GitHub リポジトリ（owner/repo）。空なら更新チェックは無効。
// 例: 'yuuyuu86game/workone'
const UPDATE_REPO = 'yuuyuu86/WorkOne';

function compareVersion(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// 最新版が現在より新しければ {version, url} を返す。無ければ null。
ipcMain.handle('check-update', async () => {
  if (!UPDATE_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`,
      { headers: { 'User-Agent': 'WorkOne', Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    const latest = String(j.tag_name || '').replace(/^v/, '');
    if (latest && compareVersion(latest, app.getVersion()) > 0) {
      return { version: latest, url: j.html_url as string, notes: j.name || '' };
    }
    return null;
  } catch {
    return null;
  }
});

// 現在のアプリバージョン
ipcMain.handle('app-version', () => app.getVersion());

// ===== Classroom / Calendar の取得（ログイン済みセッションを使った DOM 読み取り） =====
// 共有プロファイル(SHARED_PARTITION)の非表示ウィンドウで対象ページを開き、
// 自分のアカウントの画面から自分の課題・予定を読み取ってローカル表示する。
// Google の class 名は難読化されるため、比較的安定している href / aria-label を主に使う。

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ScrapeResult<T> = {
  ok: boolean;
  loginRequired: boolean;
  /** 想定ホスト外（製品紹介ページ等）へ飛ばされ取得不能。管理者が無効化している場合など。 */
  unavailable: boolean;
  items: T[];
};

// 非表示ウィンドウでページを開き、extractor(JS文字列) を繰り返し実行して
// 結果（配列）が得られるまで待つ。ログイン画面へ飛んだら loginRequired、
// 想定ホスト外（製品紹介ページ等）へ飛んだら unavailable を返す。
async function scrapeInHiddenWindow<T>(
  url: string,
  extractor: string,
  opts: {
    timeoutMs?: number;
    settleMs?: number;
    expectHost?: string;
    /** false にすると「URL に signin 等を含む＝未ログイン」の自動判定を行わない */
    loginCheck?: boolean;
  } = {}
): Promise<ScrapeResult<T>> {
  const timeoutMs = opts.timeoutMs ?? 16000;
  const settleMs = opts.settleMs ?? 1000;
  const expectHost = opts.expectHost;
  const loginCheck = opts.loginCheck ?? true;
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1000,
    webPreferences: {
      partition: SHARED_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      // 背景でも描画を続けてもらう（SPA のレンダリングのため）
      backgroundThrottling: false,
    },
  });
  win.webContents.setUserAgent(normalizedUserAgent());
  try {
    try {
      await win.loadURL(url);
    } catch {
      /* リダイレクト等で reject されることがあるが続行 */
    }
    const deadline = Date.now() + timeoutMs;
    let last: T[] = [];
    while (Date.now() < deadline) {
      const cur = win.webContents.getURL();
      if (loginCheck && /accounts\.google\.com|ServiceLogin|signin/i.test(cur)) {
        return { ok: false, loginRequired: true, unavailable: false, items: [] };
      }
      // 想定ホスト外（例: workspace.google.com の製品紹介）へ飛ばされた＝利用不可
      if (expectHost) {
        try {
          const host = new URL(cur).hostname;
          if (cur && !host.endsWith(expectHost)) {
            return {
              ok: false,
              loginRequired: false,
              unavailable: true,
              items: [],
            };
          }
        } catch {
          /* URL 解析失敗は無視 */
        }
      }
      try {
        const r = (await win.webContents.executeJavaScript(extractor)) as T[];
        if (Array.isArray(r) && r.length > 0) {
          return { ok: true, loginRequired: false, unavailable: false, items: r };
        }
        if (Array.isArray(r)) last = r;
      } catch {
        /* まだ描画前など */
      }
      await sleep(settleMs);
    }
    return { ok: true, loginRequired: false, unavailable: false, items: last };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

// Classroom の「ToDo（未提出）」ページから課題を抽出する extractor。
// class 名は難読化されるため、安定している href（/c/.../a/...）を起点に、
// アンカー内の葉ノードのテキストを集めてタイトル/コース/期限に振り分ける。
const CLASSROOM_EXTRACTOR = `(() => {
  // Material アイコンのリガチャ文字（textContent に紛れ込む）を除外
  const ICON_RE = /^(assignment|assignment_turned_in|quiz|book|description|material|today|event|class|article|menu_book|attach_file|grading|push_pin|more_vert|insert_drive_file|folder)$/i;
  const DATE_RE = /(\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日|今日|明日|期限|締切|Due)/;
  const out = [];
  const seen = new Set();
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  for (const a of anchors) {
    const href = a.href || a.getAttribute('href') || '';
    if (!/\\/c\\/[^/]+\\/(a|sa)\\/[^/]+/.test(href)) continue;
    if (seen.has(href)) continue;
    // アンカー配下の「子要素を持たない＝葉」テキストを集める。アイコンは除く。
    let leaves = Array.from(a.querySelectorAll('*'))
      .filter((el) => el.children.length === 0)
      .filter((el) => !el.matches('i, [class*="icon" i], [aria-hidden="true"]'))
      .map((el) => (el.textContent || '').replace(/\\s+/g, ' ').trim())
      .filter((t) => t && !ICON_RE.test(t));
    // 重複除去（順序維持）
    const uniq = [];
    for (const t of leaves) if (!uniq.includes(t)) uniq.push(t);
    if (uniq.length === 0) continue;
    const title = uniq[0];
    let course = '';
    let due = '';
    let posted = '';
    for (let i = 1; i < uniq.length; i++) {
      const t = uniq[i];
      if (/投稿|posted/i.test(t)) { if (!posted) posted = t; continue; }
      if (/期限なし|締切なし|No due/i.test(t)) continue;
      if (!due && DATE_RE.test(t)) { due = t; continue; }
      if (!course && t.length <= 60) course = t;
    }
    seen.add(href);
    out.push({
      title: title.slice(0, 120),
      href,
      due: (due || '').slice(0, 60),
      course: (course || '').slice(0, 80),
    });
  }
  return out.slice(0, 50);
})()`;

ipcMain.handle('scrape-classroom', async () => {
  return scrapeInHiddenWindow(
    'https://classroom.google.com/a/not-turned-in/all',
    CLASSROOM_EXTRACTOR,
    { timeoutMs: 18000, expectHost: 'classroom.google.com' }
  );
});

// ログイン済みセッションを使って、所属している Slack ワークスペース一覧を検出する。
// slack.com/signin はログイン済みブラウザだと「サインインできるワークスペース一覧」
// （各行に名前・人数・最終サインイン日、開く先は https://<sub>.slack.com）を出すので、
// その一覧の各ワークスペースの URL と名前を読み取る。
// slack.com/signin（ログイン済み）には、このブラウザでサインイン済みのワークスペースが
// 「<名前><sub>.slack.com開く」という行で並ぶ。各行のリンク（https://<sub>.slack.com/...）
// から URL を、親要素のテキストからドメインと「開く」を除いて名前を取り出す。
const SLACK_EXTRACTOR = `(() => {
  try {
    const out = [];
    const seen = new Set();
    const GENERIC = ['www','app','api','my','get-started','slack','status','slackhq','help','files','files-origin','edgeapi','signin'];
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/^https?:\\/\\/([a-z0-9-]+)\\.slack\\.com/i);
      if (!m) continue;
      const sub = m[1].toLowerCase();
      if (GENERIC.includes(sub) || seen.has(sub)) continue;
      const domain = sub + '.slack.com';
      let name = (a.parentElement ? a.parentElement.textContent : '' || '')
        .replace(/\\s+/g, ' ')
        .trim();
      // ドメイン文字列と「開く / Open / Launch」を取り除いて名前だけにする
      name = name
        .replace(new RegExp(domain.replace(/[.]/g, '\\\\.'), 'ig'), '')
        .replace(/開く|を開く|Open|Launch/gi, '')
        .trim();
      if (!name || name.length > 60) name = sub;
      seen.add(sub);
      out.push({ url: 'https://' + domain, name });
    }
    return out.slice(0, 30);
  } catch (e) { return []; }
})()`;

ipcMain.handle('scrape-slack-workspaces', async () => {
  return scrapeInHiddenWindow(
    'https://slack.com/signin',
    SLACK_EXTRACTOR,
    // signin ページ自体を読むので、URL の "signin" による未ログイン誤判定を無効化
    { timeoutMs: 15000, loginCheck: false }
  );
});

// Google Calendar は別プロセスの隠しウィンドウだと製品紹介ページへ飛ばされる
// 環境があるため、renderer 側で「実際に表示中のカレンダー webview」から
// 直接読み取る方式（ServiceFrame / CalendarCard）に変更した。

// 座標→地名（逆ジオコーディング、日本語）。OS 位置情報の表示名に使う。
ipcMain.handle('reverse-geocode', async (_event, lat: number, lon: number) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ja`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WorkOne/0.1 (desktop app)' },
    });
    if (res.ok) {
      const j: any = await res.json();
      const a = j.address || {};
      return (
        a.town || a.city || a.village || a.suburb || a.county || j.name || '現在地'
      );
    }
  } catch {
    /* 失敗 */
  }
  return '現在地';
});

// Dock / タスクバーのバッジに合計未読数を表示（renderer から呼ばれる）
ipcMain.handle('set-badge', (_event, count: number) => {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  app.setBadgeCount(n);
  return true;
});

// renderer からウィンドウ操作（再読込/戻る/進む等のショートカット用に補助）
ipcMain.handle('focus-main', () => {
  showMainWindow();
  return true;
});

// メニューバー常駐アイコン（トレイ）
function createTray() {
  if (tray) return;
  const trayIconPath = path.join(RESOURCES_DIR, 'trayTemplate.png');
  let image = nativeImage.createFromPath(trayIconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 18, height: 18 });
    image.setTemplateImage(true); // macOS のダーク/ライトに自動追従
  }
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('WorkOne');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'WorkOne を開く', click: () => showMainWindow() },
      { type: 'separator' },
      {
        label: '終了',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', () => showMainWindow());
}

// アプリメニュー（コピペ等の標準ショートカット + 独自ショートカット）
function buildAppMenu() {
  const send = (channel: string) =>
    mainWindow?.webContents.send(channel);
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'WorkOne',
            submenu: [
              { role: 'about' as const, label: 'WorkOne について' },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              {
                label: '終了',
                accelerator: 'Cmd+Q',
                click: () => {
                  isQuitting = true;
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'ファイル',
      submenu: [
        {
          label: '検索',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('menu:search'),
        },
        {
          label: 'サービスを追加',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:add-service'),
        },
        {
          label: '設定',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('menu:settings'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'ウィンドウを閉じる' } : { role: 'quit' },
      ],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべて選択' },
      ],
    },
    {
      label: '表示',
      submenu: [
        {
          label: '再読み込み',
          accelerator: 'CmdOrCtrl+R',
          click: () => send('menu:reload'),
        },
        {
          label: '戻る',
          accelerator: 'CmdOrCtrl+[',
          click: () => send('menu:back'),
        },
        {
          label: '進む',
          accelerator: 'CmdOrCtrl+]',
          click: () => send('menu:forward'),
        },
        { type: 'separator' },
        {
          label: '拡大',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => send('menu:zoom-in'),
        },
        {
          label: '縮小',
          accelerator: 'CmdOrCtrl+-',
          click: () => send('menu:zoom-out'),
        },
        {
          label: '実際のサイズ',
          accelerator: 'CmdOrCtrl+0',
          click: () => send('menu:zoom-reset'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'フルスクリーン' },
      ],
    },
    {
      label: '移動',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+1',
          click: () => send('menu:view-today'),
        },
        {
          label: 'Inbox',
          accelerator: 'CmdOrCtrl+2',
          click: () => send('menu:view-inbox'),
        },
        {
          label: 'あとで見る',
          accelerator: 'CmdOrCtrl+3',
          click: () => send('menu:view-readlater'),
        },
        { type: 'separator' },
        {
          label: '次のサービス',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: () => send('menu:next-service'),
        },
        {
          label: '前のサービス',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: () => send('menu:prev-service'),
        },
      ],
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'キーボードショートカット',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('menu:shortcuts'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 各サービス（webview）に必要な権限を許可する。
// - notifications: Gmail / Calendar / Slack などが自前で出す Web 通知を OS 通知として鳴らす
// - media: Google Meet / Zoom のカメラ・マイク
// 既定では Electron がこれらを拒否するため、共有プロファイルに対して明示的に許可する。
function setupPermissions() {
  const ALLOWED = new Set([
    'notifications',
    'media',
    'mediaKeySystem',
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'pointerLock',
    'idle-detection',
    'background-sync',
    'geolocation', // 現在地の天気（OS の位置情報サービス）
  ]);
  const sessions = [
    session.defaultSession,
    session.fromPartition(SHARED_PARTITION),
  ];
  for (const ses of sessions) {
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(ALLOWED.has(permission));
    });
    ses.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  }
}

app.whenReady().then(() => {
  // ウィンドウ生成前にアプリ全体の UA を上書きする。
  // これにより BrowserWindow も全 <webview> も同じ素の Chrome UA を使う。
  app.userAgentFallback = normalizedUserAgent();
  // 開発時の Dock アイコンを WorkOne のものに（本番はバンドルのアイコンを使用）
  if (process.platform === 'darwin') {
    try {
      const img = nativeImage.createFromPath(
        path.join(RESOURCES_DIR, 'icon.png')
      );
      if (!img.isEmpty()) app.dock?.setIcon(img);
    } catch {
      /* 無視 */
    }
  }
  setupPermissions();
  buildAppMenu();
  createTray();
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  saveWindowState();
});

// バックグラウンド常駐するため、全ウィンドウが閉じても終了しない
// （トレイ or Dock から復帰できる）。
app.on('window-all-closed', () => {
  // 何もしない（終了はトレイ/メニューの「終了」から）
});

app.on('activate', () => {
  showMainWindow();
});
