import { useCallback, useState } from 'react';
import { FiPlus, FiCheck, FiEdit3, FiRefreshCw } from 'react-icons/fi';
import { useAppStore } from '../store/useAppStore';

type Props = {
  onAdded: () => void;
};

type DetectState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'found'; items: { url: string; name: string }[] }
  | { kind: 'empty' }
  | { kind: 'error' };

// URL からホスト名を安全に取り出す（追加済み判定の比較用）
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

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
  const services = useAppStore((s) => s.services);
  const [open, setOpen] = useState(false);
  const [detect, setDetect] = useState<DetectState>({ kind: 'idle' });
  const [manual, setManual] = useState(false);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [error, setError] = useState('');

  // 追加済みのワークスペースかどうか（ホスト名の一致で判定）
  const isAdded = (url: string) => {
    const host = hostOf(url);
    return host !== '' && services.some((s) => hostOf(s.url) === host);
  };

  const runDetect = useCallback(async () => {
    setDetect({ kind: 'loading' });
    try {
      const r = await window.workOne.scrapeSlackWorkspaces();
      if (r.loginRequired) setDetect({ kind: 'login' });
      else if (r.items.length > 0) setDetect({ kind: 'found', items: r.items });
      else setDetect({ kind: 'empty' });
    } catch {
      setDetect({ kind: 'error' });
    }
  }, []);

  const handleSelect = (url: string, workspaceName: string) => {
    addCustomService({
      name: workspaceName || 'Slack',
      url,
      category: 'chat',
      icon: 'slack',
    });
    onAdded();
  };

  const handleManualAdd = () => {
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
        className="btn btn-block btn-primary"
        style={{ marginTop: 10 }}
        onClick={() => {
          setOpen(true);
          setManual(false);
          runDetect();
        }}
      >
        <FiPlus size={14} /> ワークスペースを追加
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Slack ワークスペースを追加
      </div>

      {!manual && (
        <>
          {detect.kind === 'loading' && (
            <p className="muted" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
              ログイン済みのワークスペースを確認しています…
            </p>
          )}

          {detect.kind === 'found' && (
            <>
              <p className="muted" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
                サインイン済みのワークスペースが見つかりました。追加するものを選んでください。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detect.items.map((it) => {
                  const added = isAdded(it.url);
                  return (
                    <button
                      key={it.url}
                      className="btn btn-block"
                      style={{ justifyContent: 'flex-start' }}
                      disabled={added}
                      onClick={() => handleSelect(it.url, it.name)}
                    >
                      {added ? <FiCheck size={14} /> : <FiPlus size={14} />}
                      {it.name || 'Slack ワークスペース'}
                      {added ? '（追加済み）' : ''}
                    </button>
                  );
                })}
              </div>
              <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>
                ここに無いワークスペースは、Slack を開いて「ワークスペースを追加」から
                サインインすると、次回ここに表示されます。
              </p>
            </>
          )}

          {detect.kind === 'login' && (
            <p className="muted" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
              Slack にログインしていないようです。サイドバーから一度 Slack を開いてログインしてから、再度お試しください。
            </p>
          )}

          {(detect.kind === 'empty' || detect.kind === 'error') && (
            <p className="muted" style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
              ワークスペースを自動検出できませんでした。手動で追加してください。
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {detect.kind !== 'loading' && (
              <button className="btn btn-sm btn-ghost" onClick={runDetect}>
                <FiRefreshCw size={12} /> 再確認
              </button>
            )}
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setManual(true)}
            >
              <FiEdit3 size={12} /> 手動で追加
            </button>
            <button
              className="btn btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </div>
        </>
      )}

      {manual && (
        <>
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
              onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            />
            <p className="muted" style={{ marginTop: 6 }}>
              ワークスペースの URL（〇〇.slack.com）か、サインイン後の
              app.slack.com/client/ の URL、またはチームID（T で始まる）を入力します。
            </p>
          </div>

          {error && <div className="field-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={handleManualAdd}>
              <FiPlus size={14} /> 追加する
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setManual(false)}>
              自動検出に戻る
            </button>
            <button
              className="btn btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </div>
        </>
      )}
    </div>
  );
}
