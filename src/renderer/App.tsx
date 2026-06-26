import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ServiceWebviews } from './components/ServiceWebviews';
import { TodayView } from './components/TodayView';
import { InboxView } from './components/InboxView';
import { ReadLaterView } from './components/ReadLaterView';
import { FocusModeView } from './components/FocusModeView';
import { SettingsView } from './components/SettingsView';
import { AddServiceModal } from './components/AddServiceModal';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { UpdateBanner } from './components/UpdateBanner';
import { useAppStore } from './store/useAppStore';
import { isWithinDnd } from './lib/dnd';

export default function App() {
  const activeView = useAppStore((s) => s.activeView);
  const theme = useAppStore((s) => s.theme);
  const sidebarAutoHide = useAppStore((s) => s.sidebarAutoHide);
  const dndEnabled = useAppStore((s) => s.dndEnabled);
  const dndStart = useAppStore((s) => s.dndStart);
  const dndEnd = useAppStore((s) => s.dndEnd);
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // 自動非表示時に、左端ホバーでサイドバーを一時表示
  const [sidebarRevealed, setSidebarRevealed] = useState(false);

  // 外観テーマを <html data-theme> に反映（system は OS 設定に追従）
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      root.setAttribute('data-theme', resolved);
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  // 「?」キーでショートカット一覧を開く（入力欄にフォーカス中は無効）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el?.isContentEditable
      )
        return;
      e.preventDefault();
      setShowShortcuts((v) => !v);
    };
    const onShow = () => setShowShortcuts(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('md:show-shortcuts', onShow);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('md:show-shortcuts', onShow);
    };
  }, []);

  // おやすみ時間（DND）の現在状態を1分ごとに評価してストアへ反映
  useEffect(() => {
    const evaluate = () => {
      const active = dndEnabled && isWithinDnd(dndStart, dndEnd);
      useAppStore.getState().setDndActive(active);
    };
    evaluate();
    const t = setInterval(evaluate, 30000);
    return () => clearInterval(t);
  }, [dndEnabled, dndStart, dndEnd]);
  // Cmd/Ctrl+K はメニューのアクセラレータで処理（webview にフォーカスがあっても効くため）

  // メニュー/キーボードショートカットのコマンドを処理
  useEffect(() => {
    const api = window.workOne;
    if (!api?.onMenuCommand) return;
    return api.onMenuCommand((command) => {
      const store = useAppStore.getState();
      switch (command) {
        case 'add-service':
          setShowAdd(true);
          break;
        case 'search':
          setShowSearch(true);
          break;
        case 'settings':
          store.setView('settings');
          break;
        case 'view-today':
          store.setView('today');
          break;
        case 'view-inbox':
          store.setView('inbox');
          break;
        case 'view-readlater':
          store.setView('readLater');
          break;
        case 'next-service':
        case 'prev-service': {
          const list = store.services;
          if (list.length === 0) break;
          const idx = list.findIndex((s) => s.id === store.activeServiceId);
          const delta = command === 'next-service' ? 1 : -1;
          const nextIdx =
            idx < 0
              ? 0
              : (idx + delta + list.length) % list.length;
          store.openService(list[nextIdx].id);
          break;
        }
        // webview 操作はアクティブな ServiceFrame に委譲
        case 'reload':
        case 'back':
        case 'forward':
        case 'zoom-in':
        case 'zoom-out':
        case 'zoom-reset':
          window.dispatchEvent(
            new CustomEvent('md:webview-cmd', { detail: command })
          );
          break;
      }
    });
  }, []);

  // Dock / タスクバーのバッジに合計未読数を反映
  const totalUnread = useAppStore((s) =>
    Object.values(s.serviceBadges).reduce((a, b) => a + (b > 0 ? b : 0), 0)
  );
  useEffect(() => {
    window.workOne?.setBadge?.(totalUnread);
  }, [totalUnread]);

  const renderView = () => {
    switch (activeView) {
      case 'today':
        return <TodayView onOpenAdd={() => setShowAdd(true)} />;
      case 'inbox':
        return <InboxView onOpenAdd={() => setShowAdd(true)} />;
      case 'readLater':
        return <ReadLaterView />;
      case 'focus':
        return <FocusModeView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TodayView onOpenAdd={() => setShowAdd(true)} />;
    }
  };

  return (
    <div
      className={`app${sidebarAutoHide ? ' sidebar-autohide' : ''}${
        sidebarAutoHide && sidebarRevealed ? ' sidebar-revealed' : ''
      }`}
    >
      {sidebarAutoHide && (
        <div
          className="sidebar-hover-zone"
          onMouseEnter={() => setSidebarRevealed(true)}
        />
      )}
      <Sidebar
        onOpenAdd={() => setShowAdd(true)}
        onOpenSearch={() => setShowSearch(true)}
        onMouseLeave={
          sidebarAutoHide ? () => setSidebarRevealed(false) : undefined
        }
      />
      <div className="main">
        <UpdateBanner />
        {/* webview は常時マウント＆常にレイアウト維持（白画面防止 + 未読/通知のため） */}
        <ServiceWebviews />
        {activeView !== 'service' && (
          <div className="view-overlay">{renderView()}</div>
        )}
      </div>
      {showAdd && <AddServiceModal onClose={() => setShowAdd(false)} />}
      {showSearch && <CommandPalette onClose={() => setShowSearch(false)} />}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
