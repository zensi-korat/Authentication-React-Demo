import { useState, useCallback } from "react";

// ── Types (kept in this file so the whole hook is self-contained) ───────────
type AccountStatus = "active" | "delinquent" | "inactive";

interface Consumer {
  id: string;
  consumerNumber: number;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  accountStatus: AccountStatus;
}

interface ConsumerResponse {
  consumer: Consumer;
}

export type ReplaceConsumerInput = Omit<Consumer, "id" | "consumerNumber">;

/** PUT a consumer — a FULL REPLACE (send every field). */
export function useReplaceConsumer() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (id: string, input: ReplaceConsumerInput): Promise<Consumer> => {
      setIsPending(true);
      setError(null);
      try {
        // ══════════════════════════════════════════════════════════════
        // 👉 DEMO STEP 3 — PUT (full replace)
        // ══════════════════════════════════════════════════════════════
        /*
        const res = await fetch(`/api/consumers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input), // the WHOLE object — every field
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to replace consumer");
        }
        const data: ConsumerResponse = await res.json();
        return data.consumer;
        */

        // Runs while PUT is OFF (becomes unreachable once enabled above).
        throw new Error("PUT is not wired up yet — enable it in DEMO STEP 3");
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Unknown error");
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { mutate, isPending, error };
}
