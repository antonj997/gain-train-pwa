import { z } from "zod";
import type { RecordDoc } from "../data/model";
import { isoDate } from "./dates";

const FORMAT = "gain-train";
const VERSION = 2;
/** Larger files are refused before they are read. */
export const MAX_BACKUP_BYTES = 20_000_000;

/** The file name for a backup made at `now`, dated in local time. */
export const backupFileName = (now = new Date()) =>
  `gain-train-backup-${isoDate(now)}.json`;

/** A backup file's text: every record, deleted ones included. */
export function serializeBackup(
  records: readonly RecordDoc[],
  now = new Date(),
) {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exportedAt: now.toISOString(),
      records,
    },
    null,
    2,
  );
}

// The envelope only: each record's payload is checked by the import itself.
const envelope = z.object({
  format: z.literal(FORMAT),
  version: z.literal(VERSION),
  records: z
    .array(
      z
        .object({
          id: z.string(),
          kind: z.string(),
          payload: z.unknown(),
          deleted: z.boolean().optional().default(false),
        })
        .passthrough(),
    )
    .max(10000),
});

export class BackupError extends Error {}

/** The records in a backup file's text. Throws BackupError for anything else. */
export function parseBackup(text: string): RecordDoc[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This is not a Gain Train backup.");
  }
  const result = envelope.safeParse(data);
  if (!result.success)
    throw new BackupError(
      (data as { format?: unknown })?.format === FORMAT
        ? "This backup is damaged or from an unsupported version."
        : "This is not a Gain Train backup.",
    );
  return result.data.records as unknown as RecordDoc[];
}
