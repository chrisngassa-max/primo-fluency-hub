import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, Headphones } from "lucide-react";
import AppFooter from "@/components/AppFooter";
import { CapPublicHeader } from "@/components/CapBrand";
import heroImage from "@/assets/landing-hero.png";

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
    <div className="cap-screen min-h-screen flex flex-col">
      <CapPublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-6 text-center md:pt-16">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-[#0b234a] md:text-5xl">
            Vous préparez votre titre de séjour ou votre naturalisation ?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[#0b234a]/70 md:text-lg">
            Maximisez vos chances de réussite avec notre programme de préparation complet pour le Test de Connaissance du Français (TCF).
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-4">
            <button
              onClick={() => navigate("/eleve/login?tab=signup")}
              className="cap-orange-button h-14 w-full text-lg"
            >
              Je commence maintenant
            </button>
            <p className="-mt-2 text-sm text-[#0b234a]/65">
              Munissez-vous du code à 6 chiffres donné par votre formateur.
            </p>
            <button
              onClick={() => navigate("/formateur/login")}
              className="h-14 w-full rounded-lg border-2 border-[#0b234a] bg-white text-lg font-bold text-[#0b234a] transition hover:bg-[#0b234a] hover:text-white"
            >
              Espace formateur
            </button>
          </div>
        </section>

        {/* ILLUSTRATION */}
        <section className="mx-auto max-w-3xl px-6 py-6">
          <div className="mx-auto max-w-md">
            <img
              src={heroImage}
              alt="Élève en train de passer un test TCF en ligne"
              width={1024}
              height={1024}
              className="h-auto w-full"
            />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border border-[#0b234a]/10 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-center text-2xl font-black text-[#0b234a]">Comment ça marche ?</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ["1", "Créez votre compte", "Quelques informations suffisent pour commencer."],
                ["2", "Évaluez votre niveau", "Un test vous propose un parcours adapté."],
                ["3", "Entraînez-vous", "Réalisez vos devoirs et suivez vos progrès."],
              ].map(([step, title, description]) => (
                <div key={step} className="text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#0b234a] font-bold text-white">{step}</span>
                  <h3 className="mt-3 font-bold text-[#0b234a]">{title}</h3>
                  <p className="mt-1 text-sm text-[#0b234a]/70">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-7 text-center text-sm font-medium text-[#0b234a]/75">
              Vos réponses restent dans votre espace. Les fonctions d'IA et de voix sont expliquées avant leur première utilisation.
            </p>
          </div>
        </section>

        {/* POURQUOI CAP TCF */}
        <section className="mx-auto max-w-3xl px-6 pb-16 pt-4 text-center">
          <h2 className="text-2xl font-black text-[#0b234a] md:text-3xl">Pourquoi CAP TCF ?</h2>
          <div className="mt-8 grid grid-cols-3 gap-6">
            {[
              { icon: BookOpen, label: "Contenus\nactualisés" },
              { icon: Clock, label: "Flexibilité\ntotale" },
              { icon: Headphones, label: "Accompagnement\npersonnalisé" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-3">
                <Icon className="h-10 w-10 text-[#0b234a]" strokeWidth={2} />
                <p className="whitespace-pre-line text-sm font-semibold text-[#0b234a] md:text-base">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
};

export default Index;
