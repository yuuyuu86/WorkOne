import { useEffect, useMemo, useRef, useState } from 'react';
import { FiPlus, FiCheck, FiBell } from 'react-icons/fi';
import { useAppStore, profileOf } from '../store/useAppStore';
import type { AppNotification } from '../types/service';
import { TaskQuickAdd } from './TaskQuickAdd';
import { InboxRow } from './inbox/InboxRow';
import { FocusCard } from './inbox/FocusCard';
import { InboxToolbar } from './inbox/InboxToolbar';
import { useInboxKeyboard } from './inbox/useInboxKeyboard';
import { byScore, isOpen, type InboxFilter, type InboxSort } from './inbox/inboxUtils';

type Props = {
  onOpenAdd: () => void;
};

export function InboxView({ onOpenAdd }: Props) {
  const services = useAppStore((s) => s.services);
  const notifications = useAppStore((s) => s.notifications);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const openService = useAppStore((s) => s.openService);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markNotificationDone = useAppStore((s) => s.markNotificationDone);
  const setNotificationMeta = useAppStore((s) => s.setNotificationMeta);
  const removeNotification = useAppStore((s) => s.removeNotification);

  const [filter, setFilter] = useState<InboxFilter>('open');
  const [sort, setSort] = useState<InboxSort>('priority');
  const [serviceFilter, setServiceFilter] = useState('');
  const [allProfiles, setAllProfiles] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null);
  const [taskFor, setTaskFor] = useState<AppNotification | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // プロファイルで絞る（サービスが消えた通知は既定プロファイル扱い）
  const scoped = useMemo(() => {
    if (allProfiles) return notifications;
    return notifications.filter((n) => {
      const svc = services.find((s) => s.id === n.serviceId);
      return (svc ? profileOf(svc) : 'default') === activeProfileId;
    });
  }, [notifications, services, allProfiles, activeProfileId]);

  const openList = useMemo(() => scoped.filter(isOpen), [scoped]);
  const counts: Record<InboxFilter, number> = {
    open: openList.length,
    unread: openList.filter((n) => !n.read).length,
    important: openList.filter((n) => n.important).length,
    snoozed: scoped.filter((n) => n.snoozedUntil && !n.done).length,
    done: scoped.filter((n) => n.done).length,
  };

  const shown = useMemo(() => {
    const list = scoped.filter((n) => {
      if (serviceFilter && n.serviceId !== serviceFilter) return false;
      if (filter === 'open') return isOpen(n);
      if (filter === 'unread') return isOpen(n) && !n.read;
      if (filter === 'important') return isOpen(n) && n.important;
      if (filter === 'snoozed') return !!n.snoozedUntil && !n.done;
      return !!n.done;
    });
    return sort === 'priority' && filter !== 'done' ? [...list].sort(byScore) : list;
  }, [scoped, filter, sort, serviceFilter]);

  // 今日対応が必要な上位3件（受信箱にあるもののうち、スコア 50 以上）
  const top3 = useMemo(
    () => openList.filter((n) => (n.score ?? 0) >= 50).sort(byScore).slice(0, 3),
    [openList]
  );

  const serviceIds = Array.from(new Set(openList.map((n) => n.serviceId)));

  // 一覧が減ったらカーソルを範囲内に戻し、動いたら見える位置までスクロール
  useEffect(() => {
    if (cursor >= shown.length) setCursor(Math.max(0, shown.length - 1));
  }, [shown.length, cursor]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const openFrom = (n: AppNotification) => {
    markNotificationRead(n.id);
    const svc = services.find((s) => s.id === n.serviceId);
    if (!svc) return;
    // 別プロファイルのサービスならプロファイルも切り替える
    useAppStore.getState().setActiveProfile(profileOf(svc));
    openService(n.serviceId);
  };

  useInboxKeyboard({
    shown,
    cursor,
    setCursor,
    paused: !!taskFor || !!snoozeFor,
    onOpen: openFrom,
    onDone: (n) => markNotificationDone(n.id),
    onSnooze: (n) => setSnoozeFor(n.id),
    onTask: setTaskFor,
    onDelete: (n) => removeNotification(n.id),
  });

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>Inbox</h2>
        <p>
          各サービスの通知をまとめ、重要度順に並べます。<kbd>j</kbd>/<kbd>k</kbd> 移動・
          <kbd>e</kbd> 完了・<kbd>s</kbd> スヌーズ・<kbd>t</kbd> タスク化
        </p>
      </div>

      {top3.length > 0 && filter === 'open' && (
        <FocusCard top={top3} openList={openList} onOpen={openFrom} onTask={setTaskFor} />
      )}

      <div className="section">
        {scoped.length > 0 && (
          <InboxToolbar
            filter={filter}
            onFilter={setFilter}
            counts={counts}
            sort={sort}
            onSort={setSort}
            serviceFilter={serviceFilter}
            onServiceFilter={setServiceFilter}
            serviceIds={serviceIds}
            allProfiles={allProfiles}
            onAllProfiles={setAllProfiles}
          />
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
            <p>
              {filter === 'open'
                ? '受信箱ゼロ！すべて片付きました。'
                : 'この絞り込みに一致する通知はありません。'}
            </p>
          </div>
        ) : (
          <div className="card" ref={listRef}>
            {shown.map((n, idx) => (
              <InboxRow
                key={n.id}
                n={n}
                idx={idx}
                isCursor={idx === cursor}
                showScore={filter !== 'done'}
                snoozeOpen={snoozeFor === n.id}
                onOpen={() => {
                  setCursor(() => idx);
                  openFrom(n);
                }}
                onSnoozeOpen={(open) => setSnoozeFor(open ? n.id : null)}
                onTask={() => setTaskFor(n)}
              />
            ))}
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
