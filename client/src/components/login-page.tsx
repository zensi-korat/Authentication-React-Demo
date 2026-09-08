import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import { api } from "@/lib/axios";
import { isAxiosError } from "axios";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setIsSubmitting(true);

    try {
      // POSTs to our own API (same-origin, via the Vite proxy) so the server
      // can set the httpOnly access_token/refresh_token cookies — page JS
      // never touches the token itself.
      //
      // Unlike fetch, axios throws automatically for non-2xx responses — no
      // manual `if (!res.ok)` check needed. A wrong password (401) lands
      // directly in the catch block below via a rejected promise.
      await api.post("/auth/login", { email, password });

      // Re-run /api/auth/me so the AuthProvider picks up the new cookie
      // before we navigate — otherwise RequireAuth would still think we're
      // logged out for a moment.
      await refresh();
      navigate("/");
    } catch (err) {
      // isAxiosError narrows the type so TypeScript knows `err.response` and
      // `err.response.data` exist — axios's own error shape, not a plain Error.
      const message = isAxiosError<{ message?: string; code?: string }>(err)
        ? (err.response?.data?.message ?? "Login failed")
        : "Something went wrong.";
      // A 403 with this code means the password was right but the account
      // hasn't completed the OTP email-verification step yet — point the
      // user at /verify-email instead of just showing a dead-end error.
      if (isAxiosError<{ code?: string }>(err) && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      }
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Fetch API Demo</CardTitle>
          <CardDescription>Sign in to view the consumers dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
                {needsVerification && (
                  <>
                    {" "}
                    <Link
                      to={`/verify-email?email=${encodeURIComponent(email)}`}
                      className="underline underline-offset-2"
                    >
                      Verify now
                    </Link>
                  </>
                )}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="underline underline-offset-2">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
