import type { ServiceTemplate } from '../types/service';

// MVP のみ Web 表示。通知/Inbox 統合は将来対応。
const WEB_ONLY = {
  webView: true,
  notificationIntegration: false,
  inboxIntegration: false,
};

/**
 * 最初から選べるサービステンプレート。
 * 仕様の対象サービスのみを掲載（LINE / Notion / AI 系などは含めない）。
 */
export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  // --- メール ---
  {
    templateKey: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com/',
    category: 'mail',
    icon: 'gmail',
    description: 'Google のメール。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'outlook',
    name: 'Outlook',
    url: 'https://outlook.office.com/',
    category: 'mail',
    icon: 'outlook',
    description: 'Microsoft 365 / Outlook のメール。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'yahoo-mail',
    name: 'Yahoo!メール',
    url: 'https://mail.yahoo.co.jp/',
    category: 'mail',
    icon: 'yahoo',
    description: 'Yahoo! JAPAN のメール。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'proton-mail',
    name: 'Proton Mail',
    url: 'https://mail.proton.me/',
    category: 'mail',
    icon: 'proton',
    description: 'プライバシー重視の暗号化メール。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'icloud-mail',
    name: 'iCloud メール',
    url: 'https://www.icloud.com/mail/',
    category: 'mail',
    icon: 'icloud',
    description: 'Apple の iCloud メール。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'zoho-mail',
    name: 'Zoho Mail',
    url: 'https://mail.zoho.com/',
    category: 'mail',
    icon: 'zoho',
    description: 'ビジネス向けの Zoho メール。',
    supportLevel: WEB_ONLY,
  },

  // --- チャット ---
  {
    templateKey: 'slack',
    // app.slack.com（クライアントのルート）は未ログイン時に「未対応ブラウザ」
    // 案内へ飛ぶため、ブラウザでサインインできる入口を使う。
    // ログイン後は自動的にクライアント（app.slack.com/client/...）へ遷移する。
    name: 'Slack',
    url: 'https://slack.com/signin',
    category: 'chat',
    icon: 'slack',
    description: 'ワークスペース型のチャット。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    category: 'chat',
    icon: 'discord',
    description: 'コミュニティ / グループチャット。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'teams',
    name: 'Microsoft Teams',
    url: 'https://teams.microsoft.com/',
    category: 'chat',
    icon: 'teams',
    description: 'Microsoft のチャット / 会議。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'google-chat',
    name: 'Google Chat',
    url: 'https://chat.google.com/',
    category: 'chat',
    icon: 'googlechat',
    description: 'Google のチャット。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'chatwork',
    name: 'Chatwork',
    url: 'https://www.chatwork.com/login.php',
    category: 'chat',
    icon: 'chatwork',
    description: '日本のビジネスチャット。',
    supportLevel: WEB_ONLY,
  },

  // --- 学校 ---
  {
    templateKey: 'classroom',
    name: 'Google Classroom',
    url: 'https://classroom.google.com/',
    category: 'school',
    icon: 'classroom',
    description: '授業・課題の管理。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'google-drive',
    name: 'Google Drive',
    url: 'https://drive.google.com/',
    category: 'school',
    icon: 'drive',
    description: 'ファイル・資料の保管と共有。',
    supportLevel: WEB_ONLY,
  },

  // --- 予定・会議 ---
  {
    templateKey: 'google-calendar',
    name: 'Google Calendar',
    url: 'https://calendar.google.com/',
    category: 'calendar',
    icon: 'calendar',
    description: '予定の確認と管理。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'google-meet',
    name: 'Google Meet',
    url: 'https://meet.google.com/',
    category: 'calendar',
    icon: 'meet',
    description: 'ビデオ会議。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'zoom',
    name: 'Zoom',
    url: 'https://zoom.us/',
    category: 'calendar',
    icon: 'zoom',
    description: 'ビデオ会議。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'outlook-calendar',
    name: 'Outlook 予定表',
    url: 'https://outlook.office.com/calendar/',
    category: 'calendar',
    icon: 'outlook',
    description: 'Microsoft 365 の予定表。',
    supportLevel: WEB_ONLY,
  },
  {
    templateKey: 'webex',
    name: 'Cisco Webex',
    url: 'https://web.webex.com/',
    category: 'calendar',
    icon: 'webex',
    description: 'Cisco のビデオ会議。',
    supportLevel: WEB_ONLY,
  },
];
