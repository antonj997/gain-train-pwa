import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "../i18n";
import { local, storageKeys, writeStored } from "../lib/storage";

const CHUNK_RELOAD_KEY = "gt-chunk-reload";
/** A stale-code error this soon after the last reload means reloading did not help. */
const RELOAD_RETRY_MS = 60_000;

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

/** Remembers the crash on this device, so a bug report can include it. */
export function storeLastError(report: ErrorReport) {
  writeStored(storageKeys.lastError, JSON.stringify(report));
}

/** The last crash this device saw, or null. */
export function readLastError(): ErrorReport | null {
  try {
    const raw = local.getItem(storageKeys.lastError);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value.message !== "string") return null;
    const text = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : "";
    return {
      message: text(value.message, 500),
      stack: text(value.stack, 4000),
      path: text(value.path, 200),
      at: text(value.at, 40),
    };
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

/**
 * Reloads for an error from code a deploy replaced, unless the last such
 * reload was under a minute ago (then reloading did not help). An installed
 * app keeps its session for days, so a lasting "reloaded once" flag would let
 * only the first deploy recover.
 */
export function shouldReloadForStaleCode(
  message: string,
  lastReload: number | null,
  now = Date.now(),
) {
  return (
    isStaleCodeError(message) &&
    (lastReload === null || now - lastReload >= RELOAD_RETRY_MS)
  );
}

function reloadForStaleCode(message: string) {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || null;
    if (!shouldReloadForStaleCode(message, last)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
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
    if (reloadForStaleCode(report.message)) return;
    storeLastError(report);
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
        <h1>{t("crash.title")}</h1>
        <p>{t("crash.text")}</p>
        <div className="crash-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => location.reload()}
          >
            {t("crash.reload")}
          </button>
          <button type="button" className="btn-secondary" onClick={this.copy}>
            {copied ? t("crash.copied") : t("crash.copy")}
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
