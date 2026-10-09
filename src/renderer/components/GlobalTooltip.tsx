import { useEffect, useRef, useState } from 'react';

/**
 * アプリ全体のツールチップ。ボタン類の title 属性を拾って、すぐに見える独自の吹き出しで表示する
 * （OS 標準の title は表示が遅く気づきにくいため）。
 * 「完了 (e)」のように末尾の括弧はショートカットキーとして強調する。
 * 表示は position: fixed なので、カードの overflow で切れない。
 */
type Tip = { text: string; key?: string; x: number; y: number; below: boolean };

const SELECTOR = 'button[title], [role="button"][title], .score-pill[title], [data-tip]';

export function GlobalTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(SELECTOR);
      if (!el || el === current.current) return;
      // 標準の title ツールチップと二重に出ないよう、data-tip に移す
      const title = el.getAttribute('title');
      if (title) {
        el.setAttribute('data-tip', title);
        el.removeAttribute('title');
      }
      const raw = el.getAttribute('data-tip') ?? '';
      if (!raw) return;
      current.current = el;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (current.current !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        const m = /^(.*?)\s*[（(]([^()（）]{1,12})[)）]\s*$/.exec(raw);
        const below = r.top < 44;
        setTip({
          text: m ? m[1] : raw,
          key: m ? m[2] : undefined,
          x: r.left + r.width / 2,
          y: below ? r.bottom + 6 : r.top - 6,
          below,
        });
      }, 250);
    };

    const onOut = (e: MouseEvent) => {
      const to = e.relatedTarget as Node | null;
      if (current.current && to && current.current.contains(to)) return;
      if ((e.target as HTMLElement | null)?.closest(SELECTOR) === current.current) hide();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      className={`app-tooltip ${tip.below ? 'below' : ''}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
      {tip.key && <kbd>{tip.key.toUpperCase()}</kbd>}
    </div>
  );
}
