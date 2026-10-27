import { local, storageKeys, writeStored } from "./storage";

export type SyncHealth = {
  lastSyncedAt: number | null;
  failingSince: number | null;
};
// Long enough to ignore brief outages; a paused free-tier server stays down.
export const SYNC_OUTAGE_MS = 24 * 60 * 60 * 1000;

export function readSyncHealth(account: string): SyncHealth {
  try {
    const saved = JSON.parse(local.getItem(storageKeys.syncHealth(account))!);
    return {
      lastSyncedAt: Number.isFinite(saved?.lastSyncedAt)
        ? saved.lastSyncedAt
        : null,
      failingSince: Number.isFinite(saved?.failingSince)
        ? saved.failingSince
        : null,
    };
  } catch {
    return { lastSyncedAt: null, failingSince: null };
  }
}

export function recordSyncResult(
  account: string,
  ok: boolean,
  now = Date.now(),
): SyncHealth {
  const previous = readSyncHealth(account);
  const next = ok
    ? { lastSyncedAt: now, failingSince: null }
    : { ...previous, failingSince: previous.failingSince ?? now };
  writeStored(storageKeys.syncHealth(account), JSON.stringify(next));
  return next;
}

/** True when sync has failed continuously for a day, e.g. the server is paused. */
export const isSyncOutage = (health: SyncHealth, now = Date.now()) =>
  health.failingSince !== null && now - health.failingSince >= SYNC_OUTAGE_MS;
