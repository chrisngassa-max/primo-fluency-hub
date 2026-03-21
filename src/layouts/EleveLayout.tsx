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
import AppFooter from "@/components/AppFooter";

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-14 flex items-center gap-3 border-b bg-card px-4">
        <GraduationCap className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg text-primary tracking-tight">CAP TCF</span>
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

      <nav className="hidden lg:flex sticky top-14 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 md:px-6">
        <div className="mx-auto flex w-full max-w-5xl gap-2 py-3">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-base transition-colors",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
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

      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t bg-card px-2 py-2 shadow-[0_-2px_10px_hsl(var(--foreground)/0.08)] lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex min-w-[72px] flex-col items-center gap-1 rounded-lg px-4 py-1.5 transition-colors",
              isActive(item.path) ? "text-primary font-semibold" : "text-muted-foreground"
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
