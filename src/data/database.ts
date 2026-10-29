import { emptyState, type LocalState } from "./model";
import { local, storageKeys } from "../lib/storage";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("gain-train-v2", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("accounts");
    r.onsuccess = () => {
      // Let a newer app version in another tab upgrade the database; this tab
      // reopens on its next read or write.
      r.result.onversionchange = () => {
        r.result.close();
        if (dbPromise === opening) dbPromise = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
  // Don't cache a failure: storage can become available again.
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = undefined;
  });
  return (dbPromise = opening);
}
export async function readAccount(account: string) {
  if (local.getItem(storageKeys.deleted(account))) return emptyState();
  const d = await db();
  return new Promise<LocalState>((resolve, reject) => {
    const r = d.transaction("accounts").objectStore("accounts").get(account);
    r.onsuccess = () => resolve(r.result ?? emptyState());
    r.onerror = () => reject(r.error);
  });
}
export async function transact(
  account: string,
  change: (state: LocalState) => void,
) {
  const d = await db();
  return new Promise<LocalState>((resolve, reject) => {
    const tx = d.transaction("accounts", "readwrite");
    const store = tx.objectStore("accounts");
    const r = store.get(account);
    let next: LocalState;
    r.onsuccess = () => {
      try {
        if (local.getItem(storageKeys.deleted(account)))
          throw Error("This account was deleted.");
        next = r.result ?? emptyState();
        change(next);
        store.put(next, account);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? Error("Could not save on this device."));
  });
}
export async function eraseAccount(account: string) {
  local.setItem(storageKeys.deleted(account), "true");
  local.removeItem(storageKeys.legacyPlan(account));
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("accounts", "readwrite");
    tx.objectStore("accounts").delete(account);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    // A transaction can also end by aborting (for example over quota) without
    // an error event; without this the caller would wait forever.
    tx.onabort = () =>
      reject(tx.error ?? Error("Could not erase this account's log."));
  });
}
