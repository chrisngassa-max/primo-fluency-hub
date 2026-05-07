import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";

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
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:pt-4 overflow-y-auto" style={{ background: "linear-gradient(160deg, hsl(215 40% 88%) 0%, hsl(40 30% 93%) 100%)" }}>
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 text-foreground/60 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Button>

        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <GraduationCap className="h-9 w-9 text-primary-foreground" />
            </div>
            <span className="text-4xl font-extrabold tracking-tight text-foreground">
              CAP <span className="text-accent">TCF</span>
            </span>
          </div>
        </div>

        <Card className="shadow-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">Espace Formateur</CardTitle>
            <CardDescription className="text-sm">Pilotez vos groupes et suivez la progression de vos élèves</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-login-email">Email</Label>
                <Input
                  id="form-login-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-login-password">Mot de passe</Label>
                <Input
                  id="form-login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full text-lg py-6" disabled={busy}>
                {busy ? "Connexion…" : "Se connecter"}
              </Button>
              <div className="text-center">
                <Link to="/reset-password" className="text-sm text-primary hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Pas encore de compte ? Contactez votre administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginFormateur;
