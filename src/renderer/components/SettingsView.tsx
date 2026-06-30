import { useEffect, useState } from 'react';
import {
  FiArrowUp,
  FiArrowDown,
  FiTrash2,
  FiShield,
  FiEdit2,
  FiX,
  FiStar,
  FiBellOff,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY_LABELS, type Service } from '../types/service';
import { ServiceIcon } from './ServiceIcon';
import { confirmAction } from '../lib/confirm';
import { SHARED_PARTITION } from '../lib/session';
import { CustomServiceForm } from './CustomServiceForm';
import { geocodeCity, getPreciseLocation, detectLocation } from '../lib/weather';
import { fileToResizedDataUrl } from '../lib/image';

export function SettingsView() {
  const [editing, setEditing] = useState<Service | null>(null);
  const services = useAppStore((s) => s.services);
  const focusServiceIds = useAppStore((s) => s.focusServiceIds);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);
  const autoloadServices = useAppStore((s) => s.autoloadServices);
  const setAutoloadServices = useAppStore((s) => s.setAutoloadServices);
  const notificationSound = useAppStore((s) => s.notificationSound);
  const setNotificationSound = useAppStore((s) => s.setNotificationSound);
  const historyEnabled = useAppStore((s) => s.historyEnabled);
  const setHistoryEnabled = useAppStore((s) => s.setHistoryEnabled);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const historyCount = useAppStore((s) => s.history.length);
  const weatherEnabled = useAppStore((s) => s.weatherEnabled);
  const setWeatherEnabled = useAppStore((s) => s.setWeatherEnabled);
  const weatherLocation = useAppStore((s) => s.weatherLocation);
  const setWeatherLocation = useAppStore((s) => s.setWeatherLocation);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const sidebarAutoHide = useAppStore((s) => s.sidebarAutoHide);
  const setSidebarAutoHide = useAppStore((s) => s.setSidebarAutoHide);
  const sidebarGrouped = useAppStore((s) => s.sidebarGrouped);
  const setSidebarGrouped = useAppStore((s) => s.setSidebarGrouped);
  const homeBackgroundImage = useAppStore((s) => s.homeBackgroundImage);
  const setHomeBackgroundImage = useAppStore((s) => s.setHomeBackgroundImage);
  const homeBackgroundDim = useAppStore((s) => s.homeBackgroundDim);
  const setHomeBackgroundDim = useAppStore((s) => s.setHomeBackgroundDim);
  const [bgMsg, setBgMsg] = useState('');
  const dndEnabled = useAppStore((s) => s.dndEnabled);
  const setDndEnabled = useAppStore((s) => s.setDndEnabled);
  const dndStart = useAppStore((s) => s.dndStart);
  const dndEnd = useAppStore((s) => s.dndEnd);
  const dndActive = useAppStore((s) => s.dndActive);
  const setDndWindow = useAppStore((s) => s.setDndWindow);
  const exportSettings = useAppStore((s) => s.exportSettings);
  const importSettings = useAppStore((s) => s.importSettings);
  const [ioMsg, setIoMsg] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [cityMsg, setCityMsg] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');

  useEffect(() => {
    (window as any).workOne?.appVersion?.().then(setAppVersion);
  }, []);

  const handleBackgroundFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBgMsg('読み込み中…');
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setHomeBackgroundImage(dataUrl);
      setBgMsg('設定しました');
      setTimeout(() => setBgMsg(''), 2000);
    } catch {
      setBgMsg('画像を設定できませんでした');
      setTimeout(() => setBgMsg(''), 3000);
    }
  };

  const handleCheckUpdate = async () => {
    const api = (window as any).workOne;
    if (!api?.checkUpdate) {
      setUpdateMsg('この機能は再起動後に有効になります。');
      return;
    }
    setUpdateMsg('確認中…');
    const u = await api.checkUpdate();
    if (u) {
      setUpdateMsg(`新しいバージョン v${u.version} があります`);
      api.openExternal?.(u.url);
    } else {
      setUpdateMsg('最新です（または配信先が未設定です）');
    }
  };

  const handleExport = () => {
    try {
      const json = exportSettings();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `workone-settings-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setIoMsg('設定を書き出しました。');
    } catch {
      setIoMsg('書き出しに失敗しました。');
    }
  };

  const handleImportFile = async (file: File) => {
    const ok = await confirmAction(
      '設定をインポートすると、現在のサービス一覧や設定が上書きされます。続けますか？'
    );
    if (!ok) return;
    try {
      const text = await file.text();
      if (importSettings(text)) {
        setIoMsg('設定を読み込みました。反映するにはアプリを再起動してください。');
      } else {
        setIoMsg('読み込みに失敗しました。ファイル形式を確認してください。');
      }
    } catch {
      setIoMsg('読み込みに失敗しました。');
    }
  };

  const applyCity = async () => {
    const name = cityInput.trim();
    if (!name) return;
    setCityMsg('検索中…');
    const loc = await geocodeCity(name);
    if (loc) {
      setWeatherLocation(loc);
      setCityMsg(`「${loc.label}」に設定しました`);
      setCityInput('');
    } else {
      setCityMsg('見つかりませんでした。別の都市名で試してください。');
    }
  };
  const removeService = useAppStore((s) => s.removeService);
  const reorderServices = useAppStore((s) => s.reorderServices);
  const toggleFocusService = useAppStore((s) => s.toggleFocusService);
  const mutedServices = useAppStore((s) => s.mutedServices);
  const importantServices = useAppStore((s) => s.importantServices);
  const toggleMutedService = useAppStore((s) => s.toggleMutedService);
  const toggleImportantService = useAppStore((s) => s.toggleImportantService);
  const clearServices = useAppStore((s) => s.clearServices);
  const clearReadLater = useAppStore((s) => s.clearReadLater);
  const clearRecent = useAppStore((s) => s.clearRecent);
  const clearAll = useAppStore((s) => s.clearAll);

  // 確認ダイアログ（ネイティブ→なければブラウザ標準）を挟んでから削除する
  const confirmThen = async (message: string, action: () => void) => {
    const ok = await confirmAction(message);
    if (ok) action();
  };

  // Web 表示のキャッシュ・ログインセッションを削除（全サービスからログアウト）
  const clearWebCache = async () => {
    const ok = await confirmAction(
      'すべてのサービスのキャッシュとログインセッションを削除しますか？各サービスからログアウトされ、次回開いたときに再ログインが必要になります。'
    );
    if (!ok) return;
    const partitions = [SHARED_PARTITION];
    const api = (window as any).workOne;
    if (api?.clearWebCache) {
      await api.clearWebCache(partitions);
      await confirmAction(
        'キャッシュとセッションを削除しました。反映するにはアプリを再起動してください。'
      );
    }
  };

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>設定</h2>
        <p>サービスの管理とデータの削除ができます。</p>
      </div>

      <div className="section">
        <h3 className="section-title">追加済みサービス</h3>
        {services.length === 0 ? (
          <p className="muted">追加済みのサービスはありません。</p>
        ) : (
          <div className="card">
            {services.map((svc, i) => (
              <div className="list-row" key={svc.id}>
                <div className="reorder-btns">
                  <button
                    disabled={i === 0}
                    title="上へ"
                    onClick={() => reorderServices(i, i - 1)}
                  >
                    <FiArrowUp size={14} />
                  </button>
                  <button
                    disabled={i === services.length - 1}
                    title="下へ"
                    onClick={() => reorderServices(i, i + 1)}
                  >
                    <FiArrowDown size={14} />
                  </button>
                </div>
                <ServiceIcon iconKey={svc.icon} chip={28} />
                <div className="grow">
                  <div className="row-title">{svc.name}</div>
                  <div className="row-sub">
                    {CATEGORY_LABELS[svc.category]}
                    {svc.isCustom ? '・カスタム' : ''}
                  </div>
                </div>
                <label
                  className="muted"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  title="集中モードで表示"
                >
                  <input
                    type="checkbox"
                    checked={focusServiceIds.includes(svc.id)}
                    onChange={() => toggleFocusService(svc.id)}
                  />
                  集中
                </label>
                <button
                  className="icon-btn"
                  title={
                    importantServices.includes(svc.id)
                      ? '重要を解除'
                      : '重要にする（集中モードでも通知）'
                  }
                  onClick={() => toggleImportantService(svc.id)}
                  style={{
                    color: importantServices.includes(svc.id)
                      ? '#FFB300'
                      : undefined,
                  }}
                >
                  <FiStar
                    size={15}
                    fill={
                      importantServices.includes(svc.id) ? '#FFB300' : 'none'
                    }
                  />
                </button>
                <button
                  className="icon-btn"
                  title={
                    mutedServices.includes(svc.id)
                      ? '通知ミュートを解除'
                      : '通知をミュート'
                  }
                  onClick={() => toggleMutedService(svc.id)}
                  style={{
                    color: mutedServices.includes(svc.id)
                      ? 'var(--danger)'
                      : undefined,
                  }}
                >
                  <FiBellOff size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="編集"
                  onClick={() => setEditing(svc)}
                >
                  <FiEdit2 size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="削除"
                  onClick={() =>
                    confirmThen(`「${svc.name}」を削除しますか？`, () =>
                      removeService(svc.id)
                    )
                  }
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ marginTop: 10 }}>
          並び替えは矢印ボタンで行います。「集中」のチェックは集中モードでの表示対象です。
        </p>
      </div>

      <div className="section">
        <h3 className="section-title">外観</h3>
        <div className="card">
          <div className="check-row" style={{ gap: 12 }}>
            <span className="grow">
              テーマ
              <div className="muted" style={{ marginTop: 2 }}>
                「システム」は macOS の外観設定（ライト/ダーク）に自動で合わせます。
              </div>
            </span>
            <div className="segmented">
              {(
                [
                  ['system', 'システム'],
                  ['light', 'ライト'],
                  ['dark', 'ダーク'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={theme === value ? 'active' : ''}
                  onClick={() => setTheme(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={sidebarGrouped}
              onChange={(e) => setSidebarGrouped(e.target.checked)}
            />
            <span className="grow">
              サイドバーをカテゴリ別に表示する
              <div className="muted" style={{ marginTop: 2 }}>
                メール / チャット / 学校 / 予定 ごとにまとめ、見出しをクリックで
                折りたたみできます。
              </div>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={sidebarAutoHide}
              onChange={(e) => setSidebarAutoHide(e.target.checked)}
            />
            <span className="grow">
              サイドバーを自動で隠す
              <div className="muted" style={{ marginTop: 2 }}>
                オンにすると普段はサイドバーを隠し、画面の左端にカーソルを近づけると
                サイドバーが表示されます。横幅はサイドバー右端をドラッグして調整できます。
              </div>
            </span>
          </label>
          <div className="check-row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <span className="grow">
              Home の背景画像
              <div className="muted" style={{ marginTop: 2 }}>
                好きな画像を Home 画面の背景に設定できます。画像は端末内にのみ
                保存されます。
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                  画像を選ぶ
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleBackgroundFile}
                  />
                </label>
                {homeBackgroundImage && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setHomeBackgroundImage(null)}
                  >
                    <FiX size={13} /> 背景を解除
                  </button>
                )}
                {bgMsg && <span className="muted">{bgMsg}</span>}
              </div>
              {homeBackgroundImage && (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      width: 160,
                      height: 90,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      backgroundImage: `url(${homeBackgroundImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <div style={{ marginTop: 10, maxWidth: 280 }}>
                    <label className="muted" style={{ fontSize: 12 }}>
                      暗さ（文字の読みやすさ調整）
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={0.85}
                      step={0.05}
                      value={homeBackgroundDim}
                      onChange={(e) =>
                        setHomeBackgroundDim(Number(e.target.value))
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">通知</h3>
        <div className="info-banner" style={{ marginBottom: 14 }}>
          <FiShield size={18} className="info-icon" />
          <div>
            通知は基本的に<strong>各サービス自身の設定</strong>で有効化してください。
            例: Gmail / Google Calendar / Slack の設定で「デスクトップ通知」をオンにすると、
            そのサービスが直接 OS 通知を出します（送信者・内容つき）。WorkOne
            側は通知の許可を与えているだけです。
          </div>
        </div>
        <div className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={autoloadServices}
              onChange={(e) => setAutoloadServices(e.target.checked)}
            />
            <span className="grow">
              起動時に全サービスを自動で読み込む（通知ハブ）
              <div className="muted" style={{ marginTop: 2 }}>
                オンにすると、開いていないサービスの通知や未読も受け取れます。
                オフにすると一度開いたサービスのみ対象（軽量）。
              </div>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
            />
            <span className="grow">
              アプリ側でも簡易通知を出す（予備）
              <div className="muted" style={{ marginTop: 2 }}>
                各サービスの通知が使えない場合用。開いているサービスのタイトルや
                Gmail のフィードから新着を検知して通知します。各サービスの通知と
                重複する場合はオフにしてください。
              </div>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={notificationSound}
              onChange={(e) => setNotificationSound(e.target.checked)}
            />
            <span className="grow">
              新着通知のときに音を鳴らす
              <div className="muted" style={{ marginTop: 2 }}>
                サービスから通知が届いたときにアプリ内で短い効果音を鳴らします。
                ミュート中・おやすみ時間中は鳴りません。
              </div>
            </span>
          </label>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">おやすみ時間</h3>
        <div className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={dndEnabled}
              onChange={(e) => setDndEnabled(e.target.checked)}
            />
            <span className="grow">
              指定した時間帯は通知を止める
              <div className="muted" style={{ marginTop: 2 }}>
                おやすみ時間中は OS 通知を出しません（Inbox には記録されます）。
                {dndEnabled && (
                  <>
                    {' '}
                    現在は
                    <strong>
                      {dndActive ? 'おやすみ時間中' : 'おやすみ時間外'}
                    </strong>
                    です。
                  </>
                )}
              </div>
            </span>
          </label>
          {dndEnabled && (
            <div className="check-row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="grow">時間帯</span>
              <input
                type="time"
                value={dndStart}
                onChange={(e) => setDndWindow(e.target.value, dndEnd)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--panel-bg)',
                  color: 'var(--text)',
                }}
              />
              <span className="muted">〜</span>
              <input
                type="time"
                value={dndEnd}
                onChange={(e) => setDndWindow(dndStart, e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--panel-bg)',
                  color: 'var(--text)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">検索・履歴</h3>
        <div className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={historyEnabled}
              onChange={(e) => setHistoryEnabled(e.target.checked)}
            />
            <span className="grow">
              閲覧履歴を記録する（Cmd+K の検索で使用）
              <div className="muted" style={{ marginTop: 2 }}>
                開いたページのタイトル・URL をローカルにのみ保存し、「あの時見た
                メール/メッセージ」を後から探せます（外部送信なし）。現在 {historyCount} 件。
              </div>
            </span>
          </label>
          <div className="list-row">
            <button
              className="btn btn-sm"
              onClick={() =>
                confirmThen('閲覧履歴をすべて削除しますか？', clearHistory)
              }
            >
              閲覧履歴を削除
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">天気（今日画面）</h3>
        <div className="card">
          <label className="check-row">
            <input
              type="checkbox"
              checked={weatherEnabled}
              onChange={(e) => setWeatherEnabled(e.target.checked)}
            />
            <span className="grow">
              今日画面に天気を表示する
              <div className="muted" style={{ marginTop: 2 }}>
                Open-Meteo（無料・APIキー不要）を使用。現在地は自動判定します。
                {weatherLocation ? `現在: ${weatherLocation.label}` : ''}
              </div>
            </span>
          </label>
          {weatherEnabled && (
            <div className="list-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={cityInput}
                placeholder="都市名で指定（例: 東京, 大阪, Tokyo）"
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyCity()}
                style={{
                  flex: 1,
                  minWidth: 180,
                  padding: '8px 10px',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
              <button className="btn btn-sm" onClick={applyCity}>
                設定
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const api = (window as any).workOne;
                  if (!api || typeof api.detectLocation !== 'function') {
                    setCityMsg(
                      '機能が読み込まれていません。アプリを完全に終了して起動し直してください。'
                    );
                    return;
                  }
                  setCityMsg('現在地を取得中…（許可を求められたら許可してください）');
                  // OS 位置情報（正確）→ IP（おおよそ）の順
                  const loc =
                    (await getPreciseLocation()) ?? (await detectLocation());
                  if (loc) {
                    setWeatherLocation(loc);
                    setCityMsg(`「${loc.label}」に設定しました`);
                  } else {
                    setCityMsg(
                      '位置を取得できませんでした。位置情報の許可を確認するか、都市名で設定してください。'
                    );
                  }
                }}
              >
                現在地に戻す
              </button>
              {cityMsg && (
                <span className="muted" style={{ width: '100%' }}>
                  {cityMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">設定のバックアップ</h3>
        <div className="card" style={{ padding: 16 }}>
          <p className="muted" style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
            追加したサービス・並び順・各種設定を JSON ファイルに書き出し／読み込みできます。
            パスワード・メール本文・閲覧履歴は含まれません。
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleExport}>
              設定をエクスポート
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              設定をインポート
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {ioMsg && (
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              {ioMsg}
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">データ削除</h3>
        <div className="card" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            className="btn"
            onClick={() =>
              confirmThen('追加済みサービスをすべて削除しますか？', clearServices)
            }
          >
            追加済みサービスを削除
          </button>
          <button
            className="btn"
            onClick={() =>
              confirmThen('「あとで見る」をすべて削除しますか？', clearReadLater)
            }
          >
            あとで見るを削除
          </button>
          <button
            className="btn"
            onClick={() =>
              confirmThen('最近開いた履歴を削除しますか？', clearRecent)
            }
          >
            最近開いた履歴を削除
          </button>
          <button className="btn" onClick={clearWebCache}>
            キャッシュ・ログインセッションを削除
          </button>
          <button
            className="btn btn-danger"
            onClick={() =>
              confirmThen(
                'すべてのローカルデータを削除しますか？この操作は元に戻せません。',
                clearAll
              )
            }
          >
            <FiTrash2 size={14} /> すべてのローカルデータを削除
          </button>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">アプリ情報</h3>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>WorkOne</div>
          <p className="muted" style={{ margin: '0 0 10px' }}>
            バージョン {appVersion || '0.1.0'}
          </p>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-sm" onClick={handleCheckUpdate}>
              更新を確認
            </button>
            <button
              className="btn btn-sm"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('md:show-shortcuts'))
              }
            >
              ショートカット一覧（?）
            </button>
            <button
              className="btn btn-sm"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('md:show-tour'))
              }
            >
              使い方ツアーを見る
            </button>
            {updateMsg && (
              <span className="muted" style={{ marginLeft: 2 }}>
                {updateMsg}
              </span>
            )}
          </div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            連絡・学校・予定系サービスを 1
            つのアプリにまとめて、すばやく開けるようにするアプリです。ログインは
            各サービスの公式画面で行い、ID・パスワードは保存しません。
          </p>
          <div
            className="info-banner"
            style={{ marginTop: 14, marginBottom: 0 }}
          >
            <FiShield size={18} className="info-icon" />
            <div>
              WorkOne は ID・パスワード・メール本文・チャット本文などを
              保存しません。保存するのは追加したサービス、並び順、あとで見る、
              最近開いた履歴などの設定情報だけです。
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>サービスを編集</h3>
              <button className="icon-btn" onClick={() => setEditing(null)}>
                <FiX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <CustomServiceForm
                editing={editing}
                onAdded={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
