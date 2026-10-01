-- Disposable targeted fixture, aligned with remote catalogs inspected 2026-10-01.
-- Only columns/policies required by P0 are reproduced, except exercise_assignments
-- whose full current column shape is included. Not a full Supabase schema replay.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
CREATE TYPE public.app_role AS ENUM('formateur','eleve','admin');
CREATE TYPE public.competence_type AS ENUM('CE','CO','EE','EO','Structures');
CREATE TYPE public.exercice_format AS ENUM('qcm','vrai_faux','appariement','texte_lacunaire','transformation','production_ecrite','production_orale');
CREATE TYPE public.niveau_cecrl AS ENUM('A1','A2','B1','B2');
CREATE TYPE public.devoir_raison AS ENUM('remediation','consolidation');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
-- Existing application helper, not added by the P0 migration.
CREATE FUNCTION public.has_role(uid uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role=r)
$$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.points_a_maitriser(id uuid PRIMARY KEY);
CREATE TABLE public.groups(id uuid PRIMARY KEY,formateur_id uuid NOT NULL REFERENCES public.profiles);
CREATE TABLE public.sessions(id uuid PRIMARY KEY,group_id uuid NOT NULL REFERENCES public.groups);
CREATE TABLE public.group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES public.groups,eleve_id uuid REFERENCES public.profiles);
CREATE TABLE public.exercices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),formateur_id uuid NOT NULL REFERENCES public.profiles,
 point_a_maitriser_id uuid NOT NULL REFERENCES public.points_a_maitriser,
 titre text NOT NULL,consigne text NOT NULL,competence public.competence_type NOT NULL,format public.exercice_format NOT NULL,
 niveau_vise text NOT NULL DEFAULT 'A2',difficulte integer NOT NULL DEFAULT 3 CHECK(difficulte BETWEEN 0 AND 10),contenu jsonb NOT NULL DEFAULT '{}',
 is_devoir boolean NOT NULL DEFAULT false,is_ai_generated boolean NOT NULL DEFAULT false,eleve_id uuid REFERENCES public.profiles,
 statut text DEFAULT 'draft',updated_at timestamptz DEFAULT now());
ALTER TABLE public.exercices ADD COLUMN sous_competence text;
ALTER TABLE public.exercices ADD COLUMN is_live_ready boolean DEFAULT false;
ALTER TABLE public.exercices ADD COLUMN objectif_tcf text;
ALTER TABLE public.exercices ADD COLUMN metadata_code text;
ALTER TABLE public.exercices ADD COLUMN metadata_skill text;
ALTER TABLE public.exercices ADD COLUMN duree_limite_secondes integer;
ALTER TABLE public.exercices ADD COLUMN aides_disponibles text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.exercices ADD COLUMN nombre_ecoutes_max integer;
ALTER TABLE public.exercices ADD COLUMN transcription_verrouillee boolean NOT NULL DEFAULT false;
ALTER TABLE public.exercices ADD COLUMN type_differenciation text;
ALTER TABLE public.exercices ADD COLUMN pedagogical_status text NOT NULL DEFAULT 'draft'::text;
ALTER TABLE public.exercices ADD COLUMN civic_content boolean NOT NULL DEFAULT false;
ALTER TABLE public.exercices ADD COLUMN civic_fact_ids text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.exercices ADD COLUMN needs_content_review boolean NOT NULL DEFAULT false;
CREATE TABLE public.devoirs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exercice_id uuid NOT NULL REFERENCES public.exercices ON DELETE CASCADE,
 eleve_id uuid NOT NULL REFERENCES public.profiles,formateur_id uuid NOT NULL REFERENCES public.profiles,
 session_id uuid REFERENCES public.sessions ON DELETE SET NULL,contexte text NOT NULL DEFAULT 'devoir',serie integer,
 raison public.devoir_raison NOT NULL DEFAULT 'remediation',statut text NOT NULL DEFAULT 'en_attente',
 date_echeance timestamptz NOT NULL DEFAULT (now()+interval '7 days'),source_label text);
-- Actual remote assignment shape: independent from devoirs, no source_devoir_id.
CREATE TABLE public.exercise_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exercise_id uuid REFERENCES public.exercices ON DELETE CASCADE,
 learner_id uuid REFERENCES public.profiles,group_id uuid REFERENCES public.groups,assigned_by uuid REFERENCES public.profiles,
 context text CHECK(context IN ('autonomie','devoir','live','remediation')),due_date timestamptz,sync_status text DEFAULT 'local',created_at timestamptz DEFAULT now());
CREATE TABLE public.pedagogical_sources(id uuid PRIMARY KEY,created_by uuid,source_kind text,content_hash text,status text,review_status text,storage_bucket text,storage_path text);
CREATE TABLE public.differentiation_families(id uuid PRIMARY KEY,published_exercise_id uuid,source_id uuid,source_content_hash text,review_status text);
GRANT SELECT ON public.pedagogical_sources,public.differentiation_families TO authenticated;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_exercise ON public.exercices USING(formateur_id=auth.uid()) WITH CHECK(formateur_id=auth.uid());
CREATE POLICY validated_exercise ON public.exercices FOR SELECT USING(auth.uid() IS NOT NULL AND statut IN ('validated','published'));
CREATE POLICY own_devoir ON public.devoirs USING(formateur_id=auth.uid()) WITH CHECK(formateur_id=auth.uid());
CREATE POLICY learner_devoir ON public.devoirs FOR SELECT USING(eleve_id=auth.uid());
CREATE POLICY own_group ON public.groups USING(formateur_id=auth.uid());
CREATE POLICY own_session ON public.sessions USING(EXISTS(SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.formateur_id=auth.uid()));
CREATE POLICY own_member ON public.group_members USING(EXISTS(SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.formateur_id=auth.uid()));
CREATE POLICY own_assignment ON public.exercise_assignments USING(assigned_by=auth.uid()) WITH CHECK(assigned_by=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.exercices,public.devoirs,public.exercise_assignments TO authenticated;
GRANT SELECT,UPDATE ON public.groups,public.sessions,public.group_members TO authenticated;
GRANT SELECT ON public.points_a_maitriser TO authenticated;
