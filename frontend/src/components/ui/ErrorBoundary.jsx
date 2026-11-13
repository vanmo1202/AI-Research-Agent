import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="boundary-state" role="alert">
        <h1>Không thể hiển thị trang</h1>
        <p>Hãy tải lại trang để khôi phục dữ liệu từ máy chủ.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Tải lại trang
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
