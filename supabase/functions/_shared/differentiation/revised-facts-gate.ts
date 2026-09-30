/** A revision must never fall back to extraction, even on an older generator. */
export function revisedFactsGate(families: Array<{payload?:any}>, metadata: any, force: boolean, correctif: unknown = false) {
  const revised=families.filter(f=>f.payload?.facts_revision);
  if(!revised.length) return null;
  const bundle=revised[0].payload.facts;
  if(force || revised.some(f=>f.payload.facts?.facts_hash!==bundle?.facts_hash)) return 'FACTS_REVISION_REGENERATION_FORBIDDEN';
  if(!bundle?.facts_hash || metadata?.studio_facts_confirmation?.facts_hash!==bundle.facts_hash) return 'FACTS_CONFIRMATION_REQUIRED';
  // Revised facts may only enter the verified, bounded shared-facts path.
  if (correctif !== true) return 'REVISED_FACTS_BOUNDED_MODE_REQUIRED';
  return null;
}
