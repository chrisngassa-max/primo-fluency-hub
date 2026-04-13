import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";

interface SessionFeedbackFormProps {
  sessionId: string;
  eleveId: string;
  onSubmitted?: () => void;
}

type Rating = 1 | 2 | 3;

type FeedbackField = "difficulte_percue" | "confiance" | "utilite_percue";

const QUESTIONS: {
  field: FeedbackField;
  label: string;
  options: { value: Rating; emoji: string; label: string }[];
}[] = [
  {
    field: "difficulte_percue",
    label: "Comment était la difficulté ?",
    options: [
      { value: 1, emoji: "😅", label: "Trop difficile" },
      { value: 2, emoji: "😊", label: "Bien dosé" },
      { value: 3, emoji: "😴", label: "Trop facile" },
    ],
  },
  {
    field: "confiance",
    label: "Tu te sens comment après cette séance ?",
    options: [
      { value: 1, emoji: "😟", label: "Pas confiant" },
      { value: 2, emoji: "🙂", label: "Assez confiant" },
      { value: 3, emoji: "💪", label: "Très confiant" },
    ],
  },
  {
    field: "utilite_percue",
    label: "Cette séance t'a été utile ?",
    options: [
      { value: 1, emoji: "🤔", label: "Pas vraiment" },
      { value: 2, emoji: "👍", label: "Plutôt utile" },
      { value: 3, emoji: "⭐", label: "Très utile" },
    ],
  },
];

export default function SessionFeedbackForm({ sessionId, eleveId, onSubmitted }: SessionFeedbackFormProps) {
  const [ratings, setRatings] = useState<Partial<Record<FeedbackField, Rating>>>({});
  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = QUESTIONS.every(q => ratings[q.field] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase.from("session_feedback" as any) as any).insert({
        session_id: sessionId,
        eleve_id: eleveId,
        difficulte_percue: ratings.difficulte_percue,
        confiance: ratings.confiance,
        utilite_percue: ratings.utilite_percue,
        commentaire_libre: commentaire.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Merci pour ton retour !");
      onSubmitted?.();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardContent className="flex items-center justify-center gap-2 py-6">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Retour envoyé — merci !
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ton avis sur la séance</CardTitle>
        <CardDescription>3 questions rapides, sans texte à taper</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {QUESTIONS.map(q => (
          <div key={q.field} className="space-y-1.5">
            <p className="text-sm font-medium">{q.label}</p>
            <div className="flex gap-2">
              {q.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRatings(prev => ({ ...prev, [q.field]: opt.value }))}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition-all",
                    ratings[q.field] === opt.value
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Commentaire libre (optionnel)</p>
          <Textarea
            placeholder="Ce qui t'a plu, ce qui était difficile…"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
        <Button className="w-full" onClick={handleSubmit} disabled={!allAnswered || submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi…</> : "Envoyer mon avis"}
        </Button>
      </CardContent>
    </Card>
  );
}
