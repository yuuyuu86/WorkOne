import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Service,
  ServiceTemplate,
  ReadLaterItem,
  FocusMode,
  RecentEntry,
  AppNotification,
  HistoryEntry,
} from '../types/service';
import { CATEGORY_DEFAULT_ICON } from '../data/iconMap';

// 画面（サイドバーの遷移先）
export type ViewKey =
  | 'today'
  | 'inbox'
  | 'readLater'
  | 'focus'
  | 'settings'
  | 'service'; // 個別サービスの Web 表示

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type CustomServiceInput = {
  name: string;
  url: string;
  category: Service['category'];
  icon: string;
};

type AppState = {
  // 永続化対象
  services: Service[];
  readLater: ReadLaterItem[];
  recent: RecentEntry[];
  focusMode: FocusMode;
  focusServiceIds: string[]; // 集中モードで表示するサービス
  lastServiceId: string | null;
  /** サービスごとに最後に開いていた URL（次回はここから開く） */
  serviceUrls: Record<string, string>;
  /** OS 通知の ON/OFF（既定 ON） */
  notificationsEnabled: boolean;
  /** 起動時に全サービスを自動で読み込む（通知ハブ用、既定 ON） */
  autoloadServices: boolean;
  /** 通知をミュートするサービス ID（OS 通知を出さない） */
  mutedServices: string[];
  /** 重要サービス ID（重要グループ・集中モードでも通知） */
  importantServices: string[];
  /** 閲覧履歴の記録を有効にする（検索用、既定 ON） */
  historyEnabled: boolean;
  /** 閲覧履歴（「あの時見た〇〇」検索用、ローカルのみ） */
  history: HistoryEntry[];
  /** 特定サービスを指定 URL へ遷移させる指示（検索/履歴ジャンプ用） */
  navTarget: { serviceId: string; url: string; nonce: number } | null;
  /** 天気表示の位置（未設定なら IP 自動判定）。weatherEnabled で ON/OFF */
  weatherEnabled: boolean;
  weatherLocation: { lat: number; lon: number; label: string } | null;
  /** 外観テーマ（system はOSに追従、既定 system） */
  theme: 'system' | 'light' | 'dark';
  /** サイドバーの横幅（px、既定 248） */
  sidebarWidth: number;
  /** サイドバーを自動で隠す（左端ホバーで表示） */
  sidebarAutoHide: boolean;
  /** サイドバーをカテゴリ別にグループ表示する（既定 ON） */
  sidebarGrouped: boolean;
  /** 折りたたみ中のカテゴリ */
  collapsedCategories: string[];

  // 揮発（UI ナビゲーション・未読バッジ）
  activeView: ViewKey;
  activeServiceId: string | null;
  /** サービスごとの未読数（ページタイトルから推定、永続化しない） */
  serviceBadges: Record<string, number>;
  /** 統合 Inbox の通知（メモリのみ、永続化しない） */
  notifications: AppNotification[];

  // --- ナビゲーション ---
  setView: (view: ViewKey) => void;
  openService: (id: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setAutoloadServices: (enabled: boolean) => void;
  setHistoryEnabled: (enabled: boolean) => void;
  setWeatherEnabled: (enabled: boolean) => void;
  setWeatherLocation: (
    loc: { lat: number; lon: number; label: string } | null
  ) => void;
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
  setSidebarWidth: (width: number) => void;
  setSidebarAutoHide: (enabled: boolean) => void;
  setSidebarGrouped: (enabled: boolean) => void;
  toggleCategoryCollapsed: (category: string) => void;
  /** 閲覧履歴を1件記録（同一 URL は最新化して先頭へ） */
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'visitedAt'>) => void;
  clearHistory: () => void;
  /** サービスを開いて指定 URL へ遷移（検索結果や履歴の該当ページへ） */
  navigateService: (serviceId: string, url: string) => void;
  /** 未読バッジを更新（増加時は OS 通知のトリガー対象） */
  setServiceBadge: (id: string, count: number) => void;

  // --- 統合 Inbox 通知 ---
  /** 通知を追加（id で重複排除、最大 100 件） */
  addNotification: (
    item: Omit<AppNotification, 'read' | 'important'> & {
      read?: boolean;
      important?: boolean;
    }
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  toggleMutedService: (id: string) => void;
  toggleImportantService: (id: string) => void;
  /** webview の遷移に合わせて、そのサービスの最後の URL を記録 */
  setServiceLastUrl: (id: string, url: string) => void;

  // --- サービス管理 ---
  addServiceFromTemplate: (template: ServiceTemplate) => void;
  addCustomService: (input: CustomServiceInput) => void;
  /** 追加済みサービスの表示名・URL・カテゴリ・アイコンを更新 */
  updateService: (id: string, input: CustomServiceInput) => void;
  removeService: (id: string) => void;
  reorderServices: (from: number, to: number) => void;
  /** テンプレートが追加済みか（name + url で照合） */
  isTemplateAdded: (template: ServiceTemplate) => boolean;

  // --- 集中モード ---
  setFocusMode: (mode: FocusMode) => void;
  toggleFocusService: (id: string) => void;

  // --- あとで見る ---
  addReadLater: (item: Omit<ReadLaterItem, 'id' | 'createdAt'>) => void;
  removeReadLater: (id: string) => void;
  updateReadLaterNote: (id: string, note: string) => void;

  // --- データ削除 ---
  clearServices: () => void;
  clearReadLater: () => void;
  clearRecent: () => void;
  clearAll: () => void;
};

// テンプレートキーは name+url を元に判定（id はランダムなため別管理）
const templateKeyOf = (s: Service) => `${s.name}::${s.url}`;

// 改名前の保存キー（messagedock-store）があれば、新キー（workone-store）へ一度だけ移行。
// これで設定・追加済みサービス・あとで見る・履歴などをそのまま引き継ぐ。
try {
  if (
    typeof localStorage !== 'undefined' &&
    !localStorage.getItem('workone-store') &&
    localStorage.getItem('messagedock-store')
  ) {
    localStorage.setItem(
      'workone-store',
      localStorage.getItem('messagedock-store') as string
    );
  }
} catch {
  /* 失敗時は新規 */
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      services: [],
      readLater: [],
      recent: [],
      focusMode: 'normal',
      focusServiceIds: [],
      lastServiceId: null,
      serviceUrls: {},
      // 既定は OFF。各サービス自身の Web 通知（Gmail/Calendar/Slack 等の
      // 「デスクトップ通知」）を主役にし、これは予備（タイトル/フィードからの簡易通知）。
      notificationsEnabled: false,
      autoloadServices: true,
      mutedServices: [],
      importantServices: [],
      historyEnabled: true,
      history: [],
      navTarget: null,
      weatherEnabled: true,
      weatherLocation: null,
      theme: 'system',
      sidebarWidth: 248,
      sidebarAutoHide: false,
      sidebarGrouped: true,
      collapsedCategories: [],

      activeView: 'today',
      activeServiceId: null,
      serviceBadges: {},
      notifications: [],

      setView: (view) => set({ activeView: view }),

      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      setAutoloadServices: (enabled) => set({ autoloadServices: enabled }),

      setHistoryEnabled: (enabled) => set({ historyEnabled: enabled }),
      setWeatherEnabled: (enabled) => set({ weatherEnabled: enabled }),
      setWeatherLocation: (loc) => set({ weatherLocation: loc }),
      setTheme: (theme) => set({ theme }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.max(180, Math.min(420, Math.round(width))) }),
      setSidebarAutoHide: (enabled) => set({ sidebarAutoHide: enabled }),
      setSidebarGrouped: (enabled) => set({ sidebarGrouped: enabled }),
      toggleCategoryCollapsed: (category) => {
        const has = get().collapsedCategories.includes(category);
        set({
          collapsedCategories: has
            ? get().collapsedCategories.filter((c) => c !== category)
            : [...get().collapsedCategories, category],
        });
      },

      addHistory: (entry) => {
        if (!get().historyEnabled) return;
        if (!entry.url || !/^https?:\/\//i.test(entry.url)) return;
        const title = (entry.title || '').trim();
        if (!title) return;
        // 同一 URL は最新化して先頭へ（重複させない）。最大 400 件。
        const rest = get().history.filter((h) => h.url !== entry.url);
        const item: HistoryEntry = {
          ...entry,
          title,
          id: uid(),
          visitedAt: new Date().toISOString(),
        };
        set({ history: [item, ...rest].slice(0, 400) });
      },
      clearHistory: () => set({ history: [] }),

      navigateService: (serviceId, url) => {
        const now = new Date().toISOString();
        const recent = [
          { serviceId, openedAt: now },
          ...get().recent.filter((r) => r.serviceId !== serviceId),
        ].slice(0, 8);
        set({
          activeView: 'service',
          activeServiceId: serviceId,
          lastServiceId: serviceId,
          recent,
          navTarget: { serviceId, url, nonce: Date.now() },
        });
      },

      setServiceBadge: (id, count) => {
        const safe = Number.isFinite(count) && count > 0 ? count : 0;
        if ((get().serviceBadges[id] ?? 0) === safe) return;
        set({ serviceBadges: { ...get().serviceBadges, [id]: safe } });
      },

      addNotification: (item) => {
        // 同じ id は重複追加しない
        if (get().notifications.some((n) => n.id === item.id)) return;
        const entry: AppNotification = {
          read: false,
          important: get().importantServices.includes(item.serviceId),
          ...item,
        };
        set({
          notifications: [entry, ...get().notifications].slice(0, 100),
        });
      },
      markNotificationRead: (id) =>
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }),
      markAllNotificationsRead: () =>
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
        }),
      removeNotification: (id) =>
        set({
          notifications: get().notifications.filter((n) => n.id !== id),
        }),
      clearNotifications: () => set({ notifications: [] }),

      toggleMutedService: (id) => {
        const has = get().mutedServices.includes(id);
        set({
          mutedServices: has
            ? get().mutedServices.filter((x) => x !== id)
            : [...get().mutedServices, id],
        });
      },
      toggleImportantService: (id) => {
        const has = get().importantServices.includes(id);
        const importantServices = has
          ? get().importantServices.filter((x) => x !== id)
          : [...get().importantServices, id];
        // 既存の通知の重要フラグも更新
        set({
          importantServices,
          notifications: get().notifications.map((n) =>
            n.serviceId === id ? { ...n, important: !has } : n
          ),
        });
      },

      setServiceLastUrl: (id, url) => {
        if (!url || !/^https?:\/\//i.test(url)) return;
        set({ serviceUrls: { ...get().serviceUrls, [id]: url } });
      },

      openService: (id) => {
        const now = new Date().toISOString();
        const recent = [
          { serviceId: id, openedAt: now },
          ...get().recent.filter((r) => r.serviceId !== id),
        ].slice(0, 8);
        // 開いた = 既読扱いにしてバッジをクリア。
        // ただしメール系は開いただけでは既読にならないので未読件数を維持する。
        const svc = get().services.find((s) => s.id === id);
        const badges = { ...get().serviceBadges };
        if (svc && svc.category !== 'mail') badges[id] = 0;
        set({
          activeView: 'service',
          activeServiceId: id,
          lastServiceId: id,
          recent,
          serviceBadges: badges,
        });
      },

      addServiceFromTemplate: (template) => {
        // 既に同じテンプレートが追加済みならスキップ
        if (get().isTemplateAdded(template)) return;
        const service: Service = {
          id: uid(),
          name: template.name,
          url: template.url,
          category: template.category,
          icon: template.icon,
          supportLevel: template.supportLevel,
          isCustom: false,
          createdAt: new Date().toISOString(),
        };
        set({ services: [...get().services, service] });
      },

      addCustomService: (input) => {
        const service: Service = {
          id: uid(),
          name: input.name.trim(),
          url: input.url.trim(),
          category: input.category,
          icon: input.icon || CATEGORY_DEFAULT_ICON[input.category],
          supportLevel: {
            webView: true,
            notificationIntegration: false,
            inboxIntegration: false,
          },
          isCustom: true,
          createdAt: new Date().toISOString(),
        };
        set({ services: [...get().services, service] });
      },

      updateService: (id, input) => {
        const serviceUrls = { ...get().serviceUrls };
        const prev = get().services.find((s) => s.id === id);
        // URL を変えたら「最後に開いた URL」はリセット（古い deep link を持ち越さない）
        if (prev && prev.url !== input.url.trim()) {
          delete serviceUrls[id];
        }
        set({
          serviceUrls,
          services: get().services.map((s) =>
            s.id === id
              ? {
                  ...s,
                  name: input.name.trim(),
                  url: input.url.trim(),
                  category: input.category,
                  icon: input.icon || CATEGORY_DEFAULT_ICON[input.category],
                }
              : s
          ),
        });
      },

      removeService: (id) => {
        const services = get().services.filter((s) => s.id !== id);
        const serviceUrls = { ...get().serviceUrls };
        delete serviceUrls[id];
        set({
          services,
          serviceUrls,
          notifications: get().notifications.filter((n) => n.serviceId !== id),
          history: get().history.filter((h) => h.serviceId !== id),
          mutedServices: get().mutedServices.filter((x) => x !== id),
          importantServices: get().importantServices.filter((x) => x !== id),
          focusServiceIds: get().focusServiceIds.filter((x) => x !== id),
          recent: get().recent.filter((r) => r.serviceId !== id),
          activeServiceId: get().activeServiceId === id ? null : get().activeServiceId,
          activeView:
            get().activeServiceId === id ? 'today' : get().activeView,
          lastServiceId:
            get().lastServiceId === id ? null : get().lastServiceId,
        });
      },

      reorderServices: (from, to) => {
        const services = [...get().services];
        if (
          from < 0 ||
          to < 0 ||
          from >= services.length ||
          to >= services.length
        )
          return;
        const [moved] = services.splice(from, 1);
        services.splice(to, 0, moved);
        set({ services });
      },

      isTemplateAdded: (template) => {
        const key = `${template.name}::${template.url}`;
        return get().services.some((s) => templateKeyOf(s) === key);
      },

      setFocusMode: (mode) => set({ focusMode: mode }),

      toggleFocusService: (id) => {
        const has = get().focusServiceIds.includes(id);
        set({
          focusServiceIds: has
            ? get().focusServiceIds.filter((x) => x !== id)
            : [...get().focusServiceIds, id],
        });
      },

      addReadLater: (item) =>
        set({
          readLater: [
            { ...item, id: uid(), createdAt: new Date().toISOString() },
            ...get().readLater,
          ],
        }),

      removeReadLater: (id) =>
        set({ readLater: get().readLater.filter((r) => r.id !== id) }),

      updateReadLaterNote: (id, note) =>
        set({
          readLater: get().readLater.map((r) =>
            r.id === id ? { ...r, note } : r
          ),
        }),

      clearServices: () =>
        set({
          services: [],
          serviceUrls: {},
          mutedServices: [],
          importantServices: [],
          focusServiceIds: [],
          activeServiceId: null,
          lastServiceId: null,
          activeView: 'today',
        }),
      clearReadLater: () => set({ readLater: [] }),
      clearRecent: () => set({ recent: [] }),
      clearAll: () =>
        set({
          services: [],
          serviceUrls: {},
          readLater: [],
          recent: [],
          notifications: [],
          history: [],
          serviceBadges: {},
          mutedServices: [],
          importantServices: [],
          focusServiceIds: [],
          focusMode: 'normal',
          activeServiceId: null,
          lastServiceId: null,
          activeView: 'today',
        }),
    }),
    {
      name: 'workone-store',
      // 永続化するキーだけを選ぶ（UI ナビゲーション状態は除外）
      partialize: (state) => ({
        services: state.services,
        readLater: state.readLater,
        recent: state.recent,
        focusMode: state.focusMode,
        focusServiceIds: state.focusServiceIds,
        lastServiceId: state.lastServiceId,
        serviceUrls: state.serviceUrls,
        notificationsEnabled: state.notificationsEnabled,
        autoloadServices: state.autoloadServices,
        historyEnabled: state.historyEnabled,
        history: state.history,
        weatherEnabled: state.weatherEnabled,
        weatherLocation: state.weatherLocation,
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        sidebarAutoHide: state.sidebarAutoHide,
        sidebarGrouped: state.sidebarGrouped,
        collapsedCategories: state.collapsedCategories,
        mutedServices: state.mutedServices,
        importantServices: state.importantServices,
      }),
    }
  )
);
