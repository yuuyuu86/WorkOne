import { useEffect, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

type Update = { version: string; url: string; notes: string };

/**
 * アップデートの案内バナー。
 * - 署名済みビルド: 裏で自動ダウンロードし、完了したら「再起動して更新」を出す
 * - 未署名ビルド: 起動時に新バージョンを確認し、リリースページへ案内する
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [auto, setAuto] = useState<{
    state: 'available' | 'downloading' | 'ready' | 'error';
    version?: string;
    percent?: number;
  } | null>(null);

  useEffect(() => window.workOne?.onUpdateStatus?.(setAuto), []);

  useEffect(() => {
    const api = window.workOne;
    if (!api?.checkUpdate) return;
    let cancelled = false;
    api
      .checkUpdate()
      .then((u) => {
        if (!cancelled && u) setUpdate(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;

  if (auto && auto.state !== 'error') {
    return (
      <div className="update-banner">
        <FiDownload size={15} />
        <span className="grow">
          {auto.state === 'ready'
            ? `v${auto.version} の準備ができました`
            : auto.state === 'downloading'
              ? `アップデートをダウンロード中… ${auto.percent ?? 0}%`
              : `v${auto.version} をダウンロードしています`}
        </span>
        {auto.state === 'ready' && (
          <button className="btn btn-sm btn-primary" onClick={() => window.workOne.installUpdate()}>
            再起動して更新
          </button>
        )}
        <button className="icon-btn" title="閉じる" onClick={() => setDismissed(true)}>
          <FiX size={15} />
        </button>
      </div>
    );
  }

  if (!update) return null;

  return (
    <div className="update-banner">
      <FiDownload size={15} />
      <span className="grow">
        新しいバージョン v{update.version} があります
        {update.notes ? `（${update.notes}）` : ''}
      </span>
      <button
        className="btn btn-sm"
        onClick={() => window.workOne.openExternal(update.url)}
      >
        ダウンロード
      </button>
      <button
        className="icon-btn"
        title="閉じる"
        onClick={() => setDismissed(true)}
      >
        <FiX size={15} />
      </button>
    </div>
  );
}
