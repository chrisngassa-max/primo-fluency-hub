import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fetchPublishedSessionResources, invokeCurriculumAdapt } from "@/lib/curriculum/api";
import type {
  AggregatedLearnerError,
  CurriculumAdaptResponse,
  CurriculumAdaptResult,
} from "@/lib/curriculum/types";

const DEFAULT_PHASES = [
  { value: "rituel_civique", label: "Rituel civique" },
  { value: "activation_lexique", label: "Activation + lexique" },
  { value: "support_invariant", label: "Support invariant CO/CE" },
  { value: "ateliers_differencies", label: "Ateliers differencies" },
  { value: "production_ee_eo", label: "Production EE/EO" },
  { value: "fixation", label: "Fixation" },
];

interface CurriculumAdaptPanelProps {
  sessionId: string;
  trainingSessionId: string;
  sessionCode: string;
  palierCible?: string | null;
  eleveIds: string[];
  aggregatedErrors: AggregatedLearnerError[];
  exercicesNonTraites: string[];
}

export function CurriculumAdaptPanel({
  sessionId,
  trainingSessionId,
  sessionCode,
  palierCible,
  eleveIds,
  aggregatedErrors,
  exercicesNonTraites,
}: CurriculumAdaptPanelProps) {
  const [phase, setPhase] = useState("ateliers_differencies");
  const [tempsRestantMin, setTempsRestantMin] = useState("45");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CurriculumAdaptResponse | null>(null);
  const [validated, setValidated] = useState(false);

  const { data: publishedResources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["curriculum-published-resources", trainingSessionId],
    queryFn: () => fetchPublishedSessionResources(trainingSessionId),
    enabled: Boolean(trainingSessionId),
  });

  const resourceKinds = useMemo(() => {
    const kinds = new Set(publishedResources.map((r) => r.kind));
    return {
      hasAdaptationRules: kinds.has("adaptation_rules_json"),
      hasDeroule: kinds.has("deroule_json"),
      hasVariants: kinds.has("variantes_json"),
    };
  }, [publishedResources]);

  const degradedNoPublish = !resourcesLoading && publishedResources.length === 0;

  const handleRequestAdaptation = async () => {
    setLoading(true);
    setValidated(false);
    try {
      const response = await invokeCurriculumAdapt({
        sessionId,
        trainingSessionId,
        sessionCode,
        palierCible: palierCible ?? undefined,
        phase,
        eleveIds,
        aggregatedErrors,
        exercicesNonTraites,
        tempsRestantMin: Number(tempsRestantMin) || undefined,
      });
      setResult(response);
      if (response.degraded_mode) {
        toast.warning("Mode degrade", { description: response.message ?? response.adaptation.message_formateur });
      } else {
        toast.success("Proposition d'adaptation recue", {
          description: "Le formateur valide ou refuse — rien n'est applique automatiquement.",
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Adaptation curriculum impossible", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="print:hidden border-blue-200 dark:border-blue-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              Adaptation curriculum IA
            </CardTitle>
            <CardDescription>
              Propositions basees sur les ressources publiees de {sessionCode}. Validation formateur obligatoire.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {resourcesLoading ? "…" : `${publishedResources.length} publiee(s)`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {degradedNoPublish && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Aucune ressource publiee pour cette seance. Publiez le paquet depuis{" "}
              <strong>Production parcours</strong> avant de solliciter l&apos;IA.
            </p>
          </div>
        )}

        {!degradedNoPublish && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {resourceKinds.hasAdaptationRules && <Badge variant="secondary">regles d&apos;adaptation</Badge>}
            {resourceKinds.hasDeroule && <Badge variant="secondary">deroule</Badge>}
            {resourceKinds.hasVariants && <Badge variant="secondary">variantes A1-B2</Badge>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-phase">Phase en cours</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger id="curriculum-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_PHASES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curriculum-temps">Temps restant (min)</Label>
            <Input
              id="curriculum-temps"
              type="number"
              min={5}
              max={180}
              value={tempsRestantMin}
              onChange={(e) => setTempsRestantMin(e.target.value)}
            />
          </div>
        </div>

        {aggregatedErrors.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Signaux agreges :{" "}
            {aggregatedErrors.map((e) => `${e.competence}/${e.taxonomy} (${e.count})`).join(" · ")}
          </div>
        )}

        <Button
          onClick={handleRequestAdaptation}
          disabled={loading || resourcesLoading || degradedNoPublish}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Demander une proposition d&apos;adaptation
        </Button>

        {result && (
          <AdaptationResultView
            result={result}
            validated={validated}
            onValidate={() => setValidated(true)}
            onReject={() => {
              setResult(null);
              setValidated(false);
              toast.message("Proposition ecartee", {
                description: "Aucune modification n'a ete appliquee a la seance.",
              });
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AdaptationResultView({
  result,
  validated,
  onValidate,
  onReject,
}: {
  result: CurriculumAdaptResponse;
  validated: boolean;
  onValidate: () => void;
  onReject: () => void;
}) {
  const adaptation: CurriculumAdaptResult = result.adaptation;

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Proposition IA (non appliquee)</p>
        {result.degraded_mode && <Badge variant="outline">Mode degrade</Badge>}
      </div>

      <p className="text-sm">{adaptation.analyse}</p>
      <p className="text-xs text-muted-foreground italic">{adaptation.message_formateur}</p>

      {adaptation.recommandations?.length > 0 && (
        <ul className="space-y-2 text-sm">
          {adaptation.recommandations.map((rec, i) => (
            <li key={i} className="rounded border bg-background p-2">
              <Badge variant="outline" className="mb-1">{rec.type}</Badge>
              <p>{rec.description}</p>
              {rec.resource_id && (
                <p className="text-xs text-muted-foreground mt-1">Ressource : {rec.resource_id}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {adaptation.resource_ids?.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ressources citees : {adaptation.resource_ids.join(", ")}
        </p>
      )}

      {Object.keys(adaptation.variantes_par_niveau ?? {}).length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-medium">Variantes par niveau</p>
          {Object.entries(adaptation.variantes_par_niveau).map(([niveau, hint]) => (
            <p key={niveau} className="text-muted-foreground">
              {niveau} : {hint}
            </p>
          ))}
        </div>
      )}

      {adaptation.ajustements_deroule?.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-medium">Ajustements deroule proposes</p>
          {adaptation.ajustements_deroule.map((adj, i) => (
            <p key={i} className="text-muted-foreground">
              {adj.phase} — {adj.action}
              {adj.duree_delta_min != null ? ` (${adj.duree_delta_min > 0 ? "+" : ""}${adj.duree_delta_min} min)` : ""}
            </p>
          ))}
        </div>
      )}

      {!validated ? (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" className="gap-1" onClick={onValidate}>
            <Check className="h-3 w-3" /> Valider la proposition
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={onReject}>
            <X className="h-3 w-3" /> Refuser
          </Button>
        </div>
      ) : (
        <p className="text-xs text-green-700 dark:text-green-400">
          Proposition validee par le formateur. Appliquez les ajustements manuellement en seance.
        </p>
      )}
    </div>
  );
}

export default CurriculumAdaptPanel;
