import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { SandboxLevel } from "@/contexts/SandboxContext";

export default function SandboxExerciseRunner({
  niveau,
  devoir,
  onBack,
  onCompleted,
}: {
  niveau: SandboxLevel;
  devoir: any;
  onBack: () => void;
  onCompleted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const items = useMemo(
    () => Array.isArray(devoir?.exercice?.contenu?.items) ? devoir.exercice.contenu.items : [],
    [devoir],
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sandbox-preview-action", {
        body: {
          niveau,
          action: "submit_devoir",
          payload: { devoir_id: devoir.id, answers },
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Exercice termine : ${data.score}%`);
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Soumission impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour aux devoirs
      </Button>
      <Card className="border-2 border-amber-400">
        <CardHeader>
          <CardTitle>{devoir.exercice?.titre ?? "Exercice sandbox"}</CardTitle>
          <p className="text-sm text-muted-foreground">{devoir.exercice?.consigne}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {items.map((item: any, index: number) => (
            <div key={item.id ?? index} className="space-y-3 rounded-lg border p-4">
              <p className="font-medium">{index + 1}. {item.question ?? item.consigne ?? item.texte ?? "Choisis la bonne reponse"}</p>
              <RadioGroup
                value={answers[String(index)] ?? ""}
                onValueChange={(value) => setAnswers((current) => ({ ...current, [String(index)]: value }))}
              >
                {(item.options ?? []).map((option: string, optionIndex: number) => {
                  const id = `sandbox-${niveau}-${index}-${optionIndex}`;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <RadioGroupItem id={id} value={option} disabled={!!result} />
                      <Label htmlFor={id}>{option}</Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          ))}
          {result ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
              <strong>Score : {result.score}%</strong>
            </div>
          ) : (
            <Button
              onClick={() => void submit()}
              disabled={submitting || items.some((_item: any, index: number) => !answers[String(index)])}
            >
              Valider les reponses
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
