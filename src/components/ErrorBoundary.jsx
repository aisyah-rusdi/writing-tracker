import { Component } from 'react'

// If a page crashes while drawing, show a plain message instead of a blank screen.
// App gives it key={path}, so moving to another page tries again.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="card empty" role="alert">
        <h3>Something went wrong on this page</h3>
        <p className="mut">
          Your words are safe: anything not yet sent is kept on this device. Reload to try again.
        </p>
        <button
          type="button"
          className="btn"
          style={{ width: 'auto', display: 'inline-block' }}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </section>
    )
  }
}