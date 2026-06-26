import { useEffect, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

type Update = { version: string; url: string; notes: string };

/**
 * 起動時に新バージョンを確認し、あればバナー表示（無料・Apple 不要の通知方式）。
 * クリックでダウンロードページを開く。サイレント更新はしない。
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  if (!update || dismissed) return null;

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
