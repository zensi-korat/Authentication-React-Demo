import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConsumerDetail } from "@/features/consumers/get/useConsumerDetail";
import { useUpdateConsumer, type UpdateConsumerInput } from "@/features/consumers/patch/useUpdateConsumer";
import { useReplaceConsumer } from "@/features/consumers/put/useReplaceConsumer";
import type { AccountStatus } from "@/features/consumers/types";

export default function ConsumerEditPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 1. GET the existing consumer to pre-fill the form.
  const { consumer, isLoading, isError } = useConsumerDetail(id);

  // 2. The two mutation hooks we're demonstrating.
  const { mutate: patchConsumer, isPending: isPatching } = useUpdateConsumer();
  const { mutate: putConsumer, isPending: isPutting } = useReplaceConsumer();

  // Editable form fields.
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");

  // Once the consumer arrives, copy its values into the form fields.
  useEffect(() => {
    if (!consumer) return;
    setFirstName(consumer.firstName);
    setMiddleName(consumer.middleName);
    setLastName(consumer.lastName);
    setEmail(consumer.email);
    setAccountStatus(consumer.accountStatus);
  }, [consumer]);

  // ── PATCH: send ONLY the fields that actually changed ─────────────────────
  async function handlePatch(e: { preventDefault: () => void; }) {
    e.preventDefault();
    if (!consumer) return;

    // Compare each field to the original and collect just the differences.
    const changes: UpdateConsumerInput = {};
    if (firstName !== consumer.firstName) changes.firstName = firstName;
    if (middleName !== consumer.middleName) changes.middleName = middleName;
    if (lastName !== consumer.lastName) changes.lastName = lastName;
    if (email !== consumer.email) changes.email = email;
    if (accountStatus !== consumer.accountStatus) changes.accountStatus = accountStatus;

    if (Object.keys(changes).length === 0) {
      toast.info("Nothing changed — no PATCH sent.");
      return;
    }

    try {
      await patchConsumer(id, changes);
      toast.success(`Saved via PATCH (${Object.keys(changes).join(", ")})`);
      navigate(`/consumers/${id}`);
    } catch {
      toast.error("Failed to update consumer");
    }
  }

  // ── PUT: send the WHOLE record, replacing every field ─────────────────────
  async function handlePut() {
    if (!consumer) return;
    try {
      await putConsumer(id, { firstName, middleName, lastName, email, accountStatus });
      toast.success("Replaced via PUT (all fields sent)");
      navigate(`/consumers/${id}`);
    } catch {
      toast.error("Failed to replace consumer");
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3 max-w-xl">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError || !consumer) {
    return (
      <div className="p-4 md:p-6" role="alert">
        <p className="text-sm font-medium">Failed to load consumer</p>
      </div>
    );
  }

  const isBusy = isPatching || isPutting;

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Edit Consumer</CardTitle>
          <CardDescription>
            "Save changes" sends a <strong>PATCH</strong> with only the fields you
            edited. "Replace all" sends a <strong>PUT</strong> with the entire
            record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePatch} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="middleName">Middle name</Label>
              <Input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="accountStatus">Account status</Label>
              <Select
                value={accountStatus}
                onValueChange={(v) => setAccountStatus(v as AccountStatus)}
              >
                <SelectTrigger id="accountStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="delinquent">Delinquent</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <Button type="submit" disabled={isBusy}>
                {isPatching ? "Saving..." : "Save changes (PATCH)"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handlePut}
                disabled={isBusy}
              >
                {isPutting ? "Replacing..." : "Replace all (PUT)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/consumers/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
