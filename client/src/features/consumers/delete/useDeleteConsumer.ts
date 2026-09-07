import { useState, useCallback } from "react";
import { api } from "@/lib/axios";

/** DELETE a consumer by id. */
export function useDeleteConsumer() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<void> => {
    setIsPending(true);
    setError(null);
    try {
      // ══════════════════════════════════════════════════════════════════
      // 👉 DEMO STEP 5 — DELETE (remove)
      // ══════════════════════════════════════════════════════════════════
      /*
      await api.delete(`/consumers/${id}`);
      return;
      */

      // Runs while DELETE is OFF (becomes unreachable once enabled above).
      throw new Error("DELETE is not wired up yet — enable it in DEMO STEP 5");
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Unknown error");
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { mutate, isPending, error };
}
