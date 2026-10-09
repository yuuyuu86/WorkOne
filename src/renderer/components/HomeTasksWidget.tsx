import { FiCheckSquare, FiSquare } from 'react-icons/fi';
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
            <span className="muted">やることはありません 🎉</span>
          </div>
        ) : (
          list.map((t) => (
            <div className="list-row" key={t.id}>
              <button className="icon-btn task-check" onClick={() => toggleTaskDone(t.id)} title="完了">
                {t.done ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
              </button>
              <div className="grow">
                <div className="row-title">{t.title}</div>
              </div>
              {t.due && (
                <span className={`muted ${t.due.slice(0, 10) < today ? 'danger-text' : ''}`} style={{ flexShrink: 0 }}>
                  {t.due.slice(0, 10) < today ? '期限切れ ' : ''}
                  {t.due.slice(5, 10).replace('-', '/')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
