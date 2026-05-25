import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { LiveEvent, NiveauxEleve } from "@/hooks/useLiveSession";

// ── Types ──────────────────────────────────────────────────────────────────

type Member = {
  eleve_id: string;
  eleve: { id: string; prenom: string; nom: string } | null;
};

type NiveauxWithId = NiveauxEleve & { profilId?: string };

type Recalibration = {
  competence: "co" | "ce" | "ee" | "eo";
  niveau_actuel: string;
  niveau_suggere: string;
  direction: "up" | "down";
  avg_score: number;
  n_exercices: number;
};

type Competence = "CO" | "CE" | "EE" | "EO";

type EleveBilan = {
  eleve_id: string;
  prenom: string;
  nom: string;
  n_exercices: number;
  score_moyen: number | null;
  top_erreurs: Array<{ type_erreur_id: string; count: number }>;
  recalibrations: Recalibration[];
  dominant_error_competence: Competence | null;
  dominant_niveau: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const CECRL_ORDER = ["A0", "A1", "A2", "B1", "B2"] as const;

function bumpLevel(n: string): string | null {
  const i = CECRL_ORDER.indexOf(n as (typeof CECRL_ORDER)[number]);
  return i >= 0 && i < CECRL_ORDER.length - 1 ? CECRL_ORDER[i + 1] : null;
}

function lowerLevel(n: string): string | null {
  const i = CECRL_ORDER.indexOf(n as (typeof CECRL_ORDER)[number]);
  return i > 0 ? CECRL_ORDER[i - 1] : null;
}

const ERREUR_LABELS: Record<string, string> = {
  LEX_CONFUSION: "Lexique", CONSIGNE_NC: "Consigne", GRAM_ACCORD: "Accord",
  GRAM_TEMPS: "Temps verbal", HORS_SUJET: "Hors sujet", INTERPRETATION: "Interprétation",
  JUSTIFICATION: "Justification", PHONO: "Phonologie", PRODUCTION_COURTE: "Prod. courte",
  REGISTRE: "Registre", COHERENCE_ADMIN: "Cohérence admin.",
};

const COMP_LABELS: Record<string, string> = { co: "CO", ce: "CE", ee: "EE", eo: "EO" };

function computeEleveBilan(
  member: Member,
  events: LiveEvent[],
  niveaux: NiveauxEleve | undefined,
): EleveBilan {
  const evts = events.filter((ev) => ev.eleve_id === member.eleve_id);

  // Score moyen — exercice_termine events
  const termineEvts = evts.filter((ev) => ev.event_type === "exercice_termine");
  const scores = termineEvts
    .map((ev) => (ev.payload as any)?.score)
    .filter((s): s is number => s != null);
  const score_moyen =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Top erreurs — reponse_incorrecte events
  const erreurCounts = new Map<string, number>();
  for (const ev of evts.filter(
    (e) => e.event_type === "reponse_incorrecte" && e.type_erreur_id,
  )) {
    const id = ev.type_erreur_id!;
    erreurCounts.set(id, (erreurCounts.get(id) ?? 0) + 1);
  }
  const top_erreurs = Array.from(erreurCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type_erreur_id, count]) => ({ type_erreur_id, count }));

  // Recalibration — reponse_correcte events per competence (emitted server-side)
  const recalibrations: Recalibration[] = [];
  for (const comp of ["co", "ce", "ee", "eo"] as const) {
    const niveauActuel = niveaux?.[`niveau_${comp}` as keyof NiveauxEleve] as string | null | undefined;
    if (!niveauActuel) continue;

    const compEvts = evts.filter(
      (ev) =>
        ev.event_type === "reponse_correcte" &&
        (ev.payload as any)?.competence === comp.toUpperCase(),
    );
    if (compEvts.length < 2) continue;

    const compScores = compEvts
      .map((ev) => (ev.payload as any)?.score)
      .filter((s): s is number => s != null);
    if (compScores.length < 2) continue;

    const avg = compScores.reduce((a, b) => a + b, 0) / compScores.length;

    if (avg >= 85) {
      const suggere = bumpLevel(niveauActuel);
      if (suggere)
        recalibrations.push({
          competence: comp, niveau_actuel: niveauActuel, niveau_suggere: suggere,
          direction: "up", avg_score: Math.round(avg), n_exercices: compEvts.length,
        });
    } else if (avg <= 45) {
      const suggere = lowerLevel(niveauActuel);
      if (suggere)
        recalibrations.push({
          competence: comp, niveau_actuel: niveauActuel, niveau_suggere: suggere,
          direction: "down", avg_score: Math.round(avg), n_exercices: compEvts.length,
        });
    }
  }

  // Dominant error competence — competence with most reponse_incorrecte
  const compErrors = new Map<Competence, number>();
  for (const ev of evts.filter((e) => e.event_type === "reponse_incorrecte")) {
    const c = ((ev.payload as any)?.competence ?? "").toString().toUpperCase();
    if (c === "CO" || c === "CE" || c === "EE" || c === "EO") {
      compErrors.set(c as Competence, (compErrors.get(c as Competence) ?? 0) + 1);
    }
  }
  const dominant_error_competence: Competence | null =
    compErrors.size > 0
      ? (Array.from(compErrors.entries()).sort((a, b) => b[1] - a[1])[0][0] as Competence)
      : null;
  const dominant_niveau = dominant_error_competence
    ? ((niveaux?.[`niveau_${dominant_error_competence.toLowerCase()}` as keyof NiveauxEleve] as
        | string
        | null
        | undefined) ?? null)
    : null;

  return {
    eleve_id: member.eleve_id,
    prenom: member.eleve?.prenom ?? "",
    nom: member.eleve?.nom ?? "",
    n_exercices: termineEvts.length,
    score_moyen,
    top_erreurs,
    recalibrations,
    dominant_error_competence,
    dominant_niveau,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface FinAtelierDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  formateurId: string;
  presentMembers: Member[];
  liveEvents: LiveEvent[];
  niveauxMap: Map<string, NiveauxWithId>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FinAtelierDialog({
  open, onClose, sessionId, formateurId, presentMembers, liveEvents, niveauxMap,
}: FinAtelierDialogProps) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const [generatingDevoirs, setGeneratingDevoirs] = useState(false);
  const [devoirsGenerated, setDevoirsGenerated] = useState<number | null>(null);

  const bilans = useMemo(
    () => presentMembers.map((m) => computeEleveBilan(m, liveEvents, niveauxMap.get(m.eleve_id))),
    [presentMembers, liveEvents, niveauxMap],
  );

  const totalRecalibrations = bilans.reduce((n, b) => n + b.recalibrations.length, 0);
  const elevesActifs = bilans.filter((b) => b.n_exercices > 0).length;
  const elevesAvecErreurs = bilans.filter((b) => b.top_erreurs.length > 0).length;

  async function emitSessionTermine() {
    try {
      await (supabase as any).from("session_live_events").insert({
        session_id: sessionId,
        eleve_id: null,
        event_type: "session_state_change",
        payload: { state: "atelier_termine" },
      });
    } catch (e) {
      console.warn("emit session_state_change failed", e);
    }
  }

  async function applyRecalibrations() {
    setApplying(true);
    try {
      for (const bilan of bilans) {
        if (bilan.recalibrations.length === 0) continue;
        const patch: Record<string, string> = { niveau_source: "atelier_bilan" };
        for (const r of bilan.recalibrations) {
          patch[`niveau_${r.competence}`] = r.niveau_suggere;
        }
        const { error } = await (supabase as any)
          .from("profils_eleves")
          .update(patch)
          .eq("eleve_id", bilan.eleve_id)
          .eq("niveau_locked", false);
        if (error) console.warn(`recalibration ${bilan.eleve_id}:`, error.message);
      }

      await (supabase as any).from("atelier_bilans").insert({
        session_id: sessionId,
        formateur_id: formateurId,
        contenu: { bilans },
        recalibrations_appliquees: true,
      });

      await emitSessionTermine();

      setApplied(true);
      toast({ title: `${totalRecalibrations} recalibration(s) appliquée(s)` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }

  async function saveBilanOnly() {
    await (supabase as any).from("atelier_bilans").insert({
      session_id: sessionId,
      formateur_id: formateurId,
      contenu: { bilans },
      recalibrations_appliquees: false,
    });
    await emitSessionTermine();
    onClose();
  }

  async function generateDevoirsCibles() {
    setGeneratingDevoirs(true);
    let created = 0;
    let skipped = 0;
    try {
      for (const bilan of bilans) {
        if (bilan.top_erreurs.length === 0) continue;
        if (!bilan.dominant_error_competence || !bilan.dominant_niveau) {
          skipped++;
          continue;
        }
        const { data: exos, error } = await (supabase as any)
          .from("exercices")
          .select("id")
          .eq("competence", bilan.dominant_error_competence)
          .eq("niveau_vise", bilan.dominant_niveau)
          .limit(1);
        if (error || !exos || exos.length === 0) {
          skipped++;
          continue;
        }
        const { error: insErr } = await (supabase as any).from("devoirs").insert({
          eleve_id: bilan.eleve_id,
          exercice_id: exos[0].id,
          formateur_id: formateurId,
          session_id: sessionId,
          statut: "en_attente",
          source_label: "atelier_bilan",
        });
        if (insErr) {
          skipped++;
          console.warn(`devoir ${bilan.eleve_id}:`, insErr.message);
        } else {
          created++;
        }
      }
      setDevoirsGenerated(created);
      toast({
        title: `${created} devoir${created > 1 ? "s" : ""} généré${created > 1 ? "s" : ""}`,
        description: skipped > 0 ? `${skipped} élève(s) sans exercice disponible.` : undefined,
      });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingDevoirs(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !applying && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Bilan de fin d'atelier
          </DialogTitle>
          <DialogDescription>
            {elevesActifs} élève{elevesActifs > 1 ? "s" : ""} actif{elevesActifs > 1 ? "s" : ""} ·{" "}
            {totalRecalibrations} recalibration{totalRecalibrations > 1 ? "s" : ""} suggérée
            {totalRecalibrations > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3 py-1">
            {bilans.map((bilan) => {
              const hasActivity = bilan.n_exercices > 0;
              return (
                <div
                  key={bilan.eleve_id}
                  className={`rounded-lg border p-4 space-y-3 ${
                    !hasActivity ? "opacity-50" : ""
                  }`}
                >
                  {/* Entête élève */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {bilan.prenom} {bilan.nom}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {bilan.n_exercices} exercice{bilan.n_exercices > 1 ? "s" : ""} terminé
                        {bilan.n_exercices > 1 ? "s" : ""}
                      </p>
                    </div>
                    {bilan.score_moyen != null && (
                      <Badge
                        variant="outline"
                        className={
                          bilan.score_moyen >= 80
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : bilan.score_moyen >= 60
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-red-50 text-red-700 border-red-300"
                        }
                      >
                        Score moyen : {bilan.score_moyen}%
                      </Badge>
                    )}
                  </div>

                  {/* Top erreurs */}
                  {bilan.top_erreurs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {bilan.top_erreurs.map(({ type_erreur_id, count }) => (
                        <Badge key={type_erreur_id} variant="outline" className="gap-1 text-[10px] bg-red-50/50 text-red-700 border-red-200">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {ERREUR_LABELS[type_erreur_id] ?? type_erreur_id}
                          <span className="font-bold">×{count}</span>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Recalibrations suggérées */}
                  {bilan.recalibrations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Recalibrations suggérées
                      </p>
                      {bilan.recalibrations.map((r) => (
                        <div
                          key={r.competence}
                          className={`flex items-center gap-2 text-[12px] rounded px-2.5 py-1.5 border ${
                            r.direction === "up"
                              ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20"
                              : "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20"
                          }`}
                        >
                          {r.direction === "up" ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="font-medium">{COMP_LABELS[r.competence]}</span>
                          <span className="text-muted-foreground">
                            {r.niveau_actuel}
                            {r.direction === "up" ? (
                              <ArrowUp className="h-3 w-3 inline mx-0.5 text-emerald-600" />
                            ) : (
                              <ArrowDown className="h-3 w-3 inline mx-0.5 text-amber-600" />
                            )}
                            {r.niveau_suggere}
                          </span>
                          <span className="ml-auto text-muted-foreground tabular-nums">
                            {r.avg_score}% / {r.n_exercices} ex.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasActivity && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Aucune activité enregistrée cette séance.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="gap-2 flex-wrap">
          {applied ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 mr-auto">
              <CheckCircle2 className="h-4 w-4" />
              Recalibrations appliquées
            </div>
          ) : totalRecalibrations > 0 ? (
            <Button
              variant="default"
              onClick={applyRecalibrations}
              disabled={applying}
              className="gap-1.5"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              Appliquer {totalRecalibrations} recalibration{totalRecalibrations > 1 ? "s" : ""}
            </Button>
          ) : null}

          <Button
            variant="outline"
            onClick={saveBilanOnly}
            disabled={applying}
          >
            {applied ? "Fermer" : "Enregistrer sans recalibrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
