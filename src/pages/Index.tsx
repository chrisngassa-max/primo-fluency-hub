import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, Briefcase, Shield } from "lucide-react";

const Index = () => {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  // If logged in, redirect to correct dashboard
  if (!loading && session && role) {
    if (role === "formateur") return <Navigate to="/formateur" replace />;
    if (role === "eleve") return <Navigate to="/eleve" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="text-center pt-10 pb-6 px-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          TCF Pro
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Plateforme de préparation au TCF — Intégration et Résidence
        </p>
        <p className="text-muted-foreground mt-1 text-base max-w-xl mx-auto">
          Le TCF IRN est le test de français obligatoire pour votre titre de séjour en France.
        </p>
      </header>

      {/* Portal cards */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-10 gap-6 max-w-3xl mx-auto w-full">
        {/* ÉLÈVE — Priority visual, biggest card */}
        <button
          onClick={() => navigate("/eleve/login")}
          className="w-full rounded-2xl border-2 border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 p-8 md:p-10 flex flex-col items-center gap-4 transition-all duration-200 hover:shadow-lg hover:border-primary focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer"
        >
          <div className="h-16 w-16 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
            <GraduationCap className="h-9 w-9 text-sky-500" />
          </div>
          <span className="text-2xl md:text-3xl font-bold text-foreground tracking-wide">
            ESPACE ÉLÈVE
          </span>
          <span className="text-base md:text-lg text-muted-foreground">
            Faire mes exercices et mon test
          </span>
        </button>

        {/* FORMATEUR */}
        <button
          onClick={() => navigate("/formateur/login")}
          className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 p-6 md:p-8 flex flex-col items-center gap-3 transition-all duration-200 hover:shadow-lg hover:border-primary focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer"
        >
          <div className="h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <Briefcase className="h-7 w-7 text-indigo-500" />
          </div>
          <span className="text-xl md:text-2xl font-bold text-foreground">
            ESPACE FORMATEUR
          </span>
          <span className="text-sm md:text-base text-muted-foreground">
            Gérer mes groupes et mes séances
          </span>
        </button>

        {/* ADMIN — smaller, sober */}
        <button
          onClick={() => navigate("/admin/login")}
          className="w-full max-w-xs rounded-xl border border-border bg-muted/50 p-4 md:p-5 flex flex-col items-center gap-2 transition-all duration-200 hover:shadow-lg hover:border-primary focus:outline-none focus:ring-4 focus:ring-primary/30 cursor-pointer"
        >
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <Shield className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground">
            ADMINISTRATION
          </span>
        </button>
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} TCF Pro — Tous droits réservés
      </footer>
    </div>
  );
};

export default Index;
