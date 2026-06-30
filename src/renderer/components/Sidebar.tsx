import { useEffect, useRef, useState } from 'react';
import {
  FiHome,
  FiInbox,
  FiBookmark,
  FiGrid,
  FiTarget,
  FiMoon,
  FiPlus,
  FiSettings,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiHelpCircle,
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
  onOpenShortcuts: () => void;
  /** 自動非表示のとき、サイドバーから離れたら隠す */
  onMouseLeave?: () => void;
};

export function Sidebar({
  onOpenAdd,
  onOpenSearch,
  onOpenShortcuts,
  onMouseLeave,
}: Props) {
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

  // 小ネタ: 未読バッジが増えた瞬間だけ軽くバウンスさせる
  const prevBadgesRef = useRef<Record<string, number>>({});
  const [bumpedIds, setBumpedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevBadgesRef.current;
    const bumped = Object.entries(serviceBadges)
      .filter(([id, count]) => count > 0 && count > (prev[id] ?? 0))
      .map(([id]) => id);
    prevBadgesRef.current = { ...serviceBadges };
    if (bumped.length === 0) return;
    setBumpedIds((s) => new Set([...s, ...bumped]));
    const t = setTimeout(() => {
      setBumpedIds((s) => {
        const next = new Set(s);
        bumped.forEach((id) => next.delete(id));
        return next;
      });
    }, 500);
    return () => clearTimeout(t);
  }, [serviceBadges]);

  // 小ネタ: ロゴを 1.2 秒以内に 5 回連打すると、ウェルカム集約アニメを再生する。
  const logoClicksRef = useRef<number[]>([]);
  const handleLogoClick = () => {
    const now = Date.now();
    const clicks = logoClicksRef.current.filter((t) => now - t < 1200);
    clicks.push(now);
    logoClicksRef.current = clicks;
    if (clicks.length >= 5) {
      logoClicksRef.current = [];
      window.dispatchEvent(new CustomEvent('md:logo-burst'));
    }
  };

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

  // Slack のワークスペースか（host が slack.com 系）
  const isSlackService = (s: Service) => {
    try {
      return new URL(s.url).hostname.endsWith('slack.com');
    } catch {
      return false;
    }
  };

  // 1 サービス分のボタン（sub=true でワークスペース等の入れ子表示）
  const serviceButton = (svc: Service, sub = false) => (
    <button
      key={svc.id}
      className={`nav-item ${sub ? 'nav-sub' : ''} ${
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
      <ServiceIcon iconKey={svc.icon} chip={sub ? 18 : 22} />
      <span className="nav-label">{svc.name}</span>
      {serviceBadges[svc.id] > 0 && (
        <span
          className={`unread-badge ${bumpedIds.has(svc.id) ? 'bump' : ''}`}
        >
          {serviceBadges[svc.id]}
        </span>
      )}
    </button>
  );

  // Slack ワークスペースをまとめたプルダウン（2 件以上のとき）
  const SLACK_KEY = '__slack';
  const slackNode = (slackItems: Service[]) => {
    if (slackItems.length === 1) return serviceButton(slackItems[0]);
    const collapsed = collapsedCategories.includes(SLACK_KEY);
    const unread = slackItems.reduce(
      (a, s) => a + (serviceBadges[s.id] > 0 ? serviceBadges[s.id] : 0),
      0
    );
    const childActive =
      activeView === 'service' &&
      slackItems.some((s) => s.id === activeServiceId);
    return (
      <div key={SLACK_KEY}>
        <button
          className={`nav-item ${childActive && collapsed ? 'active' : ''}`}
          onClick={() => toggleCategoryCollapsed(SLACK_KEY)}
          title="Slack ワークスペース"
        >
          <ServiceIcon iconKey="slack" chip={22} />
          <span className="nav-label">Slack</span>
          {collapsed && unread > 0 && (
            <span className="unread-badge">{unread}</span>
          )}
          <span className="nav-icon" style={{ marginLeft: 'auto' }}>
            {collapsed ? (
              <FiChevronRight size={14} />
            ) : (
              <FiChevronDown size={14} />
            )}
          </span>
        </button>
        {!collapsed && slackItems.map((svc) => serviceButton(svc, true))}
      </div>
    );
  };

  // サービス一覧を描画。Slack ワークスペースは 1 つのプルダウンにまとめる。
  const renderServiceList = (items: Service[]) => {
    const slackItems = items.filter(isSlackService);
    const out: React.ReactNode[] = [];
    let slackEmitted = false;
    for (const svc of items) {
      if (isSlackService(svc)) {
        if (!slackEmitted) {
          out.push(slackNode(slackItems));
          slackEmitted = true;
        }
        continue;
      }
      out.push(serviceButton(svc));
    }
    return out;
  };

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
          {!collapsed && renderServiceList(items)}
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
      <div className="sidebar-header" onClick={handleLogoClick}>
        <span className="logo-mark">
          <FiInbox size={19} />
        </span>
        <h1>WorkOne</h1>
      </div>

      <button
        className="nav-item"
        onClick={onOpenSearch}
        data-tour="search"
      >
        <span className="nav-icon">
          <FiSearch size={16} />
        </span>
        <span className="nav-label">検索</span>
        <span className="nav-badge">⌘K</span>
      </button>

      <div data-tour="nav-views">
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
      </div>
      <div data-tour="focus-mode">
        {navItem(
          'focus',
          '集中モード',
          focusMode === 'deep' ? (
            <FiMoon size={16} />
          ) : focusMode === 'focus' ? (
            <FiTarget size={16} />
          ) : (
            <FiGrid size={16} />
          ),
          focusMode !== 'normal' ? 'ON' : undefined
        )}
      </div>

      <div className="sidebar-section-label">マイサービス</div>
      <div data-tour="services">
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
          renderServiceList(visibleServices)
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ marginTop: 12 }}>
        <button
          className="nav-item"
          onClick={onOpenAdd}
          data-tour="add-service"
        >
          <span className="nav-icon">
            <FiPlus size={16} />
          </span>
          <span className="nav-label">サービスを追加</span>
        </button>
      </div>
      <div data-tour="settings">
        {navItem('settings', '設定', <FiSettings size={16} />)}
      </div>
      <button className="nav-item" onClick={onOpenShortcuts}>
        <span className="nav-icon">
          <FiHelpCircle size={16} />
        </span>
        <span className="nav-label">ショートカット</span>
        <span className="nav-badge">?</span>
      </button>

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
