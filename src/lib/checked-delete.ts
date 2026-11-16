import { local, storageKeys, writeStored, type KeyValueStorage } from "./storage";

/**
 * Swiping a checked set away in a live workout asks first, once per device:
 * after Delete or Cancel it never asks again. Unchecked sets never ask. The
 * row is components/gestures/SetSwipeRow.tsx.
 */

// Storage can refuse a write (private browsing): the answer still holds for
// this visit.
let answered = false;

/** Whether this device has answered the question already. */
export function checkedDeleteAsked(storage: KeyValueStorage = local) {
  if (answered) return true;
  try {
    return storage.getItem(storageKeys.checkedDeleteAsked) === "true";
  } catch {
    return false;
  }
}

/** Delete or Cancel was chosen: the question never comes back. */
export function markCheckedDeleteAsked(storage: KeyValueStorage = local) {
  answered = true;
  return writeStored(storageKeys.checkedDeleteAsked, "true", storage);
}

/** Whether a swipe past the threshold asks before it deletes. */
export const asksBeforeDelete = (checked: boolean, asked: boolean) =>
  checked && !asked;

/** For tests: forget this visit's answer. */
export function resetCheckedDeleteAnswer() {
  answered = false;
}
