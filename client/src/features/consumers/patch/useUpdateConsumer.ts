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

export type UpdateConsumerInput = Partial<Omit<Consumer, "id" | "consumerNumber">>;

/** PATCH a consumer — a PARTIAL UPDATE (send only changed fields). */
export function useUpdateConsumer() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (id: string, input: UpdateConsumerInput): Promise<Consumer> => {
      setIsPending(true);
      setError(null);
      try {
        // ══════════════════════════════════════════════════════════════
        // 👉 DEMO STEP 4 — PATCH (partial update)
        // ══════════════════════════════════════════════════════════════
        /*
        const res = await fetch(`/api/consumers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input), // ONLY the changed fields
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to update consumer");
        }
        const data: ConsumerResponse = await res.json();
        return data.consumer;
        */

        // Runs while PATCH is OFF (becomes unreachable once enabled above).
        throw new Error("PATCH is not wired up yet — enable it in DEMO STEP 4");
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
