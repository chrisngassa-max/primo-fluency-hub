import type {
  DifferentiationFact,
  SliceLevel,
  SupportCompatibilityResult,
  SupportCompatibilitySignal,
} from "./types.ts";

const B1_SIGNAL_IDS = [
  "main_idea",
  "chronology",
  "cause_effect",
  "explicit_opinion",
  "explicit_intention",
  "related_details",
] as const;

const B2_SIGNAL_IDS = [
  "multiple_viewpoints",
  "argumentation",
  "opinion_with_justification",
  "attitude_intention",
  "supported_implicature",
  "fact_opinion_hypothesis",
] as const;

const STANCE_KINDS = new Set([
  "opinion",
  "intention",
  "argument",
  "viewpoint",
  "attitude",
]);

const RELATION_KINDS = new Set([
  "cause",
  "consequence",
  "cause_effect",
  "argument",
]);

const RELATION_TYPES = new Set([
  "justification",
  "opposition",
  "consequence",
  "cause",
  "contrast",
  "comparison",
]);

const ADVANCED_KINDS = new Set([
  ...STANCE_KINDS,
  "implicature",
  "hypothesis",
  "hypothese",
  "cause",
  "consequence",
  "argument",
]);

function qualifierText(fact: DifferentiationFact): string {
  return JSON.stringify(fact.semantic_qualifiers ?? {}).toLowerCase();
}

function factBlob(fact: DifferentiationFact): string {
  return [
    fact.subject,
    fact.predicate,
    String(fact.object ?? ""),
    fact.provenance?.quote ?? "",
    qualifierText(fact),
  ].join(" ").toLowerCase();
}

function hasAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function hasToken(text: string, tokens: string[]): boolean {
  const normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return tokens.some((token) => normalized.includes(` ${token.toLowerCase()} `));
}

function kindOf(fact: DifferentiationFact): string {
  return String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
}

function epistemicOf(fact: DifferentiationFact): string {
  return String(fact.semantic_qualifiers?.epistemic ?? "").toLowerCase();
}

function modalityOf(fact: DifferentiationFact): string {
  return String(fact.semantic_qualifiers?.modality ?? "").toLowerCase();
}

function relationTypeOf(fact: DifferentiationFact): string {
  return String(fact.semantic_qualifiers?.relation_type ?? "").toLowerCase();
}

/** Ignore LLM placeholder labels that do not denote a real distinct actor. */
function isMeaningfulActorLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "speaker",
    "narrateur",
    "locuteur",
    "unknown",
    "inconnu",
    "n/a",
    "na",
    "-",
    "?",
  ].includes(normalized);
}

function isThematicViewpointTag(value: string): boolean {
  return /^(safety|societal|improvement|theme|topic|sujet|th[eè]me|security)\b/i.test(value.trim());
}

function isDistinctViewpointActor(value: string): boolean {
  return isMeaningfulActorLabel(value) && !isThematicViewpointTag(value);
}

function actorLabels(fact: DifferentiationFact): string[] {
  const labels: string[] = [];
  for (const key of ["speaker", "viewpoint"] as const) {
    const value = fact.semantic_qualifiers?.[key];
    if (typeof value === "string" && isDistinctViewpointActor(value)) {
      labels.push(value.trim().toLowerCase());
    }
  }
  return labels;
}

export function hasTextualProvenance(fact: DifferentiationFact): boolean {
  const quote = fact.provenance?.quote?.trim() ?? "";
  return quote.length > 0
    && (fact.provenance?.chunk_refs?.length ?? 0) > 0
    && (fact.provenance?.segment_refs?.length ?? 0) > 0;
}

function collectSupportRefs(fact: DifferentiationFact): string[] {
  const qualifiers = fact.semantic_qualifiers ?? {};
  const bags = [qualifiers.support_fact_ids, qualifiers.supporting_fact_refs];
  const refs: string[] = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) {
      if (typeof item === "string" && item.trim() && !refs.includes(item.trim())) {
        refs.push(item.trim());
      }
    }
  }
  return refs;
}

function isStanceFact(fact: DifferentiationFact): boolean {
  const kind = kindOf(fact);
  const epistemic = epistemicOf(fact);
  const modality = modalityOf(fact);
  return STANCE_KINDS.has(kind)
    || epistemic === "opinion"
    || modality === "opinion";
}

function isRelationFact(fact: DifferentiationFact): boolean {
  const kind = kindOf(fact);
  const relationType = relationTypeOf(fact);
  const qualifiers = fact.semantic_qualifiers ?? {};
  if (RELATION_KINDS.has(kind)) return true;
  if (RELATION_TYPES.has(relationType)) return true;
  if (qualifiers.consequence === true || qualifiers.cause === true) return true;
  if (qualifiers.justified === true && isStanceFact(fact)) return true;
  return collectSupportRefs(fact).length > 0 && isStanceFact(fact);
}

function isAdvancedFact(fact: DifferentiationFact): boolean {
  const kind = kindOf(fact);
  const epistemic = epistemicOf(fact);
  return ADVANCED_KINDS.has(kind)
    || ["opinion", "hypothesis", "hypothese"].includes(epistemic)
    || isStanceFact(fact)
    || isRelationFact(fact);
}

function linkedFactIds(facts: DifferentiationFact[]): Set<string> {
  const known = new Set(facts.map((fact) => fact.fact_id));
  const linked = new Set<string>();

  for (const fact of facts) {
    for (const ref of collectSupportRefs(fact)) {
      if (known.has(ref) && ref !== fact.fact_id) {
        linked.add(fact.fact_id);
        linked.add(ref);
      }
    }
  }

  const stances = facts.filter(isStanceFact);
  const relations = facts.filter(isRelationFact);
  const justifiedStance = stances.find((fact) =>
    fact.semantic_qualifiers?.justified === true || collectSupportRefs(fact).length > 0
  );
  const otherRelation = relations.find((fact) => fact.fact_id !== justifiedStance?.fact_id);
  if (justifiedStance && otherRelation) {
    linked.add(justifiedStance.fact_id);
    linked.add(otherRelation.fact_id);
  }

  const viewpointFacts = facts.filter((fact) => kindOf(fact) === "viewpoint" || actorLabels(fact).length > 0);
  const actors = new Set(viewpointFacts.flatMap(actorLabels));
  if (actors.size >= 2 && viewpointFacts.length >= 2) {
    for (const fact of viewpointFacts) linked.add(fact.fact_id);
  }

  return linked;
}

function collectSignals(facts: DifferentiationFact[]): SupportCompatibilitySignal[] {
  const signals: SupportCompatibilitySignal[] = [];
  const push = (id: string, evidence: DifferentiationFact[]) => {
    signals.push({
      id,
      present: evidence.length > 0,
      evidence_fact_ids: evidence.map((fact) => fact.fact_id),
    });
  };

  push("main_idea", facts.filter((fact) => {
    const kind = kindOf(fact);
    return kind === "main_idea" || hasAny(factBlob(fact), ["idée principale", "sujet", "thème", "theme", "propos"]);
  }));

  push("chronology", facts.filter((fact) => {
    const kind = kindOf(fact);
    return kind === "chronology" || hasAny(factBlob(fact), ["puis", "ensuite", "avant", "après", "apres", "d'abord", "enfin", "chronolog"]);
  }));

  push("cause_effect", facts.filter((fact) => {
    const kind = kindOf(fact);
    return ["cause", "consequence", "cause_effect"].includes(kind)
      || relationTypeOf(fact) === "cause"
      || relationTypeOf(fact) === "consequence"
      || hasAny(factBlob(fact), ["parce que", "car ", "donc", "ainsi", "conséquence", "consequence"])
      || hasToken(factBlob(fact), ["cause"]);
  }));

  push("explicit_opinion", facts.filter((fact) => {
    const kind = kindOf(fact);
    return kind === "opinion" || hasAny(factBlob(fact), ["je pense", "à mon avis", "a mon avis", "selon moi"])
      || hasToken(factBlob(fact), ["opinion"]);
  }));

  push("explicit_intention", facts.filter((fact) => {
    const kind = kindOf(fact);
    return kind === "intention" || hasAny(factBlob(fact), ["je vais", "je veux", "projet", "prévois", "prevois"])
      || hasToken(factBlob(fact), ["intention"]);
  }));

  push("related_details", facts.length >= 4 ? facts.slice(0, 4) : []);

  const distinctActors = new Set(facts.flatMap(actorLabels));
  const hasMultipleViewpoints = distinctActors.size >= 2;
  push(
    "multiple_viewpoints",
    hasMultipleViewpoints
      ? facts.filter((fact) => actorLabels(fact).length > 0)
      : [],
  );

  push("argumentation", facts.filter((fact) => {
    const kind = kindOf(fact);
    const relationType = relationTypeOf(fact);
    return kind === "argument"
      || relationType === "justification"
      || hasAny(factBlob(fact), ["d'une part", "d'autre part"])
      || hasToken(factBlob(fact), ["argument"]);
  }));

  push("opinion_with_justification", facts.filter((fact) => {
    const kind = kindOf(fact);
    const justified = fact.semantic_qualifiers?.justified === true
      || hasToken(qualifierText(fact), ["justification", "justified"]);
    const hasSupport = collectSupportRefs(fact).length > 0;
    return (kind === "opinion" || hasAny(factBlob(fact), ["je pense", "à mon avis", "a mon avis"]))
      && justified
      && (hasSupport || facts.some((other) => other.fact_id !== fact.fact_id && isRelationFact(other)));
  }));

  push("attitude_intention", facts.filter((fact) => {
    const kind = kindOf(fact);
    return ["attitude", "intention"].includes(kind)
      || hasToken(factBlob(fact), ["attitude", "souhaite", "craint", "espoir", "intention"]);
  }));

  push("supported_implicature", facts.filter((fact) => {
    const kind = kindOf(fact);
    const supportCount = collectSupportRefs(fact).length
      || Number(fact.semantic_qualifiers?.support_fact_count ?? 0);
    return kind === "implicature" && supportCount >= 2;
  }));

  // Epistemic diversity only: plain epistemic="fact" on every explicit item must NOT
  // count as a B2 richness signal by itself.
  const epistemicBuckets = new Set<string>();
  const epistemicEvidence: DifferentiationFact[] = [];
  for (const fact of facts) {
    const kind = kindOf(fact);
    const epistemic = epistemicOf(fact);
    const modality = modalityOf(fact);
    const bucket = ["opinion", "hypothesis", "hypothese"].includes(kind)
      || ["opinion", "hypothesis", "hypothese"].includes(epistemic)
      || ["opinion", "hypothese", "hypothèse"].includes(modality)
      ? (kind === "opinion" || epistemic === "opinion" || modality === "opinion" ? "opinion" : "hypothesis")
      : (kind === "fact" || epistemic === "fact" ? "fact" : null);
    if (!bucket) continue;
    epistemicBuckets.add(bucket);
    epistemicEvidence.push(fact);
  }
  const hasEpistemicDiversity = epistemicBuckets.has("fact")
    && (epistemicBuckets.has("opinion") || epistemicBuckets.has("hypothesis"));
  push("fact_opinion_hypothesis", hasEpistemicDiversity ? epistemicEvidence : []);

  return signals;
}

function refusalMessage(level: SliceLevel): string {
  if (level === "B2") {
    return "Cette ressource ne contient pas assez d’éléments pour produire une activité B2 fiable. Essayez B1 ou choisissez un support plus riche.";
  }
  if (level === "B1") {
    return "Cette ressource ne contient pas assez d’éléments pour produire une activité B1 fiable. Essayez A2 ou choisissez un support plus riche.";
  }
  return `Cette ressource ne contient pas assez d’éléments pour produire une activité ${level} fiable.`;
}

function meetsB2MinimumCombo(facts: DifferentiationFact[]): boolean {
  if (facts.length < 5) return false;
  const advanced = facts.filter(isAdvancedFact);
  if (advanced.some((fact) => !hasTextualProvenance(fact))) return false;
  if (linkedFactIds(facts).size < 2) return false;
  if (!facts.some(isStanceFact)) return false;
  if (!facts.some(isRelationFact)) return false;
  return true;
}

export function evaluateSupportCompatibility(
  targetLevel: SliceLevel,
  facts: DifferentiationFact[],
): SupportCompatibilityResult {
  const signals = collectSignals(facts);
  const present = new Set(signals.filter((signal) => signal.present).map((signal) => signal.id));

  if (targetLevel === "A1" || targetLevel === "A2") {
    const supported = facts.length > 0;
    return {
      target_level: targetLevel,
      supported,
      code: supported ? "OK" : "DIFF_TRANSFORMATION_NOT_SUPPORTED",
      message: supported
        ? `Support compatible ${targetLevel} (faits explicites disponibles).`
        : refusalMessage(targetLevel),
      signals,
    };
  }

  if (targetLevel === "B1") {
    const hitCount = B1_SIGNAL_IDS.filter((id) => present.has(id)).length;
    const supported = hitCount >= 2 && facts.length >= 3;
    return {
      target_level: targetLevel,
      supported,
      code: supported ? "OK" : "DIFF_TRANSFORMATION_NOT_SUPPORTED",
      message: supported
        ? "Support compatible B1 (combinaison exploitable détectée)."
        : refusalMessage("B1"),
      signals,
    };
  }

  // B2: never invent difficulty. Accept a verifiable combo, not duration/volume/keywords.
  // A long purely explicit list remains refused even if justified=true was stamped on every fact.
  const hitCount = B2_SIGNAL_IDS.filter((id) => present.has(id)).length;
  const minCombo = meetsB2MinimumCombo(facts);
  const richCore = present.has("multiple_viewpoints")
    || present.has("argumentation")
    || present.has("supported_implicature")
    || present.has("opinion_with_justification");
  const supported = minCombo && richCore && hitCount >= 1;

  return {
    target_level: "B2",
    supported,
    code: supported ? "OK" : "DIFF_TRANSFORMATION_NOT_SUPPORTED",
    message: supported
      ? "Support compatible B2 (richesse argumentative/verifiable détectée)."
      : refusalMessage("B2"),
    signals,
  };
}
