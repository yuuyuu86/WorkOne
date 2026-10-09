import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiPlus,
  FiCheck,
  FiTrash2,
  FiBell,
  FiStar,
  FiClock,
  FiCheckSquare,
  FiBookmark,
  FiCpu,
  FiRotateCcw,
} from 'react-icons/fi';
import { useAppStore, profileOf } from '../store/useAppStore';
import type { AppNotification } from '../types/service';
import { ServiceIcon } from './ServiceIcon';
import { TaskQuickAdd } from './TaskQuickAdd';

type Props = {
  onOpenAdd: () => void;
};

type Filter = 'open' | 'unread' | 'important' | 'snoozed' | 'done' | string; // string = serviceId
type Sort = 'priority' | 'newest';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return new Date(iso).toLocaleDateString('ja-JP');
}

/** スヌーズの選択肢（いまからの時刻を返す） */
const SNOOZE_OPTIONS: { label: string; at: () => Date }[] = [
  { label: '1時間後', at: () => new Date(Date.now() + 3600000) },
  {
    label: '今夜 19:00',
    at: () => {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: '明日 8:00',
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
  {
    label: '来週 月曜 8:00',
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
];

const isOpen = (n: AppNotification) => !n.done && !n.snoozedUntil;

export function InboxView({ onOpenAdd }: Props) {
  const services = useAppStore((s) => s.services);
  const notifications = useAppStore((s) => s.notifications);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const openService = useAppStore((s) => s.openService);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const markNotificationDone = useAppStore((s) => s.markNotificationDone);
  const snoozeNotification = useAppStore((s) => s.snoozeNotification);
  const setNotificationMeta = useAppStore((s) => s.setNotificationMeta);
  const removeNotification = useAppStore((s) => s.removeNotification);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const addReadLater = useAppStore((s) => s.addReadLater);

  const [filter, setFilter] = useState<Filter>('open');
  const [sort, setSort] = useState<Sort>('priority');
  const [allProfiles, setAllProfiles] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null);
  const [taskFor, setTaskFor] = useState<AppNotification | null>(null);
  const [digest, setDigest] = useState<{ text: string; loading: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // プロファイルで絞る（サービスが消えた通知は既定プロファイル扱い）
  const scoped = useMemo(() => {
    if (allProfiles) return notifications;
    return notifications.filter((n) => {
      const svc = services.find((s) => s.id === n.serviceId);
      return (svc ? profileOf(svc) : 'default') === activeProfileId;
    });
  }, [notifications, services, allProfiles, activeProfileId]);

  const openList = scoped.filter(isOpen);
  const unreadCount = openList.filter((n) => !n.read).length;
  const importantCount = openList.filter((n) => n.important).length;
  const snoozedCount = scoped.filter((n) => n.snoozedUntil && !n.done).length;
  const doneCount = scoped.filter((n) => n.done).length;

  const shown = useMemo(() => {
    const list = scoped.filter((n) => {
      if (filter === 'open') return isOpen(n);
      if (filter === 'unread') return isOpen(n) && !n.read;
      if (filter === 'important') return isOpen(n) && n.important;
      if (filter === 'snoozed') return !!n.snoozedUntil && !n.done;
      if (filter === 'done') return !!n.done;
      return isOpen(n) && n.serviceId === filter;
    });
    if (sort === 'priority' && filter !== 'done') {
      return [...list].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.receivedAt.localeCompare(a.receivedAt)
      );
    }
    return list;
  }, [scoped, filter, sort]);

  // 今日対応が必要な上位3件（未読・未完了をスコア順）
  const top3 = useMemo(
    () =>
      [...openList]
        .filter((n) => (n.score ?? 0) >= 50)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3),
    [openList]
  );

  const notifServiceIds = Array.from(new Set(openList.map((n) => n.serviceId)));

  useEffect(() => {
    if (cursor >= shown.length) setCursor(Math.max(0, shown.length - 1));
  }, [shown.length, cursor]);

  const openFrom = (n: AppNotification) => {
    markNotificationRead(n.id);
    if (services.some((s) => s.id === n.serviceId)) {
      const svc = services.find((s) => s.id === n.serviceId)!;
      // 別プロファイルのサービスならプロファイルも切り替える
      useAppStore.getState().setActiveProfile(profileOf(svc));
      openService(n.serviceId);
    }
  };

  const toReadLater = (n: AppNotification) => {
    const svc = services.find((s) => s.id === n.serviceId);
    addReadLater({
      title: n.title,
      url: useAppStore.getState().serviceUrls[n.serviceId] ?? svc?.url ?? '',
      serviceName: n.serviceName,
      note: n.body,
    });
    markNotificationDone(n.id);
  };

  // キーボード操作: j/k 移動, Enter 開く, e 完了, s スヌーズ, t タスク化, l あとで見る, # 削除
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (taskFor || snoozeFor) return;
      const n = shown[cursor];
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          setCursor((c) => Math.min(shown.length - 1, c + 1));
          break;
        case 'k':
        case 'ArrowUp':
          setCursor((c) => Math.max(0, c - 1));
          break;
        case 'Enter':
          if (n) openFrom(n);
          break;
        case 'e':
          if (n) markNotificationDone(n.id);
          break;
        case 's':
          if (n) setSnoozeFor(n.id);
          break;
        case 't':
          if (n) setTaskFor(n);
          break;
        case 'l':
          if (n) toReadLater(n);
          break;
        case '#':
          if (n) removeNotification(n.id);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const runDigest = async () => {
    const ai = window.workOne?.ai;
    if (!ai) return;
    setDigest({ text: '', loading: true });
    const items = [...openList]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 12)
      .map((n) => ({ service: n.serviceName, title: n.title, body: n.body.slice(0, 200) }));
    const r = await ai.digest(items).catch(() => null);
    setDigest({
      text: r?.ok ? r.text : 'オンデバイス AI を利用できませんでした（設定 → AI を確認してください）。',
      loading: false,
    });
  };

  const row = (n: AppNotification, idx: number) => (
    <div
      className={`list-row inbox-row ${idx === cursor ? 'cursor' : ''} ${n.read ? '' : 'unread'}`}
      key={n.id}
      data-idx={idx}
      onClick={() => {
        setCursor(idx);
        openFrom(n);
      }}
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
            {n.summary}
          </div>
        ) : (
          n.body && <div className="row-sub">{n.body}</div>
        )}
        {n.taskSuggestion && !n.done && (
          <button
            className="task-suggestion"
            onClick={(e) => {
              e.stopPropagation();
              setTaskFor(n);
            }}
          >
            <FiCheckSquare size={11} /> タスク候補: {n.taskSuggestion.title}
            {n.taskSuggestion.due && `（${n.taskSuggestion.due.slice(5).replace('-', '/')}）`}
          </button>
        )}
      </div>
      {n.score !== undefined && filter !== 'done' && (
        <span className={`score-pill ${n.score >= 70 ? 'high' : n.score >= 50 ? 'mid' : ''}`} title="重要度">
          {n.score}
        </span>
      )}
      <span className="muted" style={{ flexShrink: 0 }}>
        {n.snoozedUntil
          ? `⏰ ${new Date(n.snoozedUntil).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
          : timeAgo(n.receivedAt)}
      </span>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        {n.done || n.snoozedUntil ? (
          <button
            className="icon-btn"
            title="受信箱に戻す"
            onClick={() => {
              useAppStore.setState({
                notifications: useAppStore
                  .getState()
                  .notifications.map((x) =>
                    x.id === n.id ? { ...x, done: false, snoozedUntil: undefined } : x
                  ),
              });
            }}
          >
            <FiRotateCcw size={14} />
          </button>
        ) : (
          <>
            <button className="icon-btn" title="完了 (e)" onClick={() => markNotificationDone(n.id)}>
              <FiCheck size={14} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" title="スヌーズ (s)" onClick={() => setSnoozeFor(n.id)}>
                <FiClock size={14} />
              </button>
              {snoozeFor === n.id && (
                <div className="snooze-menu" onMouseLeave={() => setSnoozeFor(null)}>
                  {SNOOZE_OPTIONS.map((o, i) => (
                    <button
                      key={o.label}
                      onClick={() => {
                        snoozeNotification(n.id, o.at().toISOString());
                        setSnoozeFor(null);
                      }}
                    >
                      <kbd>{i + 1}</kbd> {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn" title="タスク化 (t)" onClick={() => setTaskFor(n)}>
              <FiCheckSquare size={14} />
            </button>
            <button className="icon-btn" title="あとで見る (l)" onClick={() => toReadLater(n)}>
              <FiBookmark size={14} />
            </button>
          </>
        )}
        <button className="icon-btn" title="削除 (#)" onClick={() => removeNotification(n.id)}>
          <FiTrash2 size={14} />
        </button>
      </div>
    </div>
  );

  // スヌーズメニュー表示中は 1〜4 キーで選択
  useEffect(() => {
    if (!snoozeFor) return;
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < SNOOZE_OPTIONS.length) {
        snoozeNotification(snoozeFor, SNOOZE_OPTIONS[i].at().toISOString());
        setSnoozeFor(null);
        e.preventDefault();
      } else if (e.key === 'Escape') setSnoozeFor(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snoozeFor, snoozeNotification]);

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>Inbox</h2>
        <p>
          各サービスの通知をまとめ、重要度順に並べます。<kbd>j</kbd>/<kbd>k</kbd> 移動・
          <kbd>e</kbd> 完了・<kbd>s</kbd> スヌーズ・<kbd>t</kbd> タスク化・<kbd>l</kbd> あとで見る
        </p>
      </div>

      {top3.length > 0 && filter === 'open' && (
        <div className="section">
          <div className="card focus3-card">
            <div className="focus3-head">
              <h3 className="section-title" style={{ margin: 0 }}>
                今日対応が必要な {top3.length} 件
              </h3>
              {aiEnabled && (
                <button className="btn btn-sm" onClick={runDigest} disabled={digest?.loading}>
                  <FiCpu size={13} /> {digest?.loading ? '要約中…' : 'AI でまとめる'}
                </button>
              )}
            </div>
            {digest?.text && <p className="digest-text">{digest.text}</p>}
            {top3.map((n) => (
              <div key={n.id} className="focus3-item" onClick={() => openFrom(n)}>
                <ServiceIcon iconKey={n.icon} chip={20} />
                <span className="grow">{n.summary || n.title}</span>
                <span className="muted">{n.serviceName}</span>
                <button
                  className="icon-btn"
                  title="完了"
                  onClick={(e) => {
                    e.stopPropagation();
                    markNotificationDone(n.id);
                  }}
                >
                  <FiCheck size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="inbox-toolbar">
          <div className="filter-chips" style={{ margin: 0 }}>
            <button className={`chip ${sort === 'priority' ? 'active' : ''}`} onClick={() => setSort('priority')}>
              重要度順
            </button>
            <button className={`chip ${sort === 'newest' ? 'active' : ''}`} onClick={() => setSort('newest')}>
              新着順
            </button>
            <span className="chip-sep" />
            <button className={`chip ${!allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(false)}>
              このプロファイル
            </button>
            <button className={`chip ${allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(true)}>
              全プロファイル
            </button>
          </div>
          {scoped.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={markAllNotificationsRead}>
                <FiCheck size={13} /> すべて既読
              </button>
              <button className="btn btn-sm" onClick={clearNotifications}>
                <FiTrash2 size={13} /> クリア
              </button>
            </div>
          )}
        </div>

        {scoped.length > 0 && (
          <div className="filter-chips">
            <button className={`chip ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')}>
              受信箱 {openList.length}
            </button>
            <button className={`chip ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
              未読 {unreadCount}
            </button>
            {importantCount > 0 && (
              <button className={`chip ${filter === 'important' ? 'active' : ''}`} onClick={() => setFilter('important')}>
                重要 {importantCount}
              </button>
            )}
            {snoozedCount > 0 && (
              <button className={`chip ${filter === 'snoozed' ? 'active' : ''}`} onClick={() => setFilter('snoozed')}>
                スヌーズ中 {snoozedCount}
              </button>
            )}
            {doneCount > 0 && (
              <button className={`chip ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>
                完了 {doneCount}
              </button>
            )}
            {notifServiceIds.map((sid) => {
              const svc = services.find((s) => s.id === sid);
              if (!svc) return null;
              return (
                <button key={sid} className={`chip ${filter === sid ? 'active' : ''}`} onClick={() => setFilter(sid)}>
                  {svc.name}
                </button>
              );
            })}
          </div>
        )}

        {scoped.length === 0 ? (
          <div className="empty-state">
            <FiBell size={36} className="empty-icon" />
            <h3>通知はまだありません</h3>
            <p>
              サービスを開いて通知が届くと、ここに集約されます。各サービスの
              「デスクトップ通知」をオンにしてください。
            </p>
            {services.length === 0 && (
              <button className="btn btn-primary" onClick={onOpenAdd}>
                <FiPlus size={14} /> サービスを追加
              </button>
            )}
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <FiCheck size={32} className="empty-icon" />
            <p>{filter === 'open' ? '受信箱ゼロ！すべて片付きました。' : 'この絞り込みに一致する通知はありません。'}</p>
          </div>
        ) : (
          <div className="card" ref={listRef}>
            {shown.map(row)}
          </div>
        )}
      </div>

      {taskFor && (
        <TaskQuickAdd
          initialTitle={taskFor.taskSuggestion?.title ?? taskFor.title}
          initialDue={taskFor.taskSuggestion?.due}
          source={taskFor.summary ? 'ai' : 'notification'}
          serviceId={taskFor.serviceId}
          url={useAppStore.getState().serviceUrls[taskFor.serviceId]}
          onClose={() => setTaskFor(null)}
          onAdded={() => {
            setNotificationMeta(taskFor.id, { taskSuggestion: undefined });
            markNotificationDone(taskFor.id);
          }}
        />
      )}
    </div>
  );
}
