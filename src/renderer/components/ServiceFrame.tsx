import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiArrowLeft,
  FiArrowRight,
  FiRotateCw,
  FiHome,
  FiExternalLink,
  FiBookmark,
  FiMonitor,
  FiX,
} from 'react-icons/fi';
import { MdPictureInPictureAlt } from 'react-icons/md';
import { useAppStore } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';
import { CHROME_USER_AGENT } from '../data/userAgent';
import { SHARED_PARTITION } from '../lib/session';
import { parseUnreadCount, hostnameOf } from '../lib/unread';
import { isLoginUrl } from '../lib/login';
import { playNotificationSound } from '../lib/sound';
import type { Service } from '../types/service';

type Props = {
  service: Service;
  isActive: boolean;
};

// Gmail 公式 atom フィードを同一オリジン fetch で取得するスクリプト（Cookie 流用）
const GMAIL_FEED_SCRIPT = `(async () => {
  try {
    var m = location.pathname.match(/\\/mail\\/u\\/(\\d+)\\//);
    var u = m ? m[1] : '0';
    var res = await fetch('/mail/u/' + u + '/feed/atom', { credentials: 'include' });
    if (!res.ok) return { error: 'http ' + res.status };
    var txt = await res.text();
    var doc = new DOMParser().parseFromString(txt, 'text/xml');
    var fc = doc.getElementsByTagName('fullcount')[0];
    var count = fc ? parseInt(fc.textContent || '0', 10) : 0;
    var es = doc.getElementsByTagName('entry');
    var entries = [];
    for (var i = 0; i < es.length && i < 5; i++) {
      var e = es[i];
      var idEl = e.getElementsByTagName('id')[0];
      var titleEl = e.getElementsByTagName('title')[0];
      var authorEl = e.getElementsByTagName('author')[0];
      var nameEl = authorEl ? authorEl.getElementsByTagName('name')[0] : null;
      entries.push({
        id: idEl ? (idEl.textContent || '') : '',
        title: titleEl ? (titleEl.textContent || '') : '',
        author: nameEl ? (nameEl.textContent || '') : ''
      });
    }
    return { count: count, entries: entries };
  } catch (e) { return { error: String(e) }; }
})();`;

// 表示中の Google Calendar webview から、data-eventid を持つ全イベントの
// aria-label を集める（日表示なら全部今日の予定）。CalendarCard 側で今日分に絞る。
// 表示中の Google カレンダー webview から予定チップの aria-label を集める。
// 月/週/日いずれの表示でも拾えるよう、複数のソースから広く集める：
//  1) data-eventid を持つ予定チップ
//  2) role=button で時刻/日付/終日を含むもの
//  3) グリッド本体内の aria-label で時刻/日付/終日を含むもの
// aria-label には「2026年 6月 27日」「午後7時～」が入るので CalendarCard 側で今日分に絞る。
const CALENDAR_EXTRACT = `(() => {
  try {
    const seen = new Set();
    const all = [];
    const eventLike = /午前|午後|\\d{1,2}:\\d{2}|終日|\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日/;
    const push = (lab) => {
      lab = (lab || '').replace(/\\s+/g, ' ').trim();
      if (!lab || lab.length < 2 || lab.length > 300 || seen.has(lab)) return;
      seen.add(lab);
      all.push(lab);
    };
    // 予定チップは aria-label が空でテキストにしか情報が無い場合があるため両方見る。
    for (const el of document.querySelectorAll('[data-eventid]')) {
      push(el.getAttribute('aria-label') || el.textContent);
    }
    for (const el of document.querySelectorAll('[role="button"]')) {
      const lab = el.getAttribute('aria-label') || el.textContent || '';
      if (eventLike.test(lab)) push(lab);
    }
    const grid = document.querySelector('[role="grid"],[role="main"]');
    if (grid) {
      for (const el of grid.querySelectorAll('[aria-label]')) {
        const lab = el.getAttribute('aria-label') || '';
        if (eventLike.test(lab)) push(lab);
      }
    }
    return { all: all.slice(0, 200) };
  } catch (e) { return { all: [] }; }
})()`;

/**
 * 1 サービス分の <webview> + ツールバー。
 * 一度マウントされたら背景でも生かしておき（display で出し分け）、
 * タイトルから未読を拾ってバッジ／OS 通知に反映する。
 */
export function ServiceFrame({ service, isActive }: Props) {
  const setServiceLastUrl = useAppStore((s) => s.setServiceLastUrl);
  const setServiceBadge = useAppStore((s) => s.setServiceBadge);
  const addReadLater = useAppStore((s) => s.addReadLater);
  const addNotification = useAppStore((s) => s.addNotification);
  const addHistory = useAppStore((s) => s.addHistory);
  const navTarget = useAppStore((s) => s.navTarget);
  const focusMode = useAppStore((s) => s.focusMode);
  const focusServiceIds = useAppStore((s) => s.focusServiceIds);
  const isMutedService = useAppStore((s) => s.mutedServices.includes(service.id));
  const isImportantService = useAppStore((s) =>
    s.importantServices.includes(service.id)
  );
  const dndActive = useAppStore((s) => s.dndActive);

  // このサービスの通知を抑制するか。
  // おやすみ時間 > 明示ミュート > 重要(集中でも通知) > 集中モードの抑制
  const focusMuted =
    focusMode === 'deep'
      ? true
      : focusMode === 'focus'
      ? !focusServiceIds.includes(service.id)
      : false;
  const muted = dndActive
    ? true
    : isMutedService
    ? true
    : isImportantService
    ? false
    : focusMuted;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const webviewRef = useRef<any>(null);
  const prevCountRef = useRef(0);
  const gmailLastIdRef = useRef('');
  const currentUrlRef = useRef(service.url);
  const mountedRef = useRef(true);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setServiceZoom = useAppStore((s) => s.setServiceZoom);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // ズーム倍率はサービスごとに保存した値で初期化する
  const [zoom, setZoom] = useState(
    () => useAppStore.getState().serviceZoom[service.id] ?? 0
  );
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Gmail はセッション流用で公式 atom フィードから未読を取得できる
  const isGmail = useMemo(() => {
    try {
      return new URL(service.url).hostname === 'mail.google.com';
    } catch {
      return false;
    }
  }, [service.url]);

  // メール系は「開いても既読扱いにしない」= 未読件数を常に表示する
  const isMail = service.category === 'mail';

  // 未読推定のためのホスト名（サービス固有のクセ補正に使う）
  const host = useMemo(() => hostnameOf(service.url), [service.url]);

  // src はマウント時の初期 URL に固定（途中で書き換えると SPA がリロードされる）
  const initialSrc = useMemo(() => {
    const state = useAppStore.getState();
    return state.serviceUrls[service.id] ?? service.url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  const [currentUrl, setCurrentUrl] = useState(initialSrc);
  const [currentTitle, setCurrentTitle] = useState(service.name);
  const [saved, setSaved] = useState(false);

  // ログイン切れ検知。一度ログイン済み（非ログイン画面）になった後で
  // ログイン画面へ戻されたらセッション切れとみなす。
  const [loginExpired, setLoginExpired] = useState(false);
  const wasLoggedInRef = useRef(false);
  const loginExpiredRef = useRef(false);
  loginExpiredRef.current = loginExpired;

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onNavigate = (e: any) => {
      if (e.url) {
        currentUrlRef.current = e.url;
        setCurrentUrl(e.url);
        setServiceLastUrl(service.id, e.url);

        // ログイン切れ検知
        if (isLoginUrl(e.url)) {
          // 既にログイン済みだった→セッション切れ。初回ログインは対象外。
          if (wasLoggedInRef.current && !loginExpiredRef.current) {
            setLoginExpired(true);
            addNotification({
              id: `${service.id}:login:${new Date()
                .toISOString()
                .slice(0, 13)}`,
              serviceId: service.id,
              serviceName: service.name,
              icon: service.icon,
              title: 'ログインが切れた可能性があります',
              body: `${service.name} に再ログインしてください`,
              receivedAt: new Date().toISOString(),
            });
          }
        } else {
          wasLoggedInRef.current = true;
          if (loginExpiredRef.current) setLoginExpired(false);
        }
      }
    };
    const onTitle = (e: any) => {
      const title: string = e.title ?? '';
      if (title) setCurrentTitle(title);
      // 閲覧履歴に記録（「あの時見た〇〇」検索用）
      if (title) {
        addHistory({
          serviceId: service.id,
          serviceName: service.name,
          icon: service.icon,
          title,
          url: currentUrlRef.current,
        });
      }
      // Gmail はフィード側がバッジ・通知を管理するのでタイトルでは触らない
      if (isGmail) return;
      const count = parseUnreadCount(title, host);
      if (isMail) {
        // メール系は開いていても未読件数を出し続ける（開く=既読ではないため）
        setServiceBadge(service.id, count);
        prevCountRef.current = count;
        return;
      }
      // チャット等は表示中は既読扱い
      if (isActiveRef.current) {
        setServiceBadge(service.id, 0);
        prevCountRef.current = count;
      } else {
        setServiceBadge(service.id, count);
        if (count > prevCountRef.current && !mutedRef.current) {
          const st = useAppStore.getState();
          if (st.notificationsEnabled) {
            window.workOne.notify(service.name, '新着があります');
          }
        }
        prevCountRef.current = count;
      }
    };

    // 各サービスが出す Web 通知（new Notification）を横取りして統合 Inbox に集約する。
    // ページの主世界に Notification ラッパーを仕込み、内容を console 経由でホストへ送る。
    // 元の Notification も呼ぶので OS 通知はそのまま表示される（DOM 解析ではない）。
    const INJECT_NOTIF_HOOK = `(function(){
      if (window.__mdockNotifWrapped) return;
      var Orig = window.Notification;
      if (!Orig) return;
      function Wrapped(title, options){
        try {
          console.log('__MDOCK_NOTIF__' + JSON.stringify({
            title: String(title || ''),
            body: (options && options.body) ? String(options.body) : ''
          }));
        } catch(e){}
        // 集中モードで抑制中は OS 通知ポップアップを出さない（Inbox には残す）
        if (window.__mdockMuted) {
          return { close: function(){}, addEventListener: function(){}, removeEventListener: function(){} };
        }
        return new Orig(title, options);
      }
      try {
        Wrapped.prototype = Orig.prototype;
        Object.defineProperty(Wrapped, 'permission', { get: function(){ return Orig.permission; } });
        Wrapped.requestPermission = function(){ return Orig.requestPermission.apply(Orig, arguments); };
        window.Notification = Wrapped;
        window.__mdockNotifWrapped = true;
      } catch(e){}
    })();`;

    const injectHook = () => {
      const w = webviewRef.current;
      if (w && typeof w.executeJavaScript === 'function') {
        w.executeJavaScript(INJECT_NOTIF_HOOK, false).catch(() => {});
        w.executeJavaScript(
          `window.__mdockMuted=${mutedRef.current};`,
          false
        ).catch(() => {});
      }
      // 再読み込みでズームが戻ることがあるので保存値を再適用
      if (w && typeof w.setZoomLevel === 'function') {
        try {
          w.setZoomLevel(zoomRef.current);
        } catch {
          /* 無視 */
        }
      }
    };

    const onStartLoading = () => {
      setLoading(true);
      setFailed(false);
    };
    const onStopLoading = () => setLoading(false);
    // webview のレンダラーが落ちたら自動で再読み込みして復帰する
    const onCrashed = () => {
      try {
        webviewRef.current?.reload?.();
      } catch {
        /* 無視 */
      }
    };
    const onFailLoad = (e: any) => {
      // -3 (ABORTED) はユーザー操作等による中断なので無視
      if (e?.isMainFrame === false) return;
      if (e?.errorCode && e.errorCode !== -3) setFailed(true);
      setLoading(false);
    };

    const onConsole = (e: any) => {
      const msg: string = e?.message ?? '';
      if (!msg.startsWith('__MDOCK_NOTIF__')) return;
      try {
        const data = JSON.parse(msg.slice('__MDOCK_NOTIF__'.length));
        addNotification({
          id: `${service.id}:notif:${Date.now()}:${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          serviceId: service.id,
          serviceName: service.name,
          icon: service.icon,
          title: data.title || service.name,
          body: data.body || '',
          receivedAt: new Date().toISOString(),
        });
        // 新着の効果音（ミュート/おやすみ時間中は鳴らさない）
        const st = useAppStore.getState();
        if (st.notificationSound && !mutedRef.current) playNotificationSound();
      } catch {
        // 無視
      }
    };

    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    wv.addEventListener('page-title-updated', onTitle);
    wv.addEventListener('dom-ready', injectHook);
    wv.addEventListener('console-message', onConsole);
    wv.addEventListener('did-start-loading', onStartLoading);
    wv.addEventListener('did-stop-loading', onStopLoading);
    wv.addEventListener('did-fail-load', onFailLoad);
    wv.addEventListener('crashed', onCrashed);
    wv.addEventListener('render-process-gone', onCrashed);
    return () => {
      wv.removeEventListener('did-navigate', onNavigate);
      wv.removeEventListener('did-navigate-in-page', onNavigate);
      wv.removeEventListener('page-title-updated', onTitle);
      wv.removeEventListener('dom-ready', injectHook);
      wv.removeEventListener('console-message', onConsole);
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('did-fail-load', onFailLoad);
      wv.removeEventListener('crashed', onCrashed);
      wv.removeEventListener('render-process-gone', onCrashed);
    };
  }, [
    service.id,
    service.name,
    service.icon,
    isGmail,
    isMail,
    host,
    setServiceLastUrl,
    setServiceBadge,
    addNotification,
    addHistory,
  ]);

  // 検索/履歴ジャンプ: このサービス宛の遷移指示があれば webview を移動
  useEffect(() => {
    if (!navTarget || navTarget.serviceId !== service.id) return;
    const wv = webviewRef.current;
    if (!wv) return;
    try {
      if (typeof wv.loadURL === 'function') wv.loadURL(navTarget.url);
      else wv.src = navTarget.url;
    } catch {
      /* dom-ready 前などは無視 */
    }
    // nonce が変わるたびに再実行
  }, [navTarget?.nonce, navTarget?.serviceId, navTarget?.url, service.id]);

  // --- Gmail: セッション流用で公式 atom フィードを取得 ---
  // ログイン済みの Gmail webview 内で同一オリジンの feed/atom を fetch する
  // （Cookie がそのまま使われる）。未読数 + 最新メールの送信者・件名が取れる。
  const pollGmail = useCallback(async () => {
    const wv = webviewRef.current;
    if (!wv || typeof wv.executeJavaScript !== 'function') return;
    let r: any;
    try {
      r = await wv.executeJavaScript(GMAIL_FEED_SCRIPT, false);
    } catch {
      return; // dom-ready 前など
    }
    if (!mountedRef.current || !r || r.error) return;
    const count: number = r.count || 0;
    const entries: { id: string; title: string; author: string }[] =
      r.entries || [];

    // メール系は開いていても未読件数を表示し続ける（実際の未読数）
    setServiceBadge(service.id, count);

    // 現在の未読メールを統合 Inbox に流す（id で重複排除される）
    for (const e of entries) {
      if (!e.id) continue;
      addNotification({
        id: `${service.id}:gmail:${e.id}`,
        serviceId: service.id,
        serviceName: service.name,
        icon: service.icon,
        title: e.author || service.name,
        body: e.title || '新着メール',
        receivedAt: new Date().toISOString(),
      });
    }

    // 最新メールが変わっていれば通知（送信者・件名つき）
    const newestId = entries[0]?.id ?? '';
    const prevId = gmailLastIdRef.current;
    if (
      prevId &&
      newestId &&
      newestId !== prevId &&
      count > 0 &&
      !isActiveRef.current &&
      !mutedRef.current
    ) {
      const st = useAppStore.getState();
      if (st.notificationsEnabled) {
        const e = entries[0];
        const from = e.author ? e.author : service.name;
        window.workOne.notify(
          `${from}（${service.name}）`,
          e.title || '新着メール'
        );
      }
    }
    if (newestId) gmailLastIdRef.current = newestId;
  }, [service.id, service.name, service.icon, setServiceBadge, addNotification]);

  // 定期取得（初回は 4 秒後、その後 60 秒間隔）
  useEffect(() => {
    if (!isGmail) return;
    const first = setTimeout(pollGmail, 4000);
    const timer = setInterval(pollGmail, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [isGmail, pollGmail]);

  // Google Calendar の webview から「今日の予定」を読み取るブリッジ。
  // 裏（カバー中）の webview では時刻つき予定グリッドが完全に描画されないことが
  // あるため、カレンダーが前面に出たとき（＝確実に全描画される）にも自動抽出して
  // ストアへキャッシュし、Home はそのキャッシュを表示する。各予定の aria-label に
  // 入る「2026年 6月 27日」を CalendarCard 側で今日分に絞る（終日・時刻つき問わず）。
  const isCalendar = host === 'calendar.google.com';
  useEffect(() => {
    if (!isCalendar) return;

    const extract = async (): Promise<string[]> => {
      const w = webviewRef.current;
      if (!w || typeof w.executeJavaScript !== 'function') return [];
      try {
        const r = await w.executeJavaScript(CALENDAR_EXTRACT, false);
        return Array.isArray(r?.all) ? r.all : [];
      } catch {
        return [];
      }
    };

    // 再取得リクエストへの応答。ただしキャッシュ上書きは「前面のとき」だけ行う。
    // 裏の webview は他の日のセルなどを拾い、今日分0件の貧弱な結果で良いキャッシュを
    // 壊すことがあるため。前面なら今日の予定も確実に描画されている。
    const onReq = async () => {
      let all = await extract();
      if (all.length === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        all = await extract();
      }
      if (isActiveRef.current && all.length > 0) {
        useAppStore.getState().setCalendarRaw(all);
      }
      window.dispatchEvent(
        new CustomEvent('md:calendar-result', { detail: { ok: true, all } })
      );
    };

    window.addEventListener('md:calendar-request', onReq);
    return () => {
      window.removeEventListener('md:calendar-request', onReq);
    };
  }, [isCalendar]);

  // カレンダーが前面に出ているあいだに今日の予定を抽出してストアへキャッシュする。
  // 表示の切り替えはユーザー操作を尊重して行わない（日表示なら終日も時刻つきも取れる）。
  // 描画タイミングのブレに備え、数秒かけて複数回抽出し、結果をマージして書き込む。
  useEffect(() => {
    if (!isCalendar || !isActive) return;
    let stopped = false;

    const extractOnce = async (): Promise<string[]> => {
      const w = webviewRef.current;
      if (!w || typeof w.executeJavaScript !== 'function') return [];
      try {
        const r = await w.executeJavaScript(CALENDAR_EXTRACT, false);
        return Array.isArray(r?.all) ? r.all : [];
      } catch {
        return [];
      }
    };

    // 短い間隔で複数回抽出。各回ごとに即キャッシュ更新（途中で Home に戻っても、
    // それまでに取れた分は残る）。
    const merged = new Set<string>();
    const tick = async () => {
      if (stopped) return;
      const got = await extractOnce();
      if (stopped) return;
      for (const lab of got) merged.add(lab);
      if (merged.size > 0) useAppStore.getState().setCalendarRaw([...merged]);
    };

    // 1秒後から短い間隔で複数回抽出（描画タイミングのブレを吸収）
    const timers: ReturnType<typeof setTimeout>[] = [];
    [1000, 2200, 3400, 4600, 6000].forEach((d) =>
      timers.push(setTimeout(tick, d))
    );
    const refresh = setInterval(tick, 90000);
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      clearInterval(refresh);
    };
  }, [isCalendar, isActive]);

  // 開いた瞬間に即時更新（60 秒待たずに未読を反映）
  useEffect(() => {
    if (isGmail && isActive) pollGmail();
  }, [isGmail, isActive, pollGmail]);

  // 集中モードの抑制状態を webview にも反映（Notification ラッパーが参照する）。
  // webview が dom-ready 前だと executeJavaScript は同期例外を投げるため try/catch で保護。
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || typeof wv.executeJavaScript !== 'function') return;
    try {
      const p = wv.executeJavaScript(`window.__mdockMuted=${muted};`, false);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // dom-ready 前。dom-ready 時の injectHook で改めて反映される。
    }
  }, [muted]);

  // メニュー/ショートカットからの webview 操作（アクティブなフレームだけ反応）
  useEffect(() => {
    const onCmd = (e: Event) => {
      if (!isActiveRef.current) return;
      const wv = webviewRef.current;
      if (!wv) return;
      const cmd = (e as CustomEvent).detail as string;
      try {
        if (cmd === 'reload') wv.reload?.();
        else if (cmd === 'back') wv.goBack?.();
        else if (cmd === 'forward') wv.goForward?.();
        else if (cmd === 'zoom-in') setZoom((z) => Math.min(z + 0.5, 3));
        else if (cmd === 'zoom-out') setZoom((z) => Math.max(z - 0.5, -3));
        else if (cmd === 'zoom-reset') setZoom(0);
      } catch {
        /* 無視 */
      }
    };
    window.addEventListener('md:webview-cmd', onCmd);
    return () => window.removeEventListener('md:webview-cmd', onCmd);
  }, []);

  // ズームレベルを webview に適用し、サービスごとに保存する
  useEffect(() => {
    const wv = webviewRef.current;
    if (wv && typeof wv.setZoomLevel === 'function') {
      try {
        wv.setZoomLevel(zoom);
      } catch {
        /* 無視 */
      }
    }
    setServiceZoom(service.id, zoom);
  }, [zoom, service.id, setServiceZoom]);

  // 再生中の動画（Meet の話者映像など）だけを OS のピクチャーインピクチャー小窓に出す。
  // webview 内で requestPictureInPicture を実行する（preload 不要）。
  const handlePictureInPicture = async () => {
    const wv = webviewRef.current;
    if (!wv || typeof wv.executeJavaScript !== 'function') return;
    const code = `(async () => {
      try {
        var vids = Array.prototype.slice.call(document.querySelectorAll('video'))
          .filter(function(v){ return v.readyState >= 2 && v.videoWidth > 0; });
        // 再生中を優先し、面積の大きい順に
        vids.sort(function(a,b){
          var pa=a.paused?0:1, pb=b.paused?0:1;
          if(pa!==pb) return pb-pa;
          return (b.videoWidth*b.videoHeight)-(a.videoWidth*a.videoHeight);
        });
        var v = vids[0];
        if(!v) return 'novideo';
        if(document.pictureInPictureElement){ await document.exitPictureInPicture(); }
        v.disablePictureInPicture = false;
        await v.requestPictureInPicture();
        return 'ok';
      } catch(e){ return 'err:'+(e && e.message ? e.message : e); }
    })();`;
    try {
      // 第2引数 true = ユーザー操作扱い（PiP はユーザー操作を要求するため）
      const result: string = await wv.executeJavaScript(code, true);
      if (result === 'novideo') {
        alert('再生中の動画が見つかりませんでした。動画を再生してから試してください。');
      } else if (typeof result === 'string' && result.startsWith('err:')) {
        alert('ピクチャーインピクチャーを開始できませんでした。\n' + result.slice(4));
      }
    } catch (e) {
      console.error('[pip] failed:', e);
    }
  };

  // サービス登録時の最初の URL に戻る（引き継いだ最後の URL を破棄）。
  const handleHome = () => {
    const wv = webviewRef.current;
    setServiceLastUrl(service.id, service.url);
    if (!wv) return;
    try {
      if (typeof wv.loadURL === 'function') wv.loadURL(service.url);
      else wv.src = service.url;
    } catch {
      /* dom-ready 前などは無視 */
    }
  };

  const handleSaveReadLater = () => {
    addReadLater({
      title: currentTitle || service.name,
      url: currentUrl || service.url,
      serviceName: service.name,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="service-view"
      style={{
        // display:none ではなく visibility で出し分ける（サイズ維持＝白画面防止）
        visibility: isActive ? 'visible' : 'hidden',
        zIndex: isActive ? 2 : 1,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <div className="service-toolbar" data-tour="service-toolbar">
        <button
          className="icon-btn"
          title="戻る"
          onClick={() => webviewRef.current?.goBack?.()}
        >
          <FiArrowLeft size={16} />
        </button>
        <button
          className="icon-btn"
          title="進む"
          onClick={() => webviewRef.current?.goForward?.()}
        >
          <FiArrowRight size={16} />
        </button>
        <button
          className="icon-btn"
          title="再読み込み"
          onClick={() => webviewRef.current?.reload?.()}
        >
          <FiRotateCw size={16} />
        </button>
        <button
          className="icon-btn"
          title="最初のページに戻る"
          onClick={handleHome}
        >
          <FiHome size={16} />
        </button>

        <div className="title" style={{ marginLeft: 6 }}>
          <ServiceIcon iconKey={service.icon} chip={20} />
          {service.name}
        </div>

        <div className="spacer" />

        <button className="btn btn-sm" onClick={handleSaveReadLater}>
          <FiBookmark size={13} />
          {saved ? '保存しました' : 'あとで見る'}
        </button>
        <button
          className="icon-btn"
          title="動画だけを小窓に（ピクチャーインピクチャー）"
          onClick={handlePictureInPicture}
        >
          <MdPictureInPictureAlt size={17} />
        </button>
        <button
          className="icon-btn"
          title="ページ全体を小窓で固定（常に最前面）"
          onClick={() => {
            const url = currentUrl || service.url;
            // preload の IPC ではなくブラウザ標準の window.open を使う。
            // メインプロセスの setWindowOpenHandler が frameName を見て
            // 常駐の小窓として開く（preload 更新に依存しない）。
            window.open(url, 'workone-pin', 'popup=yes,width=440,height=340');
          }}
        >
          <FiMonitor size={16} />
        </button>
        <button
          className="icon-btn"
          title="外部ブラウザで開く"
          onClick={() =>
            window.workOne.openExternal(currentUrl || service.url)
          }
        >
          <FiExternalLink size={16} />
        </button>
      </div>

      <div className="webview-host">
        {loading && !failed && <div className="loading-bar" />}
        {loginExpired && (
          <div className="login-expired-banner">
            <span className="grow">
              ログインが切れたようです。再ログインしてください。
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                setLoginExpired(false);
                webviewRef.current?.reload?.();
              }}
            >
              <FiRotateCw size={13} /> 再読み込み
            </button>
            <button
              className="icon-btn"
              title="閉じる"
              onClick={() => setLoginExpired(false)}
            >
              <FiX size={15} />
            </button>
          </div>
        )}
        <webview
          ref={webviewRef}
          src={initialSrc}
          partition={SHARED_PARTITION}
          useragent={CHROME_USER_AGENT}
          // 裏（display:none）でも描画を止めない。Google カレンダーの時刻つき
          // 予定グリッドは描画が止まると DOM に出ないため、読み取りに必要。
          webpreferences="backgroundThrottling=no"
          {...({ allowpopups: 'true' } as Record<string, string>)}
        />
        {failed && (
          <div className="webview-error">
            <h3>ページを読み込めませんでした</h3>
            <p>ネットワークやサービス側の問題の可能性があります。</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setFailed(false);
                setLoading(true);
                webviewRef.current?.reload?.();
              }}
            >
              <FiRotateCw size={14} /> 再試行
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
