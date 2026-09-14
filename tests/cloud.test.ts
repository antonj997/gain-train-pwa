import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { transact, readAccount } from "../src/data/database";
import { syncAccount, type Transport } from "../src/data/sync";
import { type RemoteDoc } from "../src/data/model";

// Optional integration test: a disposable confirmed account is required.
// Never put test passwords or service-role credentials in the repository.
test(
  "real Supabase: offline queue, lost acknowledgement, newer edit and retry",
  { skip: !process.env.QA_EMAIL },
  async () => {
    const env = Object.fromEntries(
      readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .filter((x) => x.includes("="))
        .map((x) => {
          const i = x.indexOf("=");
          return [x.slice(0, i), x.slice(i + 1).replace(/^"|"$/g, "")];
        }),
    );
    const client = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const login = await client.auth.signInWithPassword({
      email: process.env.QA_EMAIL!,
      password: process.env.QA_PASSWORD!,
    });
    assert.equal(login.error, null);
    const account = login.data.user!.id,
      id = crypto.randomUUID();
    const transport: Transport = {
      async push(op) {
        const { data, error } = await client.rpc("sync_gain_record", {
          p_id: op.id,
          p_kind: op.kind,
          p_payload: op.payload,
          p_deleted: op.deleted,
          p_base_revision: op.baseRevision,
          p_op_id: op.opId,
        });
        if (error) throw error;
        return data;
      },
      async pull(cursor) {
        const { data, error } = await client
          .from("gain_records")
          .select("id,kind,payload,revision,deleted,change_seq")
          .gt("change_seq", cursor)
          .order("change_seq")
          .limit(200);
        if (error) throw error;
        return data as RemoteDoc[];
      },
    };
    await transact(account, (s) => {
      s.records[id] = {
        id,
        kind: "workout",
        payload: {
          name: "QA offline sync",
          date: "2026-09-14",
          status: "draft",
          duration: null,
          startedAt: null,
          exercises: [],
        },
        revision: 0,
        localVersion: 1,
        dirty: true,
        deleted: false,
      };
    });
    await assert.rejects(
      syncAccount(
        account,
        {
          ...transport,
          push: async () => {
            throw Error("Offline");
          },
        },
        () => {},
      ),
    );
    assert.equal((await readAccount(account)).records[id].dirty, true);
    await assert.rejects(
      syncAccount(
        account,
        {
          ...transport,
          push: async (op) => {
            await transport.push(op);
            throw Error("Acknowledgement lost");
          },
        },
        () => {},
      ),
    );
    await transact(account, (s) => {
      s.records[id].payload.name = "QA newer edit";
      s.records[id].localVersion++;
    });
    await syncAccount(account, transport, () => {});
    const { data, error } = await client
      .from("gain_records")
      .select("revision,payload")
      .eq("id", id)
      .single();
    assert.equal(error, null);
    assert.equal(data!.revision, 2);
    assert.equal(data!.payload.name, "QA newer edit");
    assert.equal((await readAccount(account)).records[id].dirty, false);
    await transact(account, (s) => {
      s.records[id].deleted = true;
      s.records[id].dirty = true;
      s.records[id].localVersion++;
    });
    await syncAccount(account, transport, () => {});
    await client.auth.signOut();
  },
);
