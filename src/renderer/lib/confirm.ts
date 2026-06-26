// 削除など破壊的操作の確認。
// Electron 環境では OS ネイティブダイアログ（preload 経由）を使い、
// それが使えない場合（プレビュー表示・preload 未ロード等）は
// ブラウザ標準の confirm にフォールバックする。
export async function confirmAction(message: string): Promise<boolean> {
  const api = (window as any).workOne;
  if (api && typeof api.confirm === 'function') {
    try {
      return await api.confirm(message);
    } catch {
      // IPC 失敗時はフォールバックへ
    }
  }
  return window.confirm(message);
}
