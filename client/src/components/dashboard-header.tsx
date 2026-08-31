import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/useAuth";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/consumers": "Consumers",
};

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/consumers")) return "Consumers";
  return "Fetch API Demo";
}

export function DashboardHeader() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const { user, refresh } = useAuth();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
      await refresh();
      navigate("/login");
    } catch {
      toast.error("Failed to log out. Please try again.");
    }
  }

  return (
    <header className="border-b border-border bg-card" aria-label="Dashboard header">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 gap-3">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="size-9" aria-label="Toggle sidebar" />
          <h1 className="text-lg font-semibold text-foreground">
            {pageTitleFor(pathname)}
          </h1>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-md px-2 py-2 h-auto"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-40">
                {user?.email ?? "Signed in"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 size-4" aria-hidden="true" />
              Authenticated via Supabase
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 size-4" aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
