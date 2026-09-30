-- Local recovery only. Disable UI/Edge revision action before removal.
-- No business data is reverted. Unknown dependencies abort the transaction.
BEGIN;
DROP TRIGGER guard_studio_facts_generation ON public.differentiation_families;
DROP FUNCTION public.guard_studio_facts_generation();
DROP TRIGGER guard_studio_facts_confirmation ON public.pedagogical_sources;
DROP TRIGGER guard_studio_fact_payload ON public.differentiation_families;
DROP FUNCTION public.guard_studio_facts_confirmation();
DROP FUNCTION public.guard_studio_fact_payload();
REVOKE EXECUTE ON FUNCTION public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb) FROM authenticated;
DROP FUNCTION public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb);
DROP FUNCTION public.studio_facts_hash(jsonb);
DROP FUNCTION public.studio_facts_canonical_json(jsonb);
COMMIT;
