import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  fetchFormateurManageableSessions,
  linkPublishedVariantsToSession,
  type SessionLinkOutcome,
} from "@/lib/studioAudioSessionLink";
import { publishedVariants } from "@/lib/studioAudioWorkflow";
import type { DifferentiationFamily } from "@/lib/differentiationFamilies";
import { humanizeStudioError } from "@/lib/studioAudioWorkflow";

type Props = {
  families: DifferentiationFamily[];
  userId: string;
};

export function StudioAudioSessionAttach({ families, userId }: Props) {
  const variants = useMemo(() => publishedVariants(families), [families]);
  const [sessionId, setSessionId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [orders, setOrders] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<SessionLinkOutcome[]>([]);

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ["studio-manageable-sessions", userId],
    queryFn: () => fetchFormateurManageableSessions(userId),
    enabled: Boolean(userId),
  });

  const toggle = (exerciseId: string, checked: boolean) => {
    setSelected((current) => ({ ...current, [exerciseId]: checked }));
  };

  const attach = async () => {
    if (!sessionId) {
      toast.error("Choisissez une séance.");
      return;
    }
    const chosen = variants.filter((variant) => selected[variant.exerciseId]);
    if (chosen.length === 0) {
      toast.error("Sélectionnez au moins une variante publiée.");
      return;
    }
    setBusy(true);
    setOutcomes([]);
    try {
      const result = await linkPublishedVariantsToSession({
        sessionId,
        userId,
        variants: chosen.map((variant) => ({
          exerciseId: variant.exerciseId,
          ordre: Number(orders[variant.exerciseId]) || undefined,
        })),
      });
      setOutcomes(result.outcomes);
      if (result.refusedCount > 0 && result.addedCount === 0 && result.alreadyPresentCount === 0) {
        toast.error("Ajout refusé", {
          description: humanizeStudioError(result.outcomes[0]?.reason),
        });
      } else {
        toast.success("Rattachement terminé", {
          description: `Ajoutés : ${result.addedCount} · Déjà présents : ${result.alreadyPresentCount} · Refusés : ${result.refusedCount}`,
        });
      }
    } catch (err: any) {
      toast.error("Rattachement impossible", {
        description: humanizeStudioError(err?.message),
      });
    } finally {
      setBusy(false);
    }
  };

  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Aucune variante publiée. Publiez d’abord les exercices (étape 7).
      </p>
    );
  }

  return (
    <section className="space-y-4" aria-label="Ajouter les exercices à une séance">
      <div>
        <h2 className="text-lg font-semibold">Ajouter ces exercices à une séance</h2>
        <p className="text-sm text-muted-foreground">
          Seules vos séances (groupes dont vous êtes formateur) sont proposées. Un double enregistrement
          ne crée pas de doublon.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {humanizeStudioError((error as Error).message)}
        </p>
      )}

      <div className="space-y-2 max-w-lg">
        <Label htmlFor="studio-session-select">Séance</Label>
        <Select value={sessionId || undefined} onValueChange={setSessionId} disabled={isLoading || busy}>
          <SelectTrigger id="studio-session-select" aria-label="Choisir une séance">
            <SelectValue placeholder={isLoading ? "Chargement…" : "Choisir une séance"} />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {(session.titre || "Séance sans titre") +
                  (session.group_nom ? ` · ${session.group_nom}` : "") +
                  (session.date_seance ? ` · ${session.date_seance}` : "")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2" role="group" aria-label="Variantes publiées à ajouter">
        {variants.map((variant) => (
          <div key={variant.exerciseId} className="flex flex-wrap items-center gap-3 rounded border p-3">
            <label className="flex items-center gap-2 text-sm min-w-[8rem]">
              <Checkbox
                checked={Boolean(selected[variant.exerciseId])}
                onCheckedChange={(value) => toggle(variant.exerciseId, value === true)}
                aria-label={`Ajouter la variante ${variant.level}`}
              />
              {variant.level}
            </label>
            <span className="text-xs text-muted-foreground font-mono">{variant.exerciseId.slice(0, 8)}…</span>
            <div className="flex items-center gap-2">
              <Label htmlFor={`ordre-${variant.exerciseId}`} className="text-xs">Ordre</Label>
              <Input
                id={`ordre-${variant.exerciseId}`}
                className="h-8 w-20"
                type="number"
                min={1}
                value={orders[variant.exerciseId] ?? ""}
                onChange={(event) =>
                  setOrders((current) => ({ ...current, [variant.exerciseId]: event.target.value }))
                }
                aria-label={`Ordre pour ${variant.level}`}
              />
            </div>
          </div>
        ))}
      </div>

      <Button disabled={busy || !sessionId} onClick={attach} aria-label="Enregistrer le rattachement à la séance">
        {busy ? "Enregistrement…" : "Enregistrer dans la séance"}
      </Button>

      {outcomes.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {outcomes.map((outcome) => (
            <li key={outcome.exerciseId}>
              {outcome.status === "added" && (
                <span className="text-emerald-700">Ajouté — {outcome.exerciseId.slice(0, 8)}… (ordre {outcome.ordre})</span>
              )}
              {outcome.status === "already_present" && (
                <span className="text-muted-foreground">Déjà présent — {outcome.exerciseId.slice(0, 8)}…</span>
              )}
              {outcome.status === "refused" && (
                <span className="text-destructive">
                  Refusé — {outcome.exerciseId.slice(0, 8)}… : {humanizeStudioError(outcome.reason)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
