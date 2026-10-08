import { jsPDF } from "jspdf";
import { attendanceCells, attendanceHeaders, type SummaryRow } from "./attendanceSummary";

export function createAttendancePdf(group: string, training: string, period: string, rows: SummaryRow[]) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const widths = [48, 48, 49, 39, 39, 50];
  const margin = 12;
  const lineHeight = 4;
  const available = 186;
  pdf.setFontSize(10);
  const lines = (cells: string[]) => cells.map((cell, i) => pdf.splitTextToSize(cell, widths[i] - 4) as string[]);
  const height = (cells: string[][]) => Math.max(...cells.map(c => c.length)) * lineHeight + 4;
  pdf.setFont("helvetica", "bold");
  const header = lines(attendanceHeaders);
  pdf.setFont("helvetica", "normal");
  const data = rows.map(r => lines(attendanceCells(r)));
  const titleLines = [group, training, period].map(t => pdf.splitTextToSize(t, 273) as string[]);
  const titleHeight = titleLines.reduce((n, l) => n + l.length * 5 + 2, 0) + 4;
  const naturalHeight = data.reduce((n, c) => n + height(c), 0);
  const room = available - titleHeight - height(header);
  if (room < 8) throw new Error("L'en-tête est trop long. Raccourcissez l'intitulé de la formation ou le nom du groupe.");
  // Compact modest groups, without reducing text size or splitting a participant.
  const padding = naturalHeight > room && naturalHeight - rows.length * 2 <= room ? 2 : 4;
  let y = margin;
  const draw = (cells: string[][], bold: boolean, pad = 4) => {
    const h = Math.max(...cells.map(c => c.length)) * lineHeight + pad;
    let x = margin;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    cells.forEach((cell, i) => {
      pdf.setDrawColor(130);
      pdf.rect(x, y, widths[i], h);
      pdf.text(cell, x + 2, y + pad / 2 + 3);
      x += widths[i];
    });
    y += h;
  };
  const startPage = () => {
    y = margin;
    titleLines.forEach((text, i) => {
      pdf.setFont("helvetica", i === 0 ? "bold" : "normal");
      pdf.text(text, margin, y + 4);
      y += text.length * 5 + 2;
    });
    y += 4;
    draw(header, true);
  };
  startPage();
  for (const cells of data) {
    const h = Math.max(...cells.map(c => c.length)) * lineHeight + padding;
    if (h > available - titleHeight - height(header)) throw new Error("Un nom est trop long pour tenir sur une page. Corrigez l'identité avant l'export.");
    if (y + h > 198) { pdf.addPage(); startPage(); }
    draw(cells, false, padding);
  }
  return pdf;
}
