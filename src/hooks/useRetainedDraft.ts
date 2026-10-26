import { useState } from "react";
import { readDraft, writeDraft } from "@/lib/drafts";
import { local } from "@/lib/storage";

export function useRetainedDraft<T>(
  key: string,
  parse: (value: unknown) => T | null,
) {
  const [entry, setEntry] = useState(() => ({
    key,
    value: readDraft(local, key, parse),
  }));
  const [retained, setRetained] = useState(true);
  const value =
    entry.key === key ? entry.value : readDraft(local, key, parse);
  const replace = (next: T | null) => {
    setEntry({ key, value: next });
    setRetained(writeDraft(local, key, next));
  };
  return { value, replace, retained };
}
