import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';
import { ServiceIcon } from './ServiceIcon';

type Props = {
  onAdded: () => void;
};

// 入力（ワークスペース名 / URL / チームID）から Slack の URL を組み立てる。
// - 完全な URL（http/https）→ そのまま
// - チームID（T で始まる英数）→ app.slack.com/client/<ID>
// - それ以外（サブドメイン名）→ https://<name>.slack.com
function buildSlackUrl(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      new URL(v);
      return v;
    } catch {
      return null;
    }
  }
  if (/^T[A-Z0-9]{6,}$/i.test(v)) {
    return `https://app.slack.com/client/${v.toUpperCase()}`;
  }
  // 「myteam」や「myteam.slack.com」→ https://myteam.slack.com
  const sub = v.replace(/\.slack\.com\/?$/i, '').replace(/[^a-z0-9-]/gi, '');
  if (!sub) return null;
  return `https://${sub}.slack.com`;
}

export function SlackWorkspaceForm({ onAdded }: Props) {
  const addCustomService = useAppStore((s) => s.addCustomService);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    const url = buildSlackUrl(workspace);
    if (!url) {
      setError(
        'ワークスペースの URL・サブドメイン名・チームID のいずれかを入力してください。'
      );
      return;
    }
    addCustomService({
      name: name.trim() || workspace.trim(),
      url,
      category: 'chat',
      icon: 'slack',
    });
    setName('');
    setWorkspace('');
    setError('');
    onAdded();
  };

  if (!open) {
    return (
      <button
        className="btn btn-block"
        style={{ marginBottom: 16, justifyContent: 'flex-start', gap: 10 }}
        onClick={() => setOpen(true)}
      >
        <ServiceIcon iconKey="slack" chip={20} />
        Slack ワークスペースを追加（複数可）
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Slack ワークスペースを追加
      </div>
      <p className="muted" style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
        ワークスペースごとにサイドバーへ個別に並べられます。ログインは共有されるため、
        一度サインインすれば追加ログインは不要です。
      </p>

      <div className="field">
        <label>表示名（任意）</label>
        <input
          type="text"
          value={name}
          placeholder="例: 仕事 / 学校"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label>ワークスペース</label>
        <input
          type="text"
          value={workspace}
          placeholder="例: myteam / myteam.slack.com / T01234567"
          onChange={(e) => setWorkspace(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <p className="muted" style={{ marginTop: 6 }}>
          ワークスペースの URL（〇〇.slack.com）か、サインイン後の
          app.slack.com/client/ の URL、またはチームID（T で始まる）を入力します。
        </p>
      </div>

      {error && <div className="field-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleAdd}>
          <FiPlus size={14} /> 追加する
        </button>
        <button className="btn" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>
    </div>
  );
}
