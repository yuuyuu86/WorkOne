import { useEffect } from 'react';
import { SNOOZE_OPTIONS } from './inboxUtils';

type Props = {
  onPick: (until: string) => void;
  onClose: () => void;
};

/** スヌーズの時間を選ぶメニュー。表示中は 1〜4 キーで選択、Esc で閉じる */
export function SnoozeMenu({ onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < SNOOZE_OPTIONS.length) {
        onPick(SNOOZE_OPTIONS[i].at().toISOString());
        e.preventDefault();
      } else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick, onClose]);

  return (
    <div className="snooze-menu" onMouseLeave={onClose}>
      {SNOOZE_OPTIONS.map((o, i) => (
        <button key={o.label} onClick={() => onPick(o.at().toISOString())}>
          <kbd>{i + 1}</kbd> {o.label}
        </button>
      ))}
    </div>
  );
}
