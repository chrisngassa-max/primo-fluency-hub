import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

const LoginFormateur = () => {
  const { signIn, signUp, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupNom, setSignupNom] = useState("");
  const [signupPrenom, setSignupPrenom] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;
  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error("Erreur de connexion", { description: error.message });
    else toast.success("Connexion réussie !");
    setBusy(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupNom || !signupPrenom) { toast.error("Remplissez votre nom et prénom."); return; }
    setBusy(true);
    const { error } = await signUp(signupEmail, signupPassword, { nom: signupNom, prenom: signupPrenom, role: "formateur" });
    if (error) toast.error("Erreur d'inscription", { description: error.message });
    else toast.success("Inscription réussie !", { description: "Vous pouvez maintenant vous connecter." });
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error("Erreur", { description: error.message });
    else toast.success("Email envoyé", { description: "Consultez votre boîte mail." });
    setBusy(false);
  };

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>Entrez votre email pour recevoir un lien.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Adresse email</Label>
                <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
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
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="form-login-email">Adresse email</Label>
                    <Input id="form-login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-login-password">Mot de passe</Label>
                    <Input id="form-login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Connexion…" : "Se connecter"}
                  </Button>
                  <Button type="button" variant="link" className="w-full text-sm" onClick={() => setShowForgot(true)}>
                    Mot de passe oublié ?
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="form-signup-prenom">Prénom</Label>
                      <Input id="form-signup-prenom" value={signupPrenom} onChange={(e) => setSignupPrenom(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="form-signup-nom">Nom</Label>
                      <Input id="form-signup-nom" value={signupNom} onChange={(e) => setSignupNom(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-signup-email">Adresse email</Label>
                    <Input id="form-signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-signup-password">Mot de passe</Label>
                    <Input id="form-signup-password" type="password" minLength={6} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Inscription…" : "S'inscrire"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginFormateur;
