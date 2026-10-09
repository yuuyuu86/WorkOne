import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ruleScore, ruleTaskSuggestion } from './priority';

// 新着通知を解析するバックグラウンド処理（App に1つだけ置く）。
// 1. まずルールで重要度スコアとタスク候補を付ける（即時・全環境）
// 2. オンデバイス AI（Apple Foundation Models）が使えれば、数件ずつ
//    要約・スコア補正・タスク候補を上書きする。データは Mac の外に出ない。

const AI_BATCH = 4;

export function useInboxAi() {
  const notifications = useAppStore((s) => s.notifications);
  const aiEnabled = useAppStore((s) => s.aiEnabled);
  const busy = useRef(false);

  useEffect(() => {
    const pending = notifications.filter((n) => !n.analyzed && !n.done);
    if (pending.length === 0 || busy.current) return;
    busy.current = true;

    const run = async () => {
      const st = useAppStore.getState();
      // ルールで即時に付ける
      for (const n of pending) {
        st.setNotificationMeta(n.id, {
          score: ruleScore(n),
          taskSuggestion: n.taskSuggestion ?? ruleTaskSuggestion(n),
          analyzed: true,
        });
      }

      const ai = window.workOne?.ai;
      if (!aiEnabled || !ai) return;
      const status = await ai.status().catch(() => null);
      if (!status?.available) return;

      // 新しいものから数件ずつ AI に渡す（コンテキストが小さいため）
      const targets = pending.slice(0, AI_BATCH * 3);
      for (let i = 0; i < targets.length; i += AI_BATCH) {
        const batch = targets.slice(i, i + AI_BATCH);
        const res = await ai
          .triage(
            batch.map((n) => ({
              id: n.id,
              service: n.serviceName,
              title: n.title,
              body: n.body.slice(0, 400),
            })),
            new Date().toISOString().slice(0, 10)
          )
          .catch(() => null);
        if (!res?.ok) break;
        for (const r of res.items) {
          const base = useAppStore
            .getState()
            .notifications.find((n) => n.id === r.id);
          if (!base) continue;
          useAppStore.getState().setNotificationMeta(r.id, {
            // ルールと AI の平均（AI 単独の極端な判定を抑える）
            score: Math.round(((base.score ?? 50) + r.score) / 2),
            summary: r.summary || undefined,
            taskSuggestion: r.task ?? base.taskSuggestion,
          });
        }
      }
    };

    run().finally(() => {
      busy.current = false;
    });
  }, [notifications, aiEnabled]);
}
