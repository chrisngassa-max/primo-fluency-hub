import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Mock data — will be replaced with real DB queries
const mockSeances = [
  { id: "s1", titre: "Séance 1 — Vie quotidienne", groupe: "Groupe A1", date: "2026-03-20", statut: "planifiee" },
  { id: "s2", titre: "Séance 2 — Démarches préfecture", groupe: "Groupe A2", date: "2026-03-22", statut: "planifiee" },
  { id: "s3", titre: "Séance 3 — Emploi et CV", groupe: "Groupe A1", date: "2026-03-18", statut: "terminee" },
];

const statutBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  planifiee: { label: "Planifiée", variant: "outline" },
  en_cours: { label: "En cours", variant: "default" },
  terminee: { label: "Terminée", variant: "secondary" },
  annulee: { label: "Annulée", variant: "destructive" },
};

const SeancesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Séances</h1>
          <p className="text-sm text-muted-foreground">Planifiez et gérez vos séances de formation.</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle séance
        </Button>
      </div>

      {mockSeances.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Aucune séance</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Créez votre première séance pour commencer.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mockSeances.map((s) => {
            const badge = statutBadge[s.statut] || statutBadge.planifiee;
            return (
              <Card
                key={s.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(`/formateur/seances/${s.id}/pilote`)}
              >
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.titre}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.groupe} · {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SeancesPage;
