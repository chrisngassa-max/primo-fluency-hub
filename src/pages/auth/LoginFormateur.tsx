import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";

const LoginFormateur = () => {
  const { signIn, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;
  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error("Erreur de connexion", { description: translateAuthError(error.message) });
    else toast.success("Connexion réussie !");
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    if (error) toast.error("Erreur", { description: translateAuthError(error.message) });
    else toast.success("Email envoyé", { description: "Consultez votre boîte mail." });
    setBusy(false);
  };

  if (showForgot) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/20 p-4 overflow-y-auto">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>Entrez votre email pour recevoir un lien.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Adresse email</Label>
                <Input id="forgot-email" type="email" placeholder="votre@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Envoi…" : "Envoyer le lien"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>Retour</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-login-email">Adresse email</Label>
                <Input id="form-login-email" type="email" placeholder="votre@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-login-password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="form-login-password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Connexion…" : "Se connecter"}
              </Button>
              <Button type="button" variant="link" className="w-full text-sm" onClick={() => setShowForgot(true)}>
                Mot de passe oublié ?
              </Button>
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
