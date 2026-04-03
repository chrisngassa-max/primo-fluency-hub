import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff, Users } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";
import { Badge } from "@/components/ui/badge";

const LoginEleve = () => {
  const { signIn, signUp, session, role, loading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get("invite");
  const [busy, setBusy] = useState(false);
  const autoJoinAttempted = useRef(false);

  // Persist invite code across email confirmation redirect
  useEffect(() => {
    if (inviteParam) {
      sessionStorage.setItem("tcf-invite-code", inviteParam);
    }
  }, [inviteParam]);

  const inviteCode = inviteParam || sessionStorage.getItem("tcf-invite-code");

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

  // Auto-join group when user is logged in and has an invite code
  useEffect(() => {
    if (!session || !user || !inviteCode || autoJoinAttempted.current) return;
    autoJoinAttempted.current = true;

    const joinGroup = async () => {
      try {
        const { data: invitation } = await supabase
          .from("group_invitations")
          .select("id, group_id, expires_at, used_count, group:groups(nom)")
          .eq("code", inviteCode)
          .maybeSingle();

        if (!invitation) return;
        if (new Date(invitation.expires_at) < new Date()) return;

        const { data: existing } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", invitation.group_id)
          .eq("eleve_id", user.id)
          .maybeSingle();

        if (existing) return;

        await supabase
          .from("group_members")
          .insert({ group_id: invitation.group_id, eleve_id: user.id });

        sessionStorage.removeItem("tcf-invite-code");
        const groupName = (invitation as any).group?.nom || "le groupe";
        toast.success(`Tu as rejoint le groupe « ${groupName} » !`);
      } catch (e) {
        console.error("Auto-join failed", e);
      }
    };
    joinGroup();
  }, [session, user, inviteCode]);

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
    if (error) {
      toast.error("Erreur d'inscription", { description: translateAuthError(error.message) });
    } else {
      toast.success("Inscription réussie !", { description: "Vous pouvez maintenant vous connecter." });
      // Notify all formateurs about new student registration
      try {
        const { data: formateurs } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "formateur");
        if (formateurs) {
          for (const f of formateurs) {
            // In-app notification
            await supabase.from("notifications").insert({
              user_id: f.user_id,
              titre: "Nouvel élève inscrit",
              message: `${signupPrenom} ${signupNom} (${signupEmail}) vient de s'inscrire et attend ta validation.`,
              link: "/formateur/demandes",
            });
            // Email notification
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", f.user_id)
              .maybeSingle();
            if (profile?.email) {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "new-student-notification",
                  recipientEmail: profile.email,
                  idempotencyKey: `new-student-${signupEmail}-${f.user_id}`,
                  templateData: {
                    studentName: `${signupPrenom} ${signupNom}`,
                    studentEmail: signupEmail,
                  },
                },
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to send formateur notification", e);
      }
    }
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

  const renderPasswordInput = (
    id: string, value: string, onChange: (v: string) => void,
    show: boolean, onToggle: () => void, minLength?: number,
  ) => (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        minLength={minLength}
        autoComplete="new-password"
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-sky-50/50 dark:bg-background p-4 overflow-y-auto">
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center bg-sky-50/50 dark:bg-background p-4 pt-8 sm:pt-4 overflow-y-auto">
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </Button>

        <div className="text-center space-y-2">
          <span className="text-5xl" role="img" aria-label="Élève">🎓</span>
          <h1 className="text-3xl font-bold text-foreground">Espace Élève</h1>
          <p className="text-muted-foreground">Faire mes exercices et mon test</p>
        </div>

        {inviteCode && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Users className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">
              Inscrivez-vous ou connectez-vous pour rejoindre automatiquement le groupe de votre formateur.
            </p>
          </div>
        )}

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
                    {renderPasswordInput("eleve-login-password", loginPassword, setLoginPassword, showLoginPw, () => setShowLoginPw(!showLoginPw))}
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
