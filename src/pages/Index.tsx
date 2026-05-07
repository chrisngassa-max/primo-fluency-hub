import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GraduationCap, Bot, Users, LogIn, CheckCircle2, ArrowRight, BookOpen, Clock, Headphones } from "lucide-react";
import AppFooter from "@/components/AppFooter";

const Index = () => {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const isAuthResolved = !loading && (!session || role !== null);

  if (isAuthResolved && session && role) {
    if (role === "formateur") return <Navigate to="/formateur" replace />;
    if (role === "eleve") return <Navigate to="/eleve" replace />;
    if (role === "admin") return <Navigate to="/formateur" replace />;
  }

  if (!isAuthResolved) {
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
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, hsl(215 65% 96%) 0%, hsl(40 20% 98%) 50%, hsl(0 0% 100%) 100%)" }}>

      {/* HEADER — glassmorphism */}
      <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-foreground">
              CAP <span className="text-accent">TCF</span>
            </span>
          </div>
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
              variant="outline"
              onClick={() => navigate("/formateur/login")}
              className="text-sm border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Espace formateur
            </Button>
          </div>
        </div>
      </header>

      {/* HERO — split layout 60/40 */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-12 md:gap-8">

        {/* Colonne gauche — 60% */}
        <div className="flex-[3] space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Programme officiel TCF IRN
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Vous préparez votre{" "}
            <span className="text-primary">titre de séjour</span>{" "}
            ou votre naturalisation ?
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto md:mx-0">
            Maximisez vos chances de réussite avec notre programme de préparation complet pour le Test de Connaissance du Français (TCF).
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button
              size="lg"
              onClick={() => navigate("/eleve/login")}
              className="text-base px-8 bg-accent hover:bg-accent/90 text-accent-foreground gap-2 shadow-lg shadow-accent/25"
            >
              Je commence maintenant
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/formateur/login")}
              className="text-base px-8 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Espace formateur
            </Button>
          </div>

          <div className="flex items-center gap-6 justify-center md:justify-start text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Inscription gratuite</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Résultats en quelques séances</span>
          </div>
        </div>

        {/* Colonne droite — 40% — mockup illustratif */}
        <div className="flex-[2] w-full max-w-sm mx-auto md:mx-0 hidden md:block">
          <div className="relative">
            {/* Halo décoratif */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 blur-2xl" />

            {/* Carte mockup principale */}
            <div className="relative rounded-2xl border border-white/80 bg-white shadow-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm text-foreground">CAP <span className="text-accent">TCF</span></span>
                <span className="ml-auto text-xs text-success font-medium bg-success/10 px-2 py-0.5 rounded-full">En cours</span>
              </div>

              {/* Progression */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ma progression</p>
                {[
                  { label: "Compréhension Orale", value: 72, color: "bg-primary" },
                  { label: "Compréhension Écrite", value: 58, color: "bg-accent" },
                  { label: "Expression Écrite", value: 45, color: "bg-primary" },
                ].map((c) => (
                  <div key={c.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.label}</span><span className="font-medium text-foreground">{c.value}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA interne */}
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">3 exercices à faire</p>
                  <p className="text-xs text-muted-foreground">Adaptés à votre niveau</p>
                </div>
                <ArrowRight className="h-4 w-4 text-accent ml-auto shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION POURQUOI CAP TCF */}
      <section className="px-4 pb-16 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-10">
            Pourquoi CAP TCF ?
          </h2>
          <div className="grid grid-cols-3 gap-6 md:gap-10">
            {[
              { icon: BookOpen, label: "Contenus\nactualisés", color: "text-primary", bg: "bg-primary/10" },
              { icon: Clock, label: "Flexibilité\ntotale", color: "text-accent", bg: "bg-accent/10" },
              { icon: Headphones, label: "Accompagnement\npersonnalisé", color: "text-success", bg: "bg-success/10" },
            ].map(({ icon: Icon, label, color, bg }) => (
              <div key={label} className="flex flex-col items-center gap-3">
                <div className={`h-14 w-14 rounded-full ${bg} flex items-center justify-center`}>
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>
                <p className="text-sm font-medium text-foreground whitespace-pre-line">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-4 pb-20 text-center">
        <div className="max-w-2xl mx-auto rounded-2xl p-10 border" style={{ background: "linear-gradient(135deg, hsl(215 65% 20%) 0%, hsl(215 65% 30%) 100%)" }}>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Commencez votre préparation aujourd'hui
          </h2>
          <p className="mt-2 text-white/70">
            Inscription gratuite · Résultats visibles en quelques séances
          </p>
          <Button
            size="lg"
            className="mt-6 text-base px-8 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/30 gap-2"
            onClick={() => navigate("/eleve/login")}
          >
            Créer mon compte gratuitement
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <AppFooter />
    </div>
  );
};

export default Index;
