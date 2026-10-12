import { useState } from 'react';
import { FiCheck, FiCheckSquare, FiCpu, FiX } from 'react-icons/fi';
import { useAppStore } from '../../store/useAppStore';
import type { AppNotification } from '../../types/service';
import { timeAgo } from '../../lib/time';
import { ServiceIcon } from '../ServiceIcon';
import { byScore, cleanSentence } from './inboxUtils';

type Props = {
  /** 表示する上位の通知（スコア順） */
  top: AppNotification[];
  /** AI のまとめに渡す、受信箱にある通知 */
  openList: AppNotification[];
  onOpen: (n: AppNotification) => void;
  onTask: (n: AppNotification) => void;
};

/** 「今日対応が必要」カード（上位の通知と、オンデバイス AI のまとめ） */
export function FocusCard({ top, openList, onOpen, onTask }: Props) {
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const markDone = useAppStore((s) => s.markNotificationDone);
  const [digest, setDigest] = useState<{ text: string; loading: boolean } | null>(null);

  const runDigest = async () => {
    const ai = window.workOne?.ai;
    if (!ai) return;
    setDigest({ text: '', loading: true });
    const items = [...openList]
      .sort(byScore)
      .slice(0, 12)
      .map((n) => ({ service: n.serviceName, title: n.title, body: n.body.slice(0, 200) }));
    const r = await ai.digest(items).catch(() => null);
    setDigest({
      text: r?.ok ? r.text : 'オンデバイス AI を利用できませんでした（設定 → AI を確認してください）。',
      loading: false,
    });
  };

  const digestLines = (digest?.text ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[・\-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <div className="section">
      <div className="card focus3-card">
        <div className="focus3-head">
          <div className="focus3-title">
            <span>今日対応が必要</span>
            <span className="section-count">{top.length}</span>
          </div>
          {aiEnabled && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={runDigest}
              disabled={digest?.loading}
              title="オンデバイス AI で要点をまとめる"
            >
              <FiCpu size={13} /> {digest?.loading ? 'まとめています…' : 'AI でまとめる'}
            </button>
          )}
        </div>

        {digestLines.length > 0 && (
          <div className="digest-panel">
            <div className="digest-label">
              <FiCpu size={12} /> AI のまとめ
              <button className="icon-btn" title="閉じる" onClick={() => setDigest(null)}>
                <FiX size={12} />
              </button>
            </div>
            <ul>
              {digestLines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="focus3-list">
          {top.map((n, i) => (
            <div key={n.id} className="focus3-item" onClick={() => onOpen(n)}>
              <span className="focus3-rank">{i + 1}</span>
              <ServiceIcon iconKey={n.icon} chip={26} />
              <div className="focus3-body">
                <div className="focus3-text">{cleanSentence(n.summary || n.title)}</div>
                <div className="focus3-meta">
                  {n.serviceName}・{timeAgo(n.receivedAt)}
                </div>
              </div>
              <div className="focus3-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm btn-ghost" title="タスク化 (t)" onClick={() => onTask(n)}>
                  <FiCheckSquare size={13} /> タスク化
                </button>
                <button className="btn btn-sm" title="完了 (e)" onClick={() => markDone(n.id)}>
                  <FiCheck size={13} /> 完了
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
