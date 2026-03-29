import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Bot, Users, LogIn } from "lucide-react";
import AppFooter from "@/components/AppFooter";

const Index = () => {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && session && role) {
    if (role === "formateur") return <Navigate to="/formateur" replace />;
    if (role === "eleve") return <Navigate to="/eleve" replace />;
    if (role === "admin") return <Navigate to="/formateur" replace />;
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
      {/* HEADER PUBLIC */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-foreground tracking-tight">TCF Pro</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/eleve/login")}
              className="gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogIn className="h-4 w-4" />
              Se connecter
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/formateur/login")}
              className="text-sm"
            >
              Espace formateur
            </Button>
          </div>
        </div>
      </header>

      {/* BLOC 1 — Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 pt-12 pb-12 md:pt-16 md:pb-16">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground max-w-3xl leading-tight">
          Préparez votre TCF IRN avec un programme personnalisé
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl">
          CAP TCF accompagne les primo-arrivants vers la réussite à la certification TCF IRN
          grâce à des séances adaptatives, un suivi par formateur et une IA pédagogique.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Button size="lg" onClick={() => navigate("/eleve/login")} className="text-base px-8">
            Je commence maintenant
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/formateur/login")}
            className="text-base px-8"
          >
            Espace formateur
          </Button>
        </div>
      </section>

      {/* BLOC 2 — 3 arguments */}
      <section className="px-4 pb-12 md:pb-16">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          <Card className="border bg-card">
            <CardContent className="pt-6 space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Programme structuré A0→B2</h3>
              <p className="text-sm text-muted-foreground">
                20 séances progressives couvrant les 5 compétences TCF : Compréhension Orale,
                Compréhension Écrite, Expression Écrite, Expression Orale et Structures de la
                Langue.
              </p>
            </CardContent>
          </Card>

          <Card className="border bg-card">
            <CardContent className="pt-6 space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">IA pédagogique adaptative</h3>
              <p className="text-sm text-muted-foreground">
                Le moteur IA génère des exercices ciblés sur vos lacunes et ajuste
                automatiquement le rythme de progression selon vos résultats.
              </p>
            </CardContent>
          </Card>

          <Card className="border bg-card">
            <CardContent className="pt-6 space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Suivi formateur personnalisé</h3>
              <p className="text-sm text-muted-foreground">
                Votre formateur pilote votre parcours, assigne des devoirs, monitore votre
                progression et génère des rapports de préparation.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BLOC 3 — CTA final */}
      <section className="px-4 pb-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Rejoignez CAP TCF dès aujourd'hui
        </h2>
        <p className="mt-2 text-muted-foreground">
          Commencez dès maintenant · Résultats visibles en quelques séances
        </p>
        <Button size="lg" className="mt-6 text-base px-8" onClick={() => navigate("/eleve/login")}>
          Créer mon compte
        </Button>
      </section>

      <AppFooter />
    </div>
  );
};

export default Index;
