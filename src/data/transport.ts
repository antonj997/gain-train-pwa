import type { SupabaseClient } from "@supabase/supabase-js";
import type { RemoteDoc } from "./model";
import type { Transport } from "./sync";

/** Rows per download page; `syncAccount` stops paging on a shorter page. */
export const PULL_PAGE_SIZE = 200;

/** The sync transport over Supabase: the `sync_gain_record` RPC and a `gain_records` cursor read. */
export function supabaseTransport(client: SupabaseClient): Transport {
  return {
    push: async (op) => {
      const { data, error } = await client.rpc("sync_gain_record", {
        p_id: op.id,
        p_kind: op.kind,
        p_payload: op.payload,
        p_deleted: op.deleted,
        p_base_revision: op.baseRevision,
        p_op_id: op.opId,
      });
      if (error) throw error;
      return data as { record: RemoteDoc; conflict?: boolean };
    },
    pull: async (cursor) => {
      const { data, error } = await client
        .from("gain_records")
        .select("id,kind,payload,revision,deleted,change_seq")
        .gt("change_seq", cursor)
        .order("change_seq")
        .limit(PULL_PAGE_SIZE);
      if (error) throw error;
      return data as RemoteDoc[];
    },
  };
}
