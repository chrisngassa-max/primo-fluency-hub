import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ClipboardList, TrendingUp } from "lucide-react";

const EleveDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenue, {user?.user_metadata?.prenom || "Élève"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Votre espace de préparation au TCF Pro.</p>
      </div>

      {/* Global progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progression globale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Niveau estimé</span>
              <Badge variant="secondary">Non évalué</Badge>
            </div>
            <Progress value={0} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Passez le test d'entrée pour évaluer votre niveau initial.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Devoirs en attente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun devoir en attente</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Les devoirs apparaîtront ici après vos premières séances.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Entry test CTA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <ClipboardList className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground">Test d'entrée</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Évaluez votre niveau en Compréhension orale, écrite, Expression écrite et Structures de la langue.
              </p>
              <Badge className="mt-3" variant="outline">
                À compléter
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EleveDashboard;
