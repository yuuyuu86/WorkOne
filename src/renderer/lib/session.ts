// 全サービスで共有する Web 表示プロファイル（パーティション）。
//
// すべてのサービスを同じ永続パーティションで開くことで、普通のブラウザの
// 1 プロファイルと同じ挙動になる。例えば Google に一度ログインすれば、
// Gmail / Classroom / Drive / Calendar / Meet など同じ Google アカウントを
// 使うサービスはすべてログイン済みになる（accounts.google.com の Cookie を共有）。
//
// 各サイトの Cookie はサイトごとに分かれて保存されるため、サービス間で
// 認証情報が混ざることはない（共有されるのは「同じドメイン同士」だけ）。
export const SHARED_PARTITION = 'persist:workone';

// プロファイルごとのパーティション。既定プロファイルは従来の共有パーティションを
// そのまま使うので、既存のログイン状態を引き継げる。
export function partitionFor(profileId: string | undefined): string {
  if (!profileId || profileId === 'default') return SHARED_PARTITION;
  return `${SHARED_PARTITION}-${profileId}`;
}
