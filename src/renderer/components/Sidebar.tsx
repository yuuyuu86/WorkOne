import { useEffect, useRef, useState } from 'react';
import {
  FiHome,
  FiInbox,
  FiBookmark,
  FiTarget,
  FiPlus,
  FiSettings,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import { useAppStore, type ViewKey } from '../store/useAppStore';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Service,
  type ServiceCategory,
} from '../types/service';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  onOpenAdd: () => void;
  onOpenSearch: () => void;
  /** 自動非表示のとき、サイドバーから離れたら隠す */
  onMouseLeave?: () => void;
};

export function Sidebar({ onOpenAdd, onOpenSearch, onMouseLeave }: Props) {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
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
  const sidebarGrouped = useAppStore((s) => s.sidebarGrouped);
  const collapsedCategories = useAppStore((s) => s.collapsedCategories);
  const toggleCategoryCollapsed = useAppStore((s) => s.toggleCategoryCollapsed);
  const unreadNotifications = useAppStore(
    (s) => s.notifications.filter((n) => !n.read).length
  );

  // ドラッグ並び替え（通常モードのみ。集中モードは表示が絞られるため無効）。
  // id ベースで扱う（グループ表示でも崩れないように）。
  const [dragId, setDragId] = useState<string | null>(null);
  const canReorder = focusMode === 'normal';

  // 右端ドラッグで横幅を変更
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const s = resizeRef.current;
      if (!s) return;
      setSidebarWidth(s.startW + (e.clientX - s.startX));
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, setSidebarWidth]);

  // ドロップ先サービスの位置へ移動。グループ表示では同カテゴリ内のみ。
  const handleDropOn = (target: Service) => {
    if (!dragId || dragId === target.id) {
      setDragId(null);
      return;
    }
    const dragged = services.find((s) => s.id === dragId);
    if (dragged && (!sidebarGrouped || dragged.category === target.category)) {
      const from = services.findIndex((s) => s.id === dragId);
      const to = services.findIndex((s) => s.id === target.id);
      if (from >= 0 && to >= 0) reorderServices(from, to);
    }
    setDragId(null);
  };

  // 集中モードに応じて表示するサービスを絞る
  let visibleServices = services;
  if (focusMode === 'focus') {
    visibleServices = services.filter((s) => focusServiceIds.includes(s.id));
  } else if (focusMode === 'deep') {
    visibleServices = []; // 完全集中モードはサービス一覧を隠す
  }

  // 1 サービス分のボタン
  const serviceButton = (svc: Service) => (
    <button
      key={svc.id}
      className={`nav-item ${
        activeView === 'service' && activeServiceId === svc.id ? 'active' : ''
      } ${dragId === svc.id ? 'dragging' : ''}`}
      onClick={() => openService(svc.id)}
      title={svc.name}
      draggable={canReorder}
      onDragStart={() => canReorder && setDragId(svc.id)}
      onDragOver={(e) => canReorder && e.preventDefault()}
      onDrop={() => canReorder && handleDropOn(svc)}
      onDragEnd={() => setDragId(null)}
    >
      <ServiceIcon iconKey={svc.icon} chip={22} />
      <span className="nav-label">{svc.name}</span>
      {serviceBadges[svc.id] > 0 && (
        <span className="unread-badge">{serviceBadges[svc.id]}</span>
      )}
    </button>
  );

  // カテゴリ別グループ（該当サービスがあるカテゴリのみ見出しを出す）
  const renderGrouped = () =>
    CATEGORY_ORDER.map((cat) => {
      const items = visibleServices.filter((s) => s.category === cat);
      if (items.length === 0) return null;
      const collapsed = collapsedCategories.includes(cat);
      const unread = items.reduce(
        (a, s) => a + (serviceBadges[s.id] > 0 ? serviceBadges[s.id] : 0),
        0
      );
      return (
        <div key={cat}>
          <button
            className="sidebar-group-header"
            onClick={() => toggleCategoryCollapsed(cat)}
          >
            {collapsed ? (
              <FiChevronRight size={13} />
            ) : (
              <FiChevronDown size={13} />
            )}
            <span className="grow">{CATEGORY_LABELS[cat as ServiceCategory]}</span>
            {collapsed && unread > 0 && (
              <span className="unread-badge">{unread}</span>
            )}
          </button>
          {!collapsed && items.map((svc) => serviceButton(svc))}
        </div>
      );
    });

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
    <aside
      className="sidebar"
      style={{ width: sidebarWidth }}
      onMouseLeave={onMouseLeave}
    >
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

      {navItem('today', 'Home', <FiHome size={16} />)}
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
      ) : sidebarGrouped ? (
        renderGrouped()
      ) : (
        visibleServices.map((svc) => serviceButton(svc))
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

      <div
        className={`sidebar-resizer ${resizing ? 'active' : ''}`}
        onMouseDown={(e) => {
          resizeRef.current = { startX: e.clientX, startW: sidebarWidth };
          setResizing(true);
        }}
        title="ドラッグで幅を調整"
      />
    </aside>
  );
}
