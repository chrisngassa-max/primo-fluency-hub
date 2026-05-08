import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Competence = "CO" | "CE" | "EE" | "EO";
type Statut = "non_evalue" | "non_acquis" | "consolide" | "acquis_provisoire";

const COMPETENCES: { key: Competence; label: string }[] = [
  { key: "CO", label: "Compréhension orale" },
  { key: "CE", label: "Compréhension écrite" },
  { key: "EE", label: "Expression écrite" },
  { key: "EO", label: "Expression orale" },
];

const STATUT_META: Record<
  Statut,
  { label: string; pct: number; barClass: string; chipClass: string }
> = {
  non_evalue: {
    label: "Non évalué",
    pct: 5,
    barClass: "bg-zinc-300",
    chipClass: "bg-zinc-100 text-zinc-600",
  },
  non_acquis: {
    label: "À travailler",
    pct: 30,
    barClass: "bg-red-500",
    chipClass: "bg-red-100 text-red-700",
  },
  consolide: {
    label: "En consolidation",
    pct: 65,
    barClass: "bg-orange-500",
    chipClass: "bg-orange-100 text-orange-700",
  },
  acquis_provisoire: {
    label: "Acquis",
    pct: 95,
    barClass: "bg-emerald-500",
    chipClass: "bg-emerald-100 text-emerald-700",
  },
};

export default function TrajectoireTCF({ eleveId }: { eleveId: string }) {
  const [statuts, setStatuts] = useState<Record<Competence, Statut>>({
    CO: "non_evalue",
    CE: "non_evalue",
    EE: "non_evalue",
    EO: "non_evalue",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("student_competency_status")
        .select("competence, statut")
        .eq("eleve_id", eleveId);
      if (cancelled) return;
      const next = { CO: "non_evalue", CE: "non_evalue", EE: "non_evalue", EO: "non_evalue" } as Record<
        Competence,
        Statut
      >;
      (data ?? []).forEach((row: any) => {
        const k = String(row.competence).toUpperCase() as Competence;
        if (k in next) next[k] = row.statut as Statut;
      });
      setStatuts(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eleveId]);

  return (
    <div className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
      <h3 className="text-lg font-bold text-[#0b234a]">Ma trajectoire TCF</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Ton niveau pour chaque compétence
      </p>

      <div className="mt-4 space-y-4">
        {COMPETENCES.map(({ key, label }) => {
          const meta = STATUT_META[statuts[key]];
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-9 items-center justify-center rounded-md bg-[#e7e9f1] text-xs font-bold text-[#0b234a]">
                    {key}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {label}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    meta.chipClass
                  )}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn("h-full rounded-full transition-all", meta.barClass)}
                  style={{ width: loading ? "0%" : `${meta.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
