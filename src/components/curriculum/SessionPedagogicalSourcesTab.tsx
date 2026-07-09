import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPedagogicalSources,
  fetchSessionPedagogicalSources,
  getPedagogicalSourceSignedUrl,
  linkPedagogicalSourceToSession,
  SOURCE_KIND_LABELS,
  SOURCE_USAGE_LABELS,
  unlinkPedagogicalSourceFromSession,
  type PedagogicalSource,
  type SourceUsageScope,
} from "@/lib/pedagogicalSources";
import { BookOpen, Eye, Link2, Loader2, Trash2 } from "lucide-react";

const USAGE_SCOPES: SourceUsageScope[] = [
  "context_ia",
  "support_formateur",
  "support_apprenant",
  "source_exercices",
  "source_vocabulaire",
];

function LinkSourceDialog({
  sessionCode,
  open,
  onOpenChange,
}: {
  sessionCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [usageScope, setUsageScope] = useState<SourceUsageScope>("context_ia");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["pedagogical-sources", "link-dialog", search],
    queryFn: () => fetchPedagogicalSources({ search }),
    enabled: open,
  });

  async function handleLink() {
    if (!user || !selectedSourceId) return;
    setSaving(true);
    try {
      await linkPedagogicalSourceToSession({
        sessionCode,
        sourceId: selectedSourceId,
        usageScope,
        notes,
        userId: user.id,
      });
      toast.success("Source liée à la séance.");
      queryClient.invalidateQueries({ queryKey: ["session-pedagogical-sources", sessionCode] });
      onOpenChange(false);
      setSelectedSourceId("");
      setNotes("");
    } catch (error: any) {
      toast.error("Lien impossible", { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lier une source pédagogique</DialogTitle>
          <DialogDescription>
            Cette source servira de cadrage ou d'appui. Elle n'est pas automatiquement ajoutée au livret.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une source..." />
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune source trouvée.</p>
            ) : (
              sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedSourceId(source.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedSourceId === source.id ? "border-orange-500 bg-orange-50" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {SOURCE_KIND_LABELS[source.source_kind] ?? source.source_kind} · {(source.pedagogical_domains || []).join(", ") || "domaines à compléter"}
                      </p>
                    </div>
                    <Badge variant="outline">{source.review_status}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Usage dans cette séance</label>
              <Select value={usageScope} onValueChange={(value) => setUsageScope(value as SourceUsageScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USAGE_SCOPES.map((scope) => (
                    <SelectItem key={scope} value={scope}>{SOURCE_USAGE_LABELS[scope]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes d'utilisation</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : utiliser uniquement le vocabulaire, ne pas recopier dans les fiches élèves..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={!selectedSourceId || saving} onClick={handleLink} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Lier à la séance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SessionPedagogicalSourcesTab({ sessionCode }: { sessionCode: string }) {
  const queryClient = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: links = [], isLoading, error } = useQuery({
    queryKey: ["session-pedagogical-sources", sessionCode],
    queryFn: () => fetchSessionPedagogicalSources(sessionCode),
  });

  const usableForAiCount = useMemo(() => links.filter((link) => link.source?.reusable_for_ai).length, [links]);

  async function handleOpen(source: PedagogicalSource) {
    setOpeningId(source.id);
    try {
      const url = await getPedagogicalSourceSignedUrl(source);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error("Ouverture impossible", { description: error.message });
    } finally {
      setOpeningId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await unlinkPedagogicalSourceFromSession(id);
      toast.success("Source retirée de la séance.");
      queryClient.invalidateQueries({ queryKey: ["session-pedagogical-sources", sessionCode] });
    } catch (error: any) {
      toast.error("Suppression impossible", { description: error.message });
    } finally {
      setRemovingId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">Impossible de charger les sources liées : {(error as Error).message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">
            Sources de cadrage pour la séance. Elles n'apparaissent pas automatiquement dans les livrets, contrairement aux documents du déroulé.
          </p>
          <p className="text-xs text-muted-foreground mt-1">{links.length} source(s) liée(s), dont {usableForAiCount} utilisable(s) comme contexte IA.</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLinkOpen(true)}>
          <Link2 className="h-3.5 w-3.5" /> Lier une source
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucune source d'appui liée. Ajoutez ici un manuel, une image, une leçon ou une référence pour cadrer les futures productions.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {links.map((link) => {
            const source = link.source;
            return (
              <Card key={link.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-orange-600" />
                      {source?.title ?? "Source introuvable"}
                    </CardTitle>
                    <Badge variant="outline">{SOURCE_USAGE_LABELS[link.usage_scope]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {source ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{SOURCE_KIND_LABELS[source.source_kind] ?? source.source_kind}</Badge>
                        {source.pedagogical_domains.map((domain) => <Badge key={domain} variant="secondary" className="text-[10px]">{domain}</Badge>)}
                        {source.themes.slice(0, 4).map((theme) => <Badge key={theme} variant="secondary" className="text-[10px]">{theme}</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        IA : {source.reusable_for_ai ? "oui" : "non"} · Élèves : {source.reusable_for_students ? "oui" : "non"}
                      </p>
                      {link.notes && <p className="text-xs bg-muted/50 rounded-md p-2">{link.notes}</p>}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={openingId === source.id} onClick={() => handleOpen(source)}>
                          {openingId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          Ouvrir
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive" disabled={removingId === link.id} onClick={() => handleRemove(link.id)}>
                          {removingId === link.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Retirer
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" disabled={removingId === link.id} onClick={() => handleRemove(link.id)}>
                      Retirer le lien cassé
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <LinkSourceDialog sessionCode={sessionCode} open={linkOpen} onOpenChange={setLinkOpen} />
    </div>
  );
}
