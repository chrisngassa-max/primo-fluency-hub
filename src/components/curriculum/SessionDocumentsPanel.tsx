import { useEffect, useRef, useState } from "react";
import { Close as PopoverClose } from "@radix-ui/react-popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateSessionDocumentContent } from "@/lib/curriculum/documents";
import {
  BLANK_DOCUMENT_TYPES,
  SESSION_DOCUMENT_STATUS_LABELS,
  SESSION_DOCUMENT_TYPE_LABELS,
  type SessionDocument,
  type SessionDocumentStatus,
  type SessionDocumentType,
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

const AUTOSAVE_DELAY_MS = 800;

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
  onInsert: (position: "before" | "after", type: SessionDocumentType) => void;
  onDelete: () => void;
  busy: boolean;
}

export function InsertMenu({ onPick }: { onPick: (type: SessionDocumentType) => void }) {
  return (
    <PopoverContent className="w-56 p-1" align="start">
      {BLANK_DOCUMENT_TYPES.map((type) => (
        <PopoverClose key={type} asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={() => onPick(type)}
          >
            {SESSION_DOCUMENT_TYPE_LABELS[type]}
          </Button>
        </PopoverClose>
      ))}
    </PopoverContent>
  );
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
          <InsertMenu onPick={(type) => onInsert("before", type)} />
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground" disabled={busy}>
              <Plus className="h-3 w-3" /> Insérer après
            </Button>
          </PopoverTrigger>
          <InsertMenu onPick={(type) => onInsert("after", type)} />
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

interface SessionDocumentsPanelProps {
  /** Documents déjà filtrés (audience) et triés (display_order global) pour cet onglet. */
  documents: SessionDocument[];
  /** Message affiché quand la liste (filtrée) est vide. */
  emptyMessage: string;
  onSaved: () => void;
  onMove: (doc: SessionDocument, direction: "up" | "down") => void;
  onInsert: (referenceDoc: SessionDocument, position: "before" | "after", type: SessionDocumentType) => void;
  onDelete: (doc: SessionDocument) => void;
  /** true pendant un déplacement/insertion/suppression en cours (désactive les boutons). */
  busy: boolean;
}

export function SessionDocumentsPanel({
  documents,
  emptyMessage,
  onSaved,
  onMove,
  onInsert,
  onDelete,
  busy,
}: SessionDocumentsPanelProps) {
  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Ces documents sont des brouillons pédagogiques ("socle à compléter"), pas des versions finales.
        Ils sont modifiables ici et enregistrés automatiquement. Les PDF/DOCX déjà publiés restent
        inchangés et accessibles via les boutons ci-dessus. L'ordre est celui du déroulé de séance
        (commun à tous les onglets).
      </p>
      {documents.map((doc, index) => (
        <DocumentEditorCard
          key={doc.id}
          doc={doc}
          onSaved={onSaved}
          canMoveUp={index > 0}
          canMoveDown={index < documents.length - 1}
          onMoveUp={() => onMove(doc, "up")}
          onMoveDown={() => onMove(doc, "down")}
          onInsert={(position, type) => onInsert(doc, position, type)}
          onDelete={() => onDelete(doc)}
          busy={busy}
        />
      ))}
    </div>
  );
}
