import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { useSandboxPreview } from "@/contexts/SandboxPreviewContext";

export default function SandboxGridPreview() {
  const { enterStudentPreview, exitStudentPreview } = useSandboxPreview();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.functions.invoke("sandbox-mosaic-summary").then(async ({ data, error: invokeError }) => {
      if (invokeError) setError(await getEdgeFunctionErrorMessage(invokeError, "Mosaique indisponible"));
      else setProfiles(data?.profils ?? []);
    });
  }, []);

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="space-y-4 p-6">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={exitStudentPreview}>
            Revenir a la vue formateur
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mosaique des profils sandbox</h1>
        <p className="text-muted-foreground">Comparaison legere des quatre eleves, chargee en un seul appel.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map((profile) => (
          <Card key={profile.niveau} className="border-2 border-amber-200">
            <CardHeader className="flex-row items-center">
              <CardTitle>Eleve Test {profile.niveau}</CardTitle>
              <Button className="ml-auto" size="sm" onClick={() => enterStudentPreview(profile.niveau)}>
                Ouvrir <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(profile.competences ?? {}).map(([code, value]) => (
                  <div key={code} className="rounded-md bg-muted p-2 text-center">
                    <p className="text-xs text-muted-foreground">{code}</p>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{profile.devoirs_en_cours} en cours</span>
                <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{profile.derniere_activite ? new Date(profile.derniere_activite).toLocaleDateString("fr-FR") : "Aucune activite"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
