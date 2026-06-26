// WorkOne のドメイン型定義

export type ServiceCategory = 'mail' | 'chat' | 'school' | 'calendar' | 'custom';

/**
 * 各サービスの対応レベル。
 * MVP では webView のみ true。通知統合・Inbox 統合は将来対応の旗印。
 */
export type ServiceSupportLevel = {
  webView: boolean;
  notificationIntegration: boolean;
  inboxIntegration: boolean;
};

export type Service = {
  id: string;
  name: string;
  url: string;
  category: ServiceCategory;
  /** react-icons を引くためのアイコンキー（data/iconMap で解決） */
  icon: string;
  supportLevel: ServiceSupportLevel;
  isCustom: boolean;
  createdAt: string;
};

/** サービス追加画面で使うテンプレート（id は追加時に採番） */
export type ServiceTemplate = Omit<Service, 'id' | 'createdAt' | 'isCustom'> & {
  /** テンプレートを一意に識別するキー（追加済み判定に使用） */
  templateKey: string;
  description: string;
};

export type ReadLaterItem = {
  id: string;
  title: string;
  url: string;
  serviceName: string;
  note?: string;
  createdAt: string;
};

/**
 * 統合 Inbox に集約する通知アイテム。
 * 各サービスの Web 通知（Gmail/Slack/Calendar 等が出すもの）や、
 * Gmail フィードの新着を正規化して 1 か所にまとめる。
 * プライバシー配慮のため localStorage には保存せず、メモリ上のみで保持する。
 */
export type AppNotification = {
  id: string;
  serviceId: string;
  serviceName: string;
  icon: string;
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
  /** 重要サービス由来の通知（重要グループでフィルタ・集中モードでも通知） */
  important: boolean;
};

/** 集中モードの種類 */
export type FocusMode = 'normal' | 'focus' | 'deep';

/**
 * 閲覧履歴の1件。実際に開いたページのタイトルと URL を記録し、
 * 「あの時見たメール/メッセージ」をキーワードで探して飛べるようにする。
 * ローカル保存のみ（外部送信なし）。
 */
export type HistoryEntry = {
  id: string;
  serviceId: string;
  serviceName: string;
  icon: string;
  title: string;
  url: string;
  visitedAt: string;
};

/** 最近開いたサービスの履歴 */
export type RecentEntry = {
  serviceId: string;
  openedAt: string;
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  mail: 'メール',
  chat: 'チャット',
  school: '学校',
  calendar: '予定・会議',
  custom: 'カスタムURL',
};

export const CATEGORY_ORDER: ServiceCategory[] = [
  'mail',
  'chat',
  'school',
  'calendar',
  'custom',
];
