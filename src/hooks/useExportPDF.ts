import { useState, type RefObject } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ExportOptions = {
  filename?: string;
  sendByEmail?: boolean;
  sessionTitre?: string;
  sessionDate?: string;
  formateurEmail?: string;
};

/**
 * Capture un élément DOM et génère un PDF A4.
 * Téléchargement local par défaut, envoi e-mail si sendByEmail=true.
 */
export function useExportPDF(targetRef: RefObject<HTMLElement>) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async (opts: ExportOptions = {}) => {
    if (!targetRef.current) {
      toast.error("Rien à exporter");
      return;
    }
    setIsExporting(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const ratio = canvas.height / canvas.width;
      const imgH = usableW * ratio;

      // Pagination si l'image dépasse une page
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, usableW, imgH);
      heightLeft -= pageH - margin * 2;
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgH - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, usableW, imgH);
        heightLeft -= pageH - margin * 2;
      }

      if (opts.sendByEmail) {
        const pdfBase64 = pdf.output("datauristring").split(",")[1];
        const { error } = await supabase.functions.invoke("send-bilan-email", {
          body: {
            pdf_base64: pdfBase64,
            session_titre: opts.sessionTitre ?? "Bilan d'atelier",
            session_date: opts.sessionDate ?? new Date().toISOString().slice(0, 10),
            formateur_email: opts.formateurEmail ?? "",
          },
        });
        if (error) throw error;
        toast.success(`Bilan envoyé à ${opts.formateurEmail ?? "votre adresse"}`);
      } else {
        const filename = opts.filename ?? `bilan-atelier-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
      }
    } catch (e: any) {
      console.error("Export PDF error", e);
      toast.error("Erreur lors de l'export PDF", { description: e?.message });
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPDF, isExporting };
}
