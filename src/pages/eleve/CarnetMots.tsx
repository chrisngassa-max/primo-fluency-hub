import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type VocabularyItem = {
  id: string;
  word: string;
  translation: string | null;
  simple_definition: string | null;
  context_sentence: string | null;
  translation_language: string | null;
  created_at: string;
};

const CarnetMots = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const vocabularyQuery = useQuery({
    queryKey: ["student-vocabulary", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_vocabulary")
        .select("id, word, translation, simple_definition, context_sentence, translation_language, created_at")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as VocabularyItem[];
    },
  });

  const groupedItems = useMemo(() => {
    const items = vocabularyQuery.data ?? [];
    return items.reduce<Record<string, VocabularyItem[]>>((acc, item) => {
      const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
        new Date(item.created_at)
      );
      acc[date] = acc[date] ?? [];
      acc[date].push(item);
      return acc;
    }, {});
  }, [vocabularyQuery.data]);

  const handleDelete = async (itemId: string) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from("student_vocabulary")
      .delete()
      .eq("id", itemId)
      .eq("student_id", user.id);

    if (error) {
      toast.error("Impossible de supprimer ce mot");
      return;
    }

    toast.success("Mot supprimé");
    await queryClient.invalidateQueries({ queryKey: ["student-vocabulary", user.id] });
  };

  if (vocabularyQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">Mon carnet de mots</h1>
        </div>
        <Badge variant="secondary" className="w-fit text-sm">
          {(vocabularyQuery.data ?? []).length} mot{(vocabularyQuery.data ?? []).length > 1 ? "s" : ""}
        </Badge>
      </div>

      {(vocabularyQuery.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <BookMarked className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold tracking-normal">Aucun mot enregistré</h2>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedItems).map(([date, items]) => (
          <section key={date} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
              {date}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="space-y-0 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-2xl tracking-normal">
                          {item.word}
                        </CardTitle>
                        {item.translation ? (
                          <p className="mt-1 break-words text-base font-medium text-primary">
                            {item.translation}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <TTSAudioPlayer text={item.word} size="icon" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(item.id)}
                          aria-label="Supprimer le mot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {item.simple_definition ? (
                      <p className="rounded-md bg-muted p-3 text-foreground">{item.simple_definition}</p>
                    ) : null}
                    {item.context_sentence ? (
                      <p className="line-clamp-3 text-muted-foreground">{item.context_sentence}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default CarnetMots;
