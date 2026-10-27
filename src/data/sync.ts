import { transact, readAccount } from "./database";
import {
  type RemoteDoc,
  type Operation,
  type LocalState,
  type RecordDoc,
  validate,
} from "./model";
export interface Transport {
  push: (op: Operation) => Promise<{ record: RemoteDoc; conflict?: boolean }>;
  pull: (cursor: number) => Promise<RemoteDoc[]>;
}
type ServerError = { code?: unknown; message?: unknown };

// The server raises this when a phone sends an edit for a record it no longer has,
// for example after the database was replaced. Sending it as new re-creates it.
const isMissingOnServer = (error: ServerError) =>
  String(error?.message ?? "").includes("Record missing");

/**
 * Errors the server will repeat for the same operation: validation exceptions
 * (P0001), bad data (class 22) and constraint violations (class 23). Anything
 * else (network, timeouts, auth, rate limits) is retried on the next sync.
 */
export function isRejectedByServer(error: unknown) {
  const code = String((error as ServerError)?.code ?? "");
  return code === "P0001" || code.startsWith("22") || code.startsWith("23");
}

const readable = (row: RemoteDoc) => {
  try {
    validate(row.kind, row.payload);
    return true;
  } catch {
    return false;
  }
};

function applyRemote(s: LocalState, row: RemoteDoc) {
  const current = s.records[row.id];
  if (!current || (!current.dirty && row.revision > current.revision)) {
    s.records[row.id] = {
      ...row,
      localVersion: current?.localVersion ?? 0,
      dirty: false,
    } as RecordDoc;
  } else if (
    current.dirty &&
    row.revision > current.revision &&
    !s.outbox.some((o) => o.id === row.id)
  ) {
    current.conflict = row;
  }
}

export async function syncAccount(
  account: string,
  transport: Transport,
  changed: () => void,
  active: () => boolean = () => true,
) {
  for (let i = 0; i < 100 && active(); i++) {
    let op: Operation | undefined;
    await transact(account, (s) => {
      op = s.outbox[0];
      if (!op) {
        const r = Object.values(s.records).find(
          (r) => r.dirty && !r.conflict && !r.syncError,
        );
        if (r) {
          op = {
            opId: crypto.randomUUID(),
            id: r.id,
            kind: r.kind,
            payload: structuredClone(r.payload),
            deleted: r.deleted,
            baseRevision: r.revision,
            localVersion: r.localVersion,
          };
          s.outbox.push(op);
        }
      }
    });
    if (!op) break;
    const sent = op;
    let result: Awaited<ReturnType<Transport["push"]>>;
    try {
      result = await transport.push(sent);
    } catch (error) {
      if (!active()) return;
      if (isMissingOnServer(error as ServerError) && sent.baseRevision !== 0) {
        await transact(account, (s) => {
          const queued = s.outbox.find((x) => x.opId === sent.opId);
          if (queued) Object.assign(queued, resend(queued));
          if (s.records[sent.id]) s.records[sent.id].revision = 0;
        });
        continue;
      }
      if (!isRejectedByServer(error)) throw error;
      // Park the record so the rest of the queue keeps syncing. Editing it again,
      // or Retry in Settings, sends it once more.
      await transact(account, (s) => {
        s.outbox = s.outbox.filter((x) => x.opId !== sent.opId);
        const current = s.records[sent.id];
        if (current)
          current.syncError =
            String((error as ServerError).message ?? "") ||
            "The server rejected this change.";
      });
      changed();
      continue;
    }
    if (!active()) return;
    await transact(account, (s) => {
      const current = s.records[sent.id];
      s.outbox = s.outbox.filter((x) => x.opId !== sent.opId);
      if (!current) return;
      if (result.conflict) {
        current.conflict = result.record;
        return;
      }
      current.revision = result.record.revision;
      current.dirty = current.localVersion !== sent.localVersion;
    });
    changed();
  }
  // A per-user server lock orders writes, so the cursor only moves forward.
  while (active()) {
    const state = await readAccount(account);
    const rows = await transport.pull(state.cursor);
    if (!active()) return;
    // Rows this version cannot read (e.g. written by a newer app) are kept aside
    // and retried after an update, instead of stopping every later download.
    const accepted = new Set(rows.filter(readable).map((row) => row.id));
    await transact(account, (s) => {
      for (const parked of Object.values(s.quarantine ?? {}))
        if (readable(parked)) {
          applyRemote(s, parked);
          delete s.quarantine![parked.id];
        }
      for (const row of rows) {
        if (accepted.has(row.id)) {
          applyRemote(s, row);
          delete s.quarantine?.[row.id];
        } else (s.quarantine ??= {})[row.id] = row;
        s.cursor = Math.max(s.cursor, row.change_seq);
      }
    });
    changed();
    if (rows.length < 200) break;
  }
}

const resend = (op: Operation): Operation => ({
  ...op,
  opId: crypto.randomUUID(),
  baseRevision: 0,
});
