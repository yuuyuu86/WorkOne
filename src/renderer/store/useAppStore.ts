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
  /** 新着通知のときにアプリ内で音を鳴らす（既定 OFF） */
  notificationSound: boolean;
  /** カレンダー webview から最後に取得できた予定の生ラベル（Home 表示用キャッシュ） */
  calendarRaw: string[];
  /** カレンダー生ラベルを取得した時刻（ms） */
  calendarRawAt: number;
  setCalendarRaw: (labels: string[]) => void;
  /** Classroom から最後に取得できた課題一覧（コマンドパレット検索/通知用キャッシュ） */
  classroomItems: { title: string; href: string; due: string; course: string }[];
  setClassroomItems: (
    items: { title: string; href: string; due: string; course: string }[]
  ) => void;
  /** Home ウィジェットの並び順（全 ID。表示/非表示問わず順序を保持） */
  homeWidgetOrder: string[];
  /** 非表示にした Home ウィジェットの ID */
  homeWidgetHidden: string[];
  /** Home ウィジェットの幅（'full'=全幅 / 'half'=半幅）。未指定は full */
  homeWidgetWidth: Record<string, 'full' | 'half'>;
  setHomeWidgetOrder: (order: string[]) => void;
  toggleHomeWidgetHidden: (id: string) => void;
  setHomeWidgetWidth: (id: string, w: 'full' | 'half') => void;
  resetHomeWidgets: () => void;
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
  /** Home の背景にする画像（data URL）。未設定なら null */
  homeBackgroundImage: string | null;
  /** 背景画像の上に重ねる暗さ（0〜1、文字の読みやすさ調整用） */
  homeBackgroundDim: number;
  setHomeBackgroundImage: (dataUrl: string | null) => void;
  setHomeBackgroundDim: (dim: number) => void;
  /** おやすみ時間（DND）。指定時間帯は通知を出さない */
  dndEnabled: boolean;
  dndStart: string; // "HH:MM"
  dndEnd: string; // "HH:MM"
  /** 現在おやすみ時間中か（揮発・App のタイマーが更新） */
  dndActive: boolean;
  /** サービスごとのズーム倍率（Electron zoomLevel、永続化） */
  serviceZoom: Record<string, number>;
  /** 初回ウェルカム/オンボーディングを表示済みか */
  onboarded: boolean;
  /** 使い方ツアー（スポットライト解説）を表示済みか */
  tourSeen: boolean;
  /** Home の「編集」ボタン（ウィジェットの並び替え）の初回ヒントを表示済みか */
  homeEditHintSeen: boolean;
  setHomeEditHintSeen: (seen: boolean) => void;

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
  setNotificationSound: (enabled: boolean) => void;
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
  setDndEnabled: (enabled: boolean) => void;
  setDndWindow: (start: string, end: string) => void;
  setDndActive: (active: boolean) => void;
  setServiceZoom: (id: string, zoom: number) => void;
  setOnboarded: (done: boolean) => void;
  setTourSeen: (done: boolean) => void;
  /** 設定をエクスポート（JSON 文字列） */
  exportSettings: () => string;
  /** 設定をインポート（成功で true） */
  importSettings: (json: string) => boolean;
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

// Home ウィジェットの既定の並び順（新規ユーザー・リセット時）
export const DEFAULT_HOME_WIDGETS = [
  'stats',
  'notifications',
  'calendar',
  'classroom',
  'frequent',
  'readLater',
  'focus',
];

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
      notificationSound: false,
      calendarRaw: [],
      calendarRawAt: 0,
      classroomItems: [],
      homeWidgetOrder: [...DEFAULT_HOME_WIDGETS],
      homeWidgetHidden: [],
      homeWidgetWidth: {},
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
      sidebarGrouped: false,
      collapsedCategories: [],
      homeBackgroundImage: null,
      homeBackgroundDim: 0.55,
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '07:00',
      dndActive: false,
      serviceZoom: {},
      onboarded: false,
      tourSeen: false,
      homeEditHintSeen: false,

      activeView: 'today',
      activeServiceId: null,
      serviceBadges: {},
      notifications: [],

      setView: (view) => set({ activeView: view }),

      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      setAutoloadServices: (enabled) => set({ autoloadServices: enabled }),
      setNotificationSound: (enabled) => set({ notificationSound: enabled }),
      setCalendarRaw: (labels) =>
        set({ calendarRaw: labels, calendarRawAt: Date.now() }),
      setClassroomItems: (items) => set({ classroomItems: items }),
      setHomeWidgetOrder: (order) => set({ homeWidgetOrder: order }),
      toggleHomeWidgetHidden: (id) =>
        set((s) => ({
          homeWidgetHidden: s.homeWidgetHidden.includes(id)
            ? s.homeWidgetHidden.filter((x) => x !== id)
            : [...s.homeWidgetHidden, id],
        })),
      setHomeWidgetWidth: (id, w) =>
        set((s) => ({ homeWidgetWidth: { ...s.homeWidgetWidth, [id]: w } })),
      resetHomeWidgets: () =>
        set({
          homeWidgetOrder: [...DEFAULT_HOME_WIDGETS],
          homeWidgetHidden: [],
          homeWidgetWidth: {},
        }),

      setHistoryEnabled: (enabled) => set({ historyEnabled: enabled }),
      setWeatherEnabled: (enabled) => set({ weatherEnabled: enabled }),
      setWeatherLocation: (loc) => set({ weatherLocation: loc }),
      setTheme: (theme) => set({ theme }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.max(180, Math.min(420, Math.round(width))) }),
      setSidebarAutoHide: (enabled) => set({ sidebarAutoHide: enabled }),
      setSidebarGrouped: (enabled) => set({ sidebarGrouped: enabled }),
      setHomeBackgroundImage: (dataUrl) =>
        set({ homeBackgroundImage: dataUrl }),
      setHomeBackgroundDim: (dim) => set({ homeBackgroundDim: dim }),
      toggleCategoryCollapsed: (category) => {
        const has = get().collapsedCategories.includes(category);
        set({
          collapsedCategories: has
            ? get().collapsedCategories.filter((c) => c !== category)
            : [...get().collapsedCategories, category],
        });
      },
      setDndEnabled: (enabled) => set({ dndEnabled: enabled }),
      setDndWindow: (start, end) => set({ dndStart: start, dndEnd: end }),
      setDndActive: (active) => {
        if (get().dndActive !== active) set({ dndActive: active });
      },
      setServiceZoom: (id, zoom) => {
        if ((get().serviceZoom[id] ?? 0) === zoom) return;
        set({ serviceZoom: { ...get().serviceZoom, [id]: zoom } });
      },
      setOnboarded: (done) => set({ onboarded: done }),
      setTourSeen: (done) => set({ tourSeen: done }),
      setHomeEditHintSeen: (seen) => set({ homeEditHintSeen: seen }),

      exportSettings: () => {
        const s = get();
        const data = {
          app: 'WorkOne',
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: {
            services: s.services,
            readLater: s.readLater,
            focusMode: s.focusMode,
            focusServiceIds: s.focusServiceIds,
            serviceUrls: s.serviceUrls,
            notificationsEnabled: s.notificationsEnabled,
            autoloadServices: s.autoloadServices,
            notificationSound: s.notificationSound,
            historyEnabled: s.historyEnabled,
            weatherEnabled: s.weatherEnabled,
            weatherLocation: s.weatherLocation,
            theme: s.theme,
            sidebarWidth: s.sidebarWidth,
            sidebarAutoHide: s.sidebarAutoHide,
            sidebarGrouped: s.sidebarGrouped,
            collapsedCategories: s.collapsedCategories,
            dndEnabled: s.dndEnabled,
            dndStart: s.dndStart,
            dndEnd: s.dndEnd,
            serviceZoom: s.serviceZoom,
            mutedServices: s.mutedServices,
            importantServices: s.importantServices,
          },
        };
        // 履歴・通知（本文を含みうる）はエクスポートしない
        return JSON.stringify(data, null, 2);
      },

      importSettings: (json) => {
        try {
          const parsed = JSON.parse(json);
          const st = parsed?.settings;
          if (!st || !Array.isArray(st.services)) return false;
          // 既知のキーだけを取り込む（未知キーは無視）
          const allowed: (keyof AppState)[] = [
            'services',
            'readLater',
            'focusMode',
            'focusServiceIds',
            'serviceUrls',
            'notificationsEnabled',
            'autoloadServices',
            'notificationSound',
            'historyEnabled',
            'weatherEnabled',
            'weatherLocation',
            'theme',
            'sidebarWidth',
            'sidebarAutoHide',
            'sidebarGrouped',
            'collapsedCategories',
            'dndEnabled',
            'dndStart',
            'dndEnd',
            'serviceZoom',
            'mutedServices',
            'importantServices',
          ];
          const next: Partial<AppState> = {};
          for (const k of allowed) {
            if (st[k] !== undefined) (next as any)[k] = st[k];
          }
          set(next as AppState);
          return true;
        } catch {
          return false;
        }
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
        const serviceZoom = { ...get().serviceZoom };
        delete serviceZoom[id];
        set({
          services,
          serviceUrls,
          serviceZoom,
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
        notificationSound: state.notificationSound,
        calendarRaw: state.calendarRaw,
        calendarRawAt: state.calendarRawAt,
        classroomItems: state.classroomItems,
        homeWidgetOrder: state.homeWidgetOrder,
        homeWidgetHidden: state.homeWidgetHidden,
        homeWidgetWidth: state.homeWidgetWidth,
        historyEnabled: state.historyEnabled,
        history: state.history,
        weatherEnabled: state.weatherEnabled,
        weatherLocation: state.weatherLocation,
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        sidebarAutoHide: state.sidebarAutoHide,
        sidebarGrouped: state.sidebarGrouped,
        homeBackgroundImage: state.homeBackgroundImage,
        homeBackgroundDim: state.homeBackgroundDim,
        collapsedCategories: state.collapsedCategories,
        dndEnabled: state.dndEnabled,
        dndStart: state.dndStart,
        dndEnd: state.dndEnd,
        serviceZoom: state.serviceZoom,
        onboarded: state.onboarded,
        tourSeen: state.tourSeen,
        homeEditHintSeen: state.homeEditHintSeen,
        mutedServices: state.mutedServices,
        importantServices: state.importantServices,
      }),
    }
  )
);
