import { useEffect, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LANGUAGES = [
  { value: "ar", label: "Arabe", speech: "ar" },
  { value: "prs", label: "Dari", speech: "fa-AF" },
  { value: "ti", label: "Tigrinya", speech: "ti" },
  { value: "bm", label: "Bambara", speech: "bm" },
] as const;

export default function TranslatedInstruction({ text }: { text: string }) {
  const [language, setLanguage] = useState("ar");
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setTranslation(""), [text, language]);

  const translate = async () => {
    const cacheKey = `captcf-instruction:${language}:${text}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setTranslation(cached);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-instruction", {
        body: { text, language },
      });
      if (error || !data?.translation) throw error ?? new Error("Traduction indisponible");
      setTranslation(data.translation);
      localStorage.setItem(cacheKey, data.translation);
    } catch (error: any) {
      toast.error("Traduction indisponible", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const selected = LANGUAGES.find((item) => item.value === language) ?? LANGUAGES[0];

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={translate} disabled={loading || !text}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
          Traduire la consigne
        </Button>
      </div>
      {translation && (
        <div className="mt-3 rounded-md bg-muted p-3">
          <p dir="auto" className="text-base leading-relaxed">{translation}</p>
          <TTSAudioPlayer
            text={translation}
            language={selected.speech}
            label={`Écouter en ${selected.label}`}
            className="mt-2"
          />
        </div>
      )}
    </div>
  );
}
