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
  /** 所属プロファイル（未指定は既定プロファイル） */
  profileId?: string;
  /** 使っていないときも休止させない（通知を受け続けたいサービス用） */
  keepAlive?: boolean;
};

/** 時間割（この曜日・時間帯はこのプロファイルに自動で切り替える） */
export type ProfileSchedule = {
  /** 0=日 〜 6=土 */
  days: number[];
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

/**
 * Arc の Space のようなプロファイル。ログイン状態（パーティション）・
 * サービス一覧・テーマ色をプロファイルごとに分ける。
 */
export type Profile = {
  id: string;
  name: string;
  /** アイコンのキー（lib/profileIcons） */
  icon: string;
  color: string;
  schedule: ProfileSchedule[];
};

export const DEFAULT_PROFILE_ID = 'default';

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
 * 端末内（localStorage）にのみ保存し、外部へは送信しない（AI もオンデバイス）。
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
  /** トリアージで完了にした */
  done?: boolean;
  /** この時刻まで非表示（スヌーズ） */
  snoozedUntil?: string;
  /** 重要度スコア（0〜100、ルール＋オンデバイス AI） */
  score?: number;
  /** AI による一行要約 */
  summary?: string;
  /** タスク候補（ルール or AI が抽出。ユーザーが確認して登録する） */
  taskSuggestion?: { title: string; due?: string };
  /** スコア付け・AI 処理済み */
  analyzed?: boolean;
};

/** タスク */
export type TaskSource = 'manual' | 'notification' | 'classroom' | 'ai';

export type TaskPriority = 'high' | 'normal' | 'low';
export type TaskRepeat = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export type Subtask = { id: string; title: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  /** 期限日（YYYY-MM-DD）。無ければ undefined */
  due?: string;
  /** 期限の時刻（HH:MM）。あればその時刻に通知する */
  dueTime?: string;
  /** 通知済み（同じ期限で二重に通知しない） */
  remindedFor?: string;
  priority?: TaskPriority;
  repeat?: TaskRepeat;
  subtasks?: Subtask[];
  note?: string;
  source: TaskSource;
  /** 出どころのサービス／リンク（クリックで開く） */
  serviceId?: string;
  url?: string;
  profileId: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
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
