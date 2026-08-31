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

export type CreateConsumerInput = Omit<Consumer, "id" | "consumerNumber">;

/** POST a new consumer. */
export function useCreateConsumer() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (input: CreateConsumerInput): Promise<Consumer> => {
      setIsPending(true);
      setError(null);
      try {
        // ══════════════════════════════════════════════════════════════
        // 👉 DEMO STEP 2 — POST (create)
        // ══════════════════════════════════════════════════════════════
        
        const res = await fetch("/api/consumers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to create consumer");
        }
        const data: ConsumerResponse = await res.json();
        return data.consumer;
        

        // Runs while POST is OFF (becomes unreachable once enabled above).
        throw new Error("POST is not wired up yet — enable it in DEMO STEP 2");
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
