const BODYWEIGHT_ERROR =
  "Bodyweight must be greater than 0 and no more than 1000 kg, or blank to clear it.";

export type Profile = { bodyWeightKg: number | null };
type SavedProfile = Profile & { updatedAt: number; dirty: boolean };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export type ProfileSnapshot = Profile & {
  status: "local" | "pending" | "syncing" | "synced" | "error";
  error: string | null;
};
export type ProfileConnection = {
  read: () => Promise<unknown>;
  write: (
    profile: Omit<SavedProfile, "dirty">,
    metadata: unknown,
  ) => Promise<unknown>;
};
type Options = {
  account: string;
  storage: Storage;
  metadata?: unknown;
  now?: () => number;
  canSync?: () => boolean;
  connect?: (signal: AbortSignal) => Promise<ProfileConnection>;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const validWeight = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 1000);
export function parseBodyWeightInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed))
    throw new Error(BODYWEIGHT_ERROR);
  const value = Number(trimmed.replace(",", "."));
  if (!validWeight(value)) throw new Error(BODYWEIGHT_ERROR);
  return value;
}
const cacheKey = (account: string) =>
  `gt-profile-v1:${encodeURIComponent(account)}`;
export function removeProfileCache(
  account: string,
  storage: Storage = localStorage,
) {
  storage.removeItem(cacheKey(account));
}
function remoteProfile(metadata: unknown): Omit<SavedProfile, "dirty"> | null {
  const profile = object(object(metadata).gain_train_profile);
  if (
    !validWeight(profile.bodyWeightKg) ||
    typeof profile.updatedAt !== "number" ||
    !Number.isFinite(profile.updatedAt) ||
    profile.updatedAt < 0
  )
    return null;
  return { bodyWeightKg: profile.bodyWeightKg, updatedAt: profile.updatedAt };
}
export function profileMetadataPatch(
  metadata: unknown,
  profile: Omit<SavedProfile, "dirty">,
) {
  // Auth merges the supplied metadata keys; never resend unrelated user data.
  return {
    gain_train_profile: {
      ...object(object(metadata).gain_train_profile),
      bodyWeightKg: profile.bodyWeightKg,
      updatedAt: profile.updatedAt,
    },
  };
}

/** Capture the token once: an account switch must never retarget an upload. */
export function createProfileConnection(options: {
  account: string;
  token: string;
  url: string;
  publishableKey: string;
  isCurrent: () => boolean;
  signal: AbortSignal;
  request?: typeof fetch;
}): ProfileConnection {
  const request = options.request ?? fetch;
  const send = async (method: "GET" | "PUT", data?: unknown) => {
    if (!options.isCurrent() || options.signal.aborted)
      throw new Error(
        "Your account changed. Sign in again to sync your profile.",
      );
    const response = await request(
      `${options.url.replace(/\/$/, "")}/auth/v1/user`,
      {
        method,
        headers: {
          apikey: options.publishableKey,
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        ...(data ? { body: JSON.stringify({ data }) } : {}),
        signal: options.signal,
      },
    );
    if (!response.ok) throw new Error("Could not sync your profile.");
    const user = object(await response.json());
    if (
      !options.isCurrent() ||
      options.signal.aborted ||
      user.id !== options.account
    )
      throw new Error("Your account changed. Profile sync was stopped.");
    return user.user_metadata;
  };
  return {
    read: () => send("GET"),
    write: (profile, metadata) =>
      send("PUT", profileMetadataPatch(metadata, profile)),
  };
}

/** Local-first, account-scoped profile queue. Metadata is data, never authority. */
export class ProfileStore {
  private record: SavedProfile = {
    bodyWeightKg: null,
    updatedAt: 0,
    dirty: false,
  };
  private snapshot: ProfileSnapshot;
  private listeners = new Set<() => void>();
  private active = true;
  private flight: Promise<void> | null = null;
  private abort: AbortController | null = null;
  constructor(private options: Options) {
    try {
      const cache = object(
        JSON.parse(
          options.storage.getItem(cacheKey(options.account)) ?? "null",
        ),
      );
      if (
        validWeight(cache.bodyWeightKg) &&
        typeof cache.updatedAt === "number" &&
        Number.isFinite(cache.updatedAt) &&
        cache.updatedAt >= 0 &&
        typeof cache.dirty === "boolean"
      )
        this.record = cache as SavedProfile;
    } catch {
      /* A missing or unreadable cache starts with an empty profile. */
    }
    const remote = remoteProfile(options.metadata);
    if (
      remote &&
      !this.record.dirty &&
      remote.updatedAt >= this.record.updatedAt
    )
      this.record = { ...remote, dirty: false };
    this.snapshot = {
      bodyWeightKg: this.record.bodyWeightKg,
      status:
        options.account !== "phone" && this.record.dirty ? "pending" : "local",
      error: null,
    };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(
    status: ProfileSnapshot["status"],
    error: string | null = null,
  ) {
    this.snapshot = { bodyWeightKg: this.record.bodyWeightKg, status, error };
    this.listeners.forEach((listener) => listener());
  }
  private persist(record: SavedProfile) {
    try {
      this.options.storage.setItem(
        cacheKey(this.options.account),
        JSON.stringify(record),
      );
    } catch {
      throw new Error(
        "Could not save your profile on this device. Allow storage or free some space and try again.",
      );
    }
    this.record = record;
  }
  acceptMetadata(metadata: unknown) {
    if (!this.active || this.record.dirty) return;
    const remote = remoteProfile(metadata);
    if (!remote || remote.updatedAt < this.record.updatedAt) return;
    try {
      this.persist({ ...remote, dirty: false });
      this.publish(this.snapshot.status);
    } catch (error) {
      this.publish("error", (error as Error).message);
    }
  }
  saveProfile = (profile: Profile) => {
    if (!this.active)
      throw new Error(
        "Your account changed. Open Settings again to save your profile.",
      );
    if (!validWeight(profile.bodyWeightKg)) throw new Error(BODYWEIGHT_ERROR);
    const next = {
      bodyWeightKg: profile.bodyWeightKg,
      updatedAt: Math.max(
        (this.options.now ?? Date.now)(),
        this.record.updatedAt + 1,
      ),
      dirty: this.options.account !== "phone",
    };
    try {
      this.persist(next);
      this.publish(next.dirty ? "pending" : "local");
    } catch (error) {
      this.publish("error", (error as Error).message);
      throw error;
    }
  };
  sync = (): Promise<void> => {
    if (!this.active || this.options.account === "phone")
      return Promise.resolve();
    if (this.flight) return this.flight;
    if (!this.options.connect || !this.options.canSync?.()) {
      this.publish(this.record.dirty ? "pending" : "local");
      return Promise.resolve();
    }
    this.abort = new AbortController();
    this.publish("syncing");
    this.flight = this.runSync(this.abort.signal).finally(() => {
      this.flight = null;
      this.abort = null;
    });
    return this.flight;
  };
  private async runSync(signal: AbortSignal) {
    try {
      const connection = await this.options.connect!(signal);
      if (!this.active) return;
      let metadata = await connection.read();
      if (!this.active) return;
      const remote = remoteProfile(metadata);
      if (
        !this.record.dirty &&
        remote &&
        remote.updatedAt >= this.record.updatedAt
      )
        this.persist({ ...remote, dirty: false });
      if (
        this.record.dirty &&
        remote &&
        remote.updatedAt >= this.record.updatedAt
      )
        this.persist({ ...this.record, updatedAt: remote.updatedAt + 1 });
      // A second local edit made while an upload is in flight stays queued.
      // Bound the loop during unusually rapid edits; reconnect/retry continues it.
      for (let attempt = 0; attempt < 3 && this.record.dirty; attempt++) {
        if (!this.options.canSync?.()) {
          this.publish("pending");
          return;
        }
        const pending = { ...this.record };
        metadata = await connection.write(pending, metadata);
        if (!this.active) return;
        const saved = remoteProfile(metadata);
        if (
          !saved ||
          saved.bodyWeightKg !== pending.bodyWeightKg ||
          saved.updatedAt !== pending.updatedAt
        )
          throw new Error("Profile update was not confirmed.");
        if (this.record.updatedAt === pending.updatedAt)
          this.persist({ ...pending, dirty: false });
      }
      this.publish(this.record.dirty ? "pending" : "synced");
    } catch {
      if (!this.active) return;
      this.publish(
        "error",
        this.record.dirty
          ? "Saved on this device. Profile sync failed; retry when connected."
          : "Could not check your profile sync. Retry when connected.",
      );
    }
  }
  dispose() {
    this.active = false;
    this.abort?.abort();
    this.listeners.clear();
  }
}
