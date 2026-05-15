import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  CalendarDays,
  Table2,
  Trophy,
  TrendingUp,
  AlertTriangle,
  Users,
  LogOut,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Importar Planilha", url: "/upload", icon: Upload, admin: true },
  { title: "Competências", url: "/competencias", icon: CalendarDays },
  { title: "Registros", url: "/registros", icon: Table2 },
  { title: "Rankings", url: "/rankings", icon: Trophy },
  { title: "Variação de Pagamentos", url: "/variacao", icon: TrendingUp },
  { title: "Alertas", url: "/alertas", icon: AlertTriangle },
  { title: "Usuários", url: "/usuarios", icon: Users, admin: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, role, isAdmin, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-col border-b border-sidebar-border p-4 flex items-center justify-center px-[16px] py-[30px] gap-[8px]">
        <img
          src={logo}
          alt="OdontoProd Control"
          className={`${collapsed ? "h-12" : "h-20"} w-auto object-contain`}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((i) => !i.admin || isAdmin)
                .map((item) => {
                  const active = path === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && user && (
          <div className="px-2 pb-2">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user.email}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-gold">
              {role ?? "—"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}