import { useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TRANSLATION_LANGUAGE_STORAGE_KEY = "primo-smart-text-translation-language";

const TRANSLATION_LANGUAGES = [
  { value: "fr", label: "Français simple" },
  { value: "en", label: "Anglais" },
  { value: "ar", label: "Arabe" },
  { value: "ta", label: "Tamoul" },
  { value: "es", label: "Espagnol" },
  { value: "pt", label: "Portugais" },
  { value: "tr", label: "Turc" },
  { value: "uk", label: "Ukrainien" },
  { value: "ru", label: "Russe" },
] as const;

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

function makeDetailsKey(normalizedWord: string, language: string) {
  return `${normalizedWord}::${language}`;
}

function getInitialTranslationLanguage(fallbackLanguage: string) {
  if (typeof window === "undefined") return fallbackLanguage;

  try {
    const stored = window.localStorage.getItem(TRANSLATION_LANGUAGE_STORAGE_KEY);
    return stored || fallbackLanguage;
  } catch {
    return fallbackLanguage;
  }
}

export default function SmartText({
  text,
  studentId,
  contextSentence,
  translationLanguage = "fr",
  className,
}: SmartTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = useState(() =>
    getInitialTranslationLanguage(translationLanguage)
  );
  const [detailsByWord, setDetailsByWord] = useState<Record<string, WordDetails>>({});
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const [savingWord, setSavingWord] = useState<string | null>(null);

  const loadDetails = async (word: string, language = selectedTranslationLanguage) => {
    const normalized = normalizeWord(word);
    const detailsKey = makeDetailsKey(normalized, language);
    if (!normalized || detailsByWord[detailsKey]) return;

    setLoadingWord(detailsKey);
    try {
      const { data, error } = await supabase.functions.invoke("get-word-definition", {
        body: {
          word,
          context_sentence: contextSentence || text,
          student_id: studentId,
          translation_language: language,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDetailsByWord((prev) => ({
        ...prev,
        [detailsKey]: {
          translation: data.translation ?? "",
          simple_definition: data.simple_definition ?? "",
          translation_language: data.translation_language ?? language,
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
    const detailsKey = makeDetailsKey(normalized, selectedTranslationLanguage);
    const details = detailsByWord[detailsKey];
    if (!details) return;

    setSavingWord(detailsKey);
    try {
      const { error } = await supabase.from("student_vocabulary").insert({
        student_id: studentId,
        word,
        normalized_word: normalized,
        context_sentence: details.context_sentence ?? contextSentence ?? text,
        translation: details.translation,
        translation_language: details.translation_language ?? selectedTranslationLanguage,
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

  const handleLanguageChange = (word: string, language: string) => {
    setSelectedTranslationLanguage(language);
    try {
      window.localStorage.setItem(TRANSLATION_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The selected language still applies for the current page if storage is blocked.
    }
    void loadDetails(word, language);
  };

  return (
    <span className={cn("leading-relaxed", className)}>
      {tokens.map((token, index) => {
        const isWord = /^[\p{L}\p{N}'-]+$/u.test(token);
        if (!isWord || token.length <= 1) return <span key={`${token}-${index}`}>{token}</span>;

        const normalized = normalizeWord(token);
        const detailsKey = makeDetailsKey(normalized, selectedTranslationLanguage);
        const details = detailsByWord[detailsKey];
        const isLoading = loadingWord === detailsKey;
        const isSaving = savingWord === detailsKey;
        const selectedLanguageLabel =
          TRANSLATION_LANGUAGES.find((language) => language.value === selectedTranslationLanguage)?.label ??
          "Langue choisie";

        return (
          <Popover key={`${token}-${index}`}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={() => void loadDetails(token)}
                className="inline cursor-help rounded-[3px] border-b border-dotted border-primary/60 bg-primary/5 px-0.5 text-left align-baseline text-inherit transition-colors [font:inherit] [line-height:inherit] hover:border-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1"
                aria-label={`Comprendre le mot ${token}`}
                title="Écouter, traduire et ajouter au carnet"
              >
                {token}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] space-y-3" align="start">
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{token}</p>
                <TTSAudioPlayer text={token} size="icon" />
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Traduire en</p>
                <Select
                  value={selectedTranslationLanguage}
                  onValueChange={(language) => handleLanguageChange(token, language)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue aria-label={selectedLanguageLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSLATION_LANGUAGES.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <p dir="auto">{details.translation || "—"}</p>
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
