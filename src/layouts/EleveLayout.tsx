import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  TrendingUp,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Accueil", path: "/eleve", icon: LayoutDashboard },
  { title: "Test", path: "/eleve/test", icon: ClipboardList },
  { title: "Devoirs", path: "/eleve/devoirs", icon: BookOpen },
  { title: "Progrès", path: "/eleve/progression", icon: TrendingUp },
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
        <span className="font-bold text-lg text-primary tracking-tight">TCF IRN</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user?.user_metadata?.prenom} {user?.user_metadata?.nom}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut} title="Déconnexion">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Bottom navigation - mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t flex justify-around py-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors min-w-[60px]",
              isActive(item.path)
                ? "text-primary font-semibold"
                : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive(item.path) && "text-primary")} />
            {item.title}
          </button>
        ))}
      </nav>

      {/* Side navigation - desktop */}
      <nav className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 bg-card border-r flex-col p-3 gap-1 z-40">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
              isActive(item.path)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.title}
          </button>
        ))}
      </nav>

      {/* Desktop content offset */}
      <style>{`
        @media (min-width: 768px) {
          main { margin-left: 14rem; }
        }
      `}</style>
    </div>
  );
};

export default EleveLayout;
