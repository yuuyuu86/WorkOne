import { useMemo, useState } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiExternalLink,
  FiCheckSquare,
  FiSquare,
  FiInbox,
  FiBookOpen,
  FiCpu,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import type { Task } from '../types/service';

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'someday';

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: '期限切れ',
  today: '今日',
  week: '今週',
  later: 'それ以降',
  someday: 'いつか（期限なし）',
};

const SOURCE_ICON = {
  manual: null,
  notification: <FiInbox size={12} />,
  classroom: <FiBookOpen size={12} />,
  ai: <FiCpu size={12} />,
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketOf(t: Task, now: Date): Bucket {
  if (!t.due) return 'someday';
  const due = startOfDay(new Date(t.due.length === 10 ? `${t.due}T00:00` : t.due));
  const today = startOfDay(now);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 6) return 'week';
  return 'later';
}

function dueLabel(due?: string) {
  if (!due) return '';
  const d = new Date(due.length === 10 ? `${due}T00:00` : due);
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

export function TasksView() {
  const tasks = useAppStore((s) => s.tasks);
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const addTask = useAppStore((s) => s.addTask);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const removeTask = useAppStore((s) => s.removeTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const clearDoneTasks = useAppStore((s) => s.clearDoneTasks);
  const navigateService = useAppStore((s) => s.navigateService);
  const openService = useAppStore((s) => s.openService);
  const services = useAppStore((s) => s.services);

  const [allProfiles, setAllProfiles] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState('');

  const visible = useMemo(
    () => tasks.filter((t) => allProfiles || t.profileId === activeProfileId),
    [tasks, allProfiles, activeProfileId]
  );
  const open = visible.filter((t) => !t.done);
  const done = visible
    .filter((t) => t.done)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const grouped = useMemo(() => {
    const now = new Date();
    const g: Record<Bucket, Task[]> = { overdue: [], today: [], week: [], later: [], someday: [] };
    for (const t of open) g[bucketOf(t, now)].push(t);
    for (const k of Object.keys(g) as Bucket[]) {
      g[k].sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || b.createdAt.localeCompare(a.createdAt));
    }
    return g;
  }, [open]);

  // 今日完了した数（小さな達成感）
  const doneToday = done.filter(
    (t) => t.doneAt && startOfDay(new Date(t.doneAt)).getTime() === startOfDay(new Date()).getTime()
  ).length;

  const submit = () => {
    if (!draft.trim()) return;
    addTask({ title: draft, due: draftDue || undefined, source: 'manual' });
    setDraft('');
    setDraftDue('');
  };

  const openSource = (t: Task) => {
    if (!t.serviceId || !services.some((s) => s.id === t.serviceId)) {
      if (t.url) window.workOne?.openExternal?.(t.url);
      return;
    }
    if (t.url) navigateService(t.serviceId, t.url);
    else openService(t.serviceId);
  };

  const profileOf = (id: string) => profiles.find((p) => p.id === id);

  const row = (t: Task) => (
    <div className={`list-row task-row ${t.done ? 'done' : ''}`} key={t.id}>
      <button
        className="icon-btn task-check"
        title={t.done ? '未完了に戻す' : '完了'}
        onClick={() => toggleTaskDone(t.id)}
      >
        {t.done ? <FiCheckSquare size={17} /> : <FiSquare size={17} />}
      </button>
      <div className="grow">
        <input
          className="task-title-input"
          value={t.title}
          onChange={(e) => updateTask(t.id, { title: e.target.value })}
        />
        <div className="row-sub task-meta">
          {SOURCE_ICON[t.source]}
          {allProfiles && profileOf(t.profileId) && (
            <span>{profileOf(t.profileId)!.emoji} {profileOf(t.profileId)!.name}</span>
          )}
          {t.note && <span className="task-note">{t.note}</span>}
        </div>
      </div>
      <input
        type="date"
        className="task-due-input"
        value={t.due?.slice(0, 10) ?? ''}
        title={dueLabel(t.due)}
        onChange={(e) => updateTask(t.id, { due: e.target.value || undefined })}
      />
      {(t.url || t.serviceId) && (
        <button className="icon-btn" title="元の場所を開く" onClick={() => openSource(t)}>
          <FiExternalLink size={14} />
        </button>
      )}
      <button className="icon-btn" title="削除" onClick={() => removeTask(t.id)}>
        <FiTrash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>タスク</h2>
        <p>
          手動で追加したタスク、Inbox や Classroom から登録したタスクをまとめて管理します。
          {doneToday > 0 && ` 今日は ${doneToday} 件完了しました 🎉`}
        </p>
      </div>

      <div className="task-add card">
        <FiPlus size={16} className="muted" />
        <input
          className="grow"
          value={draft}
          placeholder="タスクを追加（Enter）"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
        />
        <input type="date" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={!draft.trim()}>
          追加
        </button>
      </div>

      <div className="filter-chips" style={{ marginTop: 14 }}>
        <button className={`chip ${!allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(false)}>
          このプロファイル
        </button>
        <button className={`chip ${allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(true)}>
          全プロファイル
        </button>
      </div>

      {open.length === 0 && (
        <div className="empty-state">
          <FiCheckSquare size={36} className="empty-icon" />
          <h3>やることはありません</h3>
          <p>上の入力欄や、Inbox の「タスク化」から追加できます。</p>
        </div>
      )}

      {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) =>
        grouped[b].length === 0 ? null : (
          <div className="section" key={b}>
            <h3 className={`section-title ${b === 'overdue' ? 'danger-text' : ''}`}>
              {BUCKET_LABEL[b]}（{grouped[b].length}）
            </h3>
            <div className="card">{grouped[b].map(row)}</div>
          </div>
        )
      )}

      {done.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowDone((v) => !v)}>
              完了済み（{done.length}）{showDone ? 'を隠す' : 'を表示'}
            </button>
            {showDone && (
              <button className="btn btn-sm" onClick={clearDoneTasks}>
                <FiTrash2 size={13} /> 完了済みを削除
              </button>
            )}
          </div>
          {showDone && <div className="card">{done.slice(0, 100).map(row)}</div>}
        </div>
      )}
    </div>
  );
}
