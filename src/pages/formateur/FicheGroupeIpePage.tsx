import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGroupeReadinessFiche } from "@/hooks/useEleveReadinessFiche";
import { BANDE_LABELS, type ReadinessBande } from "@/lib/readinessDisplay";
const FicheGroupeIpePage = () => {
  const { groupeId } = useParams<{ groupeId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGroupeReadinessFiche(groupeId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Groupe introuvable ou accès refusé.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Préparation examen — {data.group.nom}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.students.length} élève{data.students.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">IPE médian du groupe</CardTitle>
          <CardDescription>Basé sur les derniers snapshots GLOBAL</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold tabular-nums">
            {data.medianIpe != null ? data.medianIpe : "—"}
            {data.medianIpe != null && (
              <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Classement par IPE global</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead className="text-right">IPE</TableHead>
                <TableHead>Bande</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun élève dans ce groupe.
                  </TableCell>
                </TableRow>
              ) : (
                data.students.map((s) => (
                  <TableRow
                    key={s.eleveId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      navigate(`/formateur/preparation-examen/eleve/${s.eleveId}`)
                    }
                  >
                    <TableCell className="font-medium">{s.nom}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.confiance === "insuffisante" || s.globalScore == null
                        ? "—"
                        : Math.round(s.globalScore)}
                    </TableCell>
                    <TableCell>
                      {s.bande ? (
                        <Badge variant="outline" className="text-xs">
                          {BANDE_LABELS[s.bande as ReadinessBande] ?? s.bande}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link to="/formateur/preparation-examen">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tous les groupes
        </Link>
      </Button>
    </div>
  );
};

export default FicheGroupeIpePage;
