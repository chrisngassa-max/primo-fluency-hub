-- Local proposal only. No table/column grants were changed by the forward migration.
-- RESTRICT (default) refuses unexpected dependencies; transaction preserves all
-- objects on failure. Never add CASCADE. Source data/statuses are left untouched.
BEGIN;
DROP TRIGGER guard_pedagogical_source_review_status ON public.pedagogical_sources;
DROP FUNCTION public.mark_pedagogical_source_usable(uuid,boolean,timestamptz) RESTRICT;
DROP FUNCTION public.guard_pedagogical_source_review_status() RESTRICT;
COMMIT;
