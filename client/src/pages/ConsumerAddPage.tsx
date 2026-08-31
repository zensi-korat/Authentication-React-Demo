import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateConsumer } from "@/features/consumers/post/useCreateConsumer";
import type { AccountStatus } from "@/features/consumers/types";

export default function ConsumerAddPage() {
  const navigate = useNavigate();
  const { mutate, isPending, error } = useCreateConsumer();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");

  async function handleSubmit(e: { preventDefault: () => void; }) {
    e.preventDefault();
    try {
      await mutate({ firstName, middleName, lastName, email, accountStatus });
      toast.success("Consumer created");
      navigate("/consumers");
    } catch {
      toast.error("Failed to create consumer");
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Add Consumer</CardTitle>
          <CardDescription>
            Uses the useCreateConsumer mutation hook — a plain POST via fetch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error.message}
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/consumers")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
