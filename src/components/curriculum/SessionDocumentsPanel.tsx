import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText,
  FileDown,
  Loader2,
  Check,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Library,
  Eye,
  FlaskConical,
  X,
  Paperclip,
  Image as ImageIcon,
  GraduationCap,
  Users,
  Wand2,
} from "lucide-react";
import { ExerciseInteractiveTestDialog } from "@/components/curriculum/ExerciseInteractiveTestDialog";
import { RichInsertMenu, type RichInsertAction } from "@/components/curriculum/RichInsertMenu";
import { cn } from "@/lib/utils";
import { updateSessionDocumentContent } from "@/lib/curriculum/documents";
import { fetchExerciseBankDetail } from "@/lib/curriculum/exerciseLinks";
import { getFileSignedUrl } from "@/lib/curriculum/importedFiles";
import {
  BLANK_DOCUMENT_TYPES,
  SESSION_DOCUMENT_STATUS_LABELS,
  SESSION_DOCUMENT_TYPE_LABELS,
  type ExerciseBankDetail,
  type ImportedFileMetadata,
  type SessionDocument,
  type SessionDocumentAudience,
  type SessionDocumentLink,
  type SessionDocumentStatus,
  type SessionDocumentType,
  type SessionFlowItem,
} from "@/lib/curriculum/types";

// Fichiers PDF/DOCX déjà générés et publiés (docs/ -> GitHub Pages).
// Le module d'édition ne les modifie jamais : il lit source_file_path
// pour offrir des liens de téléchargement à côté du contenu éditable.
const DOCS_BASE_URL = "https://chrisngassa-max.github.io/primo-fluency-hub/";

const STATUS_BADGE_CLASS: Record<SessionDocumentStatus, string> = {
  brouillon: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300",
  a_completer: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  relu: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
  valide: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  remplace: "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-900/40 dark:text-zinc-400 line-through",
};

// validation_status de la banque d'exercices (distinct de SessionDocumentStatus).
const VALIDATION_BADGE_CLASS: Record<string, string> = {
  validated_auto: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  approved_human: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  needs_review: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  rejected: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300",
  draft: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/40 dark:text-slate-300",
};

const AUTOSAVE_DELAY_MS = 800;

function stripHtmlToText(html: string): string {
  if (!html.trim()) return "";
  if (typeof window !== "undefined" && "DOMParser" in window) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const paragraphs = Array.from(doc.body.querySelectorAll("p, li"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean);
    return paragraphs.join("\n");
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function getDialogueAudioText(html: string): string {
  if (!html.trim()) return "";

  if (typeof window !== "undefined" && "DOMParser" in window) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const dialogueLines = Array.from(doc.body.querySelectorAll("p"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter((line) => /^[^:]{1,80}:\s+/.test(line));

    if (dialogueLines.length >= 2) return dialogueLines.join("\n");
  }

  return stripHtmlToText(html);
}

// Seuls les blocs vierges (créés depuis "Insérer") sont supprimables ici,
// pour ne pas exposer un risque de suppression accidentelle des documents
// pédagogiques seedés (fiche_formateur, corrigé, etc.).
const DELETABLE_TYPES = new Set<SessionDocumentType>(BLANK_DOCUMENT_TYPES);

interface DocumentEditorCardProps {
  doc: SessionDocument;
  onSaved: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsert: (position: "before" | "after", action: RichInsertAction) => void;
  onDelete: () => void;
  busy: boolean;
}

function DocumentEditorCard({
  doc,
  onSaved,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onInsert,
  onDelete,
  busy,
}: DocumentEditorCardProps) {
  const [draft, setDraft] = useState(doc.content_html ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(doc.content_html ?? "");
    setSaveState("idle");
  }, [doc.id, doc.content_html]);

  function handleChange(value: string) {
    setDraft(value);
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await updateSessionDocumentContent(doc.id, value);
        setSaveState("saved");
        onSaved();
      } catch {
        setSaveState("idle");
      }
    }, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const pdfHref = doc.source_file_path ? `${DOCS_BASE_URL}${doc.source_file_path}.pdf` : null;
  const docxHref = doc.source_file_path ? `${DOCS_BASE_URL}${doc.source_file_path}.docx` : null;
  const canDelete = DELETABLE_TYPES.has(doc.document_type);
  const hasAudioPreview = doc.document_type === "dialogue_transcription" || doc.document_type === "audio_mp3";
  const audioText = hasAudioPreview ? getDialogueAudioText(draft) : "";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 shrink-0"
          disabled={!canMoveUp || busy}
          onClick={onMoveUp}
          title="Monter"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 shrink-0"
          disabled={!canMoveDown || busy}
          onClick={onMoveDown}
          title="Descendre"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground" disabled={busy}>
              <Plus className="h-3 w-3" /> Insérer avant
            </Button>
          </PopoverTrigger>
          <RichInsertMenu onPick={(action) => onInsert("before", action)} />
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground" disabled={busy}>
              <Plus className="h-3 w-3" /> Insérer après
            </Button>
          </PopoverTrigger>
          <RichInsertMenu onPick={(action) => onInsert("after", action)} />
        </Popover>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 px-2 ml-auto text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onDelete}
            title="Supprimer ce document vierge"
          >
            <Trash2 className="h-3 w-3" /> Supprimer
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {SESSION_DOCUMENT_TYPE_LABELS[doc.document_type]}
                </Badge>
                {doc.level && (
                  <Badge variant="outline" className="text-[10px]">
                    {doc.level}
                  </Badge>
                )}
                <Badge className={cn("text-[10px] border", STATUS_BADGE_CLASS[doc.status])} variant="outline">
                  {SESSION_DOCUMENT_STATUS_LABELS[doc.status]}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pdfHref && (
                <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <a href={pdfHref} target="_blank" rel="noopener noreferrer">
                    <FileDown className="h-3 w-3" /> PDF
                  </a>
                </Button>
              )}
              {docxHref && (
                <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <a href={docxHref} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> DOCX
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasAudioPreview && (
            <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                Audio de la transcription
              </p>
              {audioText ? (
                <TTSAudioPlayer text={audioText} label="Ecouter la transcription" showSpeedControl dialogueMode />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ajoutez une transcription dans le document pour pouvoir l'ecouter.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Lecture de controle generee depuis le texte editable. Le MP3 definitif pourra etre ajoute comme fichier audio si besoin.
              </p>
            </div>
          )}
          <Tabs defaultValue="apercu">
            <div className="flex items-center justify-between gap-2">
              <TabsList className="h-8">
                <TabsTrigger value="apercu" className="text-xs h-6">Aperçu</TabsTrigger>
                <TabsTrigger value="modifier" className="text-xs h-6">Modifier</TabsTrigger>
              </TabsList>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" /> Enregistré
                  </>
                )}
              </span>
            </div>
            <TabsContent value="apercu" className="mt-3">
              <div
                className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-3 max-h-64 overflow-y-auto text-sm [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_td]:align-top"
                dangerouslySetInnerHTML={{ __html: draft || "<p class='text-muted-foreground'>Contenu vide.</p>" }}
              />
            </TabsContent>
            <TabsContent value="modifier" className="mt-3">
              <Textarea
                value={draft}
                onChange={(e) => handleChange(e.target.value)}
                className="font-mono text-xs min-h-[220px]"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                HTML simple (paragraphes, listes, titres). Enregistrement automatique {AUTOSAVE_DELAY_MS / 1000} s après la dernière frappe.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ExercisePreviewDialog({ exerciseId, open, onOpenChange }: { exerciseId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [detail, setDetail] = useState<ExerciseBankDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchExerciseBankDetail(exerciseId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [open, exerciseId]);

  const items = Array.isArray((detail?.contenu as any)?.items) ? ((detail!.contenu as any).items as any[]) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4 text-indigo-600" />
            {detail?.titre ?? "Exercice"}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : detail ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{detail.niveau_vise}</Badge>
              <Badge variant="outline" className="text-[10px]">{detail.competence}</Badge>
              <Badge variant="outline" className="text-[10px]">{detail.format}</Badge>
              {detail.theme && <Badge variant="outline" className="text-[10px]">{detail.theme}</Badge>}
            </div>
            <p className="font-medium">{detail.consigne}</p>
            {(detail.contenu as any)?.texte && (
              <div className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-line">
                {(detail.contenu as any).texte}
              </div>
            )}
            {items && (
              <ol className="space-y-2 list-decimal list-inside">
                {items.map((it, i) => (
                  <li key={i}>
                    <span>{it.question ?? it.enonce}</span>
                    {Array.isArray(it.options) && (
                      <ul className="ml-5 list-disc text-muted-foreground">
                        {it.options.map((opt: string, j: number) => (
                          <li key={j}>{opt}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-[11px] text-muted-foreground">
              Lecture seule — l'édition du contenu de cet exercice se fait depuis la bibliothèque d'exercices, pas depuis le déroulé de séance.
            </p>
          </div>
        ) : (
          <p className="text-sm text-destructive">Exercice introuvable.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LinkedExerciseCardProps {
  link: SessionDocumentLink;
  exercise: { id: string; titre: string; niveau_vise: string; competence: string; format: string; theme: string | null; validation_status: string; validation_score: number | null } | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  busy: boolean;
}

function LinkedExerciseCard({ link, exercise, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove, busy }: LinkedExerciseCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const title = link.title || exercise?.titre || "Exercice";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={!canMoveUp || busy} onClick={onMoveUp} title="Monter">
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={!canMoveDown || busy} onClick={onMoveDown} title="Descendre">
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] gap-1 px-2 ml-auto text-destructive hover:text-destructive"
          disabled={busy}
          onClick={onRemove}
          title="Retirer de la séance"
        >
          <X className="h-3 w-3" /> Retirer de la séance
        </Button>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Library className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="truncate">{title}</span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" variant="outline">
                  Exercice bibliothèque
                </Badge>
                {exercise ? (
                  <>
                    <Badge variant="outline" className="text-[10px]">{exercise.niveau_vise}</Badge>
                    <Badge variant="outline" className="text-[10px]">{exercise.competence}</Badge>
                    <Badge variant="outline" className="text-[10px]">{exercise.format}</Badge>
                    {exercise.theme && <Badge variant="outline" className="text-[10px]">{exercise.theme}</Badge>}
                    <Badge className={cn("text-[10px] border", VALIDATION_BADGE_CLASS[exercise.validation_status] ?? "")} variant="outline">
                      {exercise.validation_status}
                    </Badge>
                    {exercise.validation_score != null && (
                      <Badge variant="outline" className="text-[10px]">Score {exercise.validation_score}</Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-destructive">Exercice introuvable</Badge>
                )}
              </div>
            </div>
            {exercise && (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-3 w-3" /> Voir
                </Button>
                <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={() => setTestOpen(true)}>
                  <FlaskConical className="h-3 w-3" /> Tester
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>
      {exercise && <ExercisePreviewDialog exerciseId={exercise.id} open={previewOpen} onOpenChange={setPreviewOpen} />}
      {exercise && (
        <ExerciseInteractiveTestDialog
          exerciseId={exercise.id}
          open={testOpen}
          onOpenChange={setTestOpen}
        />
      )}
    </div>
  );
}

const FILE_TYPE_LABEL: Record<string, string> = { pdf: "PDF", docx: "DOCX", image: "Image", audio: "Audio", video: "Video" };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface ImportedFileCardProps {
  link: SessionDocumentLink;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAssign: (audience: SessionDocumentAudience) => void;
  onTransformPdf?: (link: SessionDocumentLink) => void;
  busy: boolean;
}

function ImportedFileCard({ link, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove, onAssign, onTransformPdf, busy }: ImportedFileCardProps) {
  const [opening, setOpening] = useState(false);
  const meta = link.metadata as unknown as Partial<ImportedFileMetadata>;
  const title = link.title || meta.original_filename || "Fichier importé";

  async function handleOpen() {
    if (!meta.storage_path) return;
    setOpening(true);
    try {
      const url = await getFileSignedUrl(meta.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={!canMoveUp || busy} onClick={onMoveUp} title="Monter">
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={!canMoveDown || busy} onClick={onMoveDown} title="Descendre">
          <ArrowDown className="h-3 w-3" />
        </Button>
        {link.audience !== "formateur" && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" disabled={busy} onClick={() => onAssign("formateur")} title="Affecter à Formateur">
            <GraduationCap className="h-3 w-3" /> Formateur
          </Button>
        )}
        {link.audience !== "apprenant" && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" disabled={busy} onClick={() => onAssign("apprenant")} title="Affecter à Apprenant">
            <FileText className="h-3 w-3" /> Apprenant
          </Button>
        )}
        {link.audience !== "both" && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" disabled={busy} onClick={() => onAssign("both")} title="Affecter aux deux">
            <Users className="h-3 w-3" /> Les deux
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] gap-1 px-2 ml-auto text-destructive hover:text-destructive"
          disabled={busy}
          onClick={onRemove}
          title="Retirer de la séance"
        >
          <X className="h-3 w-3" /> Retirer de la séance
        </Button>
      </div>

      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {link.linked_type === "image" ? (
                  <ImageIcon className="h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <Paperclip className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span className="truncate">{title}</span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" variant="outline">
                  Fichier importé
                </Badge>
                <Badge variant="outline" className="text-[10px]">{FILE_TYPE_LABEL[link.linked_type] ?? link.linked_type}</Badge>
                {typeof meta.size === "number" && (
                  <Badge variant="outline" className="text-[10px]">{formatFileSize(meta.size)}</Badge>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" disabled={opening || !meta.storage_path} onClick={handleOpen}>
              {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Ouvrir
            </Button>
            {link.linked_type === "pdf" && onTransformPdf && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs gap-1 shrink-0"
                disabled={busy}
                onClick={() => onTransformPdf(link)}
              >
                <Wand2 className="h-3 w-3" /> Transformer en exercice
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

interface SessionDocumentsPanelProps {
  /** Items déjà filtrés (audience) et triés (display_order global fusionné) pour cet onglet. */
  items: SessionFlowItem[];
  /** Message affiché quand la liste (filtrée) est vide. */
  emptyMessage: string;
  onSaved: () => void;
  onMove: (item: SessionFlowItem, direction: "up" | "down") => void;
  onInsert: (referenceDoc: SessionDocument, position: "before" | "after", action: RichInsertAction) => void;
  onDelete: (doc: SessionDocument) => void;
  onRemoveLink: (link: SessionDocumentLink) => void;
  onAssignLinkAudience: (link: SessionDocumentLink, audience: SessionDocumentAudience) => void;
  onTransformPdf?: (link: SessionDocumentLink) => void;
  /** true pendant un déplacement/insertion/suppression en cours (désactive les boutons). */
  busy: boolean;
}

export function SessionDocumentsPanel({
  items,
  emptyMessage,
  onSaved,
  onMove,
  onInsert,
  onDelete,
  onRemoveLink,
  onAssignLinkAudience,
  onTransformPdf,
  busy,
}: SessionDocumentsPanelProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Ces documents sont des brouillons pédagogiques ("socle à compléter"), pas des versions finales.
        Ils sont modifiables ici et enregistrés automatiquement. Les PDF/DOCX déjà publiés restent
        inchangés et accessibles via les boutons ci-dessus. Les exercices de la bibliothèque sont en
        lecture seule ici (pas de duplication). L'ordre est celui du déroulé de séance (commun à tous
        les onglets).
      </p>
      {items.map((item, index) => {
        if (item.kind === "document") {
          return (
            <DocumentEditorCard
              key={item.document.id}
              doc={item.document}
              onSaved={onSaved}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => onMove(item, "up")}
              onMoveDown={() => onMove(item, "down")}
              onInsert={(position, action) => onInsert(item.document, position, action)}
              onDelete={() => onDelete(item.document)}
              busy={busy}
            />
          );
        }
        if (item.link.linked_type === "exercise") {
          return (
            <LinkedExerciseCard
              key={item.link.id}
              link={item.link}
              exercise={item.exercise}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => onMove(item, "up")}
              onMoveDown={() => onMove(item, "down")}
              onRemove={() => onRemoveLink(item.link)}
              busy={busy}
            />
          );
        }
        return (
          <ImportedFileCard
            key={item.link.id}
            link={item.link}
            canMoveUp={index > 0}
            canMoveDown={index < items.length - 1}
            onMoveUp={() => onMove(item, "up")}
            onMoveDown={() => onMove(item, "down")}
            onRemove={() => onRemoveLink(item.link)}
            onAssign={(audience) => onAssignLinkAudience(item.link, audience)}
            onTransformPdf={onTransformPdf}
            busy={busy}
          />
        );
      })}
    </div>
  );
}
