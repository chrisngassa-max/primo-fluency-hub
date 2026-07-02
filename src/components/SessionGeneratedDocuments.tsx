import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendLessonToStudents, sendSessionExercisesToStudents } from "@/lib/sessionDistribution";

interface ResourceSection {
  titre: string;
  contenu: string;
  type: string;
}

interface SessionLesson {
  id: string;
  titre: string;
  type: string;
  competence: string;
  niveau: string;
  source: string;
  statut: string;
  contenu: { titre?: string; resume?: string; sections?: ResourceSection[] } | null;
  created_at: string;
}

interface SessionGeneratedExercise {
  id: string;
  statut: string;
  is_sent: boolean;
  ordre: number;
  exercice: {
    id: string;
    titre: string;
    consigne: string;
    competence: string;
    format: string;
    is_ai_generated: boolean;
  } | null;
}

const exerciseStatutLabels: Record<string, string> = {
  planifie: "Planifié",
  traite_en_classe: "Traité en classe",
  reporte: "Reporté",
  devoir_remediation: "Devoir remédiation",
  devoir_anticipation: "Devoir anticipation",
};

interface Props {
  sessionId: string;
  onPreviewExercise?: (exercise: SessionGeneratedExercise["exercice"]) => void;
}

export default function SessionGeneratedDocuments({ sessionId, onPreviewExercise }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [sendingExerciseId, setSendingExerciseId] = useState<string | null>(null);
  const [sendingLessonId, setSendingLessonId] = useState<string | null>(null);

  const { data: sessionExercices, isLoading: loadingExercises } = useQuery({
    queryKey: ["session-generated-exercices", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select(
          "id, statut, is_sent, ordre, exercice:exercices(id, titre, consigne, competence, format, is_ai_generated)"
        )
        .eq("session_id", sessionId)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as unknown as SessionGeneratedExercise[];
    },
  });

  const { data: lessons, isLoading: loadingLessons } = useQuery({
    queryKey: ["session-generated-lecons", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ressources_pedagogiques" as never)
        .select("id, titre, type, competence, niveau, source, statut, contenu, created_at")
        .eq("session_id", sessionId)
        .eq("type", "lecon")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SessionLesson[];
    },
  });

  const lessonIds = useMemo(() => (lessons ?? []).map((l) => l.id), [lessons]);

  const { data: assignedLessonIds } = useQuery({
    queryKey: ["session-lesson-assignments", sessionId, lessonIds],
    queryFn: async () => {
      if (lessonIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("resource_assignments" as never)
        .select("resource_id")
        .in("resource_id", lessonIds);
      if (error) throw error;
      return new Set((data || []).map((r: { resource_id: string }) => r.resource_id));
    },
    enabled: lessonIds.length > 0,
  });

  const generatedExercises = useMemo(
    () => (sessionExercices ?? []).filter((se) => se.exercice?.is_ai_generated),
    [sessionExercices]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredExercises = useMemo(() => {
    if (!normalizedSearch) return generatedExercises;
    return generatedExercises.filter((se) => {
      const titre = se.exercice?.titre?.toLowerCase() ?? "";
      const competence = se.exercice?.competence?.toLowerCase() ?? "";
      return titre.includes(normalizedSearch) || competence.includes(normalizedSearch);
    });
  }, [generatedExercises, normalizedSearch]);

  const filteredLessons = useMemo(() => {
    if (!normalizedSearch) return lessons ?? [];
    return (lessons ?? []).filter((l) => {
      const titre = (l.contenu?.titre || l.titre).toLowerCase();
      const resume = (l.contenu?.resume || "").toLowerCase();
      return (
        titre.includes(normalizedSearch) ||
        resume.includes(normalizedSearch) ||
        l.competence.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [lessons, normalizedSearch]);

  const handleSendExercise = async (sessionExerciceId: string) => {
    setSendingExerciseId(sessionExerciceId);
    try {
      await sendSessionExercisesToStudents({
        sessionId,
        sessionExerciceIds: [sessionExerciceId],
      });
      qc.invalidateQueries({ queryKey: ["session-exercices", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-generated-exercices", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-info", sessionId] });
      toast.success("Exercice envoyé aux élèves");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Envoi impossible", { description: message });
    } finally {
      setSendingExerciseId(null);
    }
  };

  const handleSendLesson = async (lesson: SessionLesson) => {
    if (!user) return;
    setSendingLessonId(lesson.id);
    try {
      const count = await sendLessonToStudents({
        resourceId: lesson.id,
        sessionId,
        assignedBy: user.id,
      });
      qc.invalidateQueries({ queryKey: ["session-lesson-assignments", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-supports", sessionId] });
      qc.invalidateQueries({ queryKey: ["session-generated-lecons", sessionId] });
      toast.success(`Leçon envoyée à ${count} élève(s)`, {
        description: "Ils la verront dans « Mes fiches ».",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Envoi impossible", { description: message });
    } finally {
      setSendingLessonId(null);
    }
  };

  const isLoading = loadingExercises || loadingLessons;
  const totalCount = generatedExercises.length + (lessons?.length ?? 0);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (totalCount === 0) return null;

  return (
    <Card className="border-violet-200 dark:border-violet-900/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-violet-600" />
          Documents générés
          <Badge variant="secondary">{totalCount}</Badge>
        </CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, compétence…"
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="exercices">
          <TabsList className="mb-3">
            <TabsTrigger value="exercices" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Exercices générés
              <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
                {filteredExercises.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="lecons" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Leçons générées
              <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">
                {filteredLessons.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exercices" className="space-y-2">
            {filteredExercises.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {generatedExercises.length === 0
                  ? "Aucun exercice généré pour cette séance."
                  : "Aucun exercice ne correspond à votre recherche."}
              </p>
            ) : (
              filteredExercises.map((se, i) => {
                const ex = se.exercice;
                const isSent = se.is_sent || se.statut === "traite_en_classe";
                return (
                  <div
                    key={se.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-card p-3",
                      isSent && "opacity-75"
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-violet-50 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("truncate text-sm font-medium", isSent && "line-through")}>
                          {ex?.titre || "Exercice"}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          ✨ IA
                        </Badge>
                        {ex?.competence && (
                          <Badge variant="outline" className="text-[10px]">{ex.competence}</Badge>
                        )}
                        {ex?.format && (
                          <Badge variant="outline" className="text-[10px]">
                            {ex.format.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {isSent ? (
                          <Badge variant="outline" className="gap-1 text-[10px] bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                            <Send className="h-2.5 w-2.5" /> Envoyé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {exerciseStatutLabels[se.statut] || se.statut}
                          </Badge>
                        )}
                      </div>
                      {ex?.consigne && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{ex.consigne}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {onPreviewExercise && ex && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Aperçu"
                          onClick={() => onPreviewExercise(ex)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        disabled={sendingExerciseId === se.id || isSent}
                        onClick={() => handleSendExercise(se.id)}
                        title="Envoyer aux élèves"
                      >
                        {sendingExerciseId === se.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Envoyer
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="lecons" className="space-y-2">
            {filteredLessons.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {(lessons?.length ?? 0) === 0
                  ? "Aucune leçon générée pour cette séance."
                  : "Aucune leçon ne correspond à votre recherche."}
              </p>
            ) : (
              filteredLessons.map((lesson) => {
                const content = lesson.contenu || {};
                const isOpen = !!expandedLessons[lesson.id];
                const isAssigned = assignedLessonIds?.has(lesson.id);
                return (
                  <div key={lesson.id} className="rounded-md border bg-card">
                    <div className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {content.titre || lesson.titre}
                          </span>
                          {lesson.source === "auto" && (
                            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                              ✨ IA
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{lesson.competence}</Badge>
                          <Badge variant="outline" className="text-[10px]">Niveau {lesson.niveau}</Badge>
                          {isAssigned ? (
                            <Badge variant="outline" className="gap-1 text-[10px] bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                              <Send className="h-2.5 w-2.5" /> Envoyée
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {lesson.statut === "published" ? "Publiée" : "Brouillon"}
                            </Badge>
                          )}
                        </div>
                        {content.resume && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{content.resume}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            setExpandedLessons((p) => ({ ...p, [lesson.id]: !p[lesson.id] }))
                          }
                        >
                          {isOpen ? (
                            <>Replier <ChevronUp className="h-4 w-4" /></>
                          ) : (
                            <>Lire <ChevronDown className="h-4 w-4" /></>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          disabled={sendingLessonId === lesson.id}
                          onClick={() => handleSendLesson(lesson)}
                          title="Envoyer aux élèves"
                        >
                          {sendingLessonId === lesson.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Envoyer
                        </Button>
                      </div>
                    </div>
                    {isOpen && (content.sections || []).length > 0 && (
                      <div className="space-y-3 border-t p-3">
                        {(content.sections || []).map((section, idx) => (
                          <div key={idx} className="border-l-2 border-primary/40 pl-3">
                            <p className="text-sm font-semibold">{section.titre}</p>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {section.contenu}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
