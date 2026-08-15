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

function speakers(facts: DifferentiationFact[]): Set<string> {
  const values = new Set<string>();
  for (const fact of facts) {
    const speaker = fact.semantic_qualifiers?.speaker;
    if (typeof speaker === "string" && isMeaningfulActorLabel(speaker)) {
      values.add(speaker.trim().toLowerCase());
    }
    const viewpoint = fact.semantic_qualifiers?.viewpoint;
    if (typeof viewpoint === "string" && isMeaningfulActorLabel(viewpoint)) {
      values.add(viewpoint.trim().toLowerCase());
    }
  }
  return values;
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
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return kind === "main_idea" || hasAny(factBlob(fact), ["idée principale", "sujet", "thème", "theme", "propos"]);
  }));

  push("chronology", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return kind === "chronology" || hasAny(factBlob(fact), ["puis", "ensuite", "avant", "après", "apres", "d'abord", "enfin", "chronolog"]);
  }));

  push("cause_effect", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return ["cause", "consequence", "cause_effect"].includes(kind)
      || hasAny(factBlob(fact), ["parce que", "car ", "donc", "ainsi", "conséquence", "consequence"])
      || hasToken(factBlob(fact), ["cause"]);
  }));

  push("explicit_opinion", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return kind === "opinion" || hasAny(factBlob(fact), ["je pense", "à mon avis", "a mon avis", "selon moi"])
      || hasToken(factBlob(fact), ["opinion"]);
  }));

  push("explicit_intention", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return kind === "intention" || hasAny(factBlob(fact), ["je vais", "je veux", "projet", "prévois", "prevois"])
      || hasToken(factBlob(fact), ["intention"]);
  }));

  push("related_details", facts.length >= 4 ? facts.slice(0, 4) : []);

  const distinctSpeakers = new Set<string>();
  for (const fact of facts) {
    const speaker = fact.semantic_qualifiers?.speaker;
    if (typeof speaker === "string" && isMeaningfulActorLabel(speaker)) {
      distinctSpeakers.add(speaker.trim().toLowerCase());
    }
  }
  // Only distinct speaker identities unlock this B2 signal.
  // LLM thematic viewpoint tags ("safety", "societal improvement") must not count.
  const hasMultipleViewpoints = distinctSpeakers.size >= 2;
  push(
    "multiple_viewpoints",
    hasMultipleViewpoints
      ? facts.filter((fact) => {
        const speaker = fact.semantic_qualifiers?.speaker;
        return typeof speaker === "string" && isMeaningfulActorLabel(speaker);
      })
      : [],
  );

  push("argumentation", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    // Lexical "parce que" alone is too weak for B2 (common in A2 narratives).
    return kind === "argument"
      || hasAny(factBlob(fact), ["d'une part", "d'autre part"])
      || hasToken(factBlob(fact), ["argument"]);
  }));

  push("opinion_with_justification", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    const justified = fact.semantic_qualifiers?.justified === true
      || hasToken(qualifierText(fact), ["justification", "justified"]);
    return (kind === "opinion" || hasAny(factBlob(fact), ["je pense", "à mon avis", "a mon avis"])) && justified;
  }));

  push("attitude_intention", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    return ["attitude", "intention"].includes(kind)
      || hasToken(factBlob(fact), ["attitude", "souhaite", "craint", "espoir", "intention"]);
  }));

  push("supported_implicature", facts.filter((fact) => {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    const supportCount = Array.isArray(fact.semantic_qualifiers?.support_fact_ids)
      ? fact.semantic_qualifiers.support_fact_ids.length
      : Number(fact.semantic_qualifiers?.support_fact_count ?? 0);
    return kind === "implicature" && supportCount >= 2;
  }));

  // Epistemic diversity only: plain epistemic="fact" on every explicit item must NOT
  // count as a B2 richness signal by itself.
  const epistemicBuckets = new Set<string>();
  const epistemicEvidence: DifferentiationFact[] = [];
  for (const fact of facts) {
    const kind = String(fact.semantic_qualifiers?.fact_kind ?? "").toLowerCase();
    const epistemic = String(fact.semantic_qualifiers?.epistemic ?? "").toLowerCase();
    const bucket = ["opinion", "hypothesis", "hypothese"].includes(kind)
      || ["opinion", "hypothesis", "hypothese"].includes(epistemic)
      ? (kind === "opinion" || epistemic === "opinion" ? "opinion" : "hypothesis")
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

  // B2: never invent difficulty — require a verifiable rich combo.
  // A single-speaker opinionated monologue (fact+opinion epistemic tags) is not enough:
  // unlock only via multiple viewpoints, argumentation, or supported implicature.
  const hitCount = B2_SIGNAL_IDS.filter((id) => present.has(id)).length;
  const richCore = present.has("multiple_viewpoints")
    || present.has("argumentation")
    || present.has("supported_implicature");
  const supported = hitCount >= 2 && facts.length >= 5 && richCore;

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
