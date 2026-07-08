import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, FileText, GraduationCap, FolderOpen, Library, Plus } from "lucide-react";
import { fetchActivePlanVersion, fetchTrainingSessions } from "@/lib/curriculum/api";
import {
  createBlankSessionDocument,
  deleteSessionDocument,
  fetchSessionDocuments,
  reorderSessionDocuments,
  swapSessionDocumentOrder,
} from "@/lib/curriculum/documents";
import {
  SESSION_DOCUMENT_STATUS_LABELS,
  type SessionDocument,
  type SessionDocumentAudience,
  type SessionDocumentType,
} from "@/lib/curriculum/types";
import { InsertMenu, SessionDocumentsPanel } from "@/components/curriculum/SessionDocumentsPanel";

type AudienceTab = "formateur" | "apprenant" | "staging";

// audience='both' est visible à la fois dans Formateur et Apprenant ;
// l'ordre global (display_order) reste le même dans les deux vues.
function matchesTab(doc: SessionDocument, tab: AudienceTab): boolean {
  if (tab === "staging") return doc.audience === "staging";
  if (tab === "formateur") return doc.audience === "formateur" || doc.audience === "both";
  return doc.audience === "apprenant" || doc.audience === "both";
}

const SessionDocumentsPage = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: plan } = useQuery({
    queryKey: ["curriculum-plan-version"],
    queryFn: fetchActivePlanVersion,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["curriculum-training-sessions", plan?.id],
    queryFn: () => fetchTrainingSessions(plan!.id),
    enabled: !!plan?.id,
  });

  const trainingSession = useMemo(
    () => sessions?.find((s) => s.code === sessionCode),
    [sessions, sessionCode],
  );

  const documentsQueryKey = ["session-documents", sessionCode];
  const {
    data: documents,
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: documentsQueryKey,
    queryFn: () => fetchSessionDocuments(sessionCode!),
    enabled: !!sessionCode,
  });

  const allDocuments = useMemo(() => documents ?? [], [documents]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: documentsQueryKey });
  }

  async function handleMove(doc: SessionDocument, direction: "up" | "down", visibleList: SessionDocument[]) {
    const index = visibleList.findIndex((d) => d.id === doc.id);
    const neighbor = visibleList[direction === "up" ? index - 1 : index + 1];
    if (!neighbor) return;
    setBusy(true);
    try {
      await swapSessionDocumentOrder(
        { id: doc.id, display_order: doc.display_order },
        { id: neighbor.id, display_order: neighbor.display_order },
      );
      invalidate();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function insertBlank(
    type: SessionDocumentType,
    audience: SessionDocumentAudience,
    insertionIndex: number,
  ) {
    setBusy(true);
    try {
      const newDoc = await createBlankSessionDocument({
        sessionCode: sessionCode!,
        documentType: type,
        audience,
        displayOrder: allDocuments.length + 1,
      });
      const newOrderIds = allDocuments.map((d) => d.id);
      newOrderIds.splice(insertionIndex, 0, newDoc.id);
      await reorderSessionDocuments(newOrderIds);
      invalidate();
      toast.success("Document ajouté.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  // L'audience du bloc créé est celle de l'onglet depuis lequel on insère
  // (pas une audience propre au type choisi) : ainsi le document apparaît
  // toujours immédiatement dans l'onglet où l'utilisateur vient de cliquer.
  function handleInsertRelative(
    tabAudience: SessionDocumentAudience,
    referenceDoc: SessionDocument,
    position: "before" | "after",
    type: SessionDocumentType,
  ) {
    const globalIndex = allDocuments.findIndex((d) => d.id === referenceDoc.id);
    const insertionIndex = position === "before" ? globalIndex : globalIndex + 1;
    void insertBlank(type, tabAudience, insertionIndex);
  }

  function handleInsertAtEnd(tabAudience: SessionDocumentAudience, type: SessionDocumentType) {
    void insertBlank(type, tabAudience, allDocuments.length);
  }

  async function handleDelete(doc: SessionDocument) {
    setBusy(true);
    try {
      await deleteSessionDocument(doc.id);
      invalidate();
      toast.success("Document supprimé.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!sessionCode) return null;

  const formateurDocs = allDocuments.filter((d) => matchesTab(d, "formateur"));
  const apprenantDocs = allDocuments.filter((d) => matchesTab(d, "apprenant"));
  const stagingDocs = allDocuments.filter((d) => matchesTab(d, "staging"));

  function renderAddButton(tabAudience: SessionDocumentAudience) {
    return (
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={busy}>
              <Plus className="h-3.5 w-3.5" /> Ajouter un document
            </Button>
          </PopoverTrigger>
          <InsertMenu onPick={(docType) => handleInsertAtEnd(tabAudience, docType)} />
        </Popover>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/formateur/parcours")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            {sessionCode} — Documents de séance
          </h1>
          {sessionsLoading ? (
            <Skeleton className="h-4 w-48 mt-1" />
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {trainingSession?.titre ?? "Curriculum v2"}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 shrink-0"
        >
          {SESSION_DOCUMENT_STATUS_LABELS.a_completer}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Déroulé de la séance : brouillons pédagogiques éditables, distincts des ressources publiées par la
        pipeline de génération automatique. L'ordre est commun à tous les onglets. Modifications
        enregistrées automatiquement.
      </p>

      {documentsError ? (
        <p className="text-sm text-destructive">
          Impossible de charger les documents de séance ({(documentsError as Error).message}).
        </p>
      ) : documentsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="formateur">
          <TabsList>
            <TabsTrigger value="formateur" className="gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> Formateur
            </TabsTrigger>
            <TabsTrigger value="apprenant" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Apprenant
            </TabsTrigger>
            <TabsTrigger value="ressources" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Ressources à classer
            </TabsTrigger>
            <TabsTrigger value="bibliotheque" className="gap-1.5">
              <Library className="h-3.5 w-3.5" /> Bibliothèque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="formateur" className="mt-4 space-y-3">
            {renderAddButton("formateur")}
            <SessionDocumentsPanel
              documents={formateurDocs}
              emptyMessage="Aucun document formateur pour l'instant."
              onSaved={invalidate}
              onMove={(doc, dir) => handleMove(doc, dir, formateurDocs)}
              onInsert={(doc, pos, type) => handleInsertRelative("formateur", doc, pos, type)}
              onDelete={handleDelete}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="apprenant" className="mt-4 space-y-3">
            {renderAddButton("apprenant")}
            <SessionDocumentsPanel
              documents={apprenantDocs}
              emptyMessage="Aucun document apprenant pour l'instant."
              onSaved={invalidate}
              onMove={(doc, dir) => handleMove(doc, dir, apprenantDocs)}
              onInsert={(doc, pos, type) => handleInsertRelative("apprenant", doc, pos, type)}
              onDelete={handleDelete}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="ressources" className="mt-4 space-y-3">
            {renderAddButton("staging")}
            <SessionDocumentsPanel
              documents={stagingDocs}
              emptyMessage="Les PDF, Word, images ou exercices ajoutés apparaîtront ici avant classement."
              onSaved={invalidate}
              onMove={(doc, dir) => handleMove(doc, dir, stagingDocs)}
              onInsert={(doc, pos, type) => handleInsertRelative("staging", doc, pos, type)}
              onDelete={handleDelete}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="bibliotheque" className="mt-4">
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Cette zone permettra de rechercher dans la banque d'exercices et d'ajouter un exercice à la
              séance sans le dupliquer.
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SessionDocumentsPage;
