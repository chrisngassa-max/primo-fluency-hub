import { useMemo, useState } from "react";
import { Plus, Loader2, Check } from "lucide-react";
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
  { value: "prs", label: "Dari" },
  { value: "ti", label: "Tigrinya" },
  { value: "bm", label: "Bambara" },
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
  example?: string | null;
  translation_language?: string;
  context_sentence?: string | null;
}

const WORD_ERROR_MESSAGES = {
  ai_unavailable: "Traduction momentanément indisponible. Réessaie dans un instant.",
  consent_required: "La traduction nécessite le consentement IA. Active-le dans ton profil.",
  student_mismatch: "Session incohérente. Recharge la page ou reconnecte-toi, puis réessaie.",
  network: "Connexion impossible. Vérifie ta connexion internet, puis réessaie.",
  generic: "Impossible d'afficher ce mot pour le moment. Réessaie.",
} as const;

type WordErrorKind = keyof typeof WORD_ERROR_MESSAGES;

/**
 * Lit le corps JSON renvoyé par l'Edge Function (même sur statut non-2xx, où
 * supabase-js expose la réponse via `error.context`) afin de distinguer un
 * service IA indisponible, un consentement manquant ou une erreur réseau.
 */
async function classifyWordError(error: unknown, data: any): Promise<WordErrorKind> {
  let code: string | undefined;
  let rawMessage: string | undefined;

  if (data && typeof data === "object" && "error" in data) {
    code = (data as any).code ?? (data as any).reason ?? (data as any).error;
    rawMessage = (data as any).error ?? (data as any).message;
  }

  const context = (error as any)?.context;
  if (!code && context instanceof Response) {
    try {
      const body = await context.clone().json();
      code = body?.code ?? body?.reason ?? body?.error;
      rawMessage = body?.message ?? body?.error ?? rawMessage;
    } catch {
      // Corps illisible : on retombe sur le nom/message d'erreur ci-dessous.
    }
  }

  const errorName = (error as any)?.name as string | undefined;
  if (!code && (errorName === "FunctionsFetchError" || error instanceof TypeError)) {
    return "network";
  }

  const haystack = `${code ?? ""} ${rawMessage ?? ""}`.toLowerCase();
  if (haystack.includes("student_mismatch")) return "student_mismatch";
  if (haystack.includes("consent")) return "consent_required";
  if (
    haystack.includes("ai_unavailable") ||
    haystack.includes("server_misconfigured") ||
    haystack.includes("pseudonym") ||
    haystack.includes("gemini") ||
    haystack.includes("lovable") ||
    haystack.includes("service ia") ||
    haystack.includes("tool call") ||
    haystack.includes("internal_error")
  ) {
    return "ai_unavailable";
  }
  if (errorName === "FunctionsFetchError" || haystack.includes("failed to fetch")) return "network";

  return "generic";
}

interface SmartTextProps {
  text: string;
  studentId: string;
  contextSentence?: string;
  translationLanguage?: string;
  className?: string;
  allowSave?: boolean;
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
  allowSave = true,
}: SmartTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = useState(() =>
    getInitialTranslationLanguage(translationLanguage)
  );
  const [detailsByWord, setDetailsByWord] = useState<Record<string, WordDetails>>({});
  const [errorByWord, setErrorByWord] = useState<Record<string, WordErrorKind>>({});
  const [loadingWord, setLoadingWord] = useState<string | null>(null);
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const [savedByWord, setSavedByWord] = useState<Record<string, boolean>>({});

  const loadDetails = async (word: string, language = selectedTranslationLanguage) => {
    const normalized = normalizeWord(word);
    const detailsKey = makeDetailsKey(normalized, language);
    if (!normalized || detailsByWord[detailsKey]) return;

    setErrorByWord((prev) => {
      if (!prev[detailsKey]) return prev;
      const next = { ...prev };
      delete next[detailsKey];
      return next;
    });
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
      if (error || data?.error) {
        const kind = await classifyWordError(error, data);
        setErrorByWord((prev) => ({ ...prev, [detailsKey]: kind }));
        toast.error("Mot indisponible", { description: WORD_ERROR_MESSAGES[kind] });
        return;
      }
      setDetailsByWord((prev) => ({
        ...prev,
        [detailsKey]: {
          translation: data.translation ?? "",
          simple_definition: data.simple_definition ?? "",
          example: data.example ?? null,
          translation_language: data.translation_language ?? language,
          context_sentence: data.context_sentence ?? contextSentence ?? text,
        },
      }));

      const { data: savedRow } = await supabase
        .from("student_vocabulary")
        .select("id")
        .eq("student_id", studentId)
        .eq("normalized_word", normalized)
        .eq("translation_language", language)
        .eq("is_saved", true)
        .limit(1)
        .maybeSingle();
      if (savedRow) setSavedByWord((prev) => ({ ...prev, [detailsKey]: true }));
    } catch (error) {
      const kind = await classifyWordError(error, null);
      setErrorByWord((prev) => ({ ...prev, [detailsKey]: kind }));
      toast.error("Mot indisponible", { description: WORD_ERROR_MESSAGES[kind] });
    } finally {
      setLoadingWord(null);
    }
  };

  const saveWord = async (word: string) => {
    if (!allowSave) return;
    const normalized = normalizeWord(word);
    const detailsKey = makeDetailsKey(normalized, selectedTranslationLanguage);
    const details = detailsByWord[detailsKey];
    if (!details) return;

    setSavingWord(detailsKey);
    try {
      const language = details.translation_language ?? selectedTranslationLanguage;
      const contextValue = details.context_sentence ?? contextSentence ?? text;

      // Déduplication : si une entrée existe déjà pour ce mot (cache is_saved=false
      // ou carnet), on la promeut en is_saved=true plutôt que de créer un doublon.
      const { data: existing, error: lookupError } = await supabase
        .from("student_vocabulary")
        .select("id")
        .eq("student_id", studentId)
        .eq("normalized_word", normalized)
        .eq("translation_language", language)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existing) {
        const { error } = await supabase
          .from("student_vocabulary")
          .update({
            word,
            context_sentence: contextValue,
            translation: details.translation,
            simple_definition: details.simple_definition,
            is_saved: true,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existing.id)
          .eq("student_id", studentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("student_vocabulary").insert({
          student_id: studentId,
          word,
          normalized_word: normalized,
          context_sentence: contextValue,
          translation: details.translation,
          translation_language: language,
          simple_definition: details.simple_definition,
          is_saved: true,
        } as any);
        if (error) throw error;
      }
      setSavedByWord((prev) => ({ ...prev, [detailsKey]: true }));
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
        const errorKind = errorByWord[detailsKey];
        const isLoading = loadingWord === detailsKey;
        const isSaving = savingWord === detailsKey;
        const isSaved = savedByWord[detailsKey] ?? false;
        const selectedLanguageLabel =
          TRANSLATION_LANGUAGES.find((language) => language.value === selectedTranslationLanguage)?.label ??
          "Langue choisie";

        return (
          <Popover key={`${token}-${index}`}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(event) => {
                  // Empêche la sélection d'une réponse lorsque le mot est dans une option cliquable.
                  event.stopPropagation();
                  void loadDetails(token);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                  }
                }}
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
              ) : errorKind ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive" role="alert">
                    {WORD_ERROR_MESSAGES[errorKind]}
                  </p>
                  {errorKind !== "consent_required" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => void loadDetails(token)}
                    >
                      Réessayer
                    </Button>
                  )}
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
                  {details.example && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Exemple</p>
                      <p className="italic">{details.example}</p>
                    </div>
                  )}
                  {allowSave && (
                    isSaved ? (
                      <Button size="sm" variant="secondary" className="w-full" disabled>
                        <Check className="mr-2 h-4 w-4" />
                        Déjà dans le carnet
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => saveWord(token)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Ajouter à mon carnet
                      </Button>
                    )
                  )}
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
