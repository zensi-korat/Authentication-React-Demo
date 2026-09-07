import { useState, useCallback } from "react";
import { api } from "@/lib/axios";

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
        
        const { data } = await api.post<ConsumerResponse>("/consumers", input);
        return data.consumer;
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
