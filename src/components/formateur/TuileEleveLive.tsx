import { AlertTriangle, CheckCircle2, Hourglass, MessageSquare, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EleveStateLive, EleveStatutLive } from "@/hooks/useLiveSession";

const ERREUR_LABELS: Record<string, string> = {
  LEX_CONFUSION: "Lexique",
  CONSIGNE_NC: "Consigne",
  GRAM_ACCORD: "Accord",
  GRAM_TEMPS: "Temps verbal",
  HORS_SUJET: "Hors sujet",
  INTERPRETATION: "Interprétation",
  JUSTIFICATION: "Justification",
  PHONO: "Phonologie",
  PRODUCTION_COURTE: "Production courte",
  REGISTRE: "Registre",
  COHERENCE_ADMIN: "Cohérence admin.",
};

const STATUT_CONFIG: Record<
  EleveStatutLive | "unknown",
  { label: string; icon: React.ReactNode; text: string }
> = {
  playing: {
    label: "En cours",
    icon: <Play className="h-3 w-3" />,
    text: "text-blue-600 dark:text-blue-400",
  },
  finished: {
    label: "Terminé",
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: "text-emerald-600 dark:text-emerald-400",
  },
  idle: {
    label: "Inactif",
    icon: <Hourglass className="h-3 w-3" />,
    text: "text-amber-600 dark:text-amber-400",
  },
  offline: {
    label: "Hors ligne",
    icon: <Hourglass className="h-3 w-3" />,
    text: "text-muted-foreground",
  },
  unknown: {
    label: "En attente",
    icon: <Hourglass className="h-3 w-3" />,
    text: "text-muted-foreground",
  },
};

export interface TuileEleveLiveProps {
  prenom: string;
  nom: string;
  state: EleveStateLive | undefined;
  priorite: number;
  onIntervenir?: () => void;
  onFocus?: () => void;
}

export function TuileEleveLive({ prenom, nom, state, priorite, onIntervenir, onFocus }: TuileEleveLiveProps) {
  const niveau = priorite > 10 ? "alert" : priorite >= 4 ? "suggest" : "ok";

  const borderClass =
    niveau === "alert"
      ? "border-l-red-500 bg-red-50/40 dark:bg-red-950/20"
      : niveau === "suggest"
        ? "border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
        : !state
          ? "border-l-muted-foreground/30"
          : state.statut === "finished"
            ? "border-l-emerald-500"
            : state.statut === "playing"
              ? "border-l-blue-500"
              : "border-l-amber-400";

  const statutKey: EleveStatutLive | "unknown" = state?.statut ?? "unknown";
  const cfg = STATUT_CONFIG[statutKey];

  const scoreValue = state?.score_dernier_exercice;
  const scoreColor =
    scoreValue == null
      ? "text-muted-foreground"
      : scoreValue >= 80
        ? "text-emerald-600 dark:text-emerald-400"
        : scoreValue >= 60
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  const erreurLabel = state?.dernier_type_erreur
    ? (ERREUR_LABELS[state.dernier_type_erreur] ?? state.dernier_type_erreur)
    : null;

  return (
    <div
      className={`border-l-4 ${borderClass} bg-card rounded-md px-3 py-2.5 space-y-1.5 relative ${onFocus ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onFocus}
    >
      {/* Alert indicator */}
      {niveau === "alert" && (
        <span className="absolute top-2 right-2 text-red-500">
          <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
        </span>
      )}
      {niveau === "suggest" && (
        <span className="absolute top-2 right-2 text-amber-500">
          <Zap className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Name */}
      <p className="text-sm font-semibold truncate pr-5">
        {prenom} {nom}
      </p>

      {/* Status */}
      <p className={`text-[11px] inline-flex items-center gap-1 ${cfg.text}`}>
        {cfg.icon}
        {cfg.label}
      </p>
      {state?.exercice_en_cours_titre && (
        <p className="text-[10px] text-muted-foreground truncate">
          En cours : {state.exercice_en_cours_titre}
        </p>
      )}

      {/* Score */}
      {scoreValue != null && (
        <p className={`text-[12px] font-bold tabular-nums ${scoreColor}`}>
          {scoreValue}%
        </p>
      )}

      {/* Dernière erreur */}
      {erreurLabel && (
        <p className="text-[10px] text-muted-foreground truncate">{erreurLabel}</p>
      )}

      {/* Priorité numérique si significative */}
      {priorite >= 4 && (
        <p
          className={`text-[10px] font-semibold tabular-nums ${
            niveau === "alert" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          Priorité {priorite.toFixed(1)}
        </p>
      )}

      {/* Bouton intervention */}
      {onIntervenir && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-1.5 right-1.5 h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); onIntervenir(); }}
          title="Envoyer une aide"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
