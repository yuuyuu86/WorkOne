import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// オンデバイス AI ヘルパー（native/workone-ai, Swift + Foundation Models）との橋渡し。
// 初回利用時に子プロセスを起動し、1 行 1 JSON でやり取りする。
// ヘルパーが無い・落ちた場合は「利用不可」を返し、renderer 側はルール判定だけで動く。

type Pending = {
  resolve: (v: any) => void;
  timer: NodeJS.Timeout;
};

const REQUEST_TIMEOUT_MS = 60000;

export class OnDeviceAI {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  constructor(private readonly binPath: string) {}

  private ensure(): ChildProcessWithoutNullStreams | null {
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return this.proc;
    if (process.platform !== 'darwin' || !fs.existsSync(this.binPath)) return null;
    try {
      const p = spawn(this.binPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      readline.createInterface({ input: p.stdout }).on('line', (line) => {
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        const job = this.pending.get(msg.id);
        if (!job) return;
        clearTimeout(job.timer);
        this.pending.delete(msg.id);
        job.resolve(msg);
      });
      p.stderr.on('data', () => {});
      p.on('exit', () => {
        this.proc = null;
        for (const [, job] of this.pending) {
          clearTimeout(job.timer);
          job.resolve({ ok: false, error: 'helper exited' });
        }
        this.pending.clear();
      });
      this.proc = p;
      return p;
    } catch {
      return null;
    }
  }

  request(cmd: string, payload: Record<string, unknown> = {}): Promise<any> {
    const p = this.ensure();
    if (!p) {
      return Promise.resolve({
        ok: false,
        available: false,
        error: 'helper not found',
      });
    }
    const id = String(++this.seq);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'timeout' });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      p.stdin.write(JSON.stringify({ id, cmd, ...payload }) + '\n');
    });
  }

  async status(): Promise<{ available: boolean; reason?: string }> {
    if (process.platform !== 'darwin') {
      return { available: false, reason: 'macOS のみ対応しています' };
    }
    const r = await this.request('status');
    if (!r.ok) return { available: false, reason: 'AI ヘルパーを起動できませんでした' };
    return { available: !!r.available, reason: r.reason };
  }

  dispose() {
    this.proc?.kill();
    this.proc = null;
  }
}

export function aiHelperPath(resourcesDir: string) {
  return path.join(resourcesDir, 'native', 'workone-ai');
}
