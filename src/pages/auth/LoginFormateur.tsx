import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { translateAuthError } from "@/lib/authErrors";

const LoginFormateur = () => {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");

  if (!loading && session && role === "formateur") return <Navigate to="/formateur" replace />;
  if (!loading && session && role === "eleve") return <Navigate to="/eleve" replace />;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      toast.error("Erreur", { description: translateAuthError(error.message) });
    } else {
      toast.success("Code envoyé", { description: "Consultez votre boîte mail." });
      setStep("code");
    }
    setBusy(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      toast.error("Code invalide", { description: translateAuthError(error.message) });
    } else {
      toast.success("Connexion réussie !");
    }
    setBusy(false);
  };

  const handleResend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) toast.error("Erreur", { description: translateAuthError(error.message) });
    else toast.success("Nouveau code envoyé");
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
            <CardTitle>{step === "email" ? "Connexion" : "Entrez votre code"}</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Recevez un code à 6 chiffres par email."
                : `Code envoyé à ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Envoi…" : "Recevoir mon code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2 flex flex-col items-center">
                  <Label>Code à 6 chiffres</Label>
                  <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                  {busy ? "Vérification…" : "Se connecter"}
                </Button>
                <div className="flex justify-between text-sm">
                  <Button type="button" variant="link" className="px-0" onClick={() => { setStep("email"); setCode(""); }}>
                    Changer d'email
                  </Button>
                  <Button type="button" variant="link" className="px-0" onClick={handleResend} disabled={busy}>
                    Renvoyer le code
                  </Button>
                </div>
              </form>
            )}
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
