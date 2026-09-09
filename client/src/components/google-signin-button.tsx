import { Button } from "@/components/ui/button";

/**
 * A real page navigation, not an axios/fetch call — the whole point of the
 * redirect flow is that the browser leaves this app entirely and lands on
 * Google's own login/consent page. GET /api/auth/google (proxied by Vite to
 * the Express server) is what actually issues the redirect to Google; this
 * button just triggers that first hop.
 */
export function GoogleSignInButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => {
        window.location.href = "/api/auth/google";
      }}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.74Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.27a12 12 0 0 0 0 10.8l4-3.11Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
        />
      </svg>
      Continue with Google
    </Button>
  );
}
