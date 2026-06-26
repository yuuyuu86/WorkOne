// 将来の API 連携用の抽象層。
// MVP では実装しないが、後から google / slack / discord / outlook などの
// 具象アダプターをこのインターフェースに沿って追加できるようにしておく。

/** 統合 Inbox に流し込む正規化済み通知アイテム */
export interface NotificationItem {
  id: string;
  source: string; // 'gmail' | 'slack' | 'classroom' ...
  title: string;
  summary?: string;
  url?: string;
  receivedAt: string;
  /** 重要通知グループ分け用 */
  importance?: 'normal' | 'important';
  /** 返信が必要かどうか（将来の「返信必要リスト」用） */
  needsReply?: boolean;
}

/** カレンダー予定など、時間軸を持つアイテム */
export interface ScheduleItem {
  id: string;
  source: string;
  title: string;
  startAt: string;
  endAt?: string;
  url?: string;
}

/**
 * 各サービス連携アダプターが実装する共通インターフェース。
 * 認証は OAuth を想定（MVP では未実装）。
 */
export interface ServiceIntegration {
  readonly key: string; // 'google' | 'slack' | 'discord' | 'outlook'
  readonly displayName: string;

  /** OAuth などの認証状態 */
  isAuthenticated(): Promise<boolean>;
  authenticate(): Promise<void>;
  signOut(): Promise<void>;

  /** 通知取得（Inbox 統合用）。未対応なら空配列を返す。 */
  fetchNotifications(): Promise<NotificationItem[]>;

  /** 予定取得（今日画面 / カレンダー用）。未対応なら空配列。 */
  fetchSchedule?(): Promise<ScheduleItem[]>;
}

/** 連携アダプターのレジストリ（将来ここに具象を登録する） */
export const integrationRegistry: Record<string, ServiceIntegration> = {};

export function registerIntegration(integration: ServiceIntegration): void {
  integrationRegistry[integration.key] = integration;
}
