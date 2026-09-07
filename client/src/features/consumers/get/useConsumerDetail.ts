import { useEffect, useState } from "react";
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

// The exact shape the server sends back for GET /api/consumers/:id.
interface ConsumerResponse {
  consumer: Consumer;
}

/** GET a single consumer by id. */
export function useConsumerDetail(id: string) {
  const [consumer, setConsumer] = useState<Consumer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // `useEffect` runs after render and re-runs whenever `id` changes (see the
  // dependency array at the bottom). That's exactly what we want: navigate to a
  // different consumer → new id → fetch the new one.
  useEffect(() => {
    // `ignore` guards against a "race": if `id` changes (or the component
    // unmounts) before this fetch finishes, we skip setting state so a slow,
    // outdated response can't overwrite the newer one.
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      try {
        // The id is dropped into the URL path (a "route parameter").
        const { data } = await api.get<ConsumerResponse>(`/consumers/${id}`);
        if (!ignore) setConsumer(data.consumer);
      } catch (err) {

        if (!ignore) {
          setIsError(true);
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }

      } finally {
        if (!ignore) setIsLoading(false);
        
      }
    }

    load();

    // Cleanup: React runs this before the next effect run and on unmount. We
    // flip `ignore` so the in-flight request above becomes a no-op.
    return () => {
      ignore = true;
    };
  }, [id]);

  return { consumer, isLoading, isError, error };
}
