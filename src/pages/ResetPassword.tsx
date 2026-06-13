import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  consumePasswordRecovery,
  getLoginPath,
  type AuthAudience,
} from "@/lib/passwordRecovery";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [audience, setAudience] = useState<AuthAudience>("eleve");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const recoveryAudience = consumePasswordRecovery();
    if (recoveryAudience) {
      setAudience(recoveryAudience);
      setReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        const nextAudience = searchParams.get("audience") === "formateur" ? "formateur" : "eleve";
        setAudience(nextAudience);
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [searchParams]);

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
      await supabase.auth.signOut();
      navigate(getLoginPath(audience), { replace: true });
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p role="alert" className="text-muted-foreground">
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
            <Button variant="link" onClick={() => navigate(getLoginPath(audience))}>
              Demander un nouveau lien
            </Button>
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
