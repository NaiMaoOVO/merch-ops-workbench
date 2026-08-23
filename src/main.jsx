import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fff9fb', color: '#30252d', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 620, width: '100%', padding: 24, border: '1px solid #f0cbd9', borderRadius: 20, background: '#fff' }}>
            <p style={{ margin: 0, color: '#b54d76', fontWeight: 700 }}>工作台加载失败</p>
            <h1 style={{ margin: '10px 0', fontSize: 24 }}>页面遇到一个运行时错误</h1>
            <p style={{ color: '#756570', lineHeight: 1.6 }}>请先刷新页面。如果问题持续，请把下面的错误信息发给我。</p>
            <pre style={{ overflow: 'auto', padding: 12, borderRadius: 10, background: '#fff4f7', color: '#8f4667', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
