import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const FORMATS_TCF = [
  { value: "qcm", label: "QCM" },
  { value: "vrai_faux", label: "Vrai / Faux" },
  { value: "texte_lacunaire", label: "Texte à trous" },
  { value: "appariement", label: "Appariement" },
  { value: "transformation", label: "Transformation de phrase" },
  { value: "production_ecrite", label: "Production libre" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PdfImportDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["qcm", "texte_lacunaire"]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "formats" | "done">("upload");
  const [results, setResults] = useState<string[]>([]);

  const extractTextFromPdf = async (f: File): Promise<string> => {
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const buffer = await f.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ") + "\n";
    }
    return text.trim();
  };

  const handleFile = async (f: File) => {
    if (!f.type.includes("pdf")) {
      toast.error("Format non supporté", { description: "Veuillez sélectionner un fichier PDF." });
      return;
    }
    setFile(f);
    setLoading(true);
    try {
      const text = await extractTextFromPdf(f);
      if (!text) throw new Error("Impossible d'extraire du texte de ce PDF.");
      setExtractedText(text);
      setStep("formats");
    } catch (e: any) {
      toast.error("Erreur de lecture PDF", { description: e.message });
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }, []);

  const toggleFormat = (fmt: string) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  };

  const handleGenerate = async () => {
    if (!user || !extractedText || selectedFormats.length === 0) return;
    setLoading(true);
    const created: string[] = [];

    try {
      const { data: points } = await supabase.from("points_a_maitriser").select("id").limit(1);
      const pointId = points?.[0]?.id;
      if (!pointId) throw new Error("Aucun point à maîtriser trouvé en base");

      for (const fmt of selectedFormats) {
        const { data, error } = await supabase.functions.invoke("smart-exercise-generator", {
          body: {
            mode: "import",
            sourceText: extractedText,
            treatment: "reconfigure",
            targetFormat: fmt,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const ex = data?.exercise;
        if (!ex) continue;

        const fmtLabel = FORMATS_TCF.find((f) => f.value === fmt)?.label ?? fmt;

        const { error: insertError } = await supabase.from("exercices").insert({
          formateur_id: user.id,
          titre: ex.titre ?? `${fmtLabel} — ${file?.name ?? "PDF"}`,
          consigne: ex.consigne ?? "",
          competence: (ex.competence ?? "CE") as any,
          format: fmt as any,
          difficulte: ex.difficulte ?? 3,
          niveau_vise: ex.niveau_vise ?? "A1",
          contenu: ex.contenu ?? { items: [] },
          point_a_maitriser_id: pointId,
          is_ai_generated: true,
        });
        if (!insertError) created.push(fmtLabel);
      }

      if (created.length === 0) throw new Error("Aucun exercice n'a pu être créé");
      setResults(created);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["formateur-all-exercices", user.id] });
      onSuccess();
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setExtractedText("");
    setSelectedFormats(["qcm", "texte_lacunaire"]);
    setStep("upload");
    setResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>📎 Importer depuis un PDF</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Déposez un PDF de cours ou d'exercice — l'IA génère plusieurs types d'exercices."}
            {step === "formats" && `${file?.name} — choisissez les formats à générer.`}
            {step === "done" && "Exercices créés avec succès !"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={cn(
              "mt-2 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("pdf-file-input")?.click()}
          >
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Extraction du texte…</p>
              </>
            ) : (
              <>
                <FileText className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Glissez un PDF ici</p>
                  <p className="mt-1 text-xs text-muted-foreground">ou cliquez pour sélectionner</p>
                </div>
              </>
            )}
            <input
              id="pdf-file-input"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
          </div>
        )}

        {step === "formats" && (
          <div className="mt-2 space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground line-clamp-3">
                {extractedText.slice(0, 250)}…
              </p>
            </div>
            <div>
              <Label className="text-sm font-semibold">Formats à générer</Label>
              <p className="mb-3 text-xs text-muted-foreground">
                Un exercice sera créé pour chaque format sélectionné.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS_TCF.map((fmt) => (
                  <div
                    key={fmt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors",
                      selectedFormats.includes(fmt.value)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    )}
                    onClick={() => toggleFormat(fmt.value)}
                  >
                    <Checkbox
                      checked={selectedFormats.includes(fmt.value)}
                      onCheckedChange={() => toggleFormat(fmt.value)}
                    />
                    <span className="text-sm font-medium">{fmt.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              className="w-full gap-2"
              disabled={loading || selectedFormats.length === 0}
              onClick={() => void handleGenerate()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {loading
                ? `Génération… (${selectedFormats.length} exercice${selectedFormats.length > 1 ? "s" : ""})`
                : `Générer ${selectedFormats.length} exercice${selectedFormats.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="mt-2 space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/30">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
              <p className="font-semibold text-green-800 dark:text-green-300">
                {results.length} exercice{results.length > 1 ? "s" : ""} créé{results.length > 1 ? "s" : ""}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {results.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PdfImportDialog;
