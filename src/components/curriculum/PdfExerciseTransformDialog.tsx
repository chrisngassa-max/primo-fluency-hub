import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { getFileSignedUrl } from "@/lib/curriculum/importedFiles";
import {
  createEmptyPdfTransformItem,
  createEmptyPdfTransformItems,
  createExerciseFromPdfTransform,
  PDF_TRANSFORM_FORMAT_LABELS,
  prevalidatePdfTransformDraft,
  type PdfTransformCompetence,
  type PdfTransformFormat,
  type PdfTransformItem,
  type PdfTransformLevel,
} from "@/lib/curriculum/pdfExerciseTransform";
import type { ImportedFileMetadata, SessionDocumentLink } from "@/lib/curriculum/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FileQuestion, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const LEVELS: PdfTransformLevel[] = ["A1", "A2", "B1", "B2"];
const COMPETENCES: PdfTransformCompetence[] = ["CE", "CO", "EE", "EO", "Structures"];
const FORMATS: PdfTransformFormat[] = ["qcm", "vrai_faux", "texte_lacunaire", "production_ecrite"];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du PDF impossible."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

function analysisToSourceText(analysis: any, fallbackTitle: string): string {
  return [
    `Titre du support : ${analysis?.title || fallbackTitle}`,
    `Thème : ${analysis?.theme || "A compléter"}`,
    `Niveau estimé : ${analysis?.detected_level || "A compléter"}`,
    "",
    "Synthèse fidèle :",
    analysis?.summary || "",
    "",
    `Vocabulaire à conserver : ${(analysis?.vocabulary || []).join(", ")}`,
    `Points de langue : ${(analysis?.grammar_points || []).join(", ")}`,
    `Objectifs : ${(analysis?.learning_objectives || []).join(", ")}`,
  ].join("\n");
}

interface PdfExerciseTransformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionCode: string;
  sourceLink: SessionDocumentLink | null;
  displayOrder: number;
  onCreated: (link: SessionDocumentLink) => void | Promise<void>;
}

export function PdfExerciseTransformDialog({
  open,
  onOpenChange,
  sessionCode,
  sourceLink,
  displayOrder,
  onCreated,
}: PdfExerciseTransformDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<PdfTransformLevel>("A2");
  const [competence, setCompetence] = useState<PdfTransformCompetence>("CE");
  const [theme, setTheme] = useState("");
  const [format, setFormat] = useState<PdfTransformFormat>("qcm");
  const [consigne, setConsigne] = useState("Lisez le document puis répondez aux questions.");
  const [sourceText, setSourceText] = useState("");
  const [items, setItems] = useState<PdfTransformItem[]>(() => createEmptyPdfTransformItems("qcm", 3));
  const [prefilling, setPrefilling] = useState(false);
  const [saving, setSaving] = useState(false);

  const meta = sourceLink?.metadata as unknown as Partial<ImportedFileMetadata> | undefined;
  const sourceTitle = sourceLink?.title || meta?.original_filename || "Document PDF";

  useEffect(() => {
    if (!open || !sourceLink) return;
    setTitle(`Exercice - ${sourceTitle.replace(/\.pdf$/i, "")}`);
    setLevel("A2");
    setCompetence("CE");
    setTheme("");
    setFormat("qcm");
    setConsigne("Lisez le document puis répondez aux questions.");
    setSourceText("");
    setItems(createEmptyPdfTransformItems("qcm", 3));
  }, [open, sourceLink, sourceTitle]);

  const draft = useMemo(
    () =>
      sourceLink
        ? { sessionCode, sourceLink, title, level, competence, theme, format, consigne, sourceText, items }
        : null,
    [sessionCode, sourceLink, title, level, competence, theme, format, consigne, sourceText, items],
  );

  const validation = useMemo(() => (draft ? prevalidatePdfTransformDraft(draft) : null), [draft]);

  function changeFormat(nextFormat: PdfTransformFormat) {
    setFormat(nextFormat);
    setItems(createEmptyPdfTransformItems(nextFormat, Math.max(items.length, 3)));
    if (nextFormat === "production_ecrite") {
      setCompetence("EE");
      setConsigne("Lisez le document puis rédigez une réponse courte en vous appuyant sur les informations utiles.");
    } else if (nextFormat === "texte_lacunaire") {
      setConsigne("Lisez le document puis complétez les phrases.");
    } else {
      setConsigne("Lisez le document puis répondez aux questions.");
    }
  }

  function updateItem(index: number, patch: Partial<PdfTransformItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateOption(itemIndex: number, optionIndex: number, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, options: item.options.map((option, j) => (j === optionIndex ? value : option)) }
          : item,
      ),
    );
  }

  async function handlePrefillFromPdf() {
    if (!meta?.storage_path) return;
    setPrefilling(true);
    try {
      const url = await getFileSignedUrl(meta.storage_path, 300);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Téléchargement du PDF impossible.");
      const blob = await response.blob();
      const pdfBase64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("analyze-pdf-support", {
        body: { pdfBase64, fileName: meta.original_filename || sourceTitle, targetLevel: level },
      });
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, "Analyse du PDF impossible."));
      if ((data as any)?.error) throw new Error((data as any).error);
      const analysis = (data as any)?.analysis;
      setSourceText(analysisToSourceText(analysis, sourceTitle));
      if (analysis?.theme) setTheme(String(analysis.theme));
      toast.success("Préremplissage terminé", {
        description: "Relisez et corrigez le texte avant de créer l'exercice.",
      });
    } catch (error: any) {
      toast.error("Préremplissage impossible", {
        description: `${error.message} Vous pouvez coller le texte manuellement.`,
      });
    } finally {
      setPrefilling(false);
    }
  }

  async function handleCreate() {
    if (!draft || !user) return;
    setSaving(true);
    try {
      const newLink = await createExerciseFromPdfTransform({ draft, userId: user.id, displayOrder });
      await onCreated(newLink);
      toast.success("Exercice interactif créé", {
        description: "Il est ajouté au déroulé de séance et reste modifiable depuis la bibliothèque.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Création impossible", { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  const canCreate = !!draft && !!user && !saving;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-orange-600" />
            Transformer un PDF en exercice interactif
          </DialogTitle>
          <DialogDescription>
            Le PDF reste conservé comme ressource. L'exercice créé est ajouté à la banque puis lié au déroulé de la séance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{sourceTitle}</p>
              <p className="text-xs text-muted-foreground">
                Source PDF importée. Préremplissage possible, mais relecture humaine obligatoire.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Titre de l'exercice</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Niveau</Label>
                <Select value={level} onValueChange={(value) => setLevel(value as PdfTransformLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Compétence</Label>
                <Select value={competence} onValueChange={(value) => setCompetence(value as PdfTransformCompetence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPETENCES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select value={format} onValueChange={(value) => changeFormat(value as PdfTransformFormat)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((value) => <SelectItem key={value} value={value}>{PDF_TRANSFORM_FORMAT_LABELS[value]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Thème</Label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="prefecture, santé, logement..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Consigne</Label>
              <Textarea value={consigne} onChange={(e) => setConsigne(e.target.value)} className="min-h-[74px]" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Texte support extrait ou corrigé</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={prefilling || !meta?.storage_path}
                  onClick={handlePrefillFromPdf}
                >
                  {prefilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Préremplir depuis le PDF
                </Button>
              </div>
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="min-h-[260px] text-sm"
                placeholder="Collez ici le texte utile du PDF, ou utilisez le préremplissage puis corrigez."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Questions interactives</h3>
                <p className="text-xs text-muted-foreground">Ces éléments seront enregistrés dans contenu.items[].</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setItems((prev) => [...prev, createEmptyPdfTransformItem(format)])}
              >
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">Question {index + 1}</Badge>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={item.question}
                    onChange={(e) => updateItem(index, { question: e.target.value })}
                    placeholder="Question ou consigne courte"
                    className="min-h-[64px]"
                  />
                  {format === "qcm" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {item.options.map((option, optionIndex) => (
                        <Input
                          key={optionIndex}
                          value={option}
                          onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                          placeholder={`Option ${optionIndex + 1}`}
                        />
                      ))}
                    </div>
                  )}
                  {format === "vrai_faux" ? (
                    <div className="space-y-1.5">
                      <Label>Réponse attendue</Label>
                      <Select value={item.bonne_reponse || "vrai"} onValueChange={(value) => updateItem(index, { bonne_reponse: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vrai">Vrai</SelectItem>
                          <SelectItem value="faux">Faux</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Input
                      value={item.bonne_reponse}
                      onChange={(e) => updateItem(index, { bonne_reponse: e.target.value })}
                      placeholder={format === "production_ecrite" ? "Réponse attendue / critères de réussite" : "Bonne réponse"}
                    />
                  )}
                  <Textarea
                    value={item.explication}
                    onChange={(e) => updateItem(index, { explication: e.target.value })}
                    placeholder="Correction, justification ou explication formateur"
                    className="min-h-[56px]"
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Contrôle avant création</span>
                <Badge variant={validation?.status === "needs_review" ? "default" : "outline"}>
                  {validation?.status === "needs_review" ? "needs_review" : "draft"}
                </Badge>
              </div>
              {validation?.issues.length ? (
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  {validation.issues.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`} className={issue.severity === "error" ? "text-destructive" : ""}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700">Aucun blocage détecté. L'exercice sera créé en needs_review.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Ce contrôle ne remplace pas la validation complète de production. Il évite seulement les brouillons inutilisables.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!canCreate} onClick={handleCreate} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileQuestion className="h-4 w-4" />}
            Créer l'exercice interactif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
