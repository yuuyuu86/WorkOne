import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** コンパクト表示（個別サービス枠など）にする */
  compact?: boolean;
  /** 表示名（どこで起きたか） */
  label?: string;
};

type State = { error: Error | null };

/**
 * 描画中の例外を捕捉して、アプリ全体が白画面になるのを防ぐ。
 * フォールバック UI から復帰（再描画/再読み込み）できる。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 開発時に原因を追えるようログに残す
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.compact) {
      return (
        <div className="empty-state" style={{ padding: 32 }}>
          <h3>表示中に問題が発生しました</h3>
          <p>{this.props.label ?? 'この部分'}を再表示できます。</p>
          <button className="btn btn-primary" onClick={this.reset}>
            再試行
          </button>
        </div>
      );
    }

    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>問題が発生しました</h2>
        <p className="muted" style={{ maxWidth: 420, lineHeight: 1.6 }}>
          画面の描画中にエラーが発生しました。再読み込みすると復帰できます。
          解決しない場合は設定からデータを削除してください。
        </p>
        <pre
          style={{
            maxWidth: 460,
            maxHeight: 120,
            overflow: 'auto',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            background: 'var(--hover)',
            padding: 10,
            borderRadius: 8,
          }}
        >
          {String(error?.message || error)}
        </pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={this.reset}>
            再描画
          </button>
          <button className="btn" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }
}
