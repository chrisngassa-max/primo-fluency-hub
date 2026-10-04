import type { DifferentiationFamily, SliceLevel } from "@/lib/differentiationFamilies";
import { SLICE_LEVELS, getFamilyTargetLevel, getFamilyVariant } from "@/lib/differentiationFamilies";
import type { PedagogicalSource } from "@/lib/pedagogicalSources";
import type { TranscriptionStatus } from "@/lib/pedagogicalSourceTranscriptions";

/** Plafond Studio : au plus 6 items par niveau (contrat A2 = max 6). */
export const STUDIO_MAX_ITEMS_PER_LEVEL = 6;

export const STUDIO_FACTS_METADATA_KEY = "studio_facts_confirmation" as const;

export const STUDIO_AUDIO_STEPS = [
  { id: 1, key: "import", label: "Importer l’audio" },
  { id: 2, key: "metadata", label: "Métadonnées et droits" },
  { id: 3, key: "transcription", label: "Transcrire et relire" },
  { id: 4, key: "facts", label: "Vérifier les faits communs" },
  { id: 5, key: "generate", label: "Choisir A1–B2 et générer" },
  { id: 6, key: "review", label: "Relire les variantes" },
  { id: 7, key: "publish", label: "Valider et publier" },
  { id: 8, key: "session", label: "Ajouter à une séance" },
] as const;

export type StudioStepId = (typeof STUDIO_AUDIO_STEPS)[number]["id"];
export type StudioStepKey = (typeof STUDIO_AUDIO_STEPS)[number]["key"];
export type StudioStepStatus = "done" | "current" | "available" | "blocked";

export type StudioFactsConfirmation = {
  facts_hash: string;
  confirmed_at: string;
  confirmed_by: string;
  fact_ids: string[];
};

export type StudioFactRow = {
  fact_id: string;
  subject?: string;
  predicate?: string;
  object?: unknown;
  provenance?: { segment_refs?: string[]; chunk_refs?: string[] };
};

export type SealedFactsBundle = {
  facts_hash: string;
  facts: StudioFactRow[];
  sourceFamilyId: string;
  levels: SliceLevel[];
};

export type StudioStepView = {
  id: StudioStepId;
  key: StudioStepKey;
  label: string;
  status: StudioStepStatus;
  blockReason?: string;
};

export type StudioWorkflowSnapshot = {
  source: PedagogicalSource | null;
  transcriptionStatus: TranscriptionStatus | null | undefined;
  families: DifferentiationFamily[];
  selectedLevels: SliceLevel[];
  activeStep: StudioStepId;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readStudioFactsConfirmation(
  metadata: Record<string, unknown> | null | undefined,
): StudioFactsConfirmation | null {
  if (!metadata) return null;
  const raw = metadata[STUDIO_FACTS_METADATA_KEY];
  if (!isRecord(raw)) return null;
  const factsHash = typeof raw.facts_hash === "string" ? raw.facts_hash.trim() : "";
  const confirmedAt = typeof raw.confirmed_at === "string" ? raw.confirmed_at : "";
  const confirmedBy = typeof raw.confirmed_by === "string" ? raw.confirmed_by : "";
  const factIds = Array.isArray(raw.fact_ids)
    ? raw.fact_ids.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  if (!factsHash || !confirmedAt || !confirmedBy) return null;
  return {
    facts_hash: factsHash,
    confirmed_at: confirmedAt,
    confirmed_by: confirmedBy,
    fact_ids: factIds,
  };
}

export function buildStudioFactsConfirmation(input: {
  factsHash: string;
  confirmedBy: string;
  factIds: string[];
  confirmedAt?: string;
}): StudioFactsConfirmation {
  return {
    facts_hash: input.factsHash.trim(),
    confirmed_at: input.confirmedAt ?? new Date().toISOString(),
    confirmed_by: input.confirmedBy,
    fact_ids: [...new Set(input.factIds.filter(Boolean))],
  };
}

export function mergeStudioFactsConfirmation(
  metadata: Record<string, unknown> | null | undefined,
  confirmation: StudioFactsConfirmation,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [STUDIO_FACTS_METADATA_KEY]: confirmation,
  };
}

export function getFamilyFactsHash(family: DifferentiationFamily): string | null {
  const hash = family.payload?.facts?.facts_hash;
  return typeof hash === "string" && hash.trim() ? hash.trim() : null;
}

export function getFamilyFacts(family: DifferentiationFamily): StudioFactRow[] {
  const required = family.payload?.facts?.required;
  if (!Array.isArray(required)) return [];
  return required.filter((fact) => fact && typeof fact.fact_id === "string") as StudioFactRow[];
}

export function collectFactsHashes(families: DifferentiationFamily[]): string[] {
  const hashes = new Set<string>();
  for (const family of families) {
    const hash = getFamilyFactsHash(family);
    if (hash) hashes.add(hash);
  }
  return [...hashes];
}

export function hasDivergentFactsHashes(families: DifferentiationFamily[]): boolean {
  return collectFactsHashes(families).length > 1;
}

/** Réutilise un ensemble déjà scellé (même facts_hash) sans relancer d’extraction. */
export function findCommonSealedFacts(families: DifferentiationFamily[]): SealedFactsBundle | null {
  const withFacts = families.filter((family) => getFamilyFactsHash(family) && getFamilyFacts(family).length > 0);
  if (withFacts.length === 0) return null;
  if (hasDivergentFactsHashes(withFacts)) return null;
  const factsHash = getFamilyFactsHash(withFacts[0])!;
  const richest = [...withFacts].sort(
    (a, b) => getFamilyFacts(b).length - getFamilyFacts(a).length,
  )[0];
  return {
    facts_hash: factsHash,
    facts: getFamilyFacts(richest),
    sourceFamilyId: richest.id,
    levels: withFacts.map(getFamilyTargetLevel),
  };
}

export function isFactsConfirmationValid(
  confirmation: StudioFactsConfirmation | null,
  sealed: SealedFactsBundle | null,
): boolean {
  if (!confirmation || !sealed) return false;
  return confirmation.facts_hash === sealed.facts_hash;
}

export function countFamilyItems(family: DifferentiationFamily): number {
  const items = getFamilyVariant(family)?.exercise?.items;
  return Array.isArray(items) ? items.length : 0;
}

export function familyExceedsItemCap(
  family: DifferentiationFamily,
  maxItems = STUDIO_MAX_ITEMS_PER_LEVEL,
): boolean {
  return countFamilyItems(family) > maxItems;
}

export function publishedVariants(families: DifferentiationFamily[]): Array<{
  level: SliceLevel;
  family: DifferentiationFamily;
  exerciseId: string;
}> {
  const byLevel = new Map<SliceLevel, DifferentiationFamily>();
  for (const family of families) {
    if (family.review_status !== "published" || !family.published_exercise_id) continue;
    const level = getFamilyTargetLevel(family);
    if (!byLevel.has(level)) byLevel.set(level, family);
  }
  return SLICE_LEVELS.filter((level) => byLevel.has(level)).map((level) => ({
    level,
    family: byLevel.get(level)!,
    exerciseId: byLevel.get(level)!.published_exercise_id!,
  }));
}

function hasRights(source: PedagogicalSource): boolean {
  return Boolean(source.rights_status?.trim());
}

function hasUsableTranscription(status: TranscriptionStatus | null | undefined): boolean {
  return status === "ready" || status === "reviewed";
}

/**
 * Génération multilevel : faits disponibles + confirmés + hash unique.
 * Bootstrap A2 seul autorisé si aucun fait scellé n’existe encore.
 */
export function assertGenerationAllowed(input: {
  source: PedagogicalSource | null;
  transcriptionStatus: TranscriptionStatus | null | undefined;
  families: DifferentiationFamily[];
  selectedLevels: SliceLevel[];
  confirmation: StudioFactsConfirmation | null;
}): { ok: true } | { ok: false; reason: string } {
  const { source, transcriptionStatus, families, selectedLevels, confirmation } = input;
  if (!source) {
    return { ok: false, reason: "Importez d’abord un fichier audio." };
  }
  if (source.source_kind !== "audio") {
    return { ok: false, reason: "Le Studio audio n’accepte que les sources audio." };
  }
  if (transcriptionStatus !== "reviewed") {
    return { ok: false, reason: "La transcription doit être relue avant la génération." };
  }
  if (!["utilisable", "valide"].includes(source.review_status)) {
    return { ok: false, reason: "Marquez la source comme utilisable après sa revue (étape 3)." };
  }
  if (!hasRights(source) || !source.reusable_for_ai) {
    return { ok: false, reason: "Renseignez les droits et autorisez la génération IA." };
  }
  if (source.status !== "analyzed") {
    return { ok: false, reason: "Analysez l’audio (chunks sourcés) avant de générer." };
  }
  if (selectedLevels.length === 0) {
    return { ok: false, reason: "Sélectionnez au moins un niveau parmi A1, A2, B1 et B2." };
  }
  if (hasDivergentFactsHashes(families)) {
    return {
      ok: false,
      reason:
        "Plusieurs ensembles de faits (facts_hash différents) existent pour cette source. Une famille A1–B2 ne peut porter qu’un seul facts_hash.",
    };
  }

  const sealed = findCommonSealedFacts(families);
  const multilevel = selectedLevels.length > 1 || selectedLevels.some((level) => level !== "A2");

  if (!sealed) {
    if (multilevel) {
      return {
        ok: false,
        reason:
          "Aucun fait commun n’est encore disponible. Générez d’abord le niveau A2 seul, confirmez les faits, puis lancez les autres niveaux.",
      };
    }
    return { ok: true };
  }

  if (!isFactsConfirmationValid(confirmation, sealed)) {
    return {
      ok: false,
      reason:
        "Confirmez les faits communs (étape 4) avant de générer plusieurs niveaux ou un niveau autre que A2.",
    };
  }

  if (confirmation && confirmation.facts_hash !== sealed.facts_hash) {
    return {
      ok: false,
      reason: "La confirmation porte sur un facts_hash différent de l’ensemble scellé actuel.",
    };
  }

  return { ok: true };
}

export function assertPublishAllowed(family: DifferentiationFamily | null): { ok: true } | { ok: false; reason: string } {
  if (!family) {
    return { ok: false, reason: "Aucune variante à publier pour ce niveau." };
  }
  if (family.published_exercise_id) {
    return { ok: false, reason: "Cette variante est déjà publiée." };
  }
  if (family.review_status !== "validated") {
    return {
      ok: false,
      reason: "Validez d’abord la variante (statut « validée ») avant de publier.",
    };
  }
  if (!["passed", "passed_with_warnings"].includes(family.validation_status)) {
    return {
      ok: false,
      reason: "La validation automatique n’est pas réussie ; publication impossible.",
    };
  }
  if (familyExceedsItemCap(family)) {
    return {
      ok: false,
      reason: `Cette variante dépasse le plafond de ${STUDIO_MAX_ITEMS_PER_LEVEL} questions par niveau.`,
    };
  }
  return { ok: true };
}

export function humanizeStudioError(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "Une erreur est survenue. Réessayez ou contactez le support CapTCF.";
  const upper = text.toUpperCase();
  if (upper.includes("STAFF_ROLE_REQUIRED")) {
    return "Seuls les formateurs authentifiés peuvent utiliser le Studio audio.";
  }
  if (upper.includes("SOURCE_FORBIDDEN")) {
    return "Vous ne pouvez pas modifier une source qui ne vous appartient pas.";
  }
  if (upper.includes("SOURCE_NOT_ANALYZED") || upper.includes("SOURCE_NOT_READY")) {
    return "L’audio n’est pas encore prêt : terminez l’analyse avant de continuer.";
  }
  if (upper.includes("DIFF_TRANSFORMATION_NOT_SUPPORTED") || upper.includes("DIFF_TRANSFORMATION")) {
    return "Ce niveau n’est pas supporté pour ce document audio (support insuffisant).";
  }
  if (upper.includes("FACTS_HASH") || upper.includes("DIVERGENT")) {
    return "Les faits ne sont pas cohérents entre les niveaux. Une seule empreinte de faits est autorisée.";
  }
  if (upper.includes("JWT") || upper.includes("AUTH") || upper.includes("UNAUTHORIZED")) {
    return "Votre session a expiré. Reconnectez-vous puis réessayez.";
  }
  if (upper.includes("NETWORK") || upper.includes("FAILED TO FETCH")) {
    return "Connexion interrompue. Vérifiez votre réseau puis réessayez.";
  }
  return text;
}

function stepDoneFlags(input: StudioWorkflowSnapshot, confirmation: StudioFactsConfirmation | null, sealed: SealedFactsBundle | null) {
  const source = input.source;
  const families = input.families;
  const byLevel = publishedVariants(families);
  const hasGenerated = families.some((f) => f.generation_status === "generated" || f.review_status !== "draft");
  const hasValidated = families.some((f) => f.review_status === "validated" || f.review_status === "published");
  const hasPublished = byLevel.length > 0;

  return {
    1: Boolean(source?.id && source.source_kind === "audio"),
    2: Boolean(source && hasRights(source)),
    3: input.transcriptionStatus === "reviewed" && source?.status === "analyzed" && ["utilisable", "valide"].includes(source.review_status),
    4: isFactsConfirmationValid(confirmation, sealed),
    5: hasGenerated,
    6: hasValidated || hasGenerated,
    7: hasPublished,
    8: hasPublished,
  } as Record<StudioStepId, boolean>;
}

function blockReasonForStep(
  stepId: StudioStepId,
  input: StudioWorkflowSnapshot,
  confirmation: StudioFactsConfirmation | null,
  sealed: SealedFactsBundle | null,
): string | undefined {
  const source = input.source;
  switch (stepId) {
    case 1:
      return undefined;
    case 2:
      return source ? undefined : "Importez d’abord un fichier audio (étape 1).";
    case 3:
      if (!source) return "Importez d’abord un fichier audio (étape 1).";
      if (!hasRights(source)) return "Renseignez les droits d’utilisation (étape 2).";
      return undefined;
    case 4:
      if (!hasUsableTranscription(input.transcriptionStatus)) {
        return "La transcription doit être disponible et relue (étape 3).";
      }
      if (hasDivergentFactsHashes(input.families)) {
        return "Des facts_hash divergents bloquent la confirmation.";
      }
      if (!sealed) {
        return "Aucun fait extrait pour l’instant. Générez A2 (étape 5, A2 seul) pour obtenir les faits, puis revenez confirmer ici.";
      }
      return undefined;
    case 5: {
      const gate = assertGenerationAllowed({
        source,
        transcriptionStatus: input.transcriptionStatus,
        families: input.families,
        selectedLevels: input.selectedLevels.length ? input.selectedLevels : ["A2"],
        confirmation,
      });
      return gate.ok ? undefined : gate.reason;
    }
    case 6:
      if (!input.families.some((f) => f.generation_status === "generated" || Boolean(f.payload?.variants))) {
        return "Générez au moins une variante (étape 5) avant la relecture.";
      }
      return undefined;
    case 7: {
      const candidates = input.families.filter((f) => !f.published_exercise_id);
      if (candidates.length === 0 && publishedVariants(input.families).length === 0) {
        return "Aucune variante générée à valider ou publier.";
      }
      return undefined;
    }
    case 8:
      if (publishedVariants(input.families).length === 0) {
        return "Publiez au moins une variante (étape 7) avant de l’ajouter à une séance.";
      }
      return undefined;
    default:
      return undefined;
  }
}

export function resolveStudioSteps(input: StudioWorkflowSnapshot): {
  steps: StudioStepView[];
  recommendedStep: StudioStepId;
  nextAction: string;
  confirmation: StudioFactsConfirmation | null;
  sealed: SealedFactsBundle | null;
} {
  const confirmation = readStudioFactsConfirmation(input.source?.metadata);
  const sealed = findCommonSealedFacts(input.families);
  const done = stepDoneFlags(input, confirmation, sealed);

  let recommended: StudioStepId = 1;
  for (const step of STUDIO_AUDIO_STEPS) {
    if (!done[step.id]) {
      recommended = step.id;
      break;
    }
    recommended = 8;
  }

  const steps: StudioStepView[] = STUDIO_AUDIO_STEPS.map((step) => {
    const reason = blockReasonForStep(step.id, input, confirmation, sealed);
    const isBlocked = Boolean(reason) && step.id !== 1 && !(step.id === 4 && sealed === null && hasUsableTranscription(input.transcriptionStatus));
    // Étape 4 reste accessible (message guidé) même sans faits, pour expliquer le bootstrap A2.
    const factsGuidable = step.id === 4 && !sealed && hasUsableTranscription(input.transcriptionStatus);
    let status: StudioStepStatus;
    if (done[step.id] && input.activeStep !== step.id) status = "done";
    else if (input.activeStep === step.id) status = "current";
    else if (isBlocked && !factsGuidable) status = "blocked";
    else status = "available";

    return {
      id: step.id,
      key: step.key,
      label: step.label,
      status,
      blockReason: status === "blocked" || (step.id === input.activeStep && reason) ? reason : status === "blocked" ? reason : undefined,
    };
  });

  // Enrichir blockReason pour l’étape courante même si accessible (guidance)
  const current = steps.find((s) => s.id === input.activeStep);
  if (current && !current.blockReason) {
    const reason = blockReasonForStep(input.activeStep, input, confirmation, sealed);
    if (reason) current.blockReason = reason;
  }

  const nextLabels: Record<StudioStepId, string> = {
    1: "Importez un fichier MP3 pour commencer.",
    2: "Complétez les métadonnées et confirmez les droits d’usage.",
    3: "Relisez la transcription, terminez l’analyse puis marquez la source comme utilisable.",
    4: sealed
      ? "Vérifiez les faits affichés puis confirmez qu’ils décrivent correctement l’audio."
      : "Générez d’abord A2 pour obtenir les faits, puis confirmez-les ici.",
    5: "Sélectionnez les niveaux souhaités puis lancez la génération.",
    6: "Relisez les questions de chaque niveau et ajoutez un feedback si besoin.",
    7: "Validez chaque variante puis publiez-la (publication impossible avant validation).",
    8: "Choisissez une de vos séances et rattachez les variantes publiées.",
  };

  return {
    steps,
    recommendedStep: recommended,
    nextAction: nextLabels[recommended],
    confirmation,
    sealed,
  };
}

export function canSelectStudioStep(
  stepId: StudioStepId,
  steps: StudioStepView[],
): { ok: true } | { ok: false; reason: string } {
  const step = steps.find((entry) => entry.id === stepId);
  if (!step) return { ok: false, reason: "Étape inconnue." };
  if (step.status === "blocked") {
    return { ok: false, reason: step.blockReason || "Cette étape est encore bloquée." };
  }
  return { ok: true };
}
