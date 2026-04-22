import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Link2, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Provider = "wordwall" | "learningapps" | "h5p" | "generic";
type EmbedType = "iframe" | "link_only";

interface CompetencePoint {
  id: string;
  nom: string;
  epreuve_nom: string;
}

const schema = z.object({
  url: z.string().trim().url("URL invalide"),
  title: z.string().trim().min(1, "Titre requis").max(200),
  competence_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface CheckResult {
  embeddable: boolean;
  reason: string;
  provider: Provider;
}

interface Props {
  sessionId: string;
  onAdded: () => void;
  trigger?: React.ReactNode;
}

export function ExternalResourcePicker({ sessionId, onAdded, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [points, setPoints] = useState<CompetencePoint[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { url: "", title: "", competence_id: undefined },
  });

  // Load points_a_maitriser grouped by epreuve
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from("points_a_maitriser")
        .select("id, nom, sous_section_id, sous_sections!inner(epreuve_id, epreuves!inner(nom))")
        .order("ordre");
      if (error) return;
      const mapped: CompetencePoint[] = (data ?? []).map((p) => {
        const ep = (p as unknown as { sous_sections: { epreuves: { nom: string } } })
          .sous_sections.epreuves.nom;
        return { id: p.id, nom: p.nom, epreuve_nom: ep };
      });
      setPoints(mapped);
    })();
  }, [open]);

  const groupedPoints = points.reduce<Record<string, CompetencePoint[]>>((acc, p) => {
    (acc[p.epreuve_nom] ||= []).push(p);
    return acc;
  }, {});

  const handleCheck = async () => {
    const url = form.getValues("url").trim();
    if (!url) {
      toast({ title: "URL requise", variant: "destructive" });
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-embeddable", {
        body: { url },
      });
      if (error) throw error;
      setCheckResult(data as CheckResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast({ title: "Vérification impossible", description: msg, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const reset = () => {
    form.reset();
    setCheckResult(null);
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Non authentifié");

      const provider: Provider = checkResult?.provider ?? "generic";
      const embed_type: EmbedType =
        checkResult && !checkResult.embeddable ? "link_only" : "iframe";

      const { error } = await supabase.from("external_resources").insert({
        session_id: sessionId,
        title: values.title,
        url: values.url,
        provider,
        embed_type,
        embeddable_result: checkResult?.embeddable ?? null,
        embeddable_checked_at: checkResult ? new Date().toISOString() : null,
        competence_id: values.competence_id || null,
        created_by: userId,
      });
      if (error) throw error;
      toast({ title: "Ressource ajoutée" });
      reset();
      setOpen(false);
      onAdded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderCheckFeedback = () => {
    if (!checkResult) return null;
    const isWordwall = checkResult.provider === "wordwall";

    if (checkResult.embeddable) {
      return (
        <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">Intégration directe possible</p>
            <p className="text-muted-foreground">{checkResult.reason}</p>
          </div>
        </div>
      );
    }

    if (isWordwall) {
      return (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <div>
            <p className="font-medium">Wordwall bloque parfois l'intégration directe</p>
            <p className="text-muted-foreground">
              L'élève sera guidé pour ouvrir l'exercice dans un onglet séparé puis revenir.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <p className="font-medium">Non embeddable — sera ajoutée en lien externe</p>
          <p className="text-muted-foreground">{checkResult.reason}</p>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Ressource externe
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajouter une ressource externe</SheetTitle>
          <SheetDescription>
            Wordwall, LearningApps, H5P… Vérifiez l'intégration avant d'ajouter.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="url">URL de la ressource</Label>
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
            {renderCheckFeedback()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Ex : Vocabulaire spatial"
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Compétence visée (optionnel)</Label>
            <Select
              value={form.watch("competence_id") ?? ""}
              onValueChange={(v) => form.setValue("competence_id", v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedPoints).map(([epreuve, list]) => (
                  <SelectGroup key={epreuve}>
                    <SelectLabel>{epreuve}</SelectLabel>
                    {list.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter>
            <Button type="submit" disabled={saving} size="lg" className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter à la séance
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
