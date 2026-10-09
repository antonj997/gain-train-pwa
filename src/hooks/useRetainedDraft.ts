import { useState } from "react";
import { readDraft, writeDraft } from "@/lib/drafts";

export function useRetainedDraft<T>(
  key: string,
  parse: (value: unknown) => T | null,
) {
  const [entry, setEntry] = useState(() => ({
    key,
    value: readDraft(localStorage, key, parse),
  }));
  const [retained, setRetained] = useState(true);
  const value =
    entry.key === key ? entry.value : readDraft(localStorage, key, parse);
  const replace = (next: T | null) => {
    setEntry({ key, value: next });
    setRetained(writeDraft(localStorage, key, next));
  };
  return { value, replace, retained };
}
