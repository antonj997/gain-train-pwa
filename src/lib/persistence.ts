import { local, storageKeys, writeStored } from "./storage";

/** Asks the browser not to evict this app's storage. Resolves to whether it is protected. */
export async function requestPersistentStorage() {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist) return false;
  if (await storage.persisted?.()) return true;
  return storage.persist();
}

// Browsers may clear storage for sites used rarely. Ask once, after the first
// finished workout, when there is real data worth protecting.
export function requestPersistenceOnce() {
  if (local.getItem(storageKeys.persistRequested)) return;
  writeStored(storageKeys.persistRequested, "true");
  void requestPersistentStorage().catch(() => {});
}
