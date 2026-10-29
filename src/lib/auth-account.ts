/** The local log shown when nobody has signed in on this phone. */
export const PHONE_ACCOUNT = "phone";

/**
 * The account whose log to show after an auth change. A signed-in user's own
 * log; with no user, the log already shown. Supabase also reports a sign-out
 * when a session refresh fails (iOS suspends the app mid-refresh) or another
 * device signs out everywhere, so only an explicit sign-out on this phone
 * switches to the phone log, and that happens in `signOut` itself.
 */
export function accountAfterAuthChange(
  current: string,
  user: { id: string } | null,
) {
  return user ? user.id : current;
}

/** True when an account's log is shown but its session has ended. */
export function needsSignInAgain(account: string, user: unknown) {
  return account !== PHONE_ACCOUNT && !user;
}
