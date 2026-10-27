/** The message of a thrown Error, or `fallback` for anything else. */
export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
