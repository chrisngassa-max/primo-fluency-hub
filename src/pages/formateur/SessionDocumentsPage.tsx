import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, GraduationCap, FolderOpen, Library } from "lucide-react";
import { fetchActivePlanVersion, fetchTrainingSessions } from "@/lib/curriculum/api";
import { SessionDocumentsPanel } from "@/components/curriculum/SessionDocumentsPanel";
import { SESSION_DOCUMENT_STATUS_LABELS, type SessionDocumentType } from "@/lib/curriculum/types";

// Répartition initiale par audience (Lot 1). À terme (Lot 2), l'audience sera
// un champ affecté par document (formateur/apprenant/both) plutôt qu'un
// mapping fixe par type — voir PROMPT documents de séance, section Lot 2.
const FORMATEUR_TYPES: SessionDocumentType[] = ["fiche_formateur", "corrige_formateur"];
const APPRENANT_TYPES: SessionDocumentType[] = [
  "fiche_apprenant",
  "dialogue_transcription",
  "qcm_tcf",
  "qcm_civique",
  "lexique",
  "support_visuel",
  "document_transforme",
];
// Tout document qui n'est pas encore affecté à une audience (imports, exercices
// liés, audio) atterrit ici tant qu'il n'a pas été classé.
const RESSOURCES_TYPES: SessionDocumentType[] = ["document_importe", "exercice_interactif", "audio_mp3"];

const SessionDocumentsPage = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();

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

  if (!sessionCode) return null;

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
        pipeline de génération automatique. Modifications enregistrées automatiquement.
      </p>

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

        <TabsContent value="formateur" className="mt-4">
          <SessionDocumentsPanel sessionCode={sessionCode} documentTypes={FORMATEUR_TYPES} />
        </TabsContent>

        <TabsContent value="apprenant" className="mt-4">
          <SessionDocumentsPanel sessionCode={sessionCode} documentTypes={APPRENANT_TYPES} />
        </TabsContent>

        <TabsContent value="ressources" className="mt-4">
          <SessionDocumentsPanel
            sessionCode={sessionCode}
            documentTypes={RESSOURCES_TYPES}
            emptyMessage="Les PDF, Word, images ou exercices ajoutés apparaîtront ici avant classement."
          />
        </TabsContent>

        <TabsContent value="bibliotheque" className="mt-4">
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Cette zone permettra de rechercher dans la banque d'exercices et d'ajouter un exercice à la
            séance sans le dupliquer.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SessionDocumentsPage;
