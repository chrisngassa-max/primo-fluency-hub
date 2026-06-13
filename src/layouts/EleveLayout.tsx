import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  BookMarked,
  ClipboardList,
  Home,
  NotebookTabs,
  TrendingUp,
  User,
  MoreHorizontal,
  LogOut,
  CircleHelp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import AppFooter from "@/components/AppFooter";
import { CapPublicHeader } from "@/components/CapBrand";
import InterventionPlayer from "@/components/eleve/InterventionPlayer";
import OfflineStatus from "@/components/eleve/OfflineStatus";
import StudentHelpDialog from "@/components/eleve/StudentHelpDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { title: "Accueil", path: "/eleve", icon: Home },
  { title: "Test de niveau", path: "/eleve/test-positionnement", icon: ClipboardList },
  { title: "Mes devoirs", path: "/eleve/devoirs", icon: BookOpen },
  { title: "Mon carnet", path: "/eleve/carnet", icon: NotebookTabs },
  { title: "Ma progression", path: "/eleve/progression", icon: TrendingUp },
  { title: "Mon profil", path: "/eleve/profil", icon: User },
];

const mobileNavItems = navItems.slice(0, 4);
const mobileMoreItems = navItems.slice(4);

const EleveLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const isActive = (path: string) =>
    path === "/eleve" ? location.pathname === path : location.pathname.startsWith(path);

  const initiales = [user?.user_metadata?.prenom, user?.user_metadata?.nom]
    .filter(Boolean)
    .map((s: string) => s[0].toUpperCase())
    .join("") || "ML";

  // Sprint 10 — fallback : récupère la session active de l'élève (groupes auxquels il appartient)
  const { data: activeSessionId } = useQuery({
    queryKey: ["eleve-active-session", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: gm } = await supabase.from("group_members").select("group_id").eq("eleve_id", user.id);
      const groupIds = (gm ?? []).map((r) => r.group_id);
      if (groupIds.length === 0) return null;
      const { data: s } = await supabase
        .from("sessions")
        .select("id")
        .in("group_id", groupIds)
        .eq("statut", "en_cours")
        .order("date_seance", { ascending: false })
        .limit(1)
        .maybeSingle();
      return s?.id ?? null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  return (
    <div className="cap-screen min-h-screen">
      <OfflineStatus />
      <InterventionPlayer sessionId={activeSessionId ?? null} />
      <CapPublicHeader avatar={initiales.slice(0, 2)} showMenu={false} />

      <nav className="hidden border-b bg-white/90 px-4 shadow-sm backdrop-blur lg:flex">
        <div className="mx-auto flex w-full max-w-5xl gap-1 py-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive(item.path)
                  ? "bg-[#e7e9f1] text-[#0b234a]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </button>
          ))}
          <button
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
            Aide
          </button>
          <button
            onClick={signOut}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl px-5 py-8 pb-32 lg:px-8 lg:pb-8">
        <Outlet />
      </main>

      <div className="hidden lg:block">
        <AppFooter />
      </div>

      <nav aria-label="Navigation élève" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-black/10 bg-white/95 px-1 py-2 shadow-[0_-6px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        {mobileNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={active ? "page" : undefined}
              className="flex min-h-14 min-w-0 flex-col items-center gap-1 px-1 py-1 text-center transition-colors"
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-[#e7e9f1] text-[#0b234a]" : "text-zinc-500"
                )}
              >
                <item.icon className="h-7 w-7" strokeWidth={active ? 2.6 : 2.2} />
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-none",
                  active ? "font-extrabold text-[#0b234a]" : "text-zinc-500"
                )}
              >
                {item.title}
              </span>
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Plus de rubriques"
              className="flex min-h-14 min-w-0 flex-col items-center gap-1 px-1 py-1 text-center"
            >
              <span className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                mobileMoreItems.some((item) => isActive(item.path)) ? "bg-[#e7e9f1] text-[#0b234a]" : "text-zinc-500",
              )}>
                <MoreHorizontal className="h-7 w-7" />
              </span>
              <span className="text-xs font-medium leading-none text-zinc-600">Plus</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 min-w-56">
            {mobileMoreItems.map((item) => (
              <DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)} className="min-h-11 gap-3">
                <item.icon className="h-5 w-5" />
                {item.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setHelpOpen(true)} className="min-h-11 gap-3">
              <CircleHelp className="h-5 w-5" />
              Demander de l’aide
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()} className="min-h-11 gap-3 text-destructive">
              <LogOut className="h-5 w-5" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <StudentHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};

export default EleveLayout;
