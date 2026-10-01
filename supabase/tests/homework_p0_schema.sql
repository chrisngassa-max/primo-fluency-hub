-- Disposable PostgreSQL fixture: real roles, RLS and FK; no remote connections.
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
CREATE TABLE public.exercices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),formateur_id uuid REFERENCES public.profiles,
 point_a_maitriser_id uuid NOT NULL REFERENCES public.points_a_maitriser,
 titre text NOT NULL,consigne text NOT NULL,competence public.competence_type NOT NULL,format public.exercice_format NOT NULL,
 niveau_vise public.niveau_cecrl NOT NULL,difficulte integer CHECK(difficulte BETWEEN 0 AND 10),contenu jsonb NOT NULL DEFAULT '{}',
 is_devoir boolean NOT NULL DEFAULT false,is_ai_generated boolean NOT NULL DEFAULT false,eleve_id uuid REFERENCES public.profiles,
 statut text DEFAULT 'draft',updated_at timestamptz DEFAULT now());
CREATE TABLE public.devoirs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exercice_id uuid NOT NULL REFERENCES public.exercices ON DELETE CASCADE,
 eleve_id uuid NOT NULL REFERENCES public.profiles,formateur_id uuid NOT NULL REFERENCES public.profiles,
 session_id uuid REFERENCES public.sessions,contexte text,serie integer,raison public.devoir_raison,statut text DEFAULT 'en_attente',date_echeance timestamptz,source_label text);
CREATE TABLE public.exercise_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exercise_id uuid NOT NULL REFERENCES public.exercices ON DELETE CASCADE,
 learner_id uuid NOT NULL REFERENCES public.profiles,assigned_by uuid NOT NULL REFERENCES public.profiles,context text,due_date timestamptz,sync_status text,
 source_devoir_id uuid UNIQUE REFERENCES public.devoirs ON DELETE CASCADE);
CREATE TABLE public.pedagogical_sources(id uuid PRIMARY KEY,formateur_id uuid,source_kind text,content_hash text,status text,review_status text,storage_bucket text,storage_path text);
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
