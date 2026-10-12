import { FiCheckCircle, FiLayers, FiTrash2 } from 'react-icons/fi';
import { useAppStore } from '../../store/useAppStore';
import type { InboxFilter, InboxSort } from './inboxUtils';

type Props = {
  filter: InboxFilter;
  onFilter: (f: InboxFilter) => void;
  counts: Record<InboxFilter, number>;
  sort: InboxSort;
  onSort: (s: InboxSort) => void;
  serviceFilter: string;
  onServiceFilter: (id: string) => void;
  /** 絞り込みに出すサービス（通知があるもの） */
  serviceIds: string[];
  allProfiles: boolean;
  onAllProfiles: (v: boolean) => void;
};

const TABS: [InboxFilter, string][] = [
  ['open', '受信箱'],
  ['unread', '未読'],
  ['important', '重要'],
  ['snoozed', 'スヌーズ中'],
  ['done', '完了'],
];

/** 状態のタブ（左）と、並び順・絞り込みなどの控えめな操作（右） */
export function InboxToolbar(p: Props) {
  const services = useAppStore((s) => s.services);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const clearAll = useAppStore((s) => s.clearNotifications);

  return (
    <div className="inbox-toolbar">
      <div className="view-tabs" role="tablist">
        {TABS
          // 受信箱・未読は常に、それ以外は件数があるか選択中のときだけ出す
          .filter(([k]) => k === 'open' || k === 'unread' || p.counts[k] > 0 || p.filter === k)
          .map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={p.filter === k}
              className={`view-tab ${p.filter === k ? 'active' : ''}`}
              onClick={() => p.onFilter(k)}
            >
              {label}
              {p.counts[k] > 0 && <span className="view-tab-count">{p.counts[k]}</span>}
            </button>
          ))}
      </div>

      <div className="toolbar-controls">
        {p.serviceIds.length > 1 && (
          <select
            className="toolbar-select"
            value={p.serviceFilter}
            onChange={(e) => p.onServiceFilter(e.target.value)}
            title="サービスで絞り込み"
          >
            <option value="">すべてのサービス</option>
            {p.serviceIds.map((sid) => {
              const svc = services.find((x) => x.id === sid);
              return svc ? (
                <option key={sid} value={sid}>
                  {svc.name}
                </option>
              ) : null;
            })}
          </select>
        )}
        <select
          className="toolbar-select"
          value={p.sort}
          onChange={(e) => p.onSort(e.target.value as InboxSort)}
          title="並び順"
        >
          <option value="priority">重要度順</option>
          <option value="newest">新着順</option>
        </select>
        <button
          className={`icon-btn toolbar-toggle ${p.allProfiles ? 'on' : ''}`}
          title={p.allProfiles ? '全プロファイルの通知を表示中' : 'このプロファイルの通知だけを表示中'}
          onClick={() => p.onAllProfiles(!p.allProfiles)}
        >
          <FiLayers size={15} />
        </button>
        <button className="icon-btn" title="すべて既読にする" onClick={markAllRead}>
          <FiCheckCircle size={15} />
        </button>
        <button className="icon-btn" title="通知をすべてクリア" onClick={clearAll}>
          <FiTrash2 size={15} />
        </button>
      </div>
    </div>
  );
}
