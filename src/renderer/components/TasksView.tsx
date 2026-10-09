import { useMemo, useState } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiExternalLink,
  FiCheck,
  FiInbox,
  FiBookOpen,
  FiCpu,
  FiFlag,
  FiRepeat,
  FiChevronRight,
  FiChevronDown,
  FiSearch,
  FiList,
  FiX,
  FiCheckSquare,
} from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import type { Task, TaskPriority, TaskRepeat } from '../types/service';
import { DuePicker } from './DuePicker';
import { ProfileIcon } from '../lib/profileIcons';
import { REPEAT_LABEL } from '../lib/taskRepeat';

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'someday';
type Sort = 'due' | 'priority' | 'created';

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: '期限切れ',
  today: '今日',
  week: '7日以内',
  later: 'それ以降',
  someday: '期限なし',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: '高', normal: '中', low: '低' };
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

const SOURCE_ICON = {
  manual: null,
  notification: <FiInbox size={12} />,
  classroom: <FiBookOpen size={12} />,
  ai: <FiCpu size={12} />,
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketOf(t: Task, now: Date): Bucket {
  if (!t.due) return 'someday';
  const due = startOfDay(new Date(`${t.due.slice(0, 10)}T00:00`));
  const diff = Math.round((due.getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 6) return 'week';
  return 'later';
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
  const [sort, setSort] = useState<Sort>('due');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftDue, setDraftDue] = useState<string | undefined>();
  const [draftTime, setDraftTime] = useState<string | undefined>();
  const [draftPriority, setDraftPriority] = useState<TaskPriority>('normal');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (allProfiles || t.profileId === activeProfileId) &&
        (!q ||
          t.title.toLowerCase().includes(q) ||
          (t.note ?? '').toLowerCase().includes(q) ||
          (t.subtasks ?? []).some((s) => s.title.toLowerCase().includes(q)))
    );
  }, [tasks, allProfiles, activeProfileId, query]);

  const open = visible.filter((t) => !t.done);
  const done = visible
    .filter((t) => t.done)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  const compare = (a: Task, b: Task) => {
    const pr = PRIORITY_RANK[a.priority ?? 'normal'] - PRIORITY_RANK[b.priority ?? 'normal'];
    const du = `${a.due ?? '9999'}${a.dueTime ?? ''}`.localeCompare(`${b.due ?? '9999'}${b.dueTime ?? ''}`);
    const cr = b.createdAt.localeCompare(a.createdAt);
    if (sort === 'priority') return pr || du || cr;
    if (sort === 'created') return cr;
    return du || pr || cr;
  };

  const grouped = useMemo(() => {
    const now = new Date();
    const g: Record<Bucket, Task[]> = { overdue: [], today: [], week: [], later: [], someday: [] };
    for (const t of open) g[bucketOf(t, now)].push(t);
    for (const k of Object.keys(g) as Bucket[]) g[k].sort(compare);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sort]);

  const doneToday = done.filter(
    (t) => t.doneAt && startOfDay(new Date(t.doneAt)).getTime() === startOfDay(new Date()).getTime()
  ).length;

  const submit = () => {
    if (!draft.trim()) return;
    addTask({
      title: draft,
      due: draftDue,
      dueTime: draftTime,
      priority: draftPriority,
      source: 'manual',
    });
    setDraft('');
    setDraftDue(undefined);
    setDraftTime(undefined);
    setDraftPriority('normal');
  };

  const openSource = (t: Task) => {
    if (!t.serviceId || !services.some((s) => s.id === t.serviceId)) {
      if (t.url) window.workOne?.openExternal?.(t.url);
      return;
    }
    if (t.url) navigateService(t.serviceId, t.url);
    else openService(t.serviceId);
  };

  const setSubtasks = (t: Task, subtasks: Task['subtasks']) => updateTask(t.id, { subtasks });

  const cyclePriority = (t: Task) => {
    const order: TaskPriority[] = ['normal', 'high', 'low'];
    const cur = order.indexOf(t.priority ?? 'normal');
    updateTask(t.id, { priority: order[(cur + 1) % order.length] });
  };

  const detail = (t: Task) => (
    <div className="task-detail" onClick={(e) => e.stopPropagation()}>
      <textarea
        className="task-note-input"
        rows={2}
        placeholder="メモ"
        value={t.note ?? ''}
        onChange={(e) => updateTask(t.id, { note: e.target.value || undefined })}
      />

      <div className="task-detail-row">
        <span className="task-detail-label">優先度</span>
        <div className="segmented">
          {(['high', 'normal', 'low'] as TaskPriority[]).map((p) => (
            <button
              key={p}
              className={`${(t.priority ?? 'normal') === p ? 'active' : ''} prio-${p}`}
              onClick={() => updateTask(t.id, { priority: p })}
            >
              <FiFlag size={12} /> {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="task-detail-row">
        <span className="task-detail-label">繰り返し</span>
        <div className="segmented">
          <button className={!t.repeat ? 'active' : ''} onClick={() => updateTask(t.id, { repeat: undefined })}>
            なし
          </button>
          {(Object.keys(REPEAT_LABEL) as TaskRepeat[]).map((r) => (
            <button key={r} className={t.repeat === r ? 'active' : ''} onClick={() => updateTask(t.id, { repeat: r })}>
              {REPEAT_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="task-detail-row" style={{ alignItems: 'flex-start' }}>
        <span className="task-detail-label">サブタスク</span>
        <div className="subtasks">
          {(t.subtasks ?? []).map((s) => (
            <div key={s.id} className={`subtask ${s.done ? 'done' : ''}`}>
              <button
                className={`check-circle sm ${s.done ? 'checked' : ''}`}
                onClick={() =>
                  setSubtasks(t, t.subtasks!.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))
                }
              >
                {s.done && <FiCheck size={10} />}
              </button>
              <input
                value={s.title}
                onChange={(e) =>
                  setSubtasks(t, t.subtasks!.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))
                }
              />
              <button
                className="icon-btn"
                title="削除"
                onClick={() => setSubtasks(t, t.subtasks!.filter((x) => x.id !== s.id))}
              >
                <FiX size={12} />
              </button>
            </div>
          ))}
          <input
            className="subtask-add"
            placeholder="＋ サブタスクを追加（Enter）"
            onKeyDown={(e) => {
              const v = e.currentTarget.value.trim();
              if (e.key !== 'Enter' || e.nativeEvent.isComposing || !v) return;
              setSubtasks(t, [...(t.subtasks ?? []), { id: uid(), title: v, done: false }]);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      <div className="task-detail-actions">
        {(t.url || t.serviceId) && (
          <button className="btn btn-sm" onClick={() => openSource(t)}>
            <FiExternalLink size={13} /> 元の場所を開く
          </button>
        )}
        <button className="btn btn-sm btn-ghost danger-text" onClick={() => removeTask(t.id)}>
          <FiTrash2 size={13} /> 削除
        </button>
      </div>
    </div>
  );

  const row = (t: Task) => {
    const subs = t.subtasks ?? [];
    const subDone = subs.filter((s) => s.done).length;
    const isOpen = expanded === t.id;
    const profile = profiles.find((p) => p.id === t.profileId);
    const prio = t.priority ?? 'normal';
    return (
      <div className={`task-item ${t.done ? 'done' : ''} ${isOpen ? 'open' : ''}`} key={t.id}>
        <div className="task-line" onClick={() => setExpanded(isOpen ? null : t.id)}>
          <button
            className={`check-circle prio-${prio} ${t.done ? 'checked' : ''}`}
            title={t.done ? '未完了に戻す' : '完了'}
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskDone(t.id);
            }}
          >
            {t.done && <FiCheck size={12} />}
          </button>
          <div className="grow task-main">
            <input
              className="task-title-input"
              value={t.title}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateTask(t.id, { title: e.target.value })}
            />
            <div className="task-chips">
              {prio !== 'normal' && (
                <span className={`task-chip prio-${prio}`}>
                  <FiFlag size={11} /> {PRIORITY_LABEL[prio]}
                </span>
              )}
              {t.repeat && (
                <span className="task-chip">
                  <FiRepeat size={11} /> {REPEAT_LABEL[t.repeat]}
                </span>
              )}
              {subs.length > 0 && (
                <span className="task-chip">
                  <FiList size={11} /> {subDone}/{subs.length}
                </span>
              )}
              {SOURCE_ICON[t.source] && <span className="task-chip">{SOURCE_ICON[t.source]}</span>}
              {allProfiles && profile && (
                <span className="task-chip" style={{ color: profile.color }}>
                  <ProfileIcon icon={profile.icon} size={11} /> {profile.name}
                </span>
              )}
              {t.note && !isOpen && <span className="task-chip note">{t.note}</span>}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DuePicker
              compact
              due={t.due}
              time={t.dueTime}
              onChange={(due, time) => updateTask(t.id, { due, dueTime: time, remindedFor: undefined })}
            />
          </div>
          <button
            className="icon-btn"
            title="優先度を切り替え"
            onClick={(e) => {
              e.stopPropagation();
              cyclePriority(t);
            }}
          >
            <FiFlag size={14} className={`prio-icon-${prio}`} />
          </button>
          <span className="task-expand">
            {isOpen ? <FiChevronDown size={15} /> : <FiChevronRight size={15} />}
          </span>
        </div>
        {isOpen && detail(t)}
      </div>
    );
  };

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>タスク</h2>
        <p>
          手動で追加したタスクと、Inbox・Classroom から登録したタスクをまとめて管理します。
          {doneToday > 0 && ` 今日は ${doneToday} 件完了しました。`}
        </p>
      </div>

      <div className="task-composer card">
        <FiPlus size={16} className="muted" />
        <input
          className="grow"
          value={draft}
          placeholder="タスクを追加（Enter）"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
        />
        <DuePicker
          due={draftDue}
          time={draftTime}
          onChange={(d, tm) => {
            setDraftDue(d);
            setDraftTime(tm);
          }}
        />
        <button
          type="button"
          className={`due-chip ${draftPriority !== 'normal' ? 'set' : ''}`}
          title="優先度"
          onClick={() =>
            setDraftPriority((p) => (p === 'normal' ? 'high' : p === 'high' ? 'low' : 'normal'))
          }
        >
          <FiFlag size={13} className={`prio-icon-${draftPriority}`} />
          {PRIORITY_LABEL[draftPriority]}
        </button>
        <button className="btn btn-sm btn-primary composer-add" onClick={submit} disabled={!draft.trim()}>
          追加
        </button>
      </div>

      <div className="task-toolbar">
        <div className="filter-chips" style={{ margin: 0 }}>
          <button className={`chip ${!allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(false)}>
            このプロファイル
          </button>
          <button className={`chip ${allProfiles ? 'active' : ''}`} onClick={() => setAllProfiles(true)}>
            全プロファイル
          </button>
          <span className="chip-sep" />
          {(
            [
              ['due', '期限順'],
              ['priority', '優先度順'],
              ['created', '追加順'],
            ] as [Sort, string][]
          ).map(([k, label]) => (
            <button key={k} className={`chip ${sort === k ? 'active' : ''}`} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
        <label className="task-search">
          <FiSearch size={13} />
          <input value={query} placeholder="絞り込み" onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {open.length === 0 && (
        <div className="empty-state">
          <FiCheckSquare size={36} className="empty-icon" />
          <h3>{query ? '一致するタスクはありません' : 'やることはありません'}</h3>
          {!query && <p>上の入力欄や、Inbox の「タスク化」から追加できます。</p>}
        </div>
      )}

      {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) =>
        grouped[b].length === 0 ? null : (
          <div className="section" key={b}>
            <h3 className={`section-title ${b === 'overdue' ? 'danger-text' : ''}`}>
              {BUCKET_LABEL[b]}
              <span className="section-count">{grouped[b].length}</span>
            </h3>
            <div className="card task-list">{grouped[b].map(row)}</div>
          </div>
        )
      )}

      {done.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
              完了済み（{done.length}）
            </button>
            {showDone && (
              <button className="btn btn-sm" onClick={clearDoneTasks}>
                <FiTrash2 size={13} /> 完了済みを削除
              </button>
            )}
          </div>
          {showDone && <div className="card task-list">{done.slice(0, 100).map(row)}</div>}
        </div>
      )}
    </div>
  );
}

