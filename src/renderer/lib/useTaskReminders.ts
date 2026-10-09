import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

// 時刻つきの期限になったタスクを OS 通知で知らせる（30 秒ごとに確認）。
// 同じ期限で二重に通知しないよう remindedFor に「日付+時刻」を記録する。
export function useTaskReminders() {
  useEffect(() => {
    const tick = () => {
      const st = useAppStore.getState();
      const now = Date.now();
      for (const t of st.tasks) {
        if (t.done || !t.due || !t.dueTime) continue;
        const key = `${t.due.slice(0, 10)}T${t.dueTime}`;
        if (t.remindedFor === key) continue;
        const at = new Date(key).getTime();
        // 期限ちょうど〜1 時間後までに気づけた場合だけ通知（古いものは静かに既読扱い）
        if (at > now) continue;
        if (now - at < 3600000 && !st.dndActive) {
          window.workOne?.notify?.('タスクの期限です', t.title);
        }
        st.updateTask(t.id, { remindedFor: key });
      }
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
}
