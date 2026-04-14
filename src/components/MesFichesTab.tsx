import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Printer, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import CompetenceLabel from "@/components/CompetenceLabel";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

export default function MesFichesTab() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: fiches, isLoading } = useQuery({
    queryKey: ["eleve-fiches", user?.id],
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase
        .from("resource_assignments" as any)
        .select("id, resource_id, due_date, created_at")
        .eq("learner_id", user!.id)
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) return [];

      const resourceIds = [...new Set((assignments as any[]).map((a: any) => a.resource_id))];
      const { data: resources, error: rErr } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("id, titre, type, competence, niveau, contenu, created_at")
        .in("id", resourceIds);
      if (rErr) throw rErr;

      const resourceMap = new Map((resources as any[] || []).map((r: any) => [r.id, r]));
      return (assignments as any[])
        .map((a: any) => {
          const resource = resourceMap.get(a.resource_id);
          if (!resource) return null;
          return { ...resource, assignment_id: a.id, due_date: a.due_date, assigned_at: a.created_at };
        })
        .filter(Boolean);
    },
    enabled: !!user?.id,
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrint = (fiche: any) => {
    const content = fiche.contenu as ResourceContent;
    if (!content?.sections) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html><head><title>${content.titre}</title>
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
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; }
        @media print { body { margin: 20mm; } }
      </style></head><body>
      <h1>${content.titre}</h1>
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
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!fiches || fiches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium" style={{ fontSize: "14px" }}>
          Aucune fiche disponible pour le moment.
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1" style={{ fontSize: "14px" }}>
          Votre formateur vous en enverra après les exercices.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fiches.map((fiche: any) => {
        const content = fiche.contenu as ResourceContent;
        if (!content?.sections) return null;
        const isExpanded = !!expanded[fiche.assignment_id];

        return (
          <Card key={fiche.assignment_id} className="bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 mb-1.5 flex-wrap">
                    <Badge className={`text-xs border-0 ${COMP_COLORS[fiche.competence] || "bg-muted text-muted-foreground"}`}>
                      <CompetenceLabel code={fiche.competence} />
                    </Badge>
                    <Badge variant="outline" className="text-xs">Niveau {fiche.niveau}</Badge>
                  </div>
                  <CardTitle className="text-base" style={{ fontSize: "16px" }}>
                    {content.titre || fiche.titre}
                  </CardTitle>
                  {content.resume && (
                    <p className="text-muted-foreground mt-1 italic" style={{ fontSize: "14px" }}>
                      {content.resume}
                    </p>
                  )}
                  {fiche.due_date && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      À lire avant le {format(new Date(fiche.due_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-2 no-print">
                <Button
                  variant={isExpanded ? "secondary" : "default"}
                  size="sm"
                  onClick={() => toggleExpand(fiche.assignment_id)}
                  className="gap-1"
                >
                  {isExpanded ? (
                    <>Replier <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Lire la fiche <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </Button>
                {isExpanded && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrint(fiche)}
                    className="gap-1 no-print"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimer
                  </Button>
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-4 print:bg-white print:text-black print:shadow-none">
                  {content.sections.map((section, i) => (
                    <SectionRenderer key={i} section={section} />
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

function SectionRenderer({ section }: { section: ResourceSection }) {
  const wrapperClass = (() => {
    switch (section.type) {
      case "encadre":
        return "border-l-4 border-primary bg-primary/5 p-3 rounded-r-md";
      case "exemple":
        return "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md";
      case "astuce":
        return "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-r-md";
      case "attention":
        return "border-l-4 border-destructive bg-destructive/10 p-3 rounded-r-md";
      default:
        return "";
    }
  })();

  const prefix = section.type === "astuce" ? "💡 Astuce : " : section.type === "attention" ? "⚠️ À retenir : " : section.type === "exemple" ? "Exemple : " : "";

  return (
    <div className={wrapperClass}>
      <h3 className="font-bold mb-1" style={{ fontSize: "15px" }}>
        {prefix}{section.titre}
      </h3>

      {section.type === "liste" && section.items?.length ? (
        <ul className="list-disc list-inside space-y-1">
          {section.items.map((item, j) => (
            <li key={j} style={{ fontSize: "14px" }}>
              {item.terme && <span className="font-medium">{item.terme}</span>}
              {item.definition && <span className="text-muted-foreground"> — {item.definition}</span>}
              {item.exemple && <span className="italic text-muted-foreground ml-1">(Ex : {item.exemple})</span>}
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
                <td className="p-2 text-muted-foreground border border-border">{item.definition || ""}</td>
                <td className="p-2 italic text-muted-foreground border border-border">{item.exemple || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="whitespace-pre-wrap" style={{ fontSize: "14px" }}>{section.contenu}</p>
      )}

      {/* For non-table/non-list types that also have items, show content + items */}
      {section.type !== "liste" && section.type !== "tableau" && section.items?.length ? (
        <ul className="list-disc list-inside space-y-1 mt-2">
          {section.items.map((item, j) => (
            <li key={j} style={{ fontSize: "14px" }}>
              {item.terme && <span className="font-medium">{item.terme}</span>}
              {item.definition && <span className="text-muted-foreground"> — {item.definition}</span>}
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
