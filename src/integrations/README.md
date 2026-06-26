# integrations/

将来の API 連携用の抽象層です。**MVP では未実装**（Web 表示のみ）。

## 方針

各サービスの API 連携は `ServiceIntegration` インターフェース（`types.ts`）を実装する形で追加します。
UI 側（Inbox / 今日画面）は具象実装ではなく `integrationRegistry` 越しに通知・予定を取得するため、
アダプターを差し込むだけで統合 Inbox を段階的に有効化できます。

## 追加予定のアダプター

```
integrations/
  types.ts          # 共通インターフェース（実装済み）
  google/           # Gmail / Calendar / Classroom (OAuth)
  slack/            # メンション取得
  discord/          # 通知取得
  outlook/          # Microsoft Graph
```

## 実装手順（将来）

1. `integrations/google/index.ts` などに `ServiceIntegration` を実装
2. アプリ起動時に `registerIntegration(new GoogleIntegration())` を呼ぶ
3. `InboxView` / `TodayView` が `integrationRegistry` を走査して
   `fetchNotifications()` / `fetchSchedule()` の結果を表示
4. 認証は OAuth（PKCE）をメインプロセス側で実施。
   トークンは `safeStorage`（OS キーチェーン）で暗号化保存し、
   **ID / パスワードは決して保存しない**。
