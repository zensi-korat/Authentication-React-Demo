
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Consumer } from "./types";
import { ACCOUNT_STATUS_CONFIG } from "./consumers-page.data";

function getFullName(consumer: Consumer) {
  const parts = [consumer.firstName, consumer.middleName, consumer.lastName];
  return parts.filter(Boolean).join(" ");
}

export const consumersColumns: ColumnDef<Consumer>[] = [
  {
    accessorKey: "consumerNumber",
    header: "ID",
    cell: ({ row }) => {
      const number = row.getValue("consumerNumber") as number;
      return (
        <span className="font-mono font-medium" title={row.original.id}>
          #{number}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    id: "name",
    accessorFn: (row) => getFullName(row),
    header: "Consumer Name",
    enableSorting: false,
  },
  {
    accessorKey: "accountStatus",
    header: "Account Status",
    cell: ({ row }) => {
      const status = row.getValue("accountStatus") as Consumer["accountStatus"];
      return (
        <Badge variant={ACCOUNT_STATUS_CONFIG[status].variant}>
          {ACCOUNT_STATUS_CONFIG[status].label}
        </Badge>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "email",
    header: "Email",
    enableSorting: false,
  },
];
