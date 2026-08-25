import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Isolates a single 3D avatar: if its GLB fails to load or render, swap in
 * the fallback instead of letting the error bubble up and unmount the whole
 * R3F canvas.
 */
export class AvatarErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("avatar failed to load; falling back to default", error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default AvatarErrorBoundary;
