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
import { UpdateBanner } from './components/UpdateBanner';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const activeView = useAppStore((s) => s.activeView);
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
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
    <div className="app">
      <Sidebar
        onOpenAdd={() => setShowAdd(true)}
        onOpenSearch={() => setShowSearch(true)}
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
    </div>
  );
}
