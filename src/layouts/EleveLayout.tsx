import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  User,
  GraduationCap,
  ClipboardList,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AppFooter from "@/components/AppFooter";

const navItems = [
  { title: "Accueil", path: "/eleve", icon: LayoutDashboard },
  { title: "Test de niveau", path: "/eleve/test-positionnement", icon: ClipboardList },
  { title: "Mes devoirs", path: "/eleve/devoirs", icon: BookOpen },
  { title: "Mon carnet", path: "/eleve/carnet", icon: BookMarked },
  { title: "Ma progression", path: "/eleve/progression", icon: TrendingUp },
  { title: "Mon profil", path: "/eleve/profil", icon: User },
];

const EleveLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/eleve" ? location.pathname === path : location.pathname.startsWith(path);

  const initiales = [user?.user_metadata?.prenom, user?.user_metadata?.nom]
    .filter(Boolean).map((s: string) => s[0].toUpperCase()).join("") || "?";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 flex items-center gap-3 border-b bg-white shadow-sm px-4">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-extrabold text-lg tracking-tight text-foreground">
          CAP <span className="text-accent">TCF</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={signOut}
            title="Se déconnecter"
            className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground hover:bg-muted/80 transition-colors"
          >
            {initiales}
          </button>
        </div>
      </header>

      {/* Nav desktop — pill style */}
      <nav className="hidden lg:flex sticky top-14 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 md:px-6">
        <div className="mx-auto flex w-full max-w-5xl gap-1 py-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive(item.path)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 pb-32 md:p-6 md:pb-32 lg:pb-8">
        <Outlet />
      </main>

      <div className="hidden lg:block">
        <AppFooter />
      </div>

      {/* Nav mobile — bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t bg-white px-1 py-1.5 shadow-[0_-2px_12px_hsl(var(--foreground)/0.08)] lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-0.5 px-1 py-1 transition-colors min-w-[52px]"
          >
            <div className={cn(
              "h-9 w-12 rounded-xl flex items-center justify-center transition-colors",
              isActive(item.path) ? "bg-muted" : ""
            )}>
              <item.icon className={cn("h-5 w-5", isActive(item.path) ? "text-foreground" : "text-muted-foreground")} />
            </div>
            <span className={cn("text-[10px] leading-tight text-center", isActive(item.path) ? "text-foreground font-bold" : "text-muted-foreground")}>
              {item.title}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default EleveLayout;
