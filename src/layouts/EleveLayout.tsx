import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  User,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Accueil", path: "/eleve", icon: LayoutDashboard },
  { title: "Mes devoirs", path: "/eleve/devoirs", icon: BookOpen },
  { title: "Ma progression", path: "/eleve/progression", icon: TrendingUp },
  { title: "Mon profil", path: "/eleve/profil", icon: User },
];

const EleveLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/eleve" ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="h-14 flex items-center gap-3 border-b bg-card px-4 shrink-0">
        <GraduationCap className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg text-primary tracking-tight">TCF Pro</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.user_metadata?.prenom} {user?.user_metadata?.nom}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-sm">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      {/* Content — always full width, bottom padding for nav */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation — ALWAYS visible (no sidebar ever) */}
      <nav className="fixed bottom-0 inset-x-0 bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.08)] flex justify-around py-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors min-w-[72px]",
              isActive(item.path)
                ? "text-primary font-semibold"
                : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-6 w-6", isActive(item.path) && "text-primary")} />
            <span className="text-[13px]">{item.title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default EleveLayout;
