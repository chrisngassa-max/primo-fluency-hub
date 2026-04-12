import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  RotateCcw,
  Image,
  Search,
  Eye,
  Pencil,
  Printer,
  Trash2,
  Filter,
  Send,
} from "lucide-react";
import { COMPETENCE_COLORS } from "@/lib/competences";

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lecon: { label: "Leçon", icon: BookOpen, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  vocabulaire: { label: "Vocabulaire", icon: FileText, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rappel_methodo: { label: "Rappel méthodo", icon: RotateCcw, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  rappel_visuel: { label: "Rappel visuel", icon: Image, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default function RessourcesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCompetence, setFilterCompetence] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [filterSession, setFilterSession] = useState<string>("all");
  const [previewResource, setPreviewResource] = useState<any>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["ressources-pedagogiques", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("*, sessions(titre)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Extract unique sessions for filter
  const sessionOptions = React.useMemo(() => {
    if (!resources) return [];
    const map = new Map<string, string>();
    resources.forEach((r: any) => {
      if (r.session_id && r.sessions?.titre) map.set(r.session_id, r.sessions.titre);
    });
    return Array.from(map, ([id, titre]) => ({ id, titre }));
  }, [resources]);

  const filtered = resources?.filter((r: any) => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterCompetence !== "all" && r.competence !== filterCompetence) return false;
    if (filterNiveau !== "all" && r.niveau !== filterNiveau) return false;
    if (filterSession !== "all" && r.session_id !== filterSession) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.titre?.toLowerCase().includes(q) || r.contenu?.resume?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ressources_pedagogiques" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erreur de suppression");
      return;
    }
    toast.success("Ressource supprimée.");
    queryClient.invalidateQueries({ queryKey: ["ressources-pedagogiques"] });
  };

  const handleTogglePublish = async (resource: any) => {
    const newStatut = resource.statut === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("ressources_pedagogiques" as any)
      .update({ statut: newStatut })
      .eq("id", resource.id);
    if (error) {
      toast.error("Erreur");
      return;
    }
    toast.success(newStatut === "published" ? "Ressource publiée !" : "Ressource repassée en brouillon.");
    queryClient.invalidateQueries({ queryKey: ["ressources-pedagogiques"] });
  };

  const handlePrint = (resource: any) => {
    const contenu = resource.contenu;
    if (!contenu?.sections) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html><head><title>${contenu.titre || resource.titre}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 22px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
        .meta span { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
        h2 { font-size: 16px; margin-top: 20px; color: #1e40af; }
        .encadre { border-left: 4px solid #2563eb; background: #eff6ff; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        .astuce { border-left: 4px solid #16a34a; background: #f0fdf4; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        .attention { border-left: 4px solid #ea580c; background: #fff7ed; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        .footer { margin-top: 40px; border-top: 1px solid #d1d5db; padding-top: 8px; font-size: 11px; color: #9ca3af; text-align: center; }
        @media print { body { margin: 20mm; } }
      </style></head><body>
      <h1>${contenu.titre || resource.titre}</h1>
      <div class="meta"><span>${resource.competence}</span><span>Niveau ${resource.niveau}</span><span>${typeConfig[resource.type]?.label || resource.type}</span></div>
      ${contenu.sections.map((s: any) => {
        const cls = s.type === "encadre" ? "encadre" : s.type === "astuce" ? "astuce" : s.type === "attention" ? "attention" : "";
        let html = cls ? `<div class="${cls}">` : "";
        html += `<h2>${s.titre}</h2><p>${(s.contenu || "").replace(/\n/g, "<br/>")}</p>`;
        if (s.items?.length) {
          html += `<table><tr><th>Terme</th><th>Définition</th><th>Exemple</th></tr>`;
          s.items.forEach((i: any) => { html += `<tr><td>${i.terme || ""}</td><td>${i.definition || ""}</td><td>${i.exemple || ""}</td></tr>`; });
          html += `</table>`;
        }
        if (cls) html += `</div>`;
        return html;
      }).join("")}
      <div class="footer">CAP TCF${resource.sessions?.titre ? ` — ${resource.sessions.titre}` : ""}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banque de ressources pédagogiques</h1>
        <p className="text-muted-foreground">Leçons, fiches de vocabulaire et rappels méthodologiques générés par l'IA.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une ressource…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="lecon">Leçons</SelectItem>
                <SelectItem value="vocabulaire">Vocabulaire</SelectItem>
                <SelectItem value="rappel_methodo">Rappels méthodo</SelectItem>
                <SelectItem value="rappel_visuel">Rappels visuels</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCompetence} onValueChange={setFilterCompetence}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Compétence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="CO">CO</SelectItem>
                <SelectItem value="CE">CE</SelectItem>
                <SelectItem value="EE">EE</SelectItem>
                <SelectItem value="EO">EO</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSession} onValueChange={setFilterSession}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Séance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les séances</SelectItem>
                {sessionOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterNiveau} onValueChange={setFilterNiveau}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="A0">A0</SelectItem>
                <SelectItem value="A1">A1</SelectItem>
                <SelectItem value="A2">A2</SelectItem>
                <SelectItem value="B1">B1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resource list */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : !filtered?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Aucune ressource</h3>
            <p className="text-sm text-muted-foreground">
              Les ressources générées depuis les séances apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resource: any) => {
            const tc = typeConfig[resource.type] || typeConfig.lecon;
            const TypeIcon = tc.icon;
            return (
              <Card key={resource.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate">{resource.titre}</CardTitle>
                    </div>
                    <Badge variant={resource.statut === "published" ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {resource.statut === "published" ? "Publié" : "Brouillon"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-1 mb-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${tc.color}`}>{tc.label}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${COMPETENCE_COLORS[resource.competence] || ""}`}>{resource.competence}</Badge>
                    <Badge variant="outline" className="text-[10px]">{resource.niveau}</Badge>
                  </div>
                  {resource.contenu?.resume && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{resource.contenu.resume}</p>
                  )}
                  {resource.sessions?.titre && (
                    <p className="text-[11px] text-muted-foreground">📅 {resource.sessions.titre}</p>
                  )}
                  <Separator className="my-2" />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewResource(resource)} title="Prévisualiser">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(resource)} title="Imprimer">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTogglePublish(resource)} title={resource.statut === "published" ? "Dépublier" : "Publier"}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(resource.id)} title="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewResource} onOpenChange={(o) => !o && setPreviewResource(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewResource?.titre}</DialogTitle>
          </DialogHeader>
          {previewResource?.contenu?.sections && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {previewResource.contenu.resume && (
                  <p className="text-sm text-muted-foreground italic">{previewResource.contenu.resume}</p>
                )}
                {previewResource.contenu.sections.map((section: any, i: number) => (
                  <div key={i} className={`${
                    section.type === "encadre" ? "border-l-4 border-primary bg-primary/5 p-3 rounded-r-md" :
                    section.type === "astuce" ? "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30 p-3 rounded-r-md" :
                    section.type === "attention" ? "border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-r-md" :
                    ""
                  }`}>
                    <h3 className="font-semibold text-sm mb-1">{section.titre}</h3>
                    <p className="text-sm whitespace-pre-wrap">{section.contenu}</p>
                    {section.items?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {section.items.map((item: any, j: number) => (
                          <div key={j} className="flex gap-2 text-sm bg-background/50 rounded p-2">
                            {item.terme && <span className="font-medium">{item.terme}</span>}
                            {item.definition && <span className="text-muted-foreground">— {item.definition}</span>}
                            {item.exemple && <span className="italic text-xs text-muted-foreground">Ex: {item.exemple}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => handlePrint(previewResource)}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Imprimer
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => handleTogglePublish(previewResource)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              {previewResource?.statut === "published" ? "Dépublier" : "Publier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
