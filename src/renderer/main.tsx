import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TrayView } from './components/TrayView';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="アプリ全体">
      {/* メニューバーのミニ版は同じ画面ファイルを #tray で開く */}
      {window.location.hash === '#tray' ? <TrayView /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
