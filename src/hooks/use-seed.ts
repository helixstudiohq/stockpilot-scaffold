import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads the deterministic sample dataset when the database is empty.
 *
 * The mutation is idempotent (no-ops when data exists), so the dashboard can
 * trigger it automatically on first load; there is no manual seeding step in
 * the demo. One attempt per mount, with an explicit retry for failures.
 */
export function useSeedDemoData() {
  const seed = useMutation(api.seed.seedDemoData);
  const [state, setState] = useState<"idle" | "seeding" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const run = useCallback(async () => {
    setState("seeding");
    setError(null);
    try {
      await seed({});
      setState("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sample data",
      );
      setState("error");
    }
  }, [seed]);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void run();
  }, [run]);

  return { state, error, retry: run };
}
