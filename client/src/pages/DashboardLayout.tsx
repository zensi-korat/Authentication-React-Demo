import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RequireAuth } from "@/components/require-auth";

/**
 * The dashboard shell (sidebar + header) shared by every authenticated page.
 * In Next.js this was app/(dashboard)/layout.tsx; here it's a React Router
 * layout route that renders its child route into <Outlet />.
 */
export default function DashboardLayout() {
  return (
    <RequireAuth>
      <SidebarProvider>
        <div className="flex flex-1 h-screen bg-background overflow-hidden">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />
            <main
              id="main-content"
              aria-label="Main content"
              className="flex-1 overflow-auto relative"
              tabIndex={-1}
            >
              <Outlet />
            </main>
          </div>
          <Toaster />
        </div>
      </SidebarProvider>
    </RequireAuth>
  );
}
