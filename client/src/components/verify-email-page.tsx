import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OtpInput } from "@/components/ui/otp-input";
import { api } from "@/lib/axios";
import { isAxiosError } from "axios";

const CODE_LENGTH = 6;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post("/auth/verify-otp", { email, code });
      toast.success("Email verified. Sign in to continue.");
      navigate("/login");
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err)
        ? (err.response?.data?.message ?? "Verification failed")
        : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    try {
      const { data } = await api.post<{ devCode?: string }>("/auth/resend-otp", { email });
      // Demo-only: printed here instead of making you check the server
      // terminal — see the comment on issueOtp() in routes/auth.js.
      if (data.devCode) {
        console.log(`[DEV] Verification code for ${email}: ${data.devCode}`);
      }
      toast.success("If that account needs verification, a new code was sent.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code we sent to <span className="font-medium">{email}</span>.
            <br />
            <span className="text-xs">
              (Demo mode: this app has no email service wired up — the code was printed to
              your browser console and the server terminal, both prefixed "[DEV]".)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <OtpInput
              length={CODE_LENGTH}
              value={code}
              onChange={setCode}
              disabled={isSubmitting}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || code.length !== CODE_LENGTH}
              className="mt-2"
            >
              {isSubmitting ? "Verifying..." : "Verify"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isResending}
              onClick={handleResend}
            >
              {isResending ? "Sending..." : "Resend code"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Already verified?{" "}
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
