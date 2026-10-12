import {
  FiCheck,
  FiTrash2,
  FiStar,
  FiClock,
  FiCheckSquare,
  FiCpu,
  FiRotateCcw,
} from 'react-icons/fi';
import { useAppStore } from '../../store/useAppStore';
import type { AppNotification } from '../../types/service';
import { timeAgo } from '../../lib/time';
import { ServiceIcon } from '../ServiceIcon';
import { SnoozeMenu } from './SnoozeMenu';
import { cleanSentence } from './inboxUtils';

type Props = {
  n: AppNotification;
  idx: number;
  isCursor: boolean;
  showScore: boolean;
  snoozeOpen: boolean;
  onOpen: () => void;
  onSnoozeOpen: (open: boolean) => void;
  onTask: () => void;
};

const fmtSnooze = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Inbox の通知 1 行（内容・タスク候補・トリアージ操作） */
export function InboxRow({
  n,
  idx,
  isCursor,
  showScore,
  snoozeOpen,
  onOpen,
  onSnoozeOpen,
  onTask,
}: Props) {
  const markDone = useAppStore((s) => s.markNotificationDone);
  const snooze = useAppStore((s) => s.snoozeNotification);
  const restore = useAppStore((s) => s.restoreNotification);
  const remove = useAppStore((s) => s.removeNotification);
  const handled = n.done || !!n.snoozedUntil;

  return (
    <div
      className={`list-row inbox-row ${isCursor ? 'cursor' : ''} ${n.read ? '' : 'unread'}`}
      data-idx={idx}
      onClick={onOpen}
    >
      <ServiceIcon iconKey={n.icon} chip={28} />
      <div className="grow">
        <div className="row-title">
          {n.important && (
            <FiStar size={12} fill="#FFB300" style={{ color: '#FFB300', marginRight: 5 }} />
          )}
          {n.title}
          <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
            {n.serviceName}
          </span>
        </div>
        {n.summary ? (
          <div className="row-sub">
            <FiCpu size={11} style={{ marginRight: 4 }} />
            {cleanSentence(n.summary)}
          </div>
        ) : (
          n.body && <div className="row-sub">{n.body}</div>
        )}
        {n.taskSuggestion && !n.done && (
          <button
            className="task-suggestion"
            onClick={(e) => {
              e.stopPropagation();
              onTask();
            }}
          >
            <FiCheckSquare size={11} /> タスク候補: {n.taskSuggestion.title}
            {n.taskSuggestion.due && `（${n.taskSuggestion.due.slice(5).replace('-', '/')}）`}
          </button>
        )}
      </div>
      {showScore && n.score !== undefined && (
        <span
          className={`score-pill ${n.score >= 70 ? 'high' : n.score >= 50 ? 'mid' : ''}`}
          title="重要度スコア（0〜100）"
        >
          {n.score}
        </span>
      )}
      <span className="muted" style={{ flexShrink: 0 }}>
        {n.snoozedUntil ? fmtSnooze(n.snoozedUntil) : timeAgo(n.receivedAt)}
      </span>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {handled ? (
          <button className="icon-btn" title="受信箱に戻す（未処理に戻す）" onClick={() => restore(n.id)}>
            <FiRotateCcw size={14} />
          </button>
        ) : (
          <>
            <button className="icon-btn" title="完了 (e)" onClick={() => markDone(n.id)}>
              <FiCheck size={14} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                title="スヌーズ・あとで再表示 (s)"
                onClick={() => onSnoozeOpen(true)}
              >
                <FiClock size={14} />
              </button>
              {snoozeOpen && (
                <SnoozeMenu
                  onPick={(until) => {
                    snooze(n.id, until);
                    onSnoozeOpen(false);
                  }}
                  onClose={() => onSnoozeOpen(false)}
                />
              )}
            </div>
            <button className="icon-btn" title="タスクに追加 (t)" onClick={onTask}>
              <FiCheckSquare size={14} />
            </button>
          </>
        )}
        <button className="icon-btn" title="通知を削除 (#)" onClick={() => remove(n.id)}>
          <FiTrash2 size={14} />
        </button>
      </div>
    </div>
  );
}
