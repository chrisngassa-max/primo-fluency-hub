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
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";

const LoginEleve = () => {
  const { signIn, signUp, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupNom, setSignupNom] = useState("");
  const [signupPrenom, setSignupPrenom] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;
  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error("Erreur de connexion", { description: translateAuthError(error.message) });
    else toast.success("Connexion réussie !");
    setBusy(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupNom || !signupPrenom) { toast.error("Remplissez votre nom et prénom."); return; }
    setBusy(true);
    const { error } = await signUp(signupEmail, signupPassword, { nom: signupNom, prenom: signupPrenom, role: "eleve" });
    if (error) toast.error("Erreur d'inscription", { description: translateAuthError(error.message) });
    else toast.success("Inscription réussie !", { description: "Vous pouvez maintenant vous connecter." });
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error("Erreur", { description: translateAuthError(error.message) });
    else toast.success("Email envoyé", { description: "Consultez votre boîte mail." });
    setBusy(false);
  };

  const PasswordInput = ({
    id, value, onChange, show, onToggle, minLength,
  }: {
    id: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; minLength?: number;
  }) => (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        minLength={minLength}
        required
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        onClick={onToggle}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
      </Button>
    </div>
  );

  if (showForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50/50 dark:bg-background p-4">
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-sky-50/50 dark:bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Button>

        <div className="text-center space-y-2">
          <span className="text-5xl" role="img" aria-label="Élève">🎓</span>
          <h1 className="text-3xl font-bold text-foreground">Espace Élève</h1>
          <p className="text-muted-foreground">Faire mes exercices et mon test</p>
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
                    <Label htmlFor="eleve-login-email">Adresse email</Label>
                    <Input id="eleve-login-email" type="email" placeholder="votre@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eleve-login-password">Mot de passe</Label>
                    <PasswordInput id="eleve-login-password" value={loginPassword} onChange={setLoginPassword} show={showLoginPw} onToggle={() => setShowLoginPw(!showLoginPw)} />
                  </div>
                  <Button type="submit" className="w-full text-lg py-6" disabled={busy}>
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
                      <Label htmlFor="eleve-signup-prenom">Prénom</Label>
                      <Input id="eleve-signup-prenom" placeholder="Prénom" value={signupPrenom} onChange={(e) => setSignupPrenom(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eleve-signup-nom">Nom</Label>
                      <Input id="eleve-signup-nom" placeholder="Nom" value={signupNom} onChange={(e) => setSignupNom(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eleve-signup-email">Adresse email</Label>
                    <Input id="eleve-signup-email" type="email" placeholder="votre@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eleve-signup-password">Mot de passe</Label>
                    <PasswordInput id="eleve-signup-password" value={signupPassword} onChange={setSignupPassword} show={showSignupPw} onToggle={() => setShowSignupPw(!showSignupPw)} minLength={6} />
                  </div>
                  <Button type="submit" className="w-full text-lg py-6" disabled={busy}>
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

export default LoginEleve;
