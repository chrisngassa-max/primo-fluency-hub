import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ChevronDown, ChevronUp, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { sendLessonToStudents } from "@/lib/sessionDistribution";

interface ResourceSection {
  titre: string;
  contenu: string;
  type: string;
  items?: { terme?: string; definition?: string; exemple?: string }[];
}

interface ImportedSupport {
  id: string;
  titre: string;
  type: string;
  competence: string;
  niveau: string;
  contenu: { titre?: string; resume?: string; sections?: ResourceSection[] } | null;
  created_at: string;
}

interface Props {
  sessionId: string;
}

const typeLabels: Record<string, string> = {
  lecon: "Leçon",
  vocabulaire: "Vocabulaire",
  rappel_methodo: "Rappel méthodo",
  rappel_visuel: "Rappel visuel",
};

export default function SessionImportedSupportsList({ sessionId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<string | null>(null);

  const { data: supports, isLoading } = useQuery({
    queryKey: ["session-supports", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ressources_pedagogiques" as any)
        .select("id, titre, type, competence, niveau, contenu, created_at")
        .eq("session_id", sessionId)
        .neq("type", "lecon")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ImportedSupport[];
    },
  });

  const handleSend = async (support: ImportedSupport) => {
    if (!user) return;
    setSending(support.id);
    try {
      const count = await sendLessonToStudents({
        resourceId: support.id,
        sessionId,
        assignedBy: user.id,
      });
      toast.success(`Support envoyé à ${count} élève(s)`, {
        description: "Ils le verront dans « Mes fiches ».",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Envoi impossible", { description: message });
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette leçon/support de la séance ?")) return;
    const { error } = await supabase.from("ressources_pedagogiques" as any).delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    toast.success("Support supprimé");
    qc.invalidateQueries({ queryKey: ["session-supports", sessionId] });
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!supports || supports.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Supports importés
          <Badge variant="secondary">{supports.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {supports.map((s) => {
          const content = s.contenu || {};
          const isOpen = !!expanded[s.id];
          return (
            <div key={s.id} className="rounded-md border bg-card">
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{content.titre || s.titre}</span>
                    <Badge variant="outline" className="text-xs">{typeLabels[s.type] || s.type}</Badge>
                    <Badge variant="outline" className="text-xs">{s.competence}</Badge>
                    <Badge variant="outline" className="text-xs">Niveau {s.niveau}</Badge>
                  </div>
                  {content.resume && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{content.resume}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}>
                    {isOpen ? <>Replier <ChevronUp className="h-4 w-4" /></> : <>Lire <ChevronDown className="h-4 w-4" /></>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    disabled={sending === s.id}
                    onClick={() => handleSend(s)}
                    title="Envoyer aux élèves"
                  >
                    <Send className="h-4 w-4" /> Envoyer
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(s.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {isOpen && (content.sections || []).length > 0 && (
                <div className="space-y-3 border-t p-3">
                  {(content.sections || []).map((section, i) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-semibold">{section.titre}</p>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{section.contenu}</p>
                      {(section.items || []).length > 0 && (
                        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                          {section.items!.map((item, j) => (
                            <li key={j}>
                              {item.terme && <span className="font-medium">{item.terme}</span>}
                              {item.definition && <span> — {item.definition}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
