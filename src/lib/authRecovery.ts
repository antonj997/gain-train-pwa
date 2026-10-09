export const RECOVERY_STORAGE_KEY = "gt-password-recovery";
export const RECOVERY_USER_KEY = "gt-password-recovery-user";

export function recoveredSessionMatches(
  recoveredUserId: string | null,
  currentUserId: string | undefined,
) {
  return !!recoveredUserId && recoveredUserId === currentUserId;
}

export function recoveryRequested(href: string) {
  const url = new URL(href);
  return (
    url.searchParams.get("recovery") === "1" ||
    new URLSearchParams(url.hash.slice(1)).get("type") === "recovery"
  );
}

export function recoveryRedirect(baseUrl: string, origin: string) {
  return new URL("auth?recovery=1", new URL(baseUrl, origin)).href;
}
