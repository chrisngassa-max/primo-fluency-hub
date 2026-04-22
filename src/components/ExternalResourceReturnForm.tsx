import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  score: z.number().min(0).max(100),
  minutes: z.number().min(0).max(600),
  seconds: z.number().min(0).max(59),
  difficulty_felt: z.enum(["easy", "medium", "hard"]),
  comment: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

const BUCKET = "external-resource-screenshots";

interface Props {
  resourceId: string;
  sessionId: string;
  initialScore?: number;
  initialSource?: "declared" | "auto_captured";
  onSubmitted: () => void;
}

const DIFFICULTIES: { value: FormValues["difficulty_felt"]; emoji: string; label: string }[] = [
  { value: "easy", emoji: "😊", label: "Facile" },
  { value: "medium", emoji: "😐", label: "Moyen" },
  { value: "hard", emoji: "😣", label: "Difficile" },
];

export function ExternalResourceReturnForm({
  resourceId,
  initialScore,
  initialSource,
  onSubmitted,
}: Props) {
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      score: initialScore ?? 70,
      minutes: 0,
      seconds: 0,
      difficulty_felt: "medium",
      comment: "",
    },
  });

  const score = form.watch("score");
  const difficulty = form.watch("difficulty_felt");

  // Upload helper
  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Format invalide", description: "Image uniquement.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop lourd", description: "Max 5 Mo.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Non authentifié");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userId}/${resourceId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setScreenshotPath(path);
      setPreviewUrl(signed?.signedUrl ?? null);
    } catch (e: any) {
      toast({ title: "Échec de l'upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Paste Ctrl+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            uploadFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  // Drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("border-primary", "bg-primary/5");
    };
    const onDragLeave = () => el.classList.remove("border-primary", "bg-primary/5");
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("border-primary", "bg-primary/5");
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  const removeScreenshot = async () => {
    if (screenshotPath) {
      await supabase.storage.from(BUCKET).remove([screenshotPath]);
    }
    setScreenshotPath(null);
    setPreviewUrl(null);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Non authentifié");
      const time_spent_seconds = values.minutes * 60 + values.seconds;
      const { error } = await supabase.from("external_resource_results").upsert(
        {
          external_resource_id: resourceId,
          student_id: userId,
          score: values.score,
          time_spent_seconds,
          difficulty_felt: values.difficulty_felt,
          comment: values.comment || null,
          screenshot_path: screenshotPath,
          source: initialSource ?? "declared",
        },
        { onConflict: "external_resource_id,student_id" }
      );
      if (error) throw error;
      toast({ title: "Résultat enregistré" });
      onSubmitted();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {initialSource === "auto_captured" && (
        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
          Score détecté automatiquement
        </Badge>
      )}

      {/* Score */}
      <div className="space-y-2">
        <Label htmlFor="score">Score (0–100)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[score]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => form.setValue("score", v[0], { shouldValidate: true })}
            className="flex-1"
          />
          <Input
            id="score"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) =>
              form.setValue("score", Math.max(0, Math.min(100, Number(e.target.value) || 0)), {
                shouldValidate: true,
              })
            }
            className="w-20"
          />
        </div>
      </div>

      {/* Temps */}
      <div className="space-y-2">
        <Label>Temps passé</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            {...form.register("minutes", { valueAsNumber: true })}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">min</span>
          <Input
            type="number"
            min={0}
            max={59}
            {...form.register("seconds", { valueAsNumber: true })}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">sec</span>
        </div>
      </div>

      {/* Ressenti */}
      <div className="space-y-2">
        <Label>Ressenti</Label>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => form.setValue("difficulty_felt", d.value)}
              className={`flex flex-col items-center gap-1 rounded-md border p-3 text-sm transition-colors ${
                difficulty === d.value
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-accent"
              }`}
            >
              <span className="text-2xl">{d.emoji}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Commentaire */}
      <div className="space-y-2">
        <Label htmlFor="comment">Commentaire (optionnel)</Label>
        <Textarea id="comment" rows={3} {...form.register("comment")} />
      </div>

      {/* Capture d'écran */}
      <div className="space-y-2">
        <Label>Capture d'écran (optionnelle)</Label>
        {previewUrl ? (
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Capture"
              className="max-h-48 rounded-md border"
            />
            <button
              type="button"
              onClick={removeScreenshot}
              className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              aria-label="Supprimer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            ref={dropRef}
            className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input p-6 text-sm text-muted-foreground transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <p>Glissez une image ici ou collez avec Ctrl+V</p>
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || uploading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Envoyer mon résultat
        </Button>
      </div>
    </form>
  );
}
