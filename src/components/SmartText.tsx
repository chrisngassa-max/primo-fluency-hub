import { useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface WordDetails {
  translation: string;
  simple_definition: string;
  translation_language?: string;
  context_sentence?: string | null;
}

interface SmartTextProps {
  text: string;
  studentId: string;
  contextSentence?: string;
  translationLanguage?: string;
  className?: string;
}

function normalizeWord(word: string) {
  return word
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}'-]/gu, "");
}

function tokenize(text: string) {
  return text.match(/[\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+/gu) ?? [];
}

export default function SmartText({
  text,
  studentId,
  contextSentence,
  translationLanguage = "fr",
  className,
}: SmartTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [detailsByWord, setDetailsByWord] = useState<Record<string, WordDetails>>({});
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const [savingWord, setSavingWord] = useState<string | null>(null);

  const loadDetails = async (word: string) => {
    const normalized = normalizeWord(word);
    if (!normalized || detailsByWord[normalized]) return;

    setLoadingWord(normalized);
    try {
      const { data, error } = await supabase.functions.invoke("get-word-definition", {
        body: {
          word,
          context_sentence: contextSentence || text,
          student_id: studentId,
          translation_language: translationLanguage,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDetailsByWord((prev) => ({
        ...prev,
        [normalized]: {
          translation: data.translation ?? "",
          simple_definition: data.simple_definition ?? "",
          translation_language: data.translation_language ?? translationLanguage,
          context_sentence: data.context_sentence ?? contextSentence ?? text,
        },
      }));
    } catch (error: any) {
      toast.error("Mot indisponible", { description: error.message });
    } finally {
      setLoadingWord(null);
    }
  };

  const saveWord = async (word: string) => {
    const normalized = normalizeWord(word);
    const details = detailsByWord[normalized];
    if (!details) return;

    setSavingWord(normalized);
    try {
      const { error } = await supabase.from("student_vocabulary").insert({
        student_id: studentId,
        word,
        normalized_word: normalized,
        context_sentence: details.context_sentence ?? contextSentence ?? text,
        translation: details.translation,
        translation_language: details.translation_language ?? translationLanguage,
        simple_definition: details.simple_definition,
      } as any);
      if (error) throw error;
      toast.success("Mot ajouté au carnet");
    } catch (error: any) {
      toast.error("Impossible d'ajouter le mot", { description: error.message });
    } finally {
      setSavingWord(null);
    }
  };

  return (
    <span className={cn("leading-relaxed", className)}>
      {tokens.map((token, index) => {
        const isWord = /^[\p{L}\p{N}'-]+$/u.test(token);
        if (!isWord || token.length <= 1) return <span key={`${token}-${index}`}>{token}</span>;

        const normalized = normalizeWord(token);
        const details = detailsByWord[normalized];
        const isLoading = loadingWord === normalized;
        const isSaving = savingWord === normalized;

        return (
          <Popover key={`${token}-${index}`}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={() => loadDetails(token)}
                className="rounded-sm underline decoration-dotted underline-offset-4 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {token}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" align="start">
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{token}</p>
                <TTSAudioPlayer text={token} size="icon" />
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recherche du mot...
                </div>
              ) : details ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Traduction</p>
                    <p>{details.translation || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Définition simple</p>
                    <p>{details.simple_definition || "—"}</p>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => saveWord(token)} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Ajouter à mon carnet
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Clique encore si le mot ne s'affiche pas.</p>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </span>
  );
}
