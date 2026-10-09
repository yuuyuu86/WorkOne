import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import type { TaskSource } from '../types/service';

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
  const [due, setDue] = useState(initialDue?.slice(0, 10) ?? '');
  const [note, setNote] = useState('');

  const save = () => {
    if (!title.trim()) return;
    addTask({
      title,
      due: due || undefined,
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
          <label className="form-label">期限</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
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
