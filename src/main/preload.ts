import { contextBridge, ipcRenderer } from 'electron';

// 必要最小限の API だけを renderer に公開する。
// ID/パスワード/Cookie などはここでは一切扱わない。
const api = {
  /** 外部リンクを OS の既定ブラウザで開く */
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('open-external', url),

  /** OS ネイティブの確認ダイアログを表示（データ削除などの確認用） */
  confirm: (message: string): Promise<boolean> =>
    ipcRenderer.invoke('confirm-dialog', message),

  /** 各サービスの Web 表示キャッシュ・ログインセッションを削除 */
  clearWebCache: (partitions: string[]): Promise<boolean> =>
    ipcRenderer.invoke('clear-web-cache', partitions),

  /** OS 通知を出す */
  notify: (title: string, body: string): Promise<boolean> =>
    ipcRenderer.invoke('notify', title, body),

  /** 会議などを常に最前面の小窓で開く */
  openPinned: (url: string, partition?: string): Promise<boolean> =>
    ipcRenderer.invoke('open-pinned', url, partition),

  /** Dock / タスクバーのバッジに合計未読数を設定 */
  setBadge: (count: number): Promise<boolean> =>
    ipcRenderer.invoke('set-badge', count),

  /** IP から現在地を推定（天気用） */
  detectLocation: (): Promise<{ lat: number; lon: number; label: string } | null> =>
    ipcRenderer.invoke('detect-location'),

  /** 都市名→座標（天気用、日本語対応） */
  geocodeCity: (
    query: string
  ): Promise<{ lat: number; lon: number; label: string } | null> =>
    ipcRenderer.invoke('geocode-city', query),

  /** 座標→地名（天気用、日本語） */
  reverseGeocode: (lat: number, lon: number): Promise<string> =>
    ipcRenderer.invoke('reverse-geocode', lat, lon),

  /** 新しいバージョンがあれば返す（無ければ null） */
  checkUpdate: (): Promise<{ version: string; url: string; notes: string } | null> =>
    ipcRenderer.invoke('check-update'),

  /** 現在のアプリバージョン */
  appVersion: (): Promise<string> => ipcRenderer.invoke('app-version'),

  /** メニュー/ショートカットのコマンドを購読する。戻り値で解除。 */
  onMenuCommand: (cb: (command: string) => void): (() => void) => {
    const channels = [
      'menu:search',
      'menu:add-service',
      'menu:settings',
      'menu:reload',
      'menu:back',
      'menu:forward',
      'menu:zoom-in',
      'menu:zoom-out',
      'menu:zoom-reset',
      'menu:view-today',
      'menu:view-inbox',
      'menu:view-readlater',
      'menu:view-tasks',
      ...Array.from({ length: 9 }, (_, i) => `menu:profile-${i + 1}`),
      'menu:next-service',
      'menu:prev-service',
      'menu:shortcuts',
    ];
    const pairs = channels.map((ch) => {
      const handler = () => cb(ch.replace('menu:', ''));
      ipcRenderer.on(ch, handler);
      return [ch, handler] as const;
    });
    return () => pairs.forEach(([ch, h]) => ipcRenderer.removeListener(ch, h));
  },

  /** プラットフォーム情報（UI 微調整用） */
  platform: process.platform,

  /** ログイン済みセッションを使って Classroom の課題を読み取る（DOM 取得）。 */
  scrapeClassroom: (partition?: string): Promise<{
    ok: boolean;
    loginRequired: boolean;
    unavailable: boolean;
    items: { title: string; href: string; due: string; course: string }[];
  }> => ipcRenderer.invoke('scrape-classroom', partition),

  /** ログイン済みセッションを使って、所属している Slack ワークスペース一覧を検出する。 */
  scrapeSlackWorkspaces: (partition?: string): Promise<{
    ok: boolean;
    loginRequired: boolean;
    unavailable: boolean;
    items: { url: string; name: string }[];
  }> => ipcRenderer.invoke('scrape-slack-workspaces', partition),

  /** webview ごとのメモリ使用量（MB）。pairs は serviceId と webContentsId の対応 */
  webviewMemory: (
    pairs: { id: string; wcId: number }[]
  ): Promise<{ id: string; mb: number }[]> =>
    ipcRenderer.invoke('webview-memory', pairs),

  /** 自動アップデート: 状態を購読（戻り値で解除） */
  onUpdateStatus: (
    cb: (s: { state: 'available' | 'downloading' | 'ready' | 'error'; version?: string; percent?: number }) => void
  ): (() => void) => {
    const h = (_e: unknown, s: any) => cb(s);
    ipcRenderer.on('update-status', h);
    return () => ipcRenderer.removeListener('update-status', h);
  },
  /** ダウンロード済みのアップデートを適用して再起動 */
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),

  /** オンデバイス AI（Apple Foundation Models）。データは Mac の外に出ない */
  ai: {
    status: (): Promise<{ available: boolean; reason?: string }> =>
      ipcRenderer.invoke('ai-status'),
    triage: (
      items: { id: string; service: string; title: string; body: string }[],
      today: string
    ): Promise<{
      ok: boolean;
      items: {
        id: string;
        score: number;
        summary: string;
        task?: { title: string; due?: string };
      }[];
    }> => ipcRenderer.invoke('ai-triage', items, today),
    digest: (
      items: { service: string; title: string; body: string }[]
    ): Promise<{ ok: boolean; text: string }> =>
      ipcRenderer.invoke('ai-digest', items),
  },

};

contextBridge.exposeInMainWorld('workOne', api);

export type WorkOneApi = typeof api;
