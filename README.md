# WorkOne

Slack、Gmail、Google Classroom、Google Calendar、Discord、Outlook など、
複数の **連絡・学校・予定系サービス** を 1 つのアプリ内でまとめて開くための
**連絡専用ブラウザー** です。

各サービスは公式 Web 版をアプリ内に埋め込んで表示し、ログインは各サービスの
公式ログイン画面で行います。WorkOne 側で ID・パスワードは一切保存しません。

> MVP の方針: API 連携は行わず、まずは Web 表示とサービス管理を完成させます。
> 通知統合・OAuth 連携は将来対応予定で、そのための抽象層だけ用意しています。

---

## 起動方法

前提: Node.js 18 以上（推奨 20+）。

```bash
# 1. 依存関係のインストール
npm install

# 2. 開発モードで起動（Vite + Electron が自動で立ち上がります）
npm run dev

# 3. 本番ビルド（型チェック + バンドル）
npm run build

# 4. 配布用にパッケージ化（.app / .dmg などを release/ に生成）
npm run dist          # インストーラ（mac: dmg / win: nsis / linux: AppImage）
npm run dist:dir      # 動作確認用にアプリ本体だけを高速生成
```

`npm run dist` を実行すると、アプリアイコン付きの実行可能アプリが `release/` に作られ、
ターミナルなしでダブルクリック起動できます（アイコンは `npm run icons` で自動生成）。

### キーボードショートカット

| 操作 | キー |
| --- | --- |
| サービスを追加 | Cmd/Ctrl + N |
| 設定 | Cmd/Ctrl + , |
| 今日 / Inbox / あとで見る | Cmd/Ctrl + 1 / 2 / 3 |
| 再読み込み | Cmd/Ctrl + R |
| 戻る / 進む | Cmd/Ctrl + [ / ] |
| 次の / 前のサービス | Cmd/Ctrl + Shift + ] / [ |
| 拡大 / 縮小 / 等倍 | Cmd/Ctrl + + / - / 0 |

### 通知について

- 通知は各サービス側の設定で「デスクトップ通知」をオンにすると、サービス自身が
  OS 通知を出します（WorkOne は通知・カメラ・マイクの許可を与えています）。
- 受け取った通知は **Inbox 画面に集約**されます（内容はメモリ上のみ・保存なし）。
- ウィンドウを閉じてもアプリはバックグラウンドに常駐し（メニューバー常駐アイコン／Dock）、
  通知を受け続けます。完全に終了するには常駐アイコン or メニューの「終了」。
- 設定の「起動時に全サービスを自動で読み込む」をオンにすると、開いていないサービスの
  通知・未読も受け取れます。

`npm run dev` を実行すると Vite の開発サーバーが起動し、自動的に Electron の
ウィンドウが開きます。

初回はサービスが未追加なので、左サイドバーの「サービスを追加」から
Gmail / Slack / Google Classroom などを選んで追加してください。

---

## 主要ファイルの説明

```
src/
  main/
    main.ts            Electron メインプロセス。ウィンドウ生成とセキュリティ設定。
                       webview のポップアップを外部ブラウザに転送、外部リンク/確認
                       ダイアログの IPC を提供。
    preload.ts         contextBridge で最小限の API (openExternal / confirm) のみ公開。

  renderer/
    main.tsx           React エントリ。
    App.tsx            画面の切り替え（今日 / Inbox / あとで見る / 集中 / 設定 / サービス）。

    components/
      Sidebar.tsx          左サイドバー。集中モードに応じてサービス一覧を出し分け。
      ServiceView.tsx      中央の Web 表示エリア。<webview> + ツールバー（戻る/進む/
                           再読み込み/外部で開く/あとで見る保存）。
      ServiceCard.tsx      サービス追加画面のカード（対応レベル表示・追加/追加済み）。
      AddServiceModal.tsx  カテゴリ別のサービス追加モーダル。
      CustomServiceForm.tsx カスタム URL 追加フォーム（http/https のみ許可）。
      TodayView.tsx        今日画面（よく使う/最近開いた/あとで見る/集中モード状態）。
      InboxView.tsx        Inbox 画面（追加済み一覧 + 通知統合の将来 UI プレースホルダ）。
      ReadLaterView.tsx    あとで見る（保存/一覧/開く/削除/メモ編集）。
      FocusModeView.tsx    集中モード（3 モード切替 + 表示サービス選択）。
      SettingsView.tsx     設定（並び替え/削除/集中対象選択/データ削除/アプリ情報）。
      ServiceIcon.tsx      react-icons をキーから解決する共通アイコン。

    data/
      serviceTemplates.ts  最初から選べるサービス定義（対象サービスのみ）。
      iconMap.tsx          アイコンキー → react-icons とブランドカラーの対応。

    store/
      useAppStore.ts       zustand + persist(localStorage) によるアプリ状態。

    types/
      service.ts           Service / ReadLaterItem / FocusMode などのドメイン型。
      global.d.ts          window.workOne と <webview> の型定義。

  integrations/            将来の API 連携用の抽象層（MVP では interface のみ）。
    types.ts               ServiceIntegration インターフェースとレジストリ。
    README.md              連携アダプターの追加手順。
```

---

## 保存データ（ローカルのみ）

`localStorage`（zustand persist、キー: `messagedock-store`）に保存します。

保存するもの:

- 追加済みサービス / 並び順
- 集中モード設定（モード・表示サービス）
- あとで見る一覧
- 最近開いたサービス / 最後に開いたサービス

**保存しないもの**: パスワード、メール本文、チャット本文、添付ファイル、
各サービスのログイン情報。

> 各サービスのログインセッション（Cookie）は Electron の `<webview>` が
> サービスごとの永続パーティション（`persist:service-<id>`）として保持します。
> これは各サービスのブラウザ領域内に閉じており、WorkOne がアプリの保存データ
> として直接読み書きすることはありません。

---

## 今後 API 連携を追加する場合の設計メモ

API 連携は `src/integrations/` の抽象層を通して段階的に追加します。

1. `integrations/types.ts` の `ServiceIntegration` を実装した具象アダプターを
   `integrations/google/`, `integrations/slack/` などに追加する。
2. アプリ起動時に `registerIntegration(new GoogleIntegration())` で登録する。
3. `InboxView` / `TodayView` は具象実装に依存せず `integrationRegistry` を走査し、
   `fetchNotifications()` / `fetchSchedule()` の結果を表示する
   （現在はそのための空 UI プレースホルダを用意済み）。
4. 認証は OAuth (PKCE) をメインプロセスで実施し、トークンは OS キーチェーン
   （Electron `safeStorage`）で暗号化保存する。**ID/パスワードは保存しない。**

`Service` 型の `supportLevel`（webView / notificationIntegration /
inboxIntegration）を使って、サービスごとに「Web 表示のみ」「通知統合対応」などの
段階を UI に反映できます。

将来追加したい機能: Gmail 通知 / Calendar 予定 / Classroom 課題 /
Slack メンション / 重要通知グループ / 通知 ON/OFF / OS 通知 /
返信必要リスト / 今日のまとめ自動生成。

---

## セキュリティ上の注意点

- `nodeIntegration: false` / `contextIsolation: true`。レンダラーに Node を露出しない。
- preload は `contextBridge` で **openExternal** と **confirm** のみ公開。
- `<webview>` はサービスごとに独立パーティションで分離（セッション隔離）。
- ポップアップ / `target=_blank` / 外部リンクは **OS の既定ブラウザ** で開く
  （`setWindowOpenHandler` で `http(s)` のみ許可、それ以外は拒否）。
- レンダラー側に CSP を設定し、外部スクリプトを読み込ませない。
- ログインは各サービスの公式 Web 画面で行い、WorkOne 側に ID/パスワード入力
  フォームは作らない。
- DOM スクレイピングや自動ログイン、不要なスクリプト注入は行わない。
- User-Agent は、Electron 標準 UA から `Electron` / `WorkOne` トークンを
  取り除いて「素の Chrome」として正規化し、さらに表記上の Chrome メジャー
  バージョンを下限（既定 140）まで引き上げている（[main.ts](src/main/main.ts) /
  [userAgent.ts](src/renderer/data/userAgent.ts)）。
  Slack など一部サービスが古い Chrome を「未対応ブラウザ」として弾くための調整で、
  表示エンジンは実際に Chromium。別ブラウザへのなりすまし（例: Safari を騙る等）は
  行わない。Electron をアップグレードしてエンジンが新しくなれば、この下限は
  不要になり次第見直す。

---

## やらないこと（仕様）

LINE / Notion / Canva / Figma / GitHub / AI ツール系には対応しません。
非公式スクレイピング、User-Agent 偽装、自動ログイン、パスワード保存、
本文の勝手な保存も行いません。連絡・学校・予定に専念したアプリです。
