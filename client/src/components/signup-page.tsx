import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { api } from "@/lib/axios";
import { isAxiosError } from "axios";

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      const message = "Passwords do not match";
      setError(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Just creates the account — no cookies are set here. The account
      // starts unverified (email_verified: false server-side), so we send
      // the user to enter the OTP we just generated before they can log in.
      const { data } = await api.post<{ devCode?: string }>("/auth/signup", { email, password });

      // Demo-only: the server echoes the raw OTP back so we can print it
      // here instead of you having to go dig through the server terminal.
      // A real app would never do this — the code would only ever exist in
      // the email itself.
      if (data.devCode) {
        console.log(`[DEV] Verification code for ${email}: ${data.devCode}`);
      }

      toast.success("Account created. Check your email for a verification code.");
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? (err.response?.data?.message ?? "Signup failed")
        : "Something went wrong.";
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
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Sign up to access the consumers dashboard.</CardDescription>
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
              <PasswordInput
                id="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? "Creating account..." : "Sign up"}
            </Button>
            <div className="relative text-center text-xs text-muted-foreground">
              <span className="bg-card px-2 relative z-10">or</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <GoogleSignInButton />
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
