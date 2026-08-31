import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

export default function DashboardHome() {
  const { user } = useAuth();

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome, {user?.email ?? "there"}</CardTitle>
          <CardDescription>
            This is the fetch-only demo dashboard. Every screen in this app is
            wired up with raw <code>fetch</code> calls instead of axios or
            React Query — the goal is to see, in plain code, what a data
            library normally hides: manual loading/error state, request
            de-duplication, and a tiny hand-rolled cache.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/consumers">Go to Consumers</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
