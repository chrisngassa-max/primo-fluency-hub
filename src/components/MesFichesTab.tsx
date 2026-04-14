import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Printer, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ResourceSection {
  titre: string;
  contenu: string;
  type: string;
  items?: { terme?: string; definition?: string; exemple?: string }[];
}

interface ResourceContent {
  titre: string;
  sections: ResourceSection[];
  resume: string;
}

const resourceTypeLabels: Record<string, string> = {
  lecon: "Leçon",
  vocabulaire: "Vocabulaire",
  rappel_methodo: "Rappel méthodologique",
  rappel_visuel: "Rappel visuel",
};

export default function MesFichesTab() {
  const { user } = useAuth();

  const { data: fiches, isLoading } = useQuery({
    queryKey: ["eleve-fiches", user?.id],
    queryFn: async () => {
      // Get assignments for this student
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
        .attention { border-color: #ea580c; background: #fff7ed; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        @media print { body { margin: 20mm; } }
      </style></head><body>
      <h1>${content.titre}</h1>
      <div class="meta"><span>${fiche.competence}</span><span>Niveau ${fiche.niveau}</span><span>${resourceTypeLabels[fiche.type] || fiche.type}</span></div>
      ${content.sections.map((s: ResourceSection) => {
        const cls = s.type === "encadre" ? "encadre" : s.type === "astuce" ? "astuce" : s.type === "attention" ? "attention" : "";
        let html = `<h2>${s.titre}</h2>`;
        if (cls) html = `<div class="${cls}"><h2 style="margin-top:0">${s.titre}</h2>`;
        html += `<p>${s.contenu.replace(/\n/g, "<br/>")}</p>`;
        if (s.items?.length) {
          html += `<table><tr><th>Terme</th><th>Définition</th><th>Exemple</th></tr>`;
          s.items.forEach((i) => { html += `<tr><td>${i.terme || ""}</td><td>${i.definition || ""}</td><td>${i.exemple || ""}</td></tr>`; });
          html += `</table>`;
        }
        if (cls) html += `</div>`;
        return html;
      }).join("")}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!fiches || fiches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">Aucune fiche pour le moment</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Ton formateur t'enverra des leçons et fiches de vocabulaire ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fiches.map((fiche: any) => {
        const content = fiche.contenu as ResourceContent;
        if (!content?.sections) return null;
        return (
          <Card key={fiche.assignment_id} className="bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{content.titre || fiche.titre}</CardTitle>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{fiche.competence}</Badge>
                    <Badge variant="outline" className="text-xs">Niveau {fiche.niveau}</Badge>
                    <Badge variant="secondary" className="text-xs">{resourceTypeLabels[fiche.type] || fiche.type}</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handlePrint(fiche)} className="shrink-0">
                  <Printer className="mr-1 h-3.5 w-3.5" /> Imprimer
                </Button>
              </div>
              {fiche.due_date && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  À lire avant le {format(new Date(fiche.due_date), "d MMMM yyyy", { locale: fr })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {content.resume && (
                <p className="text-sm text-muted-foreground mb-3">{content.resume}</p>
              )}
              <Separator className="mb-3" />
              <div className="space-y-3">
                {content.sections.map((section, i) => (
                  <div key={i} className={`${
                    section.type === "encadre" ? "border-l-4 border-primary bg-primary/5 p-3 rounded-r-md" :
                    section.type === "astuce" ? "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30 p-3 rounded-r-md" :
                    section.type === "attention" ? "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-r-md" :
                    section.type === "exemple" ? "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md" :
                    ""
                  }`}>
                    <h3 className="font-semibold text-sm mb-1" style={{ fontSize: "14px" }}>
                      {section.type === "astuce" ? "💡 " : section.type === "attention" ? "⚠️ " : ""}
                      {section.titre}
                    </h3>
                    <p className="text-sm whitespace-pre-wrap" style={{ fontSize: "14px" }}>{section.contenu}</p>
                    {section.items && section.items.length > 0 && (
                      section.type === "tableau" ? (
                        <table className="mt-2 w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Terme</th>
                              <th className="text-left p-2 font-semibold">Définition</th>
                              <th className="text-left p-2 font-semibold">Exemple</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((item, j) => (
                              <tr key={j} className="border-b border-border/50">
                                <td className="p-2 font-medium">{item.terme || ""}</td>
                                <td className="p-2 text-muted-foreground">{item.definition || ""}</td>
                                <td className="p-2 italic text-muted-foreground">{item.exemple || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                          {section.items.map((item, j) => (
                            <li key={j} style={{ fontSize: "14px" }}>
                              {item.terme && <span className="font-medium">{item.terme}</span>}
                              {item.definition && <span className="text-muted-foreground"> — {item.definition}</span>}
                              {item.exemple && <span className="italic text-xs text-muted-foreground ml-1">(Ex: {item.exemple})</span>}
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
