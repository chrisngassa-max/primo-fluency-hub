import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";
import { CapPublicHeader } from "@/components/CapBrand";
import AppFooter from "@/components/AppFooter";
import { supabase } from "@/integrations/supabase/client";
import { getPasswordRecoveryRedirect } from "@/lib/passwordRecovery";

const LoginFormateur = () => {
  const { session, role, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;
  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Erreur de connexion", { description: translateAuthError(error.message) });
    } else {
      toast.success("Connexion réussie !");
    }
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRecoveryRedirect("formateur"),
    });
    if (error) {
      const translated = translateAuthError(error.message);
      setMessage(translated);
      toast.error("Erreur", { description: translated });
    } else {
      setMessage("Si un compte existe pour cette adresse, un lien vient d'être envoyé.");
    }
    setBusy(false);
  };

  return (
    <div className="cap-screen flex min-h-[100dvh] flex-col">
      <a
        href="#contenu-principal"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 font-semibold text-[#0b234a] shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu principal
      </a>
      <CapPublicHeader showMenu={false} />

      <main id="contenu-principal" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-md space-y-5">
          <button
            onClick={() => navigate("/")}
            className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f47b20]"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
          </button>

          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black text-[#0b234a] sm:text-3xl">Espace formateur</h1>
              <p className="mt-1 text-sm text-[#0b234a]/70">
                Pilotez vos groupes et suivez la progression de vos élèves.
              </p>
            </div>

            <form onSubmit={showForgot ? handleForgot : handleLogin} className="space-y-4">
              {!showForgot && <div className="space-y-2">
                <Label htmlFor="form-login-email" className="text-[#0b234a]">Email</Label>
                <Input
                  id="form-login-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12"
                />
              </div>}
              {message && <p role="status" aria-live="polite" className="rounded-lg bg-[#0b234a]/5 p-3 text-sm text-[#0b234a]">{message}</p>}
              <div className="space-y-2">
                <Label htmlFor="form-login-password" className="text-[#0b234a]">Mot de passe</Label>
                <Input
                  id="form-login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="h-14 w-full rounded-lg bg-[#0b234a] text-base font-bold text-white transition hover:bg-[#0b234a]/90 disabled:opacity-60"
              >
                {busy ? (showForgot ? "Envoi…" : "Connexion…") : (showForgot ? "Envoyer le lien" : "Se connecter")}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setShowForgot(!showForgot); setMessage(null); }} className="min-h-11 text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a]">
                  {showForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
                </button>
              </div>
            </form>

            <p className="mt-6 text-center text-xs text-[#0b234a]/60">
              Pas encore de compte ? Contactez votre administrateur.
            </p>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
};

export default LoginFormateur;
