import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import AppFooter from "@/components/AppFooter";

type Status = "loading" | "valid" | "already" | "invalid" | "done" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
      } else if (data?.success) {
        setStatus("done");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Désabonnement</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Vérification en cours…</p>
            </div>
          )}
          {status === "valid" && (
            <>
              <p className="text-muted-foreground">
                Tu es sur le point de te désabonner des emails de CAP TCF.
              </p>
              <Button onClick={handleUnsubscribe} disabled={busy} className="w-full">
                {busy ? "Traitement…" : "Confirmer le désabonnement"}
              </Button>
            </>
          )}
          {status === "done" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-10 w-10 text-success" />
              <p className="text-foreground font-medium">Désabonnement confirmé</p>
              <p className="text-sm text-muted-foreground">
                Tu ne recevras plus d'emails de notre part.
              </p>
            </div>
          )}
          {status === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-foreground font-medium">Déjà désabonné(e)</p>
              <p className="text-sm text-muted-foreground">
                Tu es déjà désabonné(e) de nos emails.
              </p>
            </div>
          )}
          {status === "invalid" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-foreground font-medium">Lien invalide</p>
              <p className="text-sm text-muted-foreground">
                Ce lien de désabonnement est invalide ou a expiré.
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-foreground font-medium">Erreur</p>
              <p className="text-sm text-muted-foreground">
                Une erreur est survenue. Réessaie plus tard.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4">
        <AppFooter />
      </div>
    </div>
  );
};

export default Unsubscribe;
