import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Filter, Loader2, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";

const typeLabels: Record<string, string> = {
  lecon: "Leçon",
  vocabulaire: "Vocabulaire",
  rappel_methodo: "Méthode",
  rappel_visuel: "Rappel visuel",
};

const typeColors: Record<string, string> = {
  lecon: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  vocabulaire: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rappel_methodo: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  rappel_visuel: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const RessourcesEleve = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: resources, isLoading } = useQuery({
    queryKey: ["eleve-ressources", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: gm } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("eleve_id", user!.id);
      const groupIds = (gm ?? []).map((r: any) => r.group_id);
      if (groupIds.length === 0) return [];

      const { data: groups } = await supabase
        .from("groups")
        .select("formateur_id")
        .in("id", groupIds);
      const formateurIds = [...new Set((groups ?? []).map((g: any) => g.formateur_id as string))];
      if (formateurIds.length === 0) return [];

      const { data, error } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("id, titre, type, competence, niveau, contenu, created_at")
        .in("formateur_id", formateurIds)
        .eq("statut", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!resources) return [];
    return resources.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.titre?.toLowerCase().includes(q) ||
          r.contenu?.resume?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [resources, filterType, search]);

  const handlePrint = (resource: any) => {
    const contenu = resource.contenu;
    if (!contenu?.sections) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${resource.titre}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:14px;line-height:1.6;margin:40px;color:#1a1a1a;}
        h1{font-size:22px;border-bottom:2px solid #2563eb;padding-bottom:8px;}
        h2{font-size:16px;color:#1e40af;margin-top:20px;}
        .enc{border-left:4px solid #2563eb;background:#eff6ff;padding:12px;margin:12px 0;border-radius:4px;}
        .astuce{border-left:4px solid #16a34a;background:#f0fdf4;padding:12px;margin:12px 0;border-radius:4px;}
        table{border-collapse:collapse;width:100%;margin:12px 0;}
        td,th{border:1px solid #d1d5db;padding:8px;}th{background:#f3f4f6;}
        .footer{margin-top:40px;border-top:1px solid #d1d5db;padding-top:8px;font-size:11px;color:#9ca3af;text-align:center;}
        @media print{body{margin:20mm;}}
      </style></head><body>
      <h1>${resource.titre}</h1>
      ${contenu.sections
        .map((s: any) => {
          const cls = s.type === "encadre" ? "enc" : s.type === "astuce" ? "astuce" : "";
          return `<div ${cls ? `class="${cls}"` : ""}>
            <h2>${s.titre}</h2>
            <p>${(s.contenu || "").replace(/\n/g, "<br/>")}</p>
            ${
              s.items?.length
                ? `<table><tr><th>Terme</th><th>Définition</th><th>Exemple</th></tr>
                   ${s.items.map((i: any) => `<tr><td>${i.terme || ""}</td><td>${i.definition || ""}</td><td>${i.exemple || ""}</td></tr>`).join("")}
                   </table>`
                : ""
            }
          </div>`;
        })
        .join("")}
      <div class="footer">CAP TCF</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">Mes ressources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leçons et fiches publiées par votre formateur
          </p>
        </div>
        <Badge variant="secondary" className="w-fit text-sm">
          {(resources ?? []).length} ressource{(resources ?? []).length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une ressource…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-1 h-3.5 w-3.5" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="lecon">Leçons</SelectItem>
            <SelectItem value="vocabulaire">Vocabulaire</SelectItem>
            <SelectItem value="rappel_methodo">Méthode</SelectItem>
            <SelectItem value="rappel_visuel">Rappels visuels</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold tracking-normal">
                {(resources ?? []).length === 0
                  ? "Aucune ressource disponible"
                  : "Aucun résultat"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {(resources ?? []).length === 0
                  ? "Votre formateur n'a pas encore publié de ressources."
                  : "Aucune ressource ne correspond à votre recherche."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((resource) => (
            <Card key={resource.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {resource.titre}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] ${typeColors[resource.type] ?? ""}`}
                  >
                    {typeLabels[resource.type] ?? resource.type}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {resource.competence && (
                    <Badge variant="outline" className="text-[10px]">
                      {resource.competence}
                    </Badge>
                  )}
                  {resource.niveau && (
                    <Badge variant="outline" className="text-[10px]">
                      {resource.niveau}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {resource.contenu?.resume && (
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {resource.contenu.resume}
                  </p>
                )}

                {resource.contenu?.sections?.slice(0, 2).map((section: any, i: number) => (
                  <div
                    key={i}
                    className={`mb-2 rounded-md p-3 text-sm ${
                      section.type === "encadre"
                        ? "border-l-2 border-primary bg-primary/5"
                        : section.type === "astuce"
                        ? "border-l-2 border-green-500 bg-green-50 dark:bg-green-950/20"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs font-semibold">{section.titre}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {section.contenu}
                        </p>
                      </div>
                      <TTSAudioPlayer
                        text={`${section.titre}. ${section.contenu}`}
                        size="icon"
                      />
                    </div>
                  </div>
                ))}

                {resource.contenu?.sections?.length > 2 && (
                  <p className="mb-2 text-center text-xs text-muted-foreground">
                    +{resource.contenu.sections.length - 2} section
                    {resource.contenu.sections.length - 2 > 1 ? "s" : ""}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => handlePrint(resource)}
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Imprimer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RessourcesEleve;
