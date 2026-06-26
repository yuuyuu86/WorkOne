// 新着通知の効果音。音源ファイルを持たず、Web Audio API で短い2音を鳴らす。
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

// 軽い「ポンッ」という2音。連続呼び出しでも破綻しないよう短く。
export function playNotificationSound(): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const now = ac.currentTime;
    const tones = [
      { freq: 880, start: 0 },
      { freq: 1175, start: 0.09 },
    ];
    for (const t of tones) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = t.freq;
      gain.gain.setValueAtTime(0.0001, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + t.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + 0.18);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + t.start);
      osc.stop(now + t.start + 0.2);
    }
  } catch {
    /* 再生に失敗しても無視 */
  }
}
