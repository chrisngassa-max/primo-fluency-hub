import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const syncRecoveryState = async () => {
      const recovery = getRecoveryParams();
      if (recovery.type === "recovery" || recovery.hasToken) {
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
    };

    syncRecoveryState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Lien de réinitialisation invalide ou expiré.</p>
            <Button variant="link" onClick={() => navigate("/")}>Retour à la connexion</Button>
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
