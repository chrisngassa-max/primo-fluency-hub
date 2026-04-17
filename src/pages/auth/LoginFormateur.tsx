import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center bg-indigo-50 dark:bg-indigo-950/20 p-4 pt-8 sm:pt-4 overflow-y-auto">
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Button>

        <div className="text-center space-y-2">
          <span className="text-5xl" role="img" aria-label="Formateur">💼</span>
          <h1 className="text-3xl font-bold text-foreground">Espace Formateur</h1>
          <p className="text-muted-foreground">Gérer mes groupes et mes séances</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Accédez à votre espace formateur.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-login-email">Adresse email</Label>
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
              <Button type="submit" className="w-full" disabled={busy}>
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
