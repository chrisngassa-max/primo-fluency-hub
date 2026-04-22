import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, ExternalLink, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Provider = "wordwall" | "learningapps" | "h5p" | "generic";
type EmbedType = "iframe" | "link_only";

interface ExternalResourceRow {
  id: string;
  title: string;
  url: string;
  embed_type: EmbedType;
  provider: Provider;
  ordre: number;
  embeddable_result: boolean | null;
}

const schema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(200),
  url: z.string().trim().url("URL invalide"),
  embed_type: z.enum(["iframe", "link_only"]),
});
type FormValues = z.infer<typeof schema>;

const PROVIDER_LABEL: Record<Provider, string> = {
  wordwall: "Wordwall",
  learningapps: "LearningApps",
  h5p: "H5P",
  generic: "Externe",
};

interface Props {
  sessionId: string;
}

export function ExternalResourcePicker({ sessionId }: Props) {
  const [items, setItems] = useState<ExternalResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    embeddable: boolean;
    reason: string;
    provider: Provider;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", url: "", embed_type: "iframe" },
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("external_resources")
      .select("id, title, url, embed_type, provider, ordre, embeddable_result")
      .eq("session_id", sessionId)
      .order("ordre", { ascending: true });
    if (error) {
      toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as ExternalResourceRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleCheck = async () => {
    const url = form.getValues("url").trim();
    if (!url) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-embeddable", {
        body: { url },
      });
      if (error) throw error;
      setCheckResult(data);
      if (!data.embeddable && form.getValues("embed_type") === "iframe") {
        form.setValue("embed_type", "link_only");
        toast({
          title: "Site non intégrable",
          description: "Mode 'Lien externe' activé automatiquement.",
        });
      }
    } catch (e: any) {
      toast({ title: "Vérification impossible", description: e.message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Non authentifié");
      const { error } = await supabase.from("external_resources").insert({
        session_id: sessionId,
        title: values.title,
        url: values.url,
        embed_type: values.embed_type,
        provider: checkResult?.provider ?? "generic",
        ordre: items.length,
        embeddable_checked_at: checkResult ? new Date().toISOString() : null,
        embeddable_result: checkResult?.embeddable ?? null,
        created_by: userId,
      });
      if (error) throw error;
      toast({ title: "Ressource ajoutée" });
      form.reset();
      setCheckResult(null);
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("external_resources").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast({ title: "Ressource supprimée" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ressources externes</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importer une ressource externe</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input id="title" {...form.register("title")} placeholder="Ex : Vocabulaire spatial" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    {...form.register("url")}
                    placeholder="https://wordwall.net/embed/..."
                  />
                  <Button type="button" variant="secondary" onClick={handleCheck} disabled={checking}>
                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vérifier"}
                  </Button>
                </div>
                {form.formState.errors.url && (
                  <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
                )}
                {checkResult && (
                  <div
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                      checkResult.embeddable
                        ? "border-primary/40 bg-primary/5"
                        : "border-destructive/40 bg-destructive/5"
                    }`}
                  >
                    {checkResult.embeddable ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">
                        {checkResult.embeddable ? "Embeddable" : "Non embeddable"} ·{" "}
                        {PROVIDER_LABEL[checkResult.provider]}
                      </p>
                      <p className="text-muted-foreground">{checkResult.reason}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Mode d'affichage</Label>
                <RadioGroup
                  value={form.watch("embed_type")}
                  onValueChange={(v) => form.setValue("embed_type", v as EmbedType)}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="iframe" id="iframe" />
                    <Label htmlFor="iframe" className="font-normal">
                      Intégré (iframe dans la page)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="link_only" id="link_only" />
                    <Label htmlFor="link_only" className="font-normal">
                      Lien externe (nouvel onglet)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ajouter à la séance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune ressource externe pour cette séance.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <Badge variant="secondary" className="shrink-0">
                    {PROVIDER_LABEL[it.provider]}
                  </Badge>
                  <Badge variant="outline" className="shrink-0">
                    {it.embed_type === "iframe" ? "Intégré" : "Lien"}
                  </Badge>
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  {it.url}
                </a>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(it.id)}
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
