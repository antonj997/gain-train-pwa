import { transact, readAccount } from "./database";
import {
  type RemoteDoc,
  type Operation,
  type LocalState,
  validate,
} from "./model";
export interface Transport {
  push: (op: Operation) => Promise<{ record: RemoteDoc; conflict?: boolean }>;
  pull: (cursor: number) => Promise<RemoteDoc[]>;
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
        const r = Object.values(s.records).find((r) => r.dirty && !r.conflict);
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
    const result = await transport.push(op);
    if (!active()) return;
    await transact(account, (s) => {
      const current = s.records[op!.id];
      s.outbox = s.outbox.filter((x) => x.opId !== op!.opId);
      if (!current) return;
      if (result.conflict) {
        current.conflict = result.record;
        return;
      }
      current.revision = result.record.revision;
      current.dirty = current.localVersion !== op!.localVersion;
    });
    changed();
  }
  // A per-user server lock orders writes. A page is not committed locally until all rows validate.
  while (active()) {
    const state = await readAccount(account);
    const rows = await transport.pull(state.cursor);
    if (!active()) return;
    for (const row of rows) validate(row.kind, row.payload);
    await transact(account, (s) => {
      for (const row of rows) {
        const current = s.records[row.id];
        if (!current || (!current.dirty && row.revision > current.revision)) {
          s.records[row.id] = {
            ...row,
            localVersion: current?.localVersion ?? 0,
            dirty: false,
          };
        } else if (
          current.dirty &&
          row.revision > current.revision &&
          !s.outbox.some((o) => o.id === row.id)
        ) {
          current.conflict = row;
        }
        s.cursor = Math.max(s.cursor, row.change_seq);
      }
    });
    changed();
    if (rows.length < 200) break;
  }
}
