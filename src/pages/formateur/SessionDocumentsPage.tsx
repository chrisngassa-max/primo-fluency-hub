import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, FileText, GraduationCap, FolderOpen, Library, Plus, Upload, Loader2 } from "lucide-react";
import { fetchActivePlanVersion, fetchTrainingSessions } from "@/lib/curriculum/api";
import {
  createBlankSessionDocument,
  deleteSessionDocument,
  fetchSessionDocuments,
} from "@/lib/curriculum/documents";
import {
  addExerciseLink,
  fetchSessionDocumentLinks,
  removeSessionDocumentLink,
  updateSessionDocumentLinkAudience,
} from "@/lib/curriculum/exerciseLinks";
import { addFileLink, linkTypeForFilename, uploadSessionFile } from "@/lib/curriculum/importedFiles";
import { buildFlowItems, nextDisplayOrder, reorderSessionFlow, swapSessionFlowOrder, toFlowRef } from "@/lib/curriculum/sessionFlow";
import {
  SESSION_DOCUMENT_STATUS_LABELS,
  type ExerciseBankPreview,
  type SessionDocument,
  type SessionDocumentAudience,
  type SessionDocumentLink,
  type SessionDocumentType,
  type SessionFlowItem,
} from "@/lib/curriculum/types";
import { InsertMenu, SessionDocumentsPanel } from "@/components/curriculum/SessionDocumentsPanel";
import { ExerciseLibraryTab } from "@/components/curriculum/ExerciseLibraryTab";

type AudienceTab = "formateur" | "apprenant" | "staging";

// audience='both' est visible à la fois dans Formateur et Apprenant ;
// l'ordre global (display_order fusionné documents + liens) reste le
// même dans les deux vues.
function matchesTab(item: SessionFlowItem, tab: AudienceTab): boolean {
  if (tab === "staging") return item.audience === "staging";
  if (tab === "formateur") return item.audience === "formateur" || item.audience === "both";
  return item.audience === "apprenant" || item.audience === "both";
}

const SessionDocumentsPage = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const linksQueryKey = ["session-document-links", sessionCode];
  const {
    data: linksWithExercise,
    isLoading: linksLoading,
    error: linksError,
  } = useQuery({
    queryKey: linksQueryKey,
    queryFn: () => fetchSessionDocumentLinks(sessionCode!),
    enabled: !!sessionCode,
  });

  const allDocuments = useMemo(() => documents ?? [], [documents]);
  const allLinks = useMemo(() => linksWithExercise ?? [], [linksWithExercise]);
  const addedExerciseIds = useMemo(() => new Set(allLinks.map((l) => l.link.linked_id)), [allLinks]);

  // Déroulé fusionné : documents (session_documents) + exercices liés
  // (session_document_links), triés par le même display_order global.
  const allFlowItems = useMemo(
    () => buildFlowItems(allDocuments, allLinks),
    [allDocuments, allLinks],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    queryClient.invalidateQueries({ queryKey: linksQueryKey });
  }

  async function handleMove(item: SessionFlowItem, direction: "up" | "down", visibleList: SessionFlowItem[]) {
    const index = visibleList.findIndex((it) =>
      it.kind === "document" && item.kind === "document"
        ? it.document.id === item.document.id
        : it.kind === "link" && item.kind === "link"
          ? it.link.id === item.link.id
          : false,
    );
    const neighbor = visibleList[direction === "up" ? index - 1 : index + 1];
    if (!neighbor) return;
    setBusy(true);
    try {
      await swapSessionFlowOrder(toFlowRef(item), toFlowRef(neighbor));
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
        displayOrder: nextDisplayOrder(allFlowItems),
      });
      const newOrderRefs = allFlowItems.map(toFlowRef);
      newOrderRefs.splice(insertionIndex, 0, { kind: "document", id: newDoc.id, display_order: 0 });
      await reorderSessionFlow(newOrderRefs);
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
    const globalIndex = allFlowItems.findIndex((it) => it.kind === "document" && it.document.id === referenceDoc.id);
    const insertionIndex = position === "before" ? globalIndex : globalIndex + 1;
    void insertBlank(type, tabAudience, insertionIndex);
  }

  function handleInsertAtEnd(tabAudience: SessionDocumentAudience, type: SessionDocumentType) {
    void insertBlank(type, tabAudience, allFlowItems.length);
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

  async function handleAddExercise(exercise: ExerciseBankPreview) {
    setBusy(true);
    try {
      await addExerciseLink({
        sessionCode: sessionCode!,
        exerciseId: exercise.id,
        title: exercise.titre,
        audience: "apprenant",
        displayOrder: nextDisplayOrder(allFlowItems),
      });
      invalidate();
      toast.success("Exercice ajouté à la séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveLink(link: SessionDocumentLink) {
    setBusy(true);
    try {
      await removeSessionDocumentLink(link.id);
      invalidate();
      // Décision produit Lot 4 : on ne supprime que la liaison. Le fichier
      // reste dans Supabase Storage (nettoyage prévu dans un lot ultérieur).
      toast.success("Retiré de la séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignLinkAudience(link: SessionDocumentLink, audience: SessionDocumentAudience) {
    setBusy(true);
    try {
      await updateSessionDocumentLinkAudience(link.id, audience);
      invalidate();
      toast.success("Affectation mise à jour.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg"];

  async function handleImportFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const linkedType = linkTypeForFilename(file.name);
    if (!linkedType) {
      toast.error("Format non accepté", { description: "Utilisez un PDF, DOCX, PNG, JPG ou JPEG." });
      return;
    }
    setImporting(true);
    try {
      const { storagePath } = await uploadSessionFile(file, sessionCode!);
      await addFileLink({
        sessionCode: sessionCode!,
        file,
        storagePath,
        linkedType,
        audience: "staging",
        displayOrder: nextDisplayOrder(allFlowItems),
      });
      invalidate();
      toast.success("Fichier importé dans Ressources à classer.");
    } catch (e: any) {
      toast.error("Erreur d'import", { description: e.message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!sessionCode) return null;

  const formateurItems = allFlowItems.filter((it) => matchesTab(it, "formateur"));
  const apprenantItems = allFlowItems.filter((it) => matchesTab(it, "apprenant"));
  const stagingItems = allFlowItems.filter((it) => matchesTab(it, "staging"));

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

  const loading = documentsLoading || linksLoading;
  const error = documentsError || linksError;

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
        Déroulé de la séance : brouillons pédagogiques éditables et exercices de la bibliothèque liés
        (sans duplication), distincts des ressources publiées par la pipeline de génération automatique.
        L'ordre est commun à tous les onglets. Modifications enregistrées automatiquement.
      </p>

      {error ? (
        <p className="text-sm text-destructive">
          Impossible de charger les documents de séance ({(error as Error).message}).
        </p>
      ) : loading ? (
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
              items={formateurItems}
              emptyMessage="Aucun document formateur pour l'instant."
              onSaved={invalidate}
              onMove={(item, dir) => handleMove(item, dir, formateurItems)}
              onInsert={(doc, pos, type) => handleInsertRelative("formateur", doc, pos, type)}
              onDelete={handleDelete}
              onRemoveLink={handleRemoveLink}
              onAssignLinkAudience={handleAssignLinkAudience}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="apprenant" className="mt-4 space-y-3">
            {renderAddButton("apprenant")}
            <SessionDocumentsPanel
              items={apprenantItems}
              emptyMessage="Aucun document apprenant pour l'instant."
              onSaved={invalidate}
              onMove={(item, dir) => handleMove(item, dir, apprenantItems)}
              onInsert={(doc, pos, type) => handleInsertRelative("apprenant", doc, pos, type)}
              onDelete={handleDelete}
              onRemoveLink={handleRemoveLink}
              onAssignLinkAudience={handleAssignLinkAudience}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="ressources" className="mt-4 space-y-3">
            <div className="flex justify-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => void handleImportFile(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Importer un fichier
              </Button>
              {renderAddButton("staging")}
            </div>
            <SessionDocumentsPanel
              items={stagingItems}
              emptyMessage="Les PDF, Word, images ou exercices ajoutés apparaîtront ici avant classement."
              onSaved={invalidate}
              onMove={(item, dir) => handleMove(item, dir, stagingItems)}
              onInsert={(doc, pos, type) => handleInsertRelative("staging", doc, pos, type)}
              onDelete={handleDelete}
              onRemoveLink={handleRemoveLink}
              onAssignLinkAudience={handleAssignLinkAudience}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="bibliotheque" className="mt-4">
            <ExerciseLibraryTab onAdd={handleAddExercise} busy={busy} addedIds={addedExerciseIds} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SessionDocumentsPage;
