import { useState } from 'react';
import {
  FiSun,
  FiInbox,
  FiBookmark,
  FiTarget,
  FiPlus,
  FiSettings,
  FiSearch,
} from 'react-icons/fi';
import { useAppStore, type ViewKey } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  onOpenAdd: () => void;
  onOpenSearch: () => void;
};

export function Sidebar({ onOpenAdd, onOpenSearch }: Props) {
  const activeView = useAppStore((s) => s.activeView);
  const activeServiceId = useAppStore((s) => s.activeServiceId);
  const services = useAppStore((s) => s.services);
  const focusMode = useAppStore((s) => s.focusMode);
  const focusServiceIds = useAppStore((s) => s.focusServiceIds);
  const readLater = useAppStore((s) => s.readLater);
  const setView = useAppStore((s) => s.setView);
  const openService = useAppStore((s) => s.openService);
  const reorderServices = useAppStore((s) => s.reorderServices);
  const serviceBadges = useAppStore((s) => s.serviceBadges);
  const unreadNotifications = useAppStore(
    (s) => s.notifications.filter((n) => !n.read).length
  );

  // ドラッグ並び替え（通常モードのみ。集中モードは表示が絞られるため無効）
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const canReorder = focusMode === 'normal';

  const handleDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) {
      reorderServices(dragIndex, to);
    }
    setDragIndex(null);
  };

  // 集中モードに応じて表示するサービスを絞る
  let visibleServices = services;
  if (focusMode === 'focus') {
    visibleServices = services.filter((s) => focusServiceIds.includes(s.id));
  } else if (focusMode === 'deep') {
    visibleServices = []; // 完全集中モードはサービス一覧を隠す
  }

  const navItem = (
    key: ViewKey,
    label: string,
    icon: React.ReactNode,
    badge?: string
  ) => (
    <button
      className={`nav-item ${activeView === key ? 'active' : ''}`}
      onClick={() => setView(key)}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-mark">
          <FiInbox size={15} />
        </span>
        <h1>WorkOne</h1>
      </div>

      <button className="nav-item" onClick={onOpenSearch}>
        <span className="nav-icon">
          <FiSearch size={16} />
        </span>
        <span className="nav-label">検索</span>
        <span className="nav-badge">⌘K</span>
      </button>

      {navItem('today', '今日', <FiSun size={16} />)}
      {navItem(
        'inbox',
        'Inbox',
        <FiInbox size={16} />,
        unreadNotifications ? String(unreadNotifications) : undefined
      )}
      {navItem(
        'readLater',
        'あとで見る',
        <FiBookmark size={16} />,
        readLater.length ? String(readLater.length) : undefined
      )}
      {navItem(
        'focus',
        '集中モード',
        <FiTarget size={16} />,
        focusMode !== 'normal' ? 'ON' : undefined
      )}

      <div className="sidebar-section-label">マイサービス</div>
      {focusMode === 'deep' ? (
        <div className="sidebar-empty">
          完全集中モード中はサービス一覧を非表示にしています。
        </div>
      ) : visibleServices.length === 0 ? (
        <div className="sidebar-empty">
          {services.length === 0
            ? '「サービスを追加」からGmailやSlackなどを追加できます。'
            : '集中モードで表示するサービスが選択されていません。'}
        </div>
      ) : (
        visibleServices.map((svc, i) => (
          <button
            key={svc.id}
            className={`nav-item ${
              activeView === 'service' && activeServiceId === svc.id
                ? 'active'
                : ''
            } ${dragIndex === i ? 'dragging' : ''}`}
            onClick={() => openService(svc.id)}
            title={svc.name}
            draggable={canReorder}
            onDragStart={() => canReorder && setDragIndex(i)}
            onDragOver={(e) => canReorder && e.preventDefault()}
            onDrop={() => canReorder && handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <ServiceIcon iconKey={svc.icon} chip={22} />
            <span className="nav-label">{svc.name}</span>
            {serviceBadges[svc.id] > 0 && (
              <span className="unread-badge">{serviceBadges[svc.id]}</span>
            )}
          </button>
        ))
      )}

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 12 }}>
        <button className="nav-item" onClick={onOpenAdd}>
          <span className="nav-icon">
            <FiPlus size={16} />
          </span>
          <span className="nav-label">サービスを追加</span>
        </button>
      </div>
      {navItem('settings', '設定', <FiSettings size={16} />)}
    </aside>
  );
}
