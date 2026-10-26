import { writeStored } from "./storage";

// Tells other open tabs to reload the log after a local write. Older Safari has
// no BroadcastChannel, so fall back to a storage event there.
const CHANNEL = "gain-train";
const FALLBACK_KEY = "gt-tab-change";
const hasChannel = () => typeof BroadcastChannel === "function";
let sender: BroadcastChannel | undefined;

export function notifyOtherTabs() {
  if (hasChannel()) (sender ??= new BroadcastChannel(CHANNEL)).postMessage(1);
  else writeStored(FALLBACK_KEY, String(Date.now()));
}

/** Calls `listener` when another tab changed the log. Returns an unsubscribe function. */
export function onOtherTabChange(listener: () => void) {
  if (hasChannel()) {
    // A channel never receives its own messages, so listen on a separate one.
    const receiver = new BroadcastChannel(CHANNEL);
    receiver.onmessage = listener;
    return () => receiver.close();
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === FALLBACK_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
