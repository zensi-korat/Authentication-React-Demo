import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { consumersColumns } from "@/features/consumers/consumers-page.columns";
import { useConsumers } from "@/features/consumers/get/useConsumers";

export default function ConsumersListPage() {
  const navigate = useNavigate();

  // The browser URL is the single source of truth. `useSearchParams` reads and
  // writes the "?..." part of the address bar, e.g.
  //   /consumers?search=jane&page=2&pageSize=10&sort=name&dir=asc
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper: change some query params while KEEPING the rest. Passing `undefined`
  // removes a param, which keeps the URL clean (e.g. no ?page=1).
  function updateParams(changes: Record<string, string | number | undefined>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
           console.log(`Changed ${key} to ${value}`);
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace: true }, // don't stack a new history entry on every keystroke
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SEARCH   —   URL param:  ?search=
  // ═══════════════════════════════════════════════════════════════════════
  const search = searchParams.get("search") ?? ""; // read the term from the URL

  // The box updates instantly as you type (local state); we only push it into
  // the URL 400ms after typing stops (debounce), and reset to page 1 then.
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ search: searchInput || undefined, page: undefined });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ═══════════════════════════════════════════════════════════════════════
  //  PAGINATION   —   URL params:  ?page=  &  ?pageSize=
  // ═══════════════════════════════════════════════════════════════════════
  const page = Number(searchParams.get("page")) || 1; // read from URL (default 1)
  const pageSize = Number(searchParams.get("pageSize")) || 10; // (default 10)

  // Changing the page just changes the URL param; the fetch reacts to that.
  const goToPage = (p: number) => updateParams({ page: p > 1 ? p : undefined });
  // Changing rows-per-page resets to page 1 (a page-5 might no longer exist).
  const changePageSize = (size: number) => updateParams({ pageSize: size, page: undefined });

  // ── Fetch the data. Re-runs whenever any URL-derived value above changes. ──
  const { consumers, total, isLoading, isError, error } = useConsumers({
    search,
    page,
    pageSize,
  });

  // Pagination display numbers — computed here because they need `total`, which
  // only the server can tell us (there are `total` rows across ALL pages).
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // The three states (loading / error / data) are picked here with plain early
  // returns instead of a nested ternary inside JSX — same output, easier to read.
  function renderContent() {
    if (isLoading) {
      return (
        <div className="space-y-3" aria-busy="true" aria-label="Loading consumers">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 py-16 text-center"
          role="alert"
        >
          <p className="text-sm font-medium">Failed to load consumers</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
        </div>
      );
    }

    return (
      <>
        {/* The table just renders the rows the server already paged for us,
            so we turn OFF its built-in pagination. */}
        <DataTable
          columns={consumersColumns}
          data={consumers}
          showPagination={false}
          emptyMessage="No consumers found."
          onRowClick={(consumer) => navigate(`/consumers/${consumer.id}`)}
        />

        {/* ── PAGINATION controls (raw, no library) ──────────────────── */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {start}–{end} of {total} results
          </div>

          <div className="flex items-center gap-2">
            {/* Rows-per-page */}
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Go to previous page"
            >
              Previous
            </Button>

            <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="size-8"
                  onClick={() => goToPage(p)}
                  aria-label={`Go to page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="border-b bg-background px-4 md:px-6 py-3 md:py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Consumers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search, pagination and sorting live in the URL and run on the
              server — try editing the address bar or refreshing the page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* SEARCH input — typing updates local state; the debounce above
                pushes it into the URL. */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Search consumers..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
                aria-label="Search consumers"
              />
            </div>

            <Button className="gap-2" onClick={() => navigate("/consumers/add")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Consumer
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">{renderContent()}</div>
    </div>
  );
}
