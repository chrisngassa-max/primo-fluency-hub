import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { translateAuthError } from "@/lib/authErrors";

const getRecoveryParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const hashQuery = hash.includes("?")
    ? hash.split("?")[1]
    : hash.startsWith("#access_token=")
      ? hash.slice(1)
      : "";
  const hashParams = new URLSearchParams(hashQuery);

  return {
    type: searchParams.get("type") ?? hashParams.get("type"),
    hasToken: Boolean(
      searchParams.get("access_token") ||
      hashParams.get("access_token") ||
      searchParams.get("refresh_token") ||
      hashParams.get("refresh_token") ||
      searchParams.get("code") ||
      hashParams.get("code")
    ),
  };
};

const resetRedirectUrl = () => `${window.location.origin}/#/reset-password`;

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"loading" | "recovery" | "request">("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const syncRecoveryState = async () => {
      const recovery = getRecoveryParams();
      if (recovery.type === "recovery" || recovery.hasToken) {
        setMode("recovery");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setMode("recovery");
        return;
      }

      setMode("request");
    };

    void syncRecoveryState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setMode("recovery");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Erreur", { description: error.message });
    } else {
      toast.success("Mot de passe mis à jour !");
      navigate("/formateur/login");
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: resetRedirectUrl(),
    });
    if (error) {
      toast.error("Erreur", { description: translateAuthError(error.message) });
    } else {
      toast.success("Email envoyé", { description: "Consultez votre boîte mail pour réinitialiser votre mot de passe." });
    }
    setLoading(false);
  };

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Chargement…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "request") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>Entrez votre email pour recevoir un lien de réinitialisation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Adresse email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" asChild>
                <Link to="/formateur/login">Retour à la connexion</Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input id="new-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Mise à jour…" : "Mettre à jour"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
