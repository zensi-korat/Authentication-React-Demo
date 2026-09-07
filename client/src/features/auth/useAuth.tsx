import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/axios";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** Re-runs the /api/auth/me check — call after login/logout. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      // Same-origin request (via the Vite proxy), so the httpOnly access_token
      // cookie is sent automatically by the browser — no manual header, no
      // token read from anywhere in this code. We just ask the server.
      //
      // Unlike the old fetch version, axios throws for non-2xx statuses on
      // its own — no manual `if (!res.ok)` check needed. And if the access
      // token happens to be expired but the refresh token is still valid,
      // the interceptor in lib/axios.ts will silently refresh and retry this
      // exact request before we ever see a failure here.
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
