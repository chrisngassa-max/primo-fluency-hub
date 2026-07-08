import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FileDown, Loader2, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSessionDocuments, updateSessionDocumentContent } from "@/lib/curriculum/documents";
import {
  SESSION_DOCUMENT_STATUS_LABELS,
  SESSION_DOCUMENT_TYPE_LABELS,
  type SessionDocument,
  type SessionDocumentStatus,
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

interface DocumentEditorCardProps {
  doc: SessionDocument;
  onSaved: () => void;
}

function DocumentEditorCard({ doc, onSaved }: DocumentEditorCardProps) {
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

  return (
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
  );
}

interface SessionDocumentsPanelProps {
  sessionCode: string;
}

export function SessionDocumentsPanel({ sessionCode }: SessionDocumentsPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = ["session-documents", sessionCode];

  const { data: documents, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchSessionDocuments(sessionCode),
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Impossible de charger les documents de séance ({(error as Error).message}).
      </p>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun document de séance pour {sessionCode} pour l'instant. Le module MVP ne couvre que S01 v3.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ces documents sont des brouillons pédagogiques ("socle à compléter"), pas des versions finales.
        Ils sont modifiables ici et enregistrés automatiquement. Les PDF/DOCX déjà publiés restent
        inchangés et accessibles via les boutons ci-dessus.
      </p>
      {documents.map((doc) => (
        <DocumentEditorCard key={doc.id} doc={doc} onSaved={handleSaved} />
      ))}
    </div>
  );
}
