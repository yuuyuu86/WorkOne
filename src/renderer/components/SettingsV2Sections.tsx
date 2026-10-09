import { useEffect, useState } from 'react';
import { FiCpu, FiEdit2, FiPlus, FiZap } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ProfileEditModal } from './ProfileEditModal';

// 表示中の webview から serviceId と webContentsId の対応を集める
function collectWebviews(): { id: string; wcId: number }[] {
  return Array.from(document.querySelectorAll<any>('webview[data-service-id]'))
    .map((el) => {
      try {
        return { id: el.dataset.serviceId as string, wcId: el.getWebContentsId() as number };
      } catch {
        return null; // まだ dom-ready 前
      }
    })
    .filter((x): x is { id: string; wcId: number } => x !== null);
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 設定画面に追加する v2 の項目（プロファイル・AI・パフォーマンス） */
export function SettingsV2Sections() {
  const profiles = useAppStore((s) => s.profiles);
  const services = useAppStore((s) => s.services);
  const profileAutoSwitch = useAppStore((s) => s.profileAutoSwitch);
  const setProfileAutoSwitch = useAppStore((s) => s.setProfileAutoSwitch);
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const setAiEnabled = useAppStore((s) => s.setAiEnabled);
  const hibernateMinutes = useAppStore((s) => s.hibernateMinutes);
  const setHibernateMinutes = useAppStore((s) => s.setHibernateMinutes);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; reason?: string } | null>(null);
  const [memory, setMemory] = useState<{ id: string; mb: number }[] | null>(null);

  useEffect(() => {
    window.workOne?.ai
      ?.status()
      .then(setAiStatus)
      .catch(() => setAiStatus({ available: false, reason: '確認できませんでした' }));
  }, []);

  useEffect(() => {
    const load = () =>
      window.workOne
        ?.webviewMemory?.(collectWebviews())
        .then(setMemory)
        .catch(() => setMemory(null));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const countOf = (pid: string) =>
    services.filter((s) => (s.profileId ?? 'default') === pid).length;

  const slotText = (pid: string) => {
    const p = profiles.find((x) => x.id === pid);
    if (!p || p.schedule.length === 0) return '時間割なし';
    return p.schedule
      .map((s) => `${s.days.map((d) => DAY_LABELS[d]).join('')} ${s.start}〜${s.end}`)
      .join(' / ');
  };

  const totalMb = memory?.reduce((a, m) => a + m.mb, 0) ?? 0;

  return (
    <>
      <div className="section">
        <h3 className="section-title">プロファイル</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          プロファイルごとにログイン状態・サービス・色が分かれます（Arc の Space と同じ考え方）。
          サイドバー下部のアイコン、⌃1〜9、またはサイドバー上の横スワイプで切り替えられます。
        </p>
        <div className="card">
          {profiles.map((p, i) => (
            <div className="list-row" key={p.id}>
              <span className="profile-dot active" style={{ ['--dot-color' as string]: p.color }}>
                {p.emoji}
              </span>
              <div className="grow">
                <div className="row-title">
                  {p.name} <span className="muted">⌃{i + 1}</span>
                </div>
                <div className="row-sub">
                  サービス {countOf(p.id)} 件・{slotText(p.id)}
                </div>
              </div>
              <button className="icon-btn" title="編集" onClick={() => setEditing(p.id)}>
                <FiEdit2 size={15} />
              </button>
            </div>
          ))}
          <label className="check-row">
            <input
              type="checkbox"
              checked={profileAutoSwitch}
              onChange={(e) => setProfileAutoSwitch(e.target.checked)}
            />
            <span className="grow">
              時間割で自動切り替え
              <div className="muted" style={{ marginTop: 2 }}>
                各プロファイルに設定した曜日・時間帯になると自動で切り替えます。
                途中で手動で切り替えた場合は、次の時間帯の境目まで手動の選択を優先します。
              </div>
            </span>
          </label>
        </div>
        <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setEditing('new')}>
          <FiPlus size={13} /> プロファイルを追加
        </button>
      </div>

      <div className="section">
        <h3 className="section-title">AI（オンデバイス）</h3>
        <div className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />
            <span className="grow">
              <FiCpu size={13} style={{ marginRight: 5 }} />
              Apple Intelligence で通知を要約・重要度判定・タスク候補を抽出
              <div className="muted" style={{ marginTop: 2 }}>
                Mac 内蔵のオンデバイスモデル（Foundation Models）を使います。通知の内容は
                Mac の外に送信されません。使えない環境ではルールによる判定だけを行います。
              </div>
              <div style={{ marginTop: 6, fontSize: 12.5 }}>
                状態:{' '}
                {aiStatus === null
                  ? '確認中…'
                  : aiStatus.available
                    ? '✅ 利用できます'
                    : `⚠️ 利用できません（${aiStatus.reason ?? '不明'}）`}
              </div>
            </span>
          </label>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">パフォーマンス</h3>
        <div className="card">
          <div className="check-row">
            <FiZap size={16} style={{ flexShrink: 0 }} />
            <span className="grow">
              使っていないサービスを休止してメモリを節約
              <div className="muted" style={{ marginTop: 2 }}>
                指定時間開いていないサービスを一時的に閉じます。開き直すと再読み込みされます。
                通知を受け続けたいサービスは「追加済みサービス」の 📌 で常駐にしてください。
              </div>
            </span>
            <select
              value={hibernateMinutes}
              onChange={(e) => setHibernateMinutes(Number(e.target.value))}
            >
              <option value={0}>休止しない</option>
              <option value={10}>10 分</option>
              <option value={30}>30 分</option>
              <option value={60}>1 時間</option>
              <option value={180}>3 時間</option>
            </select>
          </div>
          {memory && memory.length > 0 && (
            <div className="list-row" style={{ display: 'block' }}>
              <div className="row-title" style={{ marginBottom: 6 }}>
                サービスのメモリ使用量（合計 {totalMb} MB）
              </div>
              {memory
                .slice()
                .sort((a, b) => b.mb - a.mb)
                .map((m) => {
                  const svc = services.find((s) => s.id === m.id);
                  return (
                    <div key={m.id} className="mem-row">
                      <span className="grow">{svc?.name ?? m.id}</span>
                      <span className="mem-bar">
                        <span style={{ width: `${Math.min(100, (m.mb / Math.max(1, totalMb)) * 100)}%` }} />
                      </span>
                      <span className="muted mem-mb">{m.mb} MB</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <ProfileEditModal
          profileId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
