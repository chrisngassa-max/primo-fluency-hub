import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CurriculumPublication, SessionResource } from "@/lib/curriculum/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { GitCompareArrows, History, Loader2, RotateCcw } from "lucide-react";

interface VersionHistoryProps {
  publications: CurriculumPublication[];
  resources: SessionResource[];
  onRestore: (publicationId: string) => void;
  restoringId?: string | null;
}

interface PublicationRow {
  publication: CurriculumPublication;
  resource: SessionResource | undefined;
  diffSummary: string;
}

export function VersionHistory({ publications, resources, onRestore, restoringId }: VersionHistoryProps) {
  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const rows: PublicationRow[] = useMemo(() => {
    const pubsByResource = new Map<string, CurriculumPublication[]>();
    for (const pub of publications) {
      const list = pubsByResource.get(pub.session_resource_id) ?? [];
      list.push(pub);
      pubsByResource.set(pub.session_resource_id, list);
    }

    return publications.map((publication) => {
      const resource = resourceById.get(publication.session_resource_id);
      const siblings = (pubsByResource.get(publication.session_resource_id) ?? []).sort(
        (a, b) => b.version - a.version,
      );
      const prev = siblings.find((p) => p.version === publication.version - 1);
      const diffSummary = prev
        ? `v${prev.version} → v${publication.version}`
        : publication.previous_publication_id
          ? `Restauration depuis publication antérieure`
          : `Première publication`;

      return { publication, resource, diffSummary };
    });
  }, [publications, resourceById]);

  const latestByResource = useMemo(() => {
    const map = new Map<string, CurriculumPublication>();
    for (const row of rows) {
      const existing = map.get(row.publication.session_resource_id);
      if (!existing || row.publication.version > existing.version) {
        map.set(row.publication.session_resource_id, row.publication);
      }
    }
    return map;
  }, [rows]);

  if (publications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des publications
          </CardTitle>
          <CardDescription>Aucune publication enregistrée pour ce plan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historique des publications
        </CardTitle>
        <CardDescription>
          Versions atomiques par ressource · restauration avec vérification des épingles de cohorte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <GitCompareArrows className="h-4 w-4" />
          <AlertDescription className="text-xs">
            La restauration atomique garantit qu&apos;une séance ne conserve jamais un support et un corrigé de
            versions différentes. Les cohortes épinglées sur une version bloquent la restauration.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ressource</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Diff</TableHead>
                <TableHead>Publié le</TableHead>
                <TableHead>Par</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row) => {
                const isLatest = latestByResource.get(row.publication.session_resource_id)?.id === row.publication.id;
                const canRestore = !isLatest && row.publication.version > 1;

                return (
                  <TableRow key={row.publication.id}>
                    <TableCell className="font-mono text-xs max-w-[160px] truncate">
                      {row.resource?.resource_id ?? row.publication.session_resource_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{row.publication.version}</Badge>
                      {isLatest && (
                        <Badge className="ml-1 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30">
                          actuelle
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.diffSummary}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(row.publication.published_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs">{row.publication.published_by}</TableCell>
                    <TableCell>
                      {canRestore && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={restoringId === row.publication.id}
                          onClick={() => onRestore(row.publication.id)}
                        >
                          {restoringId === row.publication.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restaurer
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {rows.length > 50 && (
          <p className="text-xs text-muted-foreground mt-2">
            Affichage des 50 publications les plus récentes sur {rows.length}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default VersionHistory;
