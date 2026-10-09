import { FiCalendar, FiRepeat } from 'react-icons/fi';
import { dueLabel } from './DuePicker';
import { useAppStore } from '../store/useAppStore';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Home: 今日まで（期限切れ含む）のタスクと、期限なしの直近タスク */
export function HomeTasksWidget() {
  const tasks = useAppStore((s) => s.tasks);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const setView = useAppStore((s) => s.setView);

  const today = ymd(new Date());
  const open = tasks.filter((t) => !t.done && t.profileId === activeProfileId);
  const dueSoon = open
    .filter((t) => t.due && t.due.slice(0, 10) <= today)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const list = [...dueSoon, ...open.filter((t) => !dueSoon.includes(t))].slice(0, 6);

  return (
    <div className="section" style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="section-title">
          タスク{dueSoon.length > 0 ? `（今日まで ${dueSoon.length}）` : ''}
        </h3>
        <button className="btn btn-sm btn-ghost" onClick={() => setView('tasks')}>
          すべて表示
        </button>
      </div>
      <div className="card">
        {list.length === 0 ? (
          <div className="list-row">
            <span className="muted">やることはありません</span>
          </div>
        ) : (
          list.map((t) => (
            <div className="list-row home-task" key={t.id}>
              <button
                className={`check-circle prio-${t.priority ?? 'normal'}`}
                onClick={() => toggleTaskDone(t.id)}
                title="完了"
              />
              <div className="grow">
                <div className="row-title">{t.title}</div>
              </div>
              {t.repeat && <FiRepeat size={12} className="muted" />}
              {t.due && (
                <span className={`due-chip set compact-static ${t.due.slice(0, 10) < today ? 'overdue' : ''}`}>
                  <FiCalendar size={12} />
                  {dueLabel(t.due, t.dueTime)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
