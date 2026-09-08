import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

/**
 * One shared axios instance for the whole app. `baseURL: "/api"` means every
 * call site writes `api.get("/consumers")` instead of `fetch("/api/consumers")`.
 *
 * We do NOT need `withCredentials: true` here — that flag only matters for
 * CROSS-origin requests. Because the Vite dev server proxies `/api/*` to the
 * Express server (see `vite.config.ts`), every request the browser sees is
 * SAME-origin, so httpOnly cookies are attached automatically regardless.
 */
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Auth endpoints are deliberately excluded from the auto-refresh-and-retry
// logic below: a 401 from /login means "wrong password" (not "expired
// token"), and letting /refresh's own failure trigger ANOTHER refresh attempt
// would be an infinite loop.
const AUTH_ENDPOINTS_TO_SKIP = ["/auth/login", "/auth/signup", "/auth/refresh"];

function shouldAttemptRefresh(config: InternalAxiosRequestConfig | undefined) {
  if (!config?.url) return false;
  return !AUTH_ENDPOINTS_TO_SKIP.some((path) => config.url!.includes(path));
}

// Tracks an in-flight refresh so that if 5 requests all 401 at the same
// moment (e.g. a page that fires several API calls at once), we only call
// POST /auth/refresh ONCE and let all 5 wait on that same result, instead of
// firing 5 separate refresh requests.
let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    // Plain axios call (not `api`) so this request is NOT itself subject to
    // the response interceptor below — that would risk recursive refreshing.
    refreshPromise = axios
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null; // next 401, after this settles, gets a fresh attempt
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  // Any 2xx response passes straight through, untouched.
  (response) => response,

  // Every non-2xx response (or network error) comes through here instead.
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isUnauthorized = error.response?.status === 401;
    const alreadyRetried = originalRequest?._retry;

    if (!isUnauthorized || alreadyRetried || !shouldAttemptRefresh(originalRequest)) {
      // Not a recoverable 401, or we already tried once — give up and let
      // the calling code's own .catch/try-catch handle it normally.
      return Promise.reject(error);
    }

    try {
      originalRequest!._retry = true; // never retry the SAME request twice
      await refreshAccessToken(); // throws if the refresh token is also invalid/expired
      return api(originalRequest!); // replay the original request with the new cookie
    } catch (refreshError) {
      // Refresh token is invalid/expired too — there's no way to silently
      // recover. Send the user to a real login instead of leaving them
      // staring at a broken page.
      //
      // Guard against redirecting when we're already there: without this,
      // an unauthenticated visit to /login triggers useAuth's initial
      // GET /auth/me check, which 401s, which fails to refresh (no session
      // exists yet), which would reload /login, which re-triggers the same
      // check — an infinite reload loop.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);
