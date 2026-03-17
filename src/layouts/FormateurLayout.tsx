import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FormateurSidebar } from "@/components/FormateurSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, GraduationCap } from "lucide-react";
import { useState } from "react";

const FormateurLayout = () => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Tablet / mobile: hamburger menu with Sheet
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
              <SidebarProvider defaultOpen={true}>
                <FormateurSidebar onNavigate={() => setSheetOpen(false)} />
              </SidebarProvider>
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
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FormateurLayout;
