import { emptyState, type LocalState } from "./model";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("gain-train-v2", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("accounts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function readAccount(account: string) {
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
