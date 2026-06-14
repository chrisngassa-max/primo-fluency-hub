import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff, Users } from "lucide-react";
import { translateAuthError, translateEleveLoginHint, type EleveLoginHintCode, isInvalidCredentialsError } from "@/lib/authErrors";
import { Checkbox } from "@/components/ui/checkbox";
import { CONSENT_VERSION } from "@/hooks/useAIConsent";
import { CapPublicHeader } from "@/components/CapBrand";
import AppFooter from "@/components/AppFooter";

const LoginEleve = () => {
  const { signIn, signUp, session, role, loading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get("invite");
  const [busy, setBusy] = useState(false);
  const autoJoinAttempted = useRef(false);

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
  const [signupCodeFormateur, setSignupCodeFormateur] = useState(inviteParam || "");
  const [signupConsentAi, setSignupConsentAi] = useState(false);
  const [signupConsentBio, setSignupConsentBio] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);

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

  const resolveLoginHint = async (email: string): Promise<EleveLoginHintCode | null> => {
    const { data, error } = await supabase.functions.invoke("resolve-eleve-login", {
      body: { email: email.trim().toLowerCase() },
    });
    if (error) return null;
    return (data?.code as EleveLoginHintCode) ?? null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const email = loginEmail.trim().toLowerCase();
    const hint = await resolveLoginHint(email);

    if (hint === "email_not_found") {
      toast.error("Erreur de connexion", { description: translateEleveLoginHint(hint) });
      setBusy(false);
      return;
    }
    if (hint === "pending_approval") {
      toast.error("Compte en attente", { description: translateEleveLoginHint(hint) });
      setBusy(false);
      return;
    }
    if (hint === "not_eleve") {
      toast.error("Erreur de connexion", { description: translateEleveLoginHint(hint) });
      setBusy(false);
      return;
    }

    const { error } = await signIn(email, loginPassword);
    if (error) {
      const description = isInvalidCredentialsError(error.message)
        ? translateEleveLoginHint(hint === "consent_missing" ? "wrong_password" : hint ?? "wrong_password")
        : translateAuthError(error.message);
      toast.error("Erreur de connexion", { description });
    } else if (hint === "consent_missing") {
      toast.success("Connexion réussie", {
        description: translateEleveLoginHint("consent_missing"),
      });
    } else {
      toast.success("Connexion réussie !");
    }
    setBusy(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupNom || !signupPrenom) { toast.error("Remplissez votre nom et prénom."); return; }
    if (!signupConsentAi || !signupConsentBio) {
      toast.error("Vous devez accepter le consentement IA et voix pour vous inscrire.");
      return;
    }
    setBusy(true);
    const formateurCode = signupCodeFormateur.trim() || inviteCode || "";
    if (formateurCode) {
      sessionStorage.setItem("tcf-invite-code", formateurCode);
    }
    const { error } = await signUp(signupEmail, signupPassword, { nom: signupNom, prenom: signupPrenom, role: "eleve" });
    if (error) {
      toast.error("Erreur d'inscription", { description: translateAuthError(error.message) });
    } else {
      const { data: authData } = await supabase.auth.getUser();
      const newUserId = authData.user?.id;
      if (newUserId) {
        await supabase.from("ai_processing_consents" as any).upsert({
          user_id: newUserId,
          consent_ai: true,
          consent_biometric: true,
          consented_at: new Date().toISOString(),
          revoked_at: null,
          version: CONSENT_VERSION,
          source: "signup",
        }, { onConflict: "user_id" });
      }
      setSignupDone(true);
      try {
        const { data: formateurs } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "formateur");
        if (formateurs) {
          for (const f of formateurs) {
            await supabase.from("notifications").insert({
              user_id: f.user_id,
              titre: "Nouvel élève inscrit",
              message: `${signupPrenom} ${signupNom} (${signupEmail}) vient de s'inscrire et attend ta validation.`,
              link: "/formateur/demandes",
            });
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
        className="h-12 pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full items-center px-3 text-[#0b234a]/60 hover:text-[#0b234a]"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  const orangeBtn =
    "h-14 w-full rounded-lg bg-[#f47b20] text-base font-bold text-white transition hover:bg-[#e36e15] disabled:opacity-60";

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

          {inviteCode && (
            <div className="flex items-center gap-3 rounded-lg border border-[#f47b20]/30 bg-[#f47b20]/10 p-3">
              <Users className="h-5 w-5 shrink-0 text-[#f47b20]" />
              <p className="text-sm text-[#0b234a]">
                Inscrivez-vous ou connectez-vous pour rejoindre automatiquement le groupe de votre formateur.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:p-8">
            {showForgot ? (
              <form onSubmit={handleForgot} className="space-y-5">
                <div className="text-center">
                  <h1 className="text-2xl font-black text-[#0b234a]">Mot de passe oublié</h1>
                  <p className="mt-1 text-sm text-[#0b234a]/70">Entrez votre email pour recevoir un lien.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-[#0b234a]">Adresse email</Label>
                  <Input id="forgot-email" type="email" placeholder="votre@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required className="h-12" />
                </div>
                <button type="submit" disabled={busy} className={orangeBtn}>
                  {busy ? "Envoi…" : "Envoyer le lien"}
                </button>
                <button type="button" onClick={() => setShowForgot(false)} className="w-full text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a]">
                  Retour
                </button>
              </form>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-2xl font-black text-[#0b234a] sm:text-3xl">Espace élève</h1>
                  <p className="mt-1 text-sm text-[#0b234a]/70">Connecte-toi pour accéder à tes devoirs et ta progression.</p>
                </div>

                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Connexion</TabsTrigger>
                    <TabsTrigger value="signup">Inscription</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="eleve-login-email" className="text-[#0b234a]">Adresse email</Label>
                        <Input id="eleve-login-email" type="email" placeholder="votre@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eleve-login-password" className="text-[#0b234a]">Mot de passe</Label>
                        {renderPasswordInput("eleve-login-password", loginPassword, setLoginPassword, showLoginPw, () => setShowLoginPw(!showLoginPw))}
                      </div>
                      <button type="submit" disabled={busy} className={orangeBtn}>
                        {busy ? "Connexion…" : "Se connecter"}
                      </button>
                      <button type="button" onClick={() => setShowForgot(true)} className="block w-full text-sm font-semibold text-[#0b234a]/70 hover:text-[#0b234a]">
                        Mot de passe oublié ?
                      </button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    {signupDone ? (
                      <div className="mt-5 space-y-4 text-center">
                        <h2 className="text-lg font-bold text-[#0b234a]">Demande envoyée</h2>
                        <p className="text-sm text-[#0b234a]/80">
                          Votre formateur va valider votre inscription. Vous pourrez vous connecter dès que votre compte sera approuvé.
                        </p>
                        <button
                          type="button"
                          className={orangeBtn}
                          onClick={() => {
                            setSignupDone(false);
                            setSignupEmail("");
                            setSignupPassword("");
                            setSignupNom("");
                            setSignupPrenom("");
                            setSignupConsentAi(false);
                            setSignupConsentBio(false);
                          }}
                        >
                          Retour à la connexion
                        </button>
                      </div>
                    ) : (
                    <form onSubmit={handleSignup} className="mt-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="eleve-signup-prenom" className="text-[#0b234a]">Prénom</Label>
                          <Input id="eleve-signup-prenom" placeholder="Prénom" value={signupPrenom} onChange={(e) => setSignupPrenom(e.target.value)} required className="h-12" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eleve-signup-nom" className="text-[#0b234a]">Nom</Label>
                          <Input id="eleve-signup-nom" placeholder="Nom" value={signupNom} onChange={(e) => setSignupNom(e.target.value)} required className="h-12" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eleve-signup-email" className="text-[#0b234a]">Adresse email</Label>
                        <Input id="eleve-signup-email" type="email" placeholder="votre@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eleve-signup-password" className="text-[#0b234a]">Mot de passe</Label>
                        {renderPasswordInput("eleve-signup-password", signupPassword, setSignupPassword, showSignupPw, () => setShowSignupPw(!showSignupPw), 6)}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eleve-signup-code" className="text-[#0b234a]">Code formateur (optionnel)</Label>
                        <Input
                          id="eleve-signup-code"
                          placeholder="Code d'invitation du groupe"
                          value={signupCodeFormateur}
                          onChange={(e) => setSignupCodeFormateur(e.target.value)}
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-3 rounded-lg border border-[#0b234a]/10 p-3 text-left">
                        <p className="text-xs font-semibold text-[#0b234a]">Consentement RGPD (obligatoire)</p>
                        <label className="flex items-start gap-2 text-sm text-[#0b234a]/90">
                          <Checkbox checked={signupConsentAi} onCheckedChange={(v) => setSignupConsentAi(v === true)} />
                          <span>J'accepte l'utilisation de l'IA pour corriger mes exercices et préparer mon travail.</span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-[#0b234a]/90">
                          <Checkbox checked={signupConsentBio} onCheckedChange={(v) => setSignupConsentBio(v === true)} />
                          <span>J'accepte l'enregistrement et le traitement de ma voix pour les exercices oraux.</span>
                        </label>
                      </div>
                      <button type="submit" disabled={busy} className={orangeBtn}>
                        {busy ? "Inscription…" : "S'inscrire"}
                      </button>
                    </form>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
};

export default LoginEleve;
