import { useEffect, useState } from "react";

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

// The server returns the page of rows PLUS the total match count.
interface ConsumersResponse {
  consumers: Consumer[];
  total: number;
  page: number;
  pageSize: number;
}

// What the caller (the page) passes in to control search + pagination.
interface UseConsumersParams {
  search: string;
  page: number;
  pageSize: number;
}

/**
 * GET the consumers list from the server (search + pagination via query params).
 */
export function useConsumers({ search, page, pageSize }: UseConsumersParams) {
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setIsError(false);
      setError(null);


      // ══════════════════════════════════════════════════════════════════
      // 👉 DEMO STEP 1 — GET (read the list)
      // ══════════════════════════════════════════════════════════════════

      try {
        // Build the URL: /api/consumers?search=...&page=...&pageSize=...
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/consumers?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Failed to load consumers");
        }
        const data: ConsumersResponse = await res.json();
        if (!ignore) {
          setConsumers(data.consumers);
          setTotal(data.total);
        }
      } catch (err) {
        if (!ignore) {
          setIsError(true);
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
      

      // Placeholder while GET is OFF: show an empty list (no spinner).
      // Harmless to leave here once the block above is enabled.
      if (!ignore) setIsLoading(false);
    }

    load();

    return () => {
      ignore = true;
    };
  }, [search, page, pageSize]);

  return { consumers, total, isLoading, isError, error };
}
