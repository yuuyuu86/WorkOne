import { useState } from 'react';
import { FiFlag, FiX } from 'react-icons/fi';
import { DuePicker } from './DuePicker';
import { useAppStore } from '../store/useAppStore';
import type { TaskPriority, TaskSource } from '../types/service';

type Props = {
  initialTitle?: string;
  initialDue?: string;
  source?: TaskSource;
  serviceId?: string;
  url?: string;
  onClose: () => void;
  onAdded?: () => void;
};

/** タスクを1件追加する小さなダイアログ（Inbox・課題・⌘K から共通で使う） */
export function TaskQuickAdd({
  initialTitle = '',
  initialDue,
  source = 'manual',
  serviceId,
  url,
  onClose,
  onAdded,
}: Props) {
  const addTask = useAppStore((s) => s.addTask);
  const [title, setTitle] = useState(initialTitle);
  const [due, setDue] = useState<string | undefined>(initialDue?.slice(0, 10));
  const [dueTime, setDueTime] = useState<string | undefined>();
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [note, setNote] = useState('');

  const save = () => {
    if (!title.trim()) return;
    addTask({
      title,
      due,
      dueTime,
      priority,
      note: note.trim() || undefined,
      source,
      serviceId,
      url,
    });
    onAdded?.();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>タスクを追加</h3>
          <button className="icon-btn" onClick={onClose} title="閉じる">
            <FiX size={16} />
          </button>
        </div>
        <div className="modal-body profile-form">
          <label className="form-label">タイトル</label>
          <input
            autoFocus
            value={title}
            placeholder="例: レポートを提出する"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
          />
          <label className="form-label">期限・優先度</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DuePicker
              due={due}
              time={dueTime}
              onChange={(d, t) => {
                setDue(d);
                setDueTime(t);
              }}
            />
            <div className="segmented">
              {(['high', 'normal', 'low'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${priority === p ? 'active' : ''} prio-${p}`}
                  onClick={() => setPriority(p)}
                >
                  <FiFlag size={12} /> {p === 'high' ? '高' : p === 'normal' ? '中' : '低'}
                </button>
              ))}
            </div>
          </div>
          <label className="form-label">メモ</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
