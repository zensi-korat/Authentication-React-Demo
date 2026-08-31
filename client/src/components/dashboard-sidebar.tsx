import { LayoutDashboard, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Consumers", path: "/consumers" },
];

export function DashboardSidebar() {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(path));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="overflow-x-hidden">
        <div
          className={cn(
            "border-b border-border py-2.5",
            isCollapsed ? "px-2 flex justify-center" : "px-5",
          )}
        >
          <div className="flex h-10 items-center">
            {isCollapsed ? (
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
                F
              </span>
            ) : (
              <span className="text-lg font-semibold text-foreground">
                Fetch API Demo
              </span>
            )}
          </div>
        </div>

        <nav aria-label="Main navigation">
          <SidebarGroup>
            {!isCollapsed && <SidebarGroupLabel>Management</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={isCollapsed ? item.label : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                          navigate(item.path);
                        }}
                      >
                        <button aria-current={active ? "page" : undefined}>
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
