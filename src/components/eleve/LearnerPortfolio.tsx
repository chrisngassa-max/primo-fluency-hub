import { useRef } from "react";
import { Award, Download, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExportPDF } from "@/hooks/useExportPDF";
import { qualitativeProgress } from "@/lib/qualitativeProgress";

type Competency = { competence: string; statut: string };
type Result = {
  id: string;
  created_at: string;
  score: number;
  exercice?: { titre?: string | null; competence?: string | null } | null;
};

export default function LearnerPortfolio({
  learnerName,
  level,
  competencies,
  results,
}: {
  learnerName: string;
  level: string;
  competencies: Competency[];
  results: Result[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { exportPDF, isExporting } = useExportPDF(ref);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          Portfolio de compétences
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isExporting}
          onClick={() => exportPDF({ filename: `portfolio-ofii-${learnerName.replace(/\s+/g, "-").toLowerCase()}.pdf` })}
        >
          <Download className="h-4 w-4" />
          Exporter pour l'OFII
        </Button>
      </div>

      <div ref={ref} className="rounded-lg border bg-white p-6 text-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">CAP TCF</p>
            <h2 className="text-xl font-bold">Portfolio de compétences</h2>
            <p className="mt-1 text-sm text-zinc-600">{learnerName}</p>
          </div>
          <Badge className="bg-[#0b234a]">Niveau {level}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {competencies.map((item) => (
            <div key={item.competence} className="rounded-md border p-3 text-center">
              <p className="font-bold">{item.competence}</p>
              <p className="mt-1 text-xs text-zinc-600">
                {item.statut === "acquis_provisoire"
                  ? "Acquis"
                  : item.statut === "consolide"
                    ? "En consolidation"
                    : item.statut === "non_acquis"
                      ? "À retravailler"
                      : "Non évalué"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileCheck2 className="h-4 w-4" />
            Preuves récentes
          </h3>
          <div className="mt-3 space-y-2">
            {results.slice(0, 8).map((result) => (
              <div key={result.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
                <div>
                  <p className="font-medium">{result.exercice?.titre || "Exercice réalisé"}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(result.created_at).toLocaleDateString("fr-FR")} · {result.exercice?.competence || "Compétence"}
                  </p>
                </div>
                <span className="font-semibold">{qualitativeProgress(Number(result.score)).shortLabel}</span>
              </div>
            ))}
            {results.length === 0 && <p className="text-sm text-zinc-500">Aucune preuve enregistrée.</p>}
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
          <Award className="h-4 w-4" />
          Document généré depuis les activités réalisées dans CAP TCF.
        </p>
      </div>
    </section>
  );
}
