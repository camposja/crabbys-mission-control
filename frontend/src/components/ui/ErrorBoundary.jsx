import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", this.props.name, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg border border-red-800 bg-red-950/50">
          <p className="text-red-400 text-sm font-medium">
            {this.props.name || "Panel"} failed to load
          </p>
          <p className="text-red-500 text-xs mt-1 font-mono">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-xs text-red-400 underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
