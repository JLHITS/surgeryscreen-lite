"use client";

import { Component, type ReactNode } from "react";

const RETRY_MS = 30_000;

/**
 * Keeps one part of an unattended display (the slideshow) from
 * taking the rest down with it: on an unexpected error the part renders
 * nothing, then tries again after a short pause.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private retry: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Display component failed; retrying shortly.", error);
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(() => this.setState({ failed: false }), RETRY_MS);
  }

  componentWillUnmount() {
    if (this.retry) clearTimeout(this.retry);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
