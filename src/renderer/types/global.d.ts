import type { WorkOneApi } from '../../main/preload';

declare global {
  interface Window {
    workOne: WorkOneApi;
  }

  // <webview> 要素を JSX で使えるようにする型補完
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          partition?: string;
          allowpopups?: string;
          useragent?: string;
          // webview の DOM プロパティ（reload 等）にアクセスするため any 許容
          ref?: React.Ref<any>;
        },
        HTMLElement
      >;
    }
  }
}

export {};
