import { Component } from 'react';

/**
 * Module-level error boundary (PRD §18 恢复)：单个模块崩溃时保留外壳，
 * 提供重载入口，避免整页白屏丢失其它模块的本地数据。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props?.onError?.(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="module-placeholder" data-testid="module-error">
          <div className="placeholder-icon">⚠️</div>
          <span className="eyebrow">MODULE ERROR</span>
          <h1>这个模块遇到了问题</h1>
          <p>本地数据不受影响。可以尝试重新打开该模块；若反复出现，请导出备份后反馈。</p>
          <button className="primary-button" onClick={() => this.setState({ error: null })}>重新加载模块</button>
        </main>
      );
    }
    return this.props.children;
  }
}
