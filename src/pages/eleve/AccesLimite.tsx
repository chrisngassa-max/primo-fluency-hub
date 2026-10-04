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
              Les fonctionnalités IA et vocales dépendent de vos consentements.
              Les devoirs écrits déterministes restent accessibles sans ces accords.
              Les autres parcours conservent leurs conditions d'accès.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vous pouvez modifier votre choix ci-dessous, consulter la politique de confidentialité ou vous déconnecter.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link to="/eleve/devoirs">Mes devoirs écrits</Link></Button>
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
