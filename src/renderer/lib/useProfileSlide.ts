import { useLayoutEffect, useEffect, useRef, type RefObject } from 'react';
import { useAppStore } from '../store/useAppStore';

// Arc の Space 切り替えのようなスライド。
// サイドバーには「前・現在・次」のプロファイルのサービス一覧が横に並んだトラックがあり、
// 普段は真ん中（現在）だけが見えている。
// - トラックパッドの横スワイプ中は、トラック全体が指に追従する（隣の一覧が横から見えてくる）
// - 一定以上動かして離すと隣まで滑らかに移動し、移動しきったところでプロファイルを切り替える
//   （切り替え後は新しい「現在」が真ん中になるよう、見た目を変えずに位置を戻す）
// - 足りなければ元の位置へ戻る。端のプロファイルではゴムのように少しだけ動く
// - クリックやショートカットで切り替えたときも、方向に合わせて横から入ってくる

const EASE = 'cubic-bezier(0.22, 0.8, 0.24, 1)';
const SNAP_MS = 260;
const COMMIT_RATIO = 0.2; // サイドバー幅のこの割合を超えたら切り替える
const END_IDLE_MS = 90; // この時間 wheel が来なければ指を離したとみなす

export function useProfileSlide(
  swipeArea: RefObject<HTMLElement>,
  track: RefObject<HTMLElement>
) {
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const prevIndex = useRef(-1);
  // スワイプで切り替えた直後は、位置を戻すだけでアニメーションしない
  const swiped = useRef(false);

  const width = () => track.current?.parentElement?.clientWidth || 240;

  /** offset: 真ん中（現在）を基準にしたずれ（px）。正で右へ動く */
  const place = (offset: number, ms = 0) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    el.style.transform = `translateX(${-width() + offset}px)`;
  };

  // プロファイルが変わったら（描画直後・表示前に）位置を合わせる
  useLayoutEffect(() => {
    const st = useAppStore.getState();
    const idx = st.profiles.findIndex((p) => p.id === activeProfileId);
    const prev = prevIndex.current;
    prevIndex.current = idx;
    if (prev < 0 || prev === idx || swiped.current) {
      swiped.current = false;
      place(0);
      return;
    }
    // クリック等: 来た方向の隣から滑り込ませる（隣の一覧が見えるので空白にならない）
    const dir = idx > prev ? 1 : -1;
    place(dir * width());
    void track.current?.offsetWidth;
    place(0, SNAP_MS + 40);
  }, [activeProfileId]);

  // サイドバー幅が変わったら位置を合わせ直す
  useEffect(() => {
    const vp = track.current?.parentElement;
    if (!vp) return;
    const ro = new ResizeObserver(() => place(0));
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // 横スワイプへの追従
  useEffect(() => {
    const area = swipeArea.current;
    if (!area) return;
    let acc = 0;
    let tracking = false;
    let lockedUntil = 0;
    let endTimer: number | undefined;

    const neighbor = (dir: number) => {
      const st = useAppStore.getState();
      const idx = st.profiles.findIndex((p) => p.id === st.activeProfileId);
      return st.profiles[idx + dir];
    };

    const finish = () => {
      tracking = false;
      const w = width();
      const dir = acc > 0 ? 1 : -1;
      const next = neighbor(dir);
      acc = 0;
      if (next && lastOffset !== 0 && Math.abs(lastOffset) > w * COMMIT_RATIO) {
        // 隣のプロファイルの位置まで滑らせてから切り替える
        place(-dir * w, SNAP_MS);
        lockedUntil = Date.now() + SNAP_MS + 300; // 慣性スクロールで二重に切り替えない
        window.setTimeout(() => {
          swiped.current = true;
          useAppStore.getState().setActiveProfile(next.id);
        }, SNAP_MS);
      } else {
        place(0, 220);
        lockedUntil = Date.now() + 150;
      }
      lastOffset = 0;
    };

    let lastOffset = 0;
    const onWheel = (e: WheelEvent) => {
      // 縦スクロールはそのまま（横成分が明らかに大きいときだけ扱う）
      if (!tracking && Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
      if (Date.now() < lockedUntil) return;
      if (useAppStore.getState().profiles.length < 2) return;
      tracking = true;
      acc += e.deltaX;
      const w = width();
      const dir = acc > 0 ? 1 : -1;
      // 隣が無い方向は抵抗をつけて少しだけ動かす
      const resist = neighbor(dir) ? 1 : 0.15;
      lastOffset = Math.max(-w, Math.min(w, -acc * resist));
      place(lastOffset);
      window.clearTimeout(endTimer);
      endTimer = window.setTimeout(finish, END_IDLE_MS);
    };

    area.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      area.removeEventListener('wheel', onWheel);
      window.clearTimeout(endTimer);
    };
  }, []);
}
