import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronDown, ChevronUp, Printer } from "lucide-react";
import CompetenceLabel from "@/components/CompetenceLabel";
import SmartText from "@/components/SmartText";

/**
 * Liste des leçons à conserver (révisables) rattachées à une ou plusieurs
 * séances. Source DURABLE : `ressources_pedagogiques` (statut publié), lisible
 * par l'élève via la policy RLS « Eleves view published ressources » (limitée
 * aux ressources des séances de ses groupes). Reste donc disponible dans
 * l'historique pour réviser.
 */

interface ResourceSection {
  titre: string;
  contenu: string;
  type: "texte" | "liste" | "tableau" | "encadre" | "exemple" | "astuce" | "attention";
  items?: { terme?: string; definition?: string; exemple?: string }[];
}

interface ResourceContent {
  titre: string;
  sections: ResourceSection[];
  resume: string;
}

const COMP_COLORS: Record<string, string> = {
  CO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EE: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  EO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Structures: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const resourceTypeLabels: Record<string, string> = {
  lecon: "Leçon",
  vocabulaire: "Vocabulaire",
  rappel_methodo: "Rappel méthodologique",
  rappel_visuel: "Rappel visuel",
};

export default function SeanceLeconsList({
  sessionIds,
  studentId,
  emptyHint,
}: {
  sessionIds: string[];
  studentId: string;
  emptyHint?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const idsKey = [...sessionIds].sort().join(",");

  const { data: lecons, isLoading } = useQuery({
    queryKey: ["eleve-seance-lecons", idsKey],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("id, titre, type, competence, niveau, contenu, session_id, created_at")
        .in("session_id", sessionIds)
        .eq("statut", "published" as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: sessionIds.length > 0,
  });

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const handlePrint = (fiche: any) => {
    const content = fiche.contenu as ResourceContent;
    if (!content?.sections) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${content.titre || fiche.titre}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
        .meta span { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
        h2 { font-size: 16px; margin-top: 20px; color: #1e40af; }
        .encadre, .astuce, .attention { border-left: 4px solid; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        .encadre { border-color: #2563eb; background: #eff6ff; }
        .astuce { border-color: #16a34a; background: #f0fdf4; }
        .attention { border-color: #dc2626; background: #fef2f2; }
        .exemple { background: #f0fdf4; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        ul { padding-left: 20px; } li { margin-bottom: 4px; }
        @media print { body { margin: 20mm; } }
      </style></head><body>
      <h1>${content.titre || fiche.titre}</h1>
      <div class="meta"><span>${fiche.competence}</span><span>Niveau ${fiche.niveau}</span><span>${resourceTypeLabels[fiche.type] || fiche.type}</span></div>
      ${content.resume ? `<p style="font-style:italic;color:#6b7280;margin-bottom:16px">${content.resume}</p>` : ""}
      ${content.sections.map((s: ResourceSection) => renderSectionHTML(s)).join("")}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const valides = (lecons ?? []).filter((f: any) => (f.contenu as ResourceContent)?.sections);

  if (valides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BookOpen className="h-9 w-9 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-foreground">Aucune leçon pour le moment</p>
        <p className="text-xs text-muted-foreground mt-1">
          {emptyHint ?? "Ton formateur t'enverra des leçons à conserver après les exercices."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {valides.map((fiche: any) => {
        const content = fiche.contenu as ResourceContent;
        const isOpen = !!expanded[fiche.id];
        return (
          <Card key={fiche.id} className="bg-card">
            <CardHeader className="pb-3">
              <div className="flex gap-1.5 mb-1.5 flex-wrap">
                <Badge className={`text-xs border-0 ${COMP_COLORS[fiche.competence] || "bg-muted text-muted-foreground"}`}>
                  <CompetenceLabel code={fiche.competence} />
                </Badge>
                <Badge variant="outline" className="text-xs">Niveau {fiche.niveau}</Badge>
                <Badge variant="secondary" className="text-xs">{resourceTypeLabels[fiche.type] || fiche.type}</Badge>
              </div>
              <CardTitle className="text-base">{content.titre || fiche.titre}</CardTitle>
              {content.resume && (
                <p className="text-sm text-muted-foreground mt-1 italic">{content.resume}</p>
              )}
              <div className="flex gap-2 mt-2">
                <Button
                  variant={isOpen ? "secondary" : "default"}
                  size="sm"
                  onClick={() => toggle(fiche.id)}
                  className="gap-1"
                >
                  {isOpen ? (<>Replier <ChevronUp className="h-3.5 w-3.5" /></>) : (<>Lire la leçon <ChevronDown className="h-3.5 w-3.5" /></>)}
                </Button>
                {isOpen && (
                  <Button variant="outline" size="sm" onClick={() => handlePrint(fiche)} className="gap-1">
                    <Printer className="h-3.5 w-3.5" /> Imprimer
                  </Button>
                )}
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {content.sections.map((section, i) => (
                    <SectionRenderer key={i} section={section} studentId={studentId} />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function SectionRenderer({ section, studentId }: { section: ResourceSection; studentId: string }) {
  const wrapperClass = (() => {
    switch (section.type) {
      case "encadre": return "border-l-4 border-primary bg-primary/5 p-3 rounded-r-md";
      case "exemple": return "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md";
      case "astuce": return "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-r-md";
      case "attention": return "border-l-4 border-destructive bg-destructive/10 p-3 rounded-r-md";
      default: return "";
    }
  })();
  const prefix = section.type === "astuce" ? "💡 Astuce : " : section.type === "attention" ? "⚠️ À retenir : " : section.type === "exemple" ? "Exemple : " : "";

  return (
    <div className={wrapperClass}>
      <h3 className="font-bold mb-1 text-[15px]">
        {prefix}
        {section.titre && (
          <SmartText text={section.titre} studentId={studentId} contextSentence={section.titre} />
        )}
      </h3>
      {section.type === "liste" && section.items?.length ? (
        <ul className="list-disc list-inside space-y-1">
          {section.items.map((item, j) => (
            <li key={j} className="text-sm">
              {item.terme && <span className="font-medium">{item.terme}</span>}
              {item.definition && (
                <span className="text-muted-foreground">
                  {" — "}
                  <SmartText text={item.definition} studentId={studentId} contextSentence={item.definition} />
                </span>
              )}
              {item.exemple && (
                <span className="italic text-muted-foreground ml-1">
                  (Ex : <SmartText text={item.exemple} studentId={studentId} contextSentence={item.exemple} />)
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : section.type === "tableau" && section.items?.length ? (
        <table className="mt-2 w-full text-sm border-collapse border border-border">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-2 font-semibold border border-border">Terme</th>
              <th className="text-left p-2 font-semibold border border-border">Définition</th>
              <th className="text-left p-2 font-semibold border border-border">Exemple</th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item, j) => (
              <tr key={j}>
                <td className="p-2 font-medium border border-border">{item.terme || ""}</td>
                <td className="p-2 text-muted-foreground border border-border">
                  {item.definition ? (
                    <SmartText text={item.definition} studentId={studentId} contextSentence={item.definition} />
                  ) : ""}
                </td>
                <td className="p-2 italic text-muted-foreground border border-border">
                  {item.exemple ? (
                    <SmartText text={item.exemple} studentId={studentId} contextSentence={item.exemple} />
                  ) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="whitespace-pre-wrap text-sm">
          {section.contenu && (
            <SmartText text={section.contenu} studentId={studentId} contextSentence={section.contenu} />
          )}
        </p>
      )}
      {section.type !== "liste" && section.type !== "tableau" && section.items?.length ? (
        <ul className="list-disc list-inside space-y-1 mt-2">
          {section.items.map((item, j) => (
            <li key={j} className="text-sm">
              {item.terme && <span className="font-medium">{item.terme}</span>}
              {item.definition && (
                <span className="text-muted-foreground">
                  {" — "}
                  <SmartText text={item.definition} studentId={studentId} contextSentence={item.definition} />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function renderSectionHTML(s: ResourceSection): string {
  const prefix = s.type === "astuce" ? "💡 Astuce : " : s.type === "attention" ? "⚠️ À retenir : " : s.type === "exemple" ? "Exemple : " : "";
  const cls = s.type === "encadre" ? "encadre" : s.type === "astuce" ? "astuce" : s.type === "attention" ? "attention" : s.type === "exemple" ? "exemple" : "";
  let html = cls ? `<div class="${cls}">` : "";
  html += `<h2>${prefix}${s.titre}</h2>`;
  if (s.type === "tableau" && s.items?.length) {
    html += `<table><tr><th>Terme</th><th>Définition</th><th>Exemple</th></tr>`;
    s.items.forEach((i) => { html += `<tr><td>${i.terme || ""}</td><td>${i.definition || ""}</td><td>${i.exemple || ""}</td></tr>`; });
    html += `</table>`;
  } else if (s.type === "liste" && s.items?.length) {
    html += `<ul>`;
    s.items.forEach((i) => { html += `<li><strong>${i.terme || ""}</strong> — ${i.definition || ""} ${i.exemple ? `<em>(Ex : ${i.exemple})</em>` : ""}</li>`; });
    html += `</ul>`;
  } else {
    html += `<p>${(s.contenu || "").replace(/\n/g, "<br/>")}</p>`;
    if (s.items?.length) {
      html += `<ul>`;
      s.items.forEach((i) => { html += `<li><strong>${i.terme || ""}</strong> — ${i.definition || ""}</li>`; });
      html += `</ul>`;
    }
  }
  if (cls) html += `</div>`;
  return html;
}
