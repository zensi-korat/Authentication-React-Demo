import type { AccountStatus } from "./types";

export const ACCOUNT_STATUS_CONFIG: Record<
  AccountStatus,
  { label: string; variant: "green" | "amber" | "red" }
> = {
  active: { label: "Active", variant: "green" as const },
  delinquent: { label: "Delinquent", variant: "amber" as const },
  inactive: { label: "Inactive", variant: "red" as const },
};
