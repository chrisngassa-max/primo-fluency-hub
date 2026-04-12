import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  Activity,
  FileText,
  Settings,
  LogOut,
  GraduationCap,
  ClipboardList,
  Upload,
  Route,
  ClipboardCheck,
  Inbox,
  Library,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const mainNav = [
  { title: "Tableau de bord", url: "/formateur", icon: LayoutDashboard },
  { title: "Demandes d'accès", url: "/formateur/demandes", icon: Inbox },
  { title: "Groupes & Élèves", url: "/formateur/groupes", icon: Users },
  { title: "Séances", url: "/formateur/seances", icon: Calendar },
  { title: "Exercices", url: "/formateur/exercices", icon: BookOpen },
  { title: "Devoirs", url: "/formateur/devoirs", icon: ClipboardCheck },
  { title: "Importer programme", url: "/formateur/import-programme", icon: Upload },
  { title: "Plans de formation", url: "/formateur/parcours", icon: Route },
  { title: "Ressources", url: "/formateur/ressources", icon: Library },
];

const monitorNav = [
  { title: "Suivi des élèves", url: "/formateur/monitoring", icon: Activity },
  { title: "Suivi des devoirs", url: "/formateur/suivi-devoirs", icon: ClipboardCheck },
  { title: "Tests d'entrée", url: "/formateur/tests", icon: ClipboardList },
  { title: "Résultats positionnement", url: "/formateur/test-resultats", icon: GraduationCap },
  { title: "Rapports IA", url: "/formateur/rapports", icon: FileText },
];

interface FormateurSidebarProps {
  onNavigate?: () => void;
}

export function FormateurSidebar({ onNavigate }: FormateurSidebarProps) {
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-access-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const isActive = (path: string) =>
    path === "/formateur" ? currentPath === path : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-sidebar-primary" />
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-primary tracking-tight">
              CAP TCF
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pédagogie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} title={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/formateur"}
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={onNavigate}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.url === "/formateur/demandes" && pendingCount > 0 && !collapsed && (
                        <Badge className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 h-4 min-w-4">{pendingCount}</Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Suivi</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {monitorNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} title={item.title}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={onNavigate}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/formateur/parametres")}>
              <NavLink
                to="/formateur/parametres"
                className="hover:bg-sidebar-accent/60"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                onClick={onNavigate}
              >
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span>Paramètres</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" />
          {!collapsed && "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
