import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, FileText, FileType, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  buildCaptcfDocumentBody,
  buildCaptcfDocumentDocxBlob,
  buildCaptcfDocumentHtml,
  CAPTCF_DOCUMENT_CSS,
  CAPTCF_DOCUMENT_TYPES,
  type CaptcfDocumentType,
  type CaptcfExerciseLike,
  downloadBlob,
  safeDocumentFilename,
} from "@/lib/document-templates/captcfDocumentTemplates";
import { cn } from "@/lib/utils";
import { getCaptcfLevelProfileSummary, resolveCaptcfDocumentLevel } from "@/lib/captcf-level-profiles";

type DocumentGenerationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: CaptcfExerciseLike[];
};

export default function DocumentGenerationDialog({ open, onOpenChange, exercises }: DocumentGenerationDialogProps) {
  const [documentType, setDocumentType] = useState<CaptcfDocumentType>("fiche_apprenant");
  const [title, setTitle] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const renderRef = useRef<HTMLDivElement>(null);

  const selectedExercises = exercises.length
    ? exercises
    : [
        {
          titre: "Document CapTCF",
          consigne: "Selectionnez un exercice ou remplissez ce gabarit avec votre contenu.",
          competence: "TCF",
          niveau_vise: "A2",
          contenu: { items: [] },
        },
      ];

  const targetLevel = useMemo(() => resolveCaptcfDocumentLevel({
    exerciseLevel: selectedExercises[0]?.niveau_vise,
    fallback: "A2",
  }), [selectedExercises]);

  const levelProfile = useMemo(() => getCaptcfLevelProfileSummary(targetLevel), [targetLevel]);

  const input = useMemo(
    () => ({
      type: documentType,
      title,
      exercises: selectedExercises,
      level: targetLevel,
    }),
    [documentType, selectedExercises, targetLevel, title],
  );

  const previewHtml = useMemo(() => buildCaptcfDocumentHtml(input), [input]);
  const exportBody = useMemo(() => buildCaptcfDocumentBody(input), [input]);

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    const style = document.createElement("style");
    style.textContent = CAPTCF_DOCUMENT_CSS;
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "794px";
    host.innerHTML = exportBody;

    try {
      document.head.appendChild(style);
      document.body.appendChild(host);
      const page = host.querySelector(".captcf-doc-page") as HTMLElement | null;
      const target = page ?? host;
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      const imageData = canvas.toDataURL("image/png");

      pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      pdf.save(safeDocumentFilename(input, "pdf"));
      toast.success("PDF CapTCF telecharge");
    } catch (error: any) {
      toast.error("Impossible de generer le PDF", { description: error?.message });
    } finally {
      host.remove();
      style.remove();
      setIsExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const blob = await buildCaptcfDocumentDocxBlob(input);
      downloadBlob(blob, safeDocumentFilename(input, "docx"));
      toast.success("Word CapTCF telecharge");
    } catch (error: any) {
      toast.error("Impossible de generer le Word", { description: error?.message });
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Creer un document CapTCF
          </DialogTitle>
          <DialogDescription>
            Choisissez un gabarit. La charte CapTCF est appliquee automatiquement au PDF et au Word editable.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr] min-h-0">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Titre du document</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Laisser vide pour utiliser le nom du gabarit"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de document</Label>
              <RadioGroup value={documentType} onValueChange={(value) => setDocumentType(value as CaptcfDocumentType)} className="space-y-2">
                {CAPTCF_DOCUMENT_TYPES.map((type) => (
                  <Label
                    key={type.value}
                    htmlFor={`captcf-doc-${type.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      documentType === type.value ? "border-primary bg-primary/5" : "hover:border-primary/40",
                    )}
                  >
                    <RadioGroupItem value={type.value} id={`captcf-doc-${type.value}`} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold">{type.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{type.description}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="rounded-lg border bg-[#fff7f0] p-3 text-sm text-[#0b234a]">
              <p className="font-bold text-[#f47b20]">Regles appliquees automatiquement</p>
              <p className="mt-1">
                Niveau {levelProfile.level} : {levelProfile.questionStyle}. {levelProfile.supportLevel}.
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Logo CAP TCF, consignes orange, export ecran/impression. Aucun enregistrement Supabase dans cette version.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleExportPdf} disabled={isExportingPdf} className="gap-2">
                {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
              <Button onClick={handleExportDocx} disabled={isExportingDocx} variant="outline" className="gap-2">
                {isExportingDocx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
                Word
              </Button>
            </div>
          </div>

          <div className="min-h-0 rounded-lg border bg-muted/30 p-3">
            <div ref={renderRef} className="h-[68vh] overflow-auto rounded-md bg-white">
              <iframe title="Apercu document CapTCF" srcDoc={previewHtml} className="h-full w-full border-0" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
