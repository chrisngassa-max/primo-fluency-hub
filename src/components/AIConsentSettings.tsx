import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAIConsent } from "@/hooks/useAIConsent";
import AIConsentModal from "./AIConsentModal";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function AIConsentSettings() {
  const { consent, accept, refresh } = useAIConsent();
  const [editing, setEditing] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const grantedAi = !!consent?.consent_ai && !consent?.revoked_at;
  const grantedBio = !!consent?.consent_biometric && !consent?.revoked_at;

  const revoke = async () => {
    const { error } = await accept(false, false, "settings_revoke");
    if (error) toast.error("Erreur");
    else {
      toast.message("Consentement retiré. Accès pédagogique bloqué.");
      await refresh();
    }
    setConfirmRevoke(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consentement IA et voix</CardTitle>
        <CardDescription>
          Le traitement IA et le traitement vocal sont nécessaires à l'exécution de la formation sur captcf.fr.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Consentement IA</span>
          <Badge variant={grantedAi ? "default" : "destructive"}>
            {grantedAi ? "Accepté" : "Refusé"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Consentement voix / audio</span>
          <Badge variant={grantedBio ? "default" : "destructive"}>
            {grantedBio ? "Accepté" : "Refusé"}
          </Badge>
        </div>
        {consent?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Dernière modification : {new Date(consent.updated_at).toLocaleString("fr-FR")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Modifier mon consentement</Button>
          {(grantedAi || grantedBio) && (
            <Button variant="outline" onClick={() => setConfirmRevoke(true)}>
              Retirer mon consentement
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Pour demander la suppression de vos fichiers audio, transcriptions et journaux IA, contactez-nous à <strong>contact@tcfpro.fr</strong>.
        </p>
      </CardContent>

      {editing && (
        <AIConsentModal open={editing} blocking={false} onClose={() => setEditing(false)} />
      )}

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmer le retrait
            </AlertDialogTitle>
            <AlertDialogDescription>
              Si tu retires ton accord, tu ne pourras plus utiliser les exercices, devoirs, corrections et le suivi de formation sur cette plateforme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={revoke}>Retirer mon consentement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
