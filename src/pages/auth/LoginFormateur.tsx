import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";
import { CapPublicHeader } from "@/components/CapBrand";
import AppFooter from "@/components/AppFooter";

const LoginFormateur = () => {
  const { session, role, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="cap-screen flex min-h-[100dvh] flex-col">
      <CapPublicHeader showMenu={false} />

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <div className="w-full max-w-md space-y-5">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a]"
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

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
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
              </div>
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
                {busy ? "Connexion…" : "Se connecter"}
              </button>
              <div className="text-center">
                <Link to="/reset-password" className="text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a]">
                  Mot de passe oublié ?
                </Link>
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
