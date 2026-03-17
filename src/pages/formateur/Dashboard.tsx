import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, Calendar, AlertTriangle } from "lucide-react";
import SkillTree from "@/components/SkillTree";

const kpis = [
  { label: "Groupes actifs", value: "0", icon: Users, color: "text-primary" },
  { label: "Élèves inscrits", value: "0", icon: GraduationCap, color: "text-success" },
  { label: "Séances à venir", value: "0", icon: Calendar, color: "text-accent" },
  { label: "Alertes non résolues", value: "0", icon: AlertTriangle, color: "text-destructive" },
];

const FormateurDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour, {user?.user_metadata?.prenom || "Formateur"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité pédagogique.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Séances / Skill Tree */}
      <Tabs defaultValue="seances">
        <TabsList>
          <TabsTrigger value="seances">Séances récentes</TabsTrigger>
          <TabsTrigger value="skilltree">Progression détaillée</TabsTrigger>
        </TabsList>

        <TabsContent value="seances">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Aucune séance planifiée</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Commencez par créer un groupe, puis planifiez votre première séance.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skilltree">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Arborescence TCF — Skill Tree</CardTitle>
            </CardHeader>
            <CardContent>
              <SkillTree />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FormateurDashboard;
