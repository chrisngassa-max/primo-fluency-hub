import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AIConsentSettings from "@/components/AIConsentSettings";
import { useAuth } from "@/contexts/AuthContext";

export default function AccesLimite() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Accès limité</CardTitle>
            <CardDescription>
              Cette formation utilise l'intelligence artificielle et l'enregistrement vocal pour fonctionner.
              Ces traitements sont nécessaires pour corriger les exercices, suivre la progression et préparer les devoirs.
              Si vous refusez, vous ne pourrez pas suivre la formation sur captcf.fr.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vous pouvez modifier votre choix ci-dessous, consulter la politique de confidentialité ou vous déconnecter.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/legal">Lire la politique de confidentialité</Link>
              </Button>
              <Button variant="outline" onClick={() => signOut()}>Se déconnecter</Button>
            </div>
          </CardContent>
        </Card>

        <AIConsentSettings />
      </div>
    </div>
  );
}
