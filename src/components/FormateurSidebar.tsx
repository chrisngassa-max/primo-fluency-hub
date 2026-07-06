import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  GraduationCap,
  Upload,
  Route,
  ClipboardCheck,
  Inbox,
  Library,
  Flame,
  Database,
  Flag,
  Eye,
  TrendingUp,
  ListChecks,
  BookMarked,
  BarChart3,
  FlaskConical,
  Factory,
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
import PedagogicalTerminologyHelp from "@/components/PedagogicalTerminologyHelp";

const gestionNav = [
  { title: "Tableau de bord", url: "/formateur", icon: LayoutDashboard },
  { title: "Mode Sandbox", url: "/formateur/sandbox", icon: FlaskConical },
  { title: "Demandes d'accès", url: "/formateur/demandes", icon: Inbox },
  { title: "Groupes & Élèves", url: "/formateur/groupes", icon: Users },
  { title: "Séances", url: "/formateur/seances", icon: Calendar },
];

const pedagogieNav = [
  { title: "Bibliothèque d'exercices", url: "/formateur/exercices", icon: BookOpen },
  { title: "Devoirs envoyés", url: "/formateur/devoirs", icon: ClipboardCheck },
  { title: "Plans de formation", url: "/formateur/parcours", icon: Route },
  { title: "Production du parcours", url: "/formateur/production-parcours", icon: Factory },
  { title: "Ressources", url: "/formateur/ressources", icon: Library },
  { title: "Ressources pédagogiques", url: "/formateur/banque-activites", icon: Database },
  { title: "Importer programme", url: "/formateur/import-programme", icon: Upload },
];

const pilotageNav = [
  { title: "Intervention rapide", url: "/formateur/intervention", icon: Flame },
  { title: "Bibliothèque interventions", url: "/formateur/bibliotheque-interventions", icon: BookMarked },
  { title: "Suivi en direct", url: "/formateur/suivi-direct", icon: Eye },
  { title: "Suivi des élèves", url: "/formateur/monitoring", icon: TrendingUp },
  { title: "Préparation séjour / naturalisation", url: "/formateur/preparation-examen", icon: GraduationCap },
  { title: "Suivi des devoirs", url: "/formateur/suivi-devoirs", icon: ListChecks },
];

const analysesNav = [
  { title: "Positionnement", url: "/formateur/positionnement", icon: ListChecks },
  { title: "Résultats de positionnement", url: "/formateur/test-resultats", icon: GraduationCap },
  { title: "Bilans d'atelier", url: "/formateur/bilans-atelier", icon: BookMarked },
  { title: "Rapports IA", url: "/formateur/rapports", icon: FileText },
  { title: "Analyse des erreurs", url: "/formateur/analytics-erreurs", icon: BarChart3 },
  { title: "Signalements", url: "/formateur/signalements", icon: Flag },
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
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar text-sidebar-foreground shadow-2xl">
      <SidebarHeader className="p-0 border-b border-sidebar-border/70">
        <div className="flex items-center gap-2 bg-white px-4 py-4">
          <GraduationCap className="h-7 w-7 text-[#0b234a]" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">
              <span className="text-[#0b234a]">CAP </span>
              <span className="text-[#f59e0b]">TCF</span>
            </span>
          )}
          {!collapsed && <div className="ml-auto"><PedagogicalTerminologyHelp /></div>}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {[
          { label: "Gestion", items: gestionNav },
          { label: "Pédagogie", items: pedagogieNav },
          { label: "Pilotage", items: pilotageNav },
          { label: "Analyses", items: analysesNav },
        ].map(({ label, items }) => (
          <SidebarGroup key={label}>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-medium px-3 pt-5 pb-2">
              {label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} title={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/formateur"}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sidebar-foreground/85 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors"
                        activeClassName="bg-sidebar-accent/70 text-sidebar-accent-foreground font-semibold"
                        onClick={onNavigate}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
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
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/formateur/parametres")}>
              <NavLink
                to="/formateur/parametres"
                className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-sidebar-accent/40 transition-colors"
                activeClassName="bg-sidebar-accent/70 text-sidebar-accent-foreground font-semibold"
                onClick={onNavigate}
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-sm">Paramètres</span>}
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
