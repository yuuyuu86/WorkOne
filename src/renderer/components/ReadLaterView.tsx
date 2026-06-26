import { useState } from 'react';
import { FiBookmark, FiExternalLink, FiTrash2, FiEdit2, FiCheck } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';

export function ReadLaterView() {
  const readLater = useAppStore((s) => s.readLater);
  const removeReadLater = useAppStore((s) => s.removeReadLater);
  const updateReadLaterNote = useAppStore((s) => s.updateReadLaterNote);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const startEdit = (id: string, note?: string) => {
    setEditingId(id);
    setDraftNote(note ?? '');
  };

  const saveNote = (id: string) => {
    updateReadLaterNote(id, draftNote.trim());
    setEditingId(null);
  };

  return (
    <div className="content-scroll">
      <div className="page-header">
        <h2>あとで見る</h2>
        <p>サービス表示中のツールバーから現在のページを保存できます。</p>
      </div>

      {readLater.length === 0 ? (
        <div className="empty-state">
          <FiBookmark size={40} className="empty-icon" />
          <h3>保存された項目はありません</h3>
          <p>
            サービスを開いてツールバーの「あとで見る」を押すと、ここに保存されます。
          </p>
        </div>
      ) : (
        <div className="card">
          {readLater.map((item) => (
            <div className="list-row" key={item.id} style={{ alignItems: 'flex-start' }}>
              <FiBookmark
                size={16}
                style={{ color: 'var(--accent)', marginTop: 3 }}
              />
              <div className="grow">
                <div className="row-title">{item.title}</div>
                <div className="row-sub">
                  {item.serviceName} ・{' '}
                  {new Date(item.createdAt).toLocaleString('ja-JP')}
                </div>
                <div className="row-sub" style={{ marginTop: 2 }}>
                  {item.url}
                </div>

                {editingId === item.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      rows={2}
                      value={draftNote}
                      placeholder="メモを入力"
                      onChange={(e) => setDraftNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-sm)',
                        resize: 'vertical',
                      }}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ marginTop: 6 }}
                      onClick={() => saveNote(item.id)}
                    >
                      <FiCheck size={13} /> 保存
                    </button>
                  </div>
                ) : (
                  item.note && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg)',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {item.note}
                    </div>
                  )
                )}
              </div>

              <div className="row-actions">
                <button
                  className="icon-btn"
                  title="メモを編集"
                  onClick={() => startEdit(item.id, item.note)}
                >
                  <FiEdit2 size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="外部ブラウザで開く"
                  onClick={() => window.workOne.openExternal(item.url)}
                >
                  <FiExternalLink size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="削除"
                  onClick={() => removeReadLater(item.id)}
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
