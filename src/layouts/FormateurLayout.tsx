import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppFooter from "@/components/AppFooter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FormateurSidebar } from "@/components/FormateurSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LogOut,
  GraduationCap,
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  Activity,
  FileText,
  Settings,
  ClipboardList,
  Upload,
  Route,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Tableau de bord", url: "/formateur", icon: LayoutDashboard },
  { title: "Groupes & Élèves", url: "/formateur/groupes", icon: Users },
  { title: "Séances", url: "/formateur/seances", icon: Calendar },
  { title: "Exercices", url: "/formateur/exercices", icon: BookOpen },
  { title: "Importer programme", url: "/formateur/import-programme", icon: Upload },
  { title: "Plans de formation", url: "/formateur/parcours", icon: Route },
];

const monitorNav = [
  { title: "Monitoring", url: "/formateur/monitoring", icon: Activity },
  { title: "Tests d'entrée", url: "/formateur/tests", icon: ClipboardList },
  { title: "Rapports", url: "/formateur/rapports", icon: FileText },
];

const FormateurLayout = () => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/formateur" ? location.pathname === path : location.pathname.startsWith(path);

  const handleNav = (url: string) => {
    navigate(url);
    setSheetOpen(false);
  };

  // Tablet / mobile: hamburger menu with Sheet containing simple nav links
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-14 flex items-center gap-3 border-b bg-card px-4 shrink-0">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-2 p-4 border-b">
                  <GraduationCap className="h-7 w-7 text-primary" />
                  <span className="font-bold text-lg text-primary tracking-tight">TCF Pro</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-auto p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground px-3 py-2">Pédagogie</p>
                  {mainNav.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => handleNav(item.url)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                        isActive(item.url)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.title}
                    </button>
                  ))}

                  <p className="text-xs font-semibold text-muted-foreground px-3 py-2 mt-4">Suivi</p>
                  {monitorNav.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => handleNav(item.url)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                        isActive(item.url)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.title}
                    </button>
                  ))}
                </nav>

                {/* Footer */}
                <div className="border-t p-3 space-y-1">
                  <button
                    onClick={() => handleNav("/formateur/parametres")}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                      isActive("/formateur/parametres")
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    Paramètres
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Déconnexion
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-primary tracking-tight">TCF Pro</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.user_metadata?.prenom}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    );
  }

  // Desktop: persistent sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <FormateurSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="ml-auto text-sm text-muted-foreground">
              {user?.user_metadata?.prenom} {user?.user_metadata?.nom}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FormateurLayout;
