import { Component, type ErrorInfo, type ReactNode } from "react";

const LAST_ERROR_KEY = "gt-last-error";
const CHUNK_RELOAD_KEY = "gt-chunk-reload";

export type ErrorReport = {
  message: string;
  stack: string;
  path: string;
  at: string;
};

export function errorReport(error: unknown, extra = ""): ErrorReport {
  const e = error instanceof Error ? error : new Error(String(error));
  return {
    message: e.message || String(error),
    stack: [e.stack ?? "", extra].filter(Boolean).join("\n").slice(0, 4000),
    path: typeof location === "undefined" ? "" : location.pathname,
    at: new Date().toISOString(),
  };
}

/** Keeps the last crash so it survives the reload and can be copied later. */
export function rememberError(report: ErrorReport) {
  try {
    localStorage.setItem(LAST_ERROR_KEY, JSON.stringify(report));
  } catch {
    /* Storage can be unavailable; the screen still shows the details. */
  }
}

export function readLastError(): ErrorReport | null {
  try {
    const raw = localStorage.getItem(LAST_ERROR_KEY);
    return raw ? (JSON.parse(raw) as ErrorReport) : null;
  } catch {
    return null;
  }
}

/** A deploy replaced the code this page still refers to: a reload fixes it. */
export function isStaleCodeError(message: string) {
  return /dynamically imported module|importing a module script failed|failed to fetch dynamically|loading chunk/i.test(
    message,
  );
}

function reloadOnceForStaleCode(message: string) {
  if (!isStaleCodeError(message)) return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Records errors outside React's render (event handlers, promises) as well. */
export function watchGlobalErrors() {
  window.addEventListener("error", (event) =>
    rememberError(errorReport(event.error ?? event.message)),
  );
  window.addEventListener("unhandledrejection", (event) =>
    rememberError(errorReport(event.reason)),
  );
}

type State = { report: ErrorReport | null; copied: boolean };

/**
 * Without this, a render error unmounts the whole app and leaves a blank
 * screen. Workouts are saved as they change, so reloading loses nothing.
 */
export default class ErrorBoundary extends Component<
  {
    children: ReactNode;
    /** "page" replaces only the page under the tab bar, which stays usable. */
    scope?: "app" | "page";
  },
  State
> {
  state: State = { report: null, copied: false };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { report: errorReport(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const report = errorReport(error, info.componentStack ?? "");
    rememberError(report);
    if (reloadOnceForStaleCode(report.message)) return;
    this.setState({ report });
  }

  copy = async () => {
    const { report } = this.state;
    if (!report) return;
    try {
      await navigator.clipboard.writeText(
        `${report.message}\n${report.path} · ${report.at}\n\n${report.stack}`,
      );
      this.setState({ copied: true });
    } catch {
      /* The details stay visible to screenshot instead. */
    }
  };

  render() {
    const { report, copied } = this.state;
    if (!report) return this.props.children;
    const Root = this.props.scope === "page" ? "div" : "main";
    return (
      <Root className="crash-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>
          Your workout is saved. Reload to continue, and send the details below
          if it keeps happening.
        </p>
        <div className="crash-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => location.reload()}
          >
            Reload
          </button>
          <button type="button" className="btn-secondary" onClick={this.copy}>
            {copied ? "Copied" : "Copy details"}
          </button>
        </div>
        <pre className="crash-details">
          {report.message}
          {"\n"}
          {report.stack.split("\n").slice(0, 12).join("\n")}
        </pre>
      </Root>
    );
  }
}
