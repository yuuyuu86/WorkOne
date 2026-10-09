import type { AppNotification } from '../types/service';

// 通知の重要度スコア（0〜100）をルールで求める。オンデバイス AI が使えない環境でも
// 並び替えができるように、AI の判定はこのスコアに上乗せする形にする。

const URGENT = /(至急|緊急|急ぎ|大至急|urgent|asap|重要|important)/i;
const DEADLINE = /(締切|締め切り|〆切|期限|までに|提出|due|deadline|リマインド|reminder)/i;
const MENTION = /(@here|@channel|@everyone|あなた|you were mentioned|メンション|返信|replied|DM|ダイレクトメッセージ)/i;
const NOISE = /(newsletter|ニュースレター|プロモーション|キャンペーン|セール|sale|unsubscribe|配信停止|広告)/i;

export function ruleScore(n: AppNotification, now = Date.now()): number {
  const text = `${n.title}\n${n.body}`;
  let score = 30;
  if (n.important) score += 25;
  if (URGENT.test(text)) score += 20;
  if (DEADLINE.test(text)) score += 15;
  if (MENTION.test(text)) score += 10;
  if (NOISE.test(text)) score -= 25;
  // 新しいものほど少し上に（24 時間で 10 点減衰）
  const ageH = (now - new Date(n.receivedAt).getTime()) / 3600000;
  score += Math.max(0, 10 - (ageH / 24) * 10);
  return Math.max(0, Math.min(100, Math.round(score)));
}

const pad = (x: number) => String(x).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 日本語・英語の文から期限らしき日付を拾う（YYYY-MM-DD）。見つからなければ undefined */
export function extractDue(text: string, now = new Date()): string | undefined {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/今日中|本日中|today/i.test(text)) return ymd(base);
  if (/明日|tomorrow/i.test(text)) {
    base.setDate(base.getDate() + 1);
    return ymd(base);
  }
  if (/明後日|あさって/.test(text)) {
    base.setDate(base.getDate() + 2);
    return ymd(base);
  }
  const md = /(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?/.exec(text);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      let y = now.getFullYear();
      // 過去日付なら来年とみなす（年末に1月の締切を書かれた場合など）
      if (new Date(y, m - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)) y += 1;
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }
  const wd = /(今週|来週)?\s*([日月火水木金土])曜/.exec(text);
  if (wd) {
    const target = '日月火水木金土'.indexOf(wd[2]);
    let diff = (target - base.getDay() + 7) % 7;
    if (wd[1] === '来週') diff += 7;
    base.setDate(base.getDate() + diff);
    return ymd(base);
  }
  return undefined;
}

/** ルールでのタスク候補抽出（期限や提出を示す語があるときだけ） */
export function ruleTaskSuggestion(
  n: AppNotification
): { title: string; due?: string } | undefined {
  const text = `${n.title}\n${n.body}`;
  if (!DEADLINE.test(text)) return undefined;
  const title = (n.title || n.body).replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return undefined;
  return { title, due: extractDue(text) };
}
