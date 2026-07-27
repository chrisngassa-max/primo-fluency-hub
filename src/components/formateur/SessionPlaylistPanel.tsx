import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionExercicesRealtime } from "@/hooks/useSessionExercicesRealtime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, X, FlaskConical, Copy, Send, Gift, Lock, Unlock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  insertItem as pureInsertItem,
  moveDown as pureMoveDown,
  moveToPosition as pureMoveToPosition,
  moveUp as pureMoveUp,
  removeItem as pureRemoveItem,
  sortByOrdre,
  type PlaylistItem,
  type ReorderOutcome,
} from "@/lib/playlist/sessionPlaylistOrdering";

export interface SessionExerciceRow {
  id: string;
  exercice_id: string;
  ordre: number;
  statut: string | null;
  is_bonus: boolean | null;
  eleve_id: string | null;
  exercice: {
    id: string;
    titre: string;
    competence: string;
    format: string;
    niveau_vise: string;
    difficulte: number;
  } | null;
}

interface SessionPlaylistPanelProps {
  sessionId: string;
  /** Ouvre l'aperçu formateur obligatoire pour cette activité (voir proposition dédiée). */
  onTest?: (row: SessionExerciceRow) => void;
  /** Ouvre le sélecteur de clonage (copie identique / variation) pour cette activité. */
  onClone?: (row: SessionExerciceRow) => void;
  /** Ouvre le choix des destinataires (groupe / sous-groupe / élève). */
  onAssign?: (row: SessionExerciceRow) => void;
  /** Ouvre le flux d'envoi bonus pour un élève ayant terminé. */
  onBonus?: (row: SessionExerciceRow) => void;
}

/**
 * Playlist pédagogique d'une séance — composant DÉDIÉ, pattern repris de
 * `SessionDocumentsPanel` (monter/descendre/position/insérer). Ne porte que
 * la mécanique d'ORDONNANCEMENT (via `sessionPlaylistOrdering.ts`, testé
 * séparément) ; la création/le clonage/l'envoi réel des exercices restent
 * dans `SessionPilot.tsx` (déjà existants) et sont exposés ici via props
 * pour éviter toute duplication de logique.
 */
export function SessionPlaylistPanel({ sessionId, onTest, onClone, onAssign, onBonus }: SessionPlaylistPanelProps) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["session-playlist", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select(
          "id, exercice_id, ordre, statut, is_bonus, eleve_id, exercice:exercices(id, titre, competence, format, niveau_vise, difficulte)",
        )
        .eq("session_id", sessionId)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as unknown as SessionExerciceRow[];
    },
    enabled: !!sessionId,
  });

  const exerciceIds = useMemo(() => (rows ?? []).map((r) => r.exercice_id).filter(Boolean), [rows]);

  // Verrouillage : une activité devient non déplaçable/non supprimable dès
  // qu'au moins une tentative existe (in_progress ou completed).
  const { data: attempts } = useQuery({
    queryKey: ["session-playlist-attempts", sessionId, exerciceIds.join(",")],
    queryFn: async () => {
      if (exerciceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exercise_attempts")
        .select("exercise_id, status")
        .eq("session_id", sessionId)
        .in("exercise_id", exerciceIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: exerciceIds.length > 0,
  });

  useSessionExercicesRealtime(sessionId, () => {
    qc.invalidateQueries({ queryKey: ["session-playlist", sessionId] });
  });

  const lockedExerciceIds = useMemo(() => {
    const set = new Set<string>();
    (attempts ?? []).forEach((a: any) => {
      if (a.status === "in_progress" || a.status === "completed") set.add(a.exercise_id);
    });
    return set;
  }, [attempts]);

  const items: PlaylistItem[] = useMemo(
    () =>
      sortByOrdre(
        (rows ?? []).map((r) => ({ id: r.id, ordre: r.ordre, locked: lockedExerciceIds.has(r.exercice_id) })),
      ),
    [rows, lockedExerciceIds],
  );

  const rowById = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);

  async function persist(outcome: ReorderOutcome, successMessage?: string) {
    if (!outcome.ok) {
      if (outcome.reason !== "noop") toast.error("Action impossible", { description: outcome.message });
      return;
    }
    if (outcome.changed.length === 0) return;
    setBusyId(null);
    try {
      // `session_exercices` n'a pas de contrainte d'unicité sur `ordre`, donc
      // ces mises à jour peuvent être envoyées en parallèle sans conflit
      // temporaire de valeurs dupliquées.
      const results = await Promise.all(
        outcome.changed.map(({ id, ordre }) =>
          supabase.from("session_exercices").update({ ordre, updated_at: new Date().toISOString() }).eq("id", id),
        ),
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      qc.invalidateQueries({ queryKey: ["session-playlist", sessionId] });
      if (successMessage) toast.success(successMessage);
    } catch (e: any) {
      toast.error("Erreur d'enregistrement de l'ordre", { description: e.message });
    }
  }

  async function handleMoveUp(id: string) {
    setBusyId(id);
    await persist(pureMoveUp(items, id));
  }
  async function handleMoveDown(id: string) {
    setBusyId(id);
    await persist(pureMoveDown(items, id));
  }
  async function handleMoveToPosition(id: string, position: number) {
    setBusyId(id);
    await persist(pureMoveToPosition(items, id, position));
  }
  /**
   * Libère la correction — réutilise la fonction serveur release_corrections
   * (migration 20260713090000), seule voie autorisée à poser
   * correction_released_at (authorisation liée à la séance/groupe du
   * formateur, pas seulement à exercices.formateur_id). Aucune correction
   * n'est donc jamais visible côté apprenant tant que le formateur n'a pas
   * explicitement cliqué ici.
   */
  async function releaseCorrection(exerciceId: string, scope: string, eleveIds: string[] | null) {
    const { error } = await supabase.rpc("release_corrections", {
      p_exercise_id: exerciceId,
      p_session_id: sessionId,
      p_scope: scope,
      p_eleve_ids: eleveIds,
    });
    if (error) throw error;
  }

  async function handleReleaseFinished(row: SessionExerciceRow) {
    setBusyId(row.id);
    try {
      await releaseCorrection(row.exercice_id, "finished", null);
      toast.success("Correction libérée pour les élèves ayant terminé.");
    } catch (e: any) {
      toast.error("Libération impossible", { description: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    const outcome = pureRemoveItem(items, id);
    if (!outcome.ok) {
      toast.error("Retrait impossible", { description: outcome.message });
      setBusyId(null);
      return;
    }
    try {
      const { error } = await supabase.from("session_exercices").delete().eq("id", id);
      if (error) throw error;
      // Renumérote le reste de la liste pour rester 1..N contigu.
      await persist({ ok: true, items: outcome.items, changed: outcome.changed.filter((c) => c.id !== id) }, "Activité retirée.");
    } catch (e: any) {
      toast.error("Erreur de suppression", { description: e.message });
      setBusyId(null);
    }
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune activité dans cette séance.</p>;
  }

  const orderedRows = items
    .map((item) => rowById.get(item.id))
    .filter((r): r is SessionExerciceRow => Boolean(r));

  return (
    <div className="space-y-3">
      {orderedRows.map((row, index) => {
        const locked = lockedExerciceIds.has(row.exercice_id);
        const busy = busyId === row.id;
        const total = orderedRows.length;
        return (
          <Card key={row.id} className={cn("border-l-4", locked ? "border-l-muted-foreground/40" : "border-l-primary/40")}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={locked || busy || index === 0} onClick={() => handleMoveUp(row.id)} title="Monter">
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" disabled={locked || busy || index === total - 1} onClick={() => handleMoveDown(row.id)} title="Descendre">
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <select
                  className="h-6 rounded-md border bg-background px-1.5 text-[11px] text-foreground disabled:opacity-50"
                  value={index + 1}
                  disabled={locked || busy || total <= 1}
                  onChange={(e) => handleMoveToPosition(row.id, Number(e.target.value))}
                  title={`Activité ${index + 1} sur ${total}`}
                >
                  {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>{p} / {total}</option>
                  ))}
                </select>
                <Badge variant="secondary" className="text-[10px]">
                  Activité {index + 1} sur {total}
                </Badge>
                {locked && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" /> déjà commencée
                  </Badge>
                )}
                {row.is_bonus && (
                  <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                    <Gift className="h-3 w-3" /> bonus
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {onTest && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onTest(row)}>
                      <FlaskConical className="h-3 w-3" /> Tester
                    </Button>
                  )}
                  {onClone && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onClone(row)}>
                      <Copy className="h-3 w-3" /> Cloner
                    </Button>
                  )}
                  {onAssign && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onAssign(row)}>
                      <Send className="h-3 w-3" /> Assigner
                    </Button>
                  )}
                  {onBonus && (
                    <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onBonus(row)}>
                      <Gift className="h-3 w-3" /> Bonus
                    </Button>
                  )}
                  {locked && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] gap-1 border-emerald-300 text-emerald-700 dark:text-emerald-400"
                        disabled={busy}
                        onClick={() => handleReleaseFinished(row)}
                        title="Libère la correction pour les élèves ayant terminé cette activité"
                      >
                        <Unlock className="h-3 w-3" /> Libérer (terminés)
                      </Button>
                      <ReleaseCorrectionDialog sessionId={sessionId} onRelease={(scope, ids) => releaseCorrection(row.exercice_id, scope, ids)} />
                      <CollectiveCorrectionDialog
                        sessionId={sessionId}
                        exerciseId={row.exercice_id}
                        onReleaseClass={() => releaseCorrection(row.exercice_id, "class", null)}
                      />
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 text-destructive hover:text-destructive"
                    disabled={locked || busy}
                    onClick={() => handleRemove(row.id)}
                    title={locked ? "Une activité déjà commencée ne peut pas être retirée." : "Retirer de la séance"}
                  >
                    <X className="h-3 w-3" /> Retirer
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-medium">{row.exercice?.titre ?? "Exercice"}</span>
                <Badge variant="outline" className="text-[10px]">{row.exercice?.competence}</Badge>
                <Badge variant="outline" className="text-[10px]">{row.exercice?.niveau_vise}</Badge>
                <Badge variant="outline" className="text-[10px]">{row.exercice?.format?.replace(/_/g, " ")}</Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Sélection d'élève(s) pour une libération individuelle ou en sous-groupe
 * (relecture indépendante, point 7). Charge les membres du groupe de la
 * séance (sessions.group_id -> group_members -> profiles), coche manuelle.
 * scope='individual' si exactement un élève sélectionné, sinon 'subgroup'.
 * "level" n'est pas résolu automatiquement ici (aucune correspondance
 * fiable niveau CECRL <-> student_competency_levels vérifiée dans cette
 * mission) — le formateur sélectionne manuellement les élèves du niveau
 * visé, ce qui reste une "subgroup" du point de vue du serveur.
 */
function ReleaseCorrectionDialog({
  sessionId, onRelease,
}: {
  sessionId: string;
  onRelease: (scope: "individual" | "subgroup" | "level" | "class", eleveIds: string[] | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["session-group-members", sessionId],
    queryFn: async () => {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("group_id")
        .eq("id", sessionId)
        .single();
      if (sessionError) throw sessionError;
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles(nom, prenom)")
        .eq("group_id", session.group_id);
      if (error) throw error;
      const memberIds = (data ?? []).map((row: any) => row.eleve_id);
      const { data: levels, error: levelsError } = memberIds.length > 0
        ? await supabase.from("profils_eleves").select("eleve_id, niveau_actuel").in("eleve_id", memberIds)
        : { data: [], error: null };
      if (levelsError) throw levelsError;
      const levelByStudent = new Map((levels ?? []).map((row: any) => [row.eleve_id, row.niveau_actuel]));
      return (data ?? []).map((row: any) => ({ ...row, niveau_actuel: levelByStudent.get(row.eleve_id) ?? null })) as Array<{
        eleve_id: string;
        eleve: { nom: string; prenom: string } | null;
        niveau_actuel: string | null;
      }>;
    },
    enabled: open,
  });

  const availableLevels = Array.from(new Set((members ?? []).map((member) => member.niveau_actuel).filter(Boolean))).sort() as string[];

  async function handleLevelRelease() {
    const ids = (members ?? []).filter((member) => member.niveau_actuel === selectedLevel).map((member) => member.eleve_id);
    if (!selectedLevel || ids.length === 0) return;
    setSubmitting(true);
    try {
      await onRelease("level", ids);
      toast.success(`Correction libérée pour le niveau ${selectedLevel} (${ids.length} élève(s)).`);
      setOpen(false);
      setSelectedLevel("");
    } catch (e: any) {
      toast.error("Libération impossible", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(eleveId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eleveId)) next.delete(eleveId); else next.add(eleveId);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const ids = Array.from(selected);
      await onRelease(ids.length === 1 ? "individual" : "subgroup", ids);
      toast.success(`Correction libérée pour ${ids.length} élève(s).`);
      setOpen(false);
      setSelected(new Set());
    } catch (e: any) {
      toast.error("Libération impossible", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1">
          <Unlock className="h-3 w-3" /> Libérer (choisir)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Libérer la correction pour un élève ou un sous-groupe</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border p-2">
              <select
                className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(event.target.value)}
              >
                <option value="">Choisir un niveau</option>
                {availableLevels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
              <Button variant="outline" disabled={!selectedLevel || submitting} onClick={handleLevelRelease}>
                Libérer ce niveau
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
            {(members ?? []).map((m) => {
              const label = [m.eleve?.prenom, m.eleve?.nom].filter(Boolean).join(" ") || "Élève";
              return (
                <label key={m.eleve_id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.has(m.eleve_id)} onCheckedChange={() => toggle(m.eleve_id)} />
                  {label}
                </label>
              );
            })}
              {(members ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun élève dans ce groupe.</p>}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button disabled={selected.size === 0 || submitting} onClick={handleConfirm}>
            Libérer pour {selected.size || "..."} élève(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectiveCorrectionDialog({
  sessionId,
  exerciseId,
  onReleaseClass,
}: {
  sessionId: string;
  exerciseId: string;
  onReleaseClass: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercise-response-distribution", sessionId, exerciseId],
    queryFn: async () => {
      const { data: rows, error: rpcError } = await (supabase as any).rpc("get_exercise_response_distribution", {
        p_exercise_id: exerciseId,
        p_session_id: sessionId,
      });
      if (rpcError) throw rpcError;
      return (rows ?? []) as Array<{ item_index: string; reponse_normalisee: string; occurrences: number }>;
    },
    enabled: open,
  });

  async function releaseForClass() {
    setReleasing(true);
    try {
      await onReleaseClass();
      toast.success("Correction libérée pour toute la classe.");
      setOpen(false);
    } catch (e: any) {
      toast.error("Libération impossible", { description: e.message });
    } finally {
      setReleasing(false);
    }
  }

  const grouped = useMemo(() => {
    const result = new Map<string, Array<{ answer: string; count: number }>>();
    for (const row of data ?? []) {
      const answers = result.get(row.item_index) ?? [];
      answers.push({ answer: row.reponse_normalisee || "(sans réponse)", count: row.occurrences });
      result.set(row.item_index, answers);
    }
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1">
          <BarChart3 className="h-3 w-3" /> Correction collective
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Réponses anonymisées de la classe</DialogTitle>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32" /> : error ? (
          <p className="text-sm text-destructive">Impossible de charger les réponses.</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune réponse enregistrée pour cette activité dans cette séance.</p>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto">
            {grouped.map(([itemIndex, answers]) => (
              <div key={itemIndex} className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">Item {Number.isNaN(Number(itemIndex)) ? itemIndex : Number(itemIndex) + 1}</p>
                <div className="space-y-1">
                  {answers.map(({ answer, count }) => (
                    <div key={answer} className="flex items-center justify-between gap-4 text-sm">
                      <span className="break-words">{answer}</span>
                      <Badge variant="secondary">{count} réponse{count > 1 ? "s" : ""}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button disabled={releasing || grouped.length === 0} onClick={releaseForClass}>
            Envoyer la correction à toute la classe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/**
 * Calcule la position (`ordre`) à assigner à une NOUVELLE activité insérée
 * avant/après une activité de référence, et les mises à jour d'`ordre` à
 * appliquer aux activités existantes qui se décalent. À appeler AVANT
 * d'insérer la ligne `session_exercices` (le composant appelant — création
 * d'exercice, clonage, ajout depuis la banque — reste responsable de choisir
 * QUEL exercice insérer ; ce module ne décide que DE LA POSITION).
 */
export function computeInsertionPlan(
  currentItems: PlaylistItem[],
  referenceId: string,
  position: "before" | "after",
  newItemId = "__pending__",
) {
  const outcome = pureInsertItem(currentItems, referenceId, position, { id: newItemId, locked: false });
  if (!outcome.ok) return outcome;
  const newOrdre = outcome.items.find((i) => i.id === newItemId)?.ordre ?? outcome.items.length;
  const shifts = outcome.changed.filter((c) => c.id !== newItemId);
  return { ok: true as const, newOrdre, shifts };
}
