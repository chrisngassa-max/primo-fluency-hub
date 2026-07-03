import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const ERREUR_LABELS: Record<string, string> = {
  LEX_CONFUSION: "Lexique",
  CONSIGNE_NC: "Consigne",
  GRAM_ACCORD: "Accord",
  GRAM_TEMPS: "Temps verbal",
  HORS_SUJET: "Hors sujet",
  INTERPRETATION: "Interprétation",
  JUSTIFICATION: "Justification",
  PHONO: "Phonologie",
  PRODUCTION_COURTE: "Prod. courte",
  REGISTRE: "Registre",
  COHERENCE_ADMIN: "Cohérence admin.",
  CO_DISCRIMINATION: "Discrimination CO",
  METHODO_REPERAGE: "Repérage CE",
  STRUCT_CONJ: "Conjugaison ST",
  STRUCT_MORPHO: "Morphosyntaxe ST",
  STRUCT_CONNECTEURS: "Connecteurs",
};

const COMP_LABELS: Record<string, string> = { co: "CO", ce: "CE", ee: "EE", eo: "EO" };

interface StoredRecalibration {
  competence: string;
  niveau_actuel: string;
  niveau_suggere: string;
  direction: "up" | "down";
  avg_score: number;
  n_exercices: number;
}

interface StoredBilan {
  eleve_id: string;
  prenom: string;
  nom: string;
  n_exercices: number;
  score_moyen: number | null;
  top_erreurs: Array<{ type_erreur_id: string; count: number }>;
  recalibrations: StoredRecalibration[];
}

interface AtelierBilanRow {
  id: string;
  session_id: string;
  formateur_id: string;
  contenu: { bilans?: StoredBilan[] } | null;
  recalibrations_appliquees: boolean;
  created_at: string;
  sessions: { titre: string | null; date_seance: string | null } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BilansAtelierPage() {
  const { user } = useAuth();

  const { data: bilans, isLoading } = useQuery({
    queryKey: ["atelier-bilans", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("atelier_bilans")
        .select("id, session_id, formateur_id, contenu, recalibrations_appliquees, created_at, sessions:session_id(titre, date_seance)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AtelierBilanRow[];
    },
  });

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Bilans d'atelier</h1>
        <p className="text-sm text-muted-foreground">
          Historique des bilans générés en fin d'atelier — recalibrations et erreurs dominantes par
          élève.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !bilans || bilans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun bilan d'atelier enregistré pour l'instant. Les bilans apparaîtront ici à la fin
            de vos séances en{" "}
            <Link to="/formateur/suivi-direct" className="underline">
              suivi en direct
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {bilans.map((b) => {
            const bilanList = b.contenu?.bilans ?? [];
            const sessionTitle = b.sessions?.titre ?? "Séance sans titre";
            const sessionDate = b.sessions?.date_seance ?? b.created_at;
            return (
              <AccordionItem
                key={b.id}
                value={b.id}
                className="border rounded-lg bg-card"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex flex-1 items-center gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{sessionTitle}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(sessionDate)}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {bilanList.length}
                    </Badge>
                    {b.recalibrations_appliquees ? (
                      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100">
                        <CheckCircle2 className="h-3 w-3" />
                        Recalibrations appliquées
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sans recalibration</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {bilanList.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Bilan vide.</p>
                  ) : (
                    <div className="space-y-3">
                      {bilanList.map((bil) => (
                        <Card key={bil.eleve_id} className="border-muted">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-sm">
                                {bil.prenom} {bil.nom}
                              </CardTitle>
                              {bil.score_moyen != null && (
                                <Badge
                                  variant="outline"
                                  className={
                                    bil.score_moyen >= 80
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                      : bil.score_moyen >= 60
                                        ? "bg-amber-50 text-amber-700 border-amber-300"
                                        : "bg-red-50 text-red-700 border-red-300"
                                  }
                                >
                                  {bil.score_moyen}%
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {bil.n_exercices} exercice{bil.n_exercices > 1 ? "s" : ""}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {bil.top_erreurs.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {bil.top_erreurs.map((e) => (
                                  <Badge
                                    key={e.type_erreur_id}
                                    variant="outline"
                                    className="gap-1 text-[10px] bg-red-50/50 text-red-700 border-red-200"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    {ERREUR_LABELS[e.type_erreur_id] ?? e.type_erreur_id}
                                    <span className="font-bold">×{e.count}</span>
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {bil.recalibrations.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                  Recalibrations
                                </p>
                                {bil.recalibrations.map((r) => (
                                  <div
                                    key={r.competence}
                                    className={`flex items-center gap-2 text-[12px] rounded px-2.5 py-1.5 border ${
                                      r.direction === "up"
                                        ? "bg-emerald-50/60 border-emerald-200"
                                        : "bg-amber-50/60 border-amber-200"
                                    }`}
                                  >
                                    {r.direction === "up" ? (
                                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <TrendingDown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                    )}
                                    <span className="font-medium">
                                      {COMP_LABELS[r.competence] ?? r.competence.toUpperCase()}
                                    </span>
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
                            {bil.top_erreurs.length === 0 && bil.recalibrations.length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic">
                                Aucune erreur ni recalibration enregistrée.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
