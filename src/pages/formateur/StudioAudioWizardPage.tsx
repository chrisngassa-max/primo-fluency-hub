// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { StudioSourceReview } from "@/components/studio-audio/StudioSourceReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StudioAudioStepBar } from "@/components/studio-audio/StudioAudioStepBar";
import { StudioAudioFactsStep } from "@/components/studio-audio/StudioAudioFactsStep";
import { StudioAudioSessionAttach } from "@/components/studio-audio/StudioAudioSessionAttach";
import { SourceTranscriptionActions } from "@/components/pedagogical-sources/SourceTranscriptionActions";
import { SourceAnalysisActions } from "@/components/pedagogical-sources/SourceAnalysisActions";
import { SourceDifferentiationFamilyActions } from "@/components/pedagogical-sources/SourceDifferentiationFamilyActions";
import {
  fetchPedagogicalSourceById,
  updatePedagogicalSourceFields,
  type PedagogicalSource,
} from "@/lib/pedagogicalSources";
import { fetchCurrentTranscription } from "@/lib/pedagogicalSourceTranscriptions";
import { fetchDifferentiationFamiliesForSource, type DifferentiationFamily, type SliceLevel } from "@/lib/differentiationFamilies";
import {
  assertGenerationAllowed,
  assertPublishAllowed,
  canSelectStudioStep,
  hasDivergentFactsHashes,
  humanizeStudioError,
  resolveStudioSteps,
  type StudioStepId,
} from "@/lib/studioAudioWorkflow";

function MetadataRightsForm({
  source,
  onSaved,
}: {
  source: PedagogicalSource;
  onSaved: (source: PedagogicalSource) => void;
}) {
  const [title, setTitle] = useState(source.title);
  const [rights, setRights] = useState(source.rights_status ?? "");
  const [licenseNote, setLicenseNote] = useState(source.license_note ?? "");
  const [origin, setOrigin] = useState(source.source_origin ?? "");
  const [reusableForStudents, setReusableForStudents] = useState(source.reusable_for_students);
  const [reusableForAi, setReusableForAi] = useState(source.reusable_for_ai);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!rights.trim()) {
      toast.error("Indiquez le statut des droits.");
      return;
    }
    setBusy(true);
    try {
      const updated = await updatePedagogicalSourceFields(source.id, {
        title: title.trim() || source.title,
        rights_status: rights.trim(),
        license_note: licenseNote.trim() || null,
        source_origin: origin.trim() || null,
        reusable_for_students: reusableForStudents,
        reusable_for_ai: reusableForAi,
      });
      toast.success("Métadonnées et droits enregistrés.");
      onSaved(updated);
    } catch (error: any) {
      toast.error("Enregistrement impossible", { description: humanizeStudioError(error?.message) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 max-w-xl" aria-label="Métadonnées et droits">
      <h2 className="text-lg font-semibold">Métadonnées et droits</h2>
      <div className="space-y-1">
        <Label htmlFor="studio-meta-title">Titre</Label>
        <Input id="studio-meta-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="studio-meta-origin">Origine</Label>
        <Input id="studio-meta-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="studio-meta-rights">Statut des droits</Label>
        <Input id="studio-meta-rights" value={rights} onChange={(e) => setRights(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="studio-meta-license">Note de licence</Label>
        <Textarea id="studio-meta-license" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={reusableForStudents} onCheckedChange={(v) => setReusableForStudents(v === true)} />
        Réutilisable pour les élèves
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={reusableForAi} onCheckedChange={(v) => setReusableForAi(v === true)} />
        Réutilisable pour la génération IA
      </label>
      <Button disabled={busy} onClick={save}>Enregistrer</Button>
    </section>
  );
}

export default function StudioAudioWizardPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<StudioStepId>(1);
  const [selectedLevels, setSelectedLevels] = useState<SliceLevel[]>(["A2"]);
  const [familiesOverride, setFamiliesOverride] = useState<DifferentiationFamily[] | null>(null);
  const resumedForSource = useRef<string | null>(null);

  const sourceQuery = useQuery({
    queryKey: ["pedagogical-source", sourceId],
    queryFn: () => fetchPedagogicalSourceById(sourceId!),
    enabled: Boolean(sourceId),
  });

  const transcriptionQuery = useQuery({
    queryKey: ["pedagogical-source-transcription", sourceId],
    queryFn: () => fetchCurrentTranscription(sourceId!),
    enabled: Boolean(sourceId),
  });

  const familiesQuery = useQuery({
    queryKey: ["differentiation-families", sourceId],
    queryFn: () => fetchDifferentiationFamiliesForSource(sourceId!),
    enabled: Boolean(sourceId),
  });

  const source = sourceQuery.data ?? null;
  const families = familiesOverride ?? familiesQuery.data ?? [];
  const transcriptionStatus = transcriptionQuery.data?.transcription?.status;

  const snapshot = useMemo(
    () => ({
      source,
      transcriptionStatus,
      families,
      selectedLevels,
      activeStep,
    }),
    [source, transcriptionStatus, families, selectedLevels, activeStep],
  );

  const resolved = useMemo(() => resolveStudioSteps(snapshot), [snapshot]);

  useEffect(() => {
    if (!sourceId || !source) return;
    if (transcriptionQuery.isLoading || familiesQuery.isLoading) return;
    if (resumedForSource.current === sourceId) return;
    resumedForSource.current = sourceId;
    setActiveStep(resolveStudioSteps({
      source,
      transcriptionStatus,
      families,
      selectedLevels: ["A2"],
      activeStep: 1,
    }).recommendedStep);
  }, [sourceId, source, transcriptionQuery.isLoading, familiesQuery.isLoading, transcriptionStatus, families]);

  const generationGate = useMemo(() => {
    const result = assertGenerationAllowed({
      source,
      transcriptionStatus,
      families,
      selectedLevels,
      confirmation: resolved.confirmation,
    });
    return result.ok
      ? { allowed: true as const }
      : { allowed: false as const, reason: result.reason };
  }, [source, transcriptionStatus, families, selectedLevels, resolved.confirmation]);

  const onFamiliesChange = useCallback((next: DifferentiationFamily[]) => {
    setFamiliesOverride(next);
  }, []);

  const onSelectedLevelsChange = useCallback((levels: SliceLevel[]) => {
    setSelectedLevels(levels);
  }, []);

  const refreshSource = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pedagogical-source", sourceId] });
    const result = await sourceQuery.refetch();
    if (result.error) throw result.error;
  };

  const selectStep = (stepId: StudioStepId) => {
    const gate = canSelectStudioStep(stepId, resolved.steps);
    if (!gate.ok) {
      toast.error("Étape indisponible", { description: gate.reason });
      return;
    }
    setActiveStep(stepId);
  };

  if (!sourceId) {
    return <p className="p-6 text-sm text-destructive">Identifiant de source manquant.</p>;
  }

  if (sourceQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du Studio…
      </div>
    );
  }

  if (sourceQuery.error || !source) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive" role="alert">
          {humanizeStudioError((sourceQuery.error as Error | null)?.message) || "Source introuvable."}
        </p>
        <Button asChild variant="outline"><Link to="/formateur/studio-audio">Retour au Studio</Link></Button>
      </div>
    );
  }

  if (source.source_kind !== "audio") {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">Cette source n’est pas un audio.</p>
        <Button asChild variant="outline"><Link to="/formateur/studio-audio">Retour</Link></Button>
      </div>
    );
  }

  const currentStepView = resolved.steps.find((step) => step.id === activeStep);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/formateur/studio-audio" aria-label="Retour à la liste Studio audio">
            <ArrowLeft className="mr-1 h-4 w-4" />Studio
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{source.title}</h1>
          <p className="text-xs text-muted-foreground">
            Étape {activeStep} · {source.status} · {source.review_status}
          </p>
        </div>
      </div>

      <StudioAudioStepBar steps={resolved.steps} activeStep={activeStep} onSelect={selectStep} />

      <div className="rounded border bg-muted/30 p-3 text-sm" role="status" aria-live="polite">
        <p>
          <span className="font-medium">Action suivante recommandée :</span> {resolved.nextAction}
        </p>
        {currentStepView?.blockReason && (
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            {currentStepView.blockReason}
          </p>
        )}
      </div>

      {activeStep === 1 && (
        <section className="space-y-2" aria-label="Audio importé">
          <h2 className="text-lg font-semibold">Audio importé</h2>
          <p className="text-sm text-muted-foreground">
            Fichier déjà enregistré côté serveur. Passez aux métadonnées ou importez un autre audio depuis
            la page d’accueil du Studio.
          </p>
          <p className="text-sm font-mono break-all">{source.storage_path}</p>
          <Button onClick={() => setActiveStep(2)}>Continuer vers les droits</Button>
        </section>
      )}

      {activeStep === 2 && (
        <MetadataRightsForm
          key={`${source.id}-${source.updated_at}`}
          source={source}
          onSaved={async () => {
            await refreshSource();
            setActiveStep(3);
          }}
        />
      )}

      {activeStep === 3 && (
        <div className="space-y-6">
          <SourceTranscriptionActions source={source} variant="inline" />
          <StudioSourceReview key={source.id} source={source} transcriptionStatus={transcriptionStatus} userId={user?.id} role={role} onSaved={refreshSource} />
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Analyse (chunks sourcés)</h3>
            <p className="text-xs text-muted-foreground">
              Requis avant la génération. Réutilise l’action existante d’analyse.
            </p>
            <SourceAnalysisActions source={source} />
          </div>
        </div>
      )}

      {activeStep === 4 && user && (
        <StudioAudioFactsStep
          source={source}
          family={families.find(family => family.id === resolved.sealed?.sourceFamilyId)}
          onRevised={async () => {
            // Invalidate locally before network refresh, including refresh failures.
            queryClient.setQueryData<PedagogicalSource>(["pedagogical-source", sourceId], current => {
              if (!current) return current;
              const metadata = { ...current.metadata };
              delete metadata.studio_facts_confirmation;
              return { ...current, metadata };
            });
            setFamiliesOverride(null);
            const refreshed = await familiesQuery.refetch();
            if (refreshed.error) throw refreshed.error;
            await refreshSource();
          }}
          sealed={resolved.sealed}
          confirmation={resolved.confirmation}
          divergent={hasDivergentFactsHashes(families)}
          userId={user.id}
          onConfirmed={async () => {
            await refreshSource();
          }}
        />
      )}

      {activeStep === 5 && (
        <SourceDifferentiationFamilyActions
          source={source}
          variant="inline"
          sections={{ generate: true, review: false }}
          generationGate={generationGate}
          onFamiliesChange={onFamiliesChange}
          onSelectedLevelsChange={onSelectedLevelsChange}
        />
      )}

      {activeStep === 6 && (
        <SourceDifferentiationFamilyActions
          source={source}
          variant="inline"
          sections={{ generate: false, review: true }}
          onFamiliesChange={onFamiliesChange}
        />
      )}

      {activeStep === 7 && (
        <SourceDifferentiationFamilyActions
          source={source}
          variant="inline"
          sections={{ generate: false, review: true }}
          publishGate={(family) => {
            const result = assertPublishAllowed(family);
            return result.ok
              ? { allowed: true }
              : { allowed: false, reason: result.reason };
          }}
          onFamiliesChange={onFamiliesChange}
        />
      )}

      {activeStep === 8 && user && (
        <StudioAudioSessionAttach families={families} userId={user.id} />
      )}
    </div>
  );
}
