
import {
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type ColumnFiltersState,
  type ExpandedState,
  type Row,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, type ReactNode, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "./button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchValue?: string;
  searchColumn?: string;
  pageSize?: number;
  showPagination?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  /**
   * Accessible label for the table element (e.g. "Units list").
   * Required by WCAG 1.3.1 / 4.1.2 — passes as aria-label on <Table>.
   */
  tableLabel?: string;
  /**
   * Render an expandable sub-row beneath a row. Use the row's
   * `getToggleExpandedHandler()` / `getIsExpanded()` from a column cell to
   * drive expansion. The returned node is placed in a full-width cell.
   */
  renderSubRow?: (row: TData) => ReactNode;
  /** When true, only one row can be expanded at a time. */
  singleExpand?: boolean;
  /** When true, clicking anywhere on a row toggles its expansion (requires renderSubRow). */
  expandOnRowClick?: boolean;
  /**
   * Controlled sorting. Pass these to drive sorting from the PARENT (e.g. for
   * server-side sorting). When `manualSorting` is true, the table does NOT
   * reorder rows itself — it just reports header clicks via `onSortingChange`,
   * and you re-fetch already-sorted rows. Leave all three out for the default
   * client-side sorting.
   */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchValue,
  searchColumn,
  pageSize = 10,
  showPagination = true,
  emptyMessage = "No results found.",
  onRowClick,
  rowClassName,
  tableLabel,
  renderSubRow,
  singleExpand,
  expandOnRowClick,
  sorting,
  onSortingChange,
  manualSorting,
}: DataTableProps<TData, TValue>) {
  // If the parent passes `sorting`/`onSortingChange`, sorting is CONTROLLED by
  // the parent; otherwise fall back to this internal state (client-side).
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const sortingState = sorting ?? internalSorting;
  const handleSortingChange = onSortingChange ?? setInternalSorting;

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    manualSorting, // when true, don't reorder rows here — the server already did
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: showPagination ? getPaginationRowModel() : undefined,
    getExpandedRowModel: renderSubRow ? getExpandedRowModel() : undefined,
    getRowCanExpand: renderSubRow ? () => true : undefined,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: (updater) => {
      setExpanded((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        if (!singleExpand || next === true) return next;
        const openKeys = Object.keys(next).filter((k) => (next as Record<string, boolean>)[k]);
        const oldKeys =
          old === true ? [] : Object.keys(old).filter((k) => (old as Record<string, boolean>)[k]);
        // Keep only the newly-opened row.
        const added = openKeys.find((k) => !oldKeys.includes(k));
        return added ? { [added]: true } : {};
      });
    },
    state: {
      sorting: sortingState,
      columnFilters,
      globalFilter: searchValue,
      expanded,
    },
    onGlobalFilterChange: () => {},
    globalFilterFn: "includesString",
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border overflow-x-auto">
        <Table aria-label={tableLabel}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} scope="col" className={cn((header.column.columnDef.meta as any)?.className)}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        className="h-auto !p-0 hover:bg-transparent font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={`Sort by ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : "column"}${header.column.getIsSorted() === "asc" ? ", sorted ascending" : header.column.getIsSorted() === "desc" ? ", sorted descending" : ""}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="ml-2 size-4" aria-hidden="true" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="ml-2 size-4" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown className="ml-2 size-4 opacity-50" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {header.column.getIsSorted() === "asc"
                            ? ", sorted ascending, activate to sort descending"
                            : header.column.getIsSorted() === "desc"
                            ? ", sorted descending, activate to remove sort"
                            : ", activate to sort ascending"}
                        </span>
                      </Button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody aria-live="polite" aria-relevant="all">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row: Row<TData>) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={(row.getIsSelected() || row.getIsExpanded()) && "selected"}
                    className={cn((onRowClick || (expandOnRowClick && renderSubRow)) ? "cursor-pointer" : "", rowClassName?.(row.original))}
                    role={(onRowClick || (expandOnRowClick && renderSubRow)) ? "button" : undefined}
                    tabIndex={(onRowClick || (expandOnRowClick && renderSubRow)) ? 0 : undefined}
                    onClick={() => {
                      onRowClick?.(row.original);
                      if (expandOnRowClick && renderSubRow) row.toggleExpanded();
                    }}
                    onKeyDown={(e) => {
                      if ((onRowClick || (expandOnRowClick && renderSubRow)) && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick?.(row.original);
                        if (expandOnRowClick && renderSubRow) row.toggleExpanded();
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cn((cell.column.columnDef.meta as any)?.className)}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubRow && row.getIsExpanded() && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                        {renderSubRow(row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <div
            className="text-sm text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            Showing{" "}
            {table.getFilteredRowModel().rows.length === 0
              ? 0
              : table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                1}
            –
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{" "}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-29" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 / page</SelectItem>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
            {table.getPageCount() > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
                  {Array.from({ length: table.getPageCount() }, (_, i) => (
                    <Button
                      key={i}
                      variant={
                        table.getState().pagination.pageIndex === i
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="size-8"
                      onClick={() => table.setPageIndex(i)}
                      aria-label={`Go to page ${i + 1}`}
                      aria-current={table.getState().pagination.pageIndex === i ? "page" : undefined}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  Next
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
