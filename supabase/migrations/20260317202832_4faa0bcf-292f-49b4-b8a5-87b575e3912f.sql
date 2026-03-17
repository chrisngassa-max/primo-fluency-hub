
-- ============================================================
-- TCF IRN — ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('formateur', 'eleve', 'admin');
CREATE TYPE public.niveau_cecrl AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');
CREATE TYPE public.competence_type AS ENUM ('CO', 'CE', 'EE', 'EO', 'Structures');
CREATE TYPE public.exercice_format AS ENUM ('qcm', 'vrai_faux', 'appariement', 'production_ecrite', 'production_orale', 'texte_lacunaire', 'transformation');
CREATE TYPE public.exercice_mode AS ENUM ('papier', 'en_ligne', 'les_deux');
CREATE TYPE public.session_statut AS ENUM ('planifiee', 'en_cours', 'terminee', 'annulee');
CREATE TYPE public.devoir_statut AS ENUM ('en_attente', 'fait', 'expire', 'arrete');
CREATE TYPE public.devoir_raison AS ENUM ('remediation', 'consolidation');
CREATE TYPE public.alerte_type AS ENUM ('score_risque', 'absence', 'devoir_expire', 'tendance_baisse');
CREATE TYPE public.competence_statut AS ENUM ('non_evalue', 'non_acquis', 'consolide', 'acquis_provisoire');
CREATE TYPE public.session_exercice_statut AS ENUM ('planifie', 'traite_en_classe', 'reporte', 'devoir_remediation', 'devoir_anticipation');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nom text NOT NULL DEFAULT '',
  prenom text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.epreuves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competence public.competence_type NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sous_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve_id uuid NOT NULL REFERENCES public.epreuves(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.points_a_maitriser (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sous_section_id uuid NOT NULL REFERENCES public.sous_sections(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  niveau_min public.niveau_cecrl NOT NULL DEFAULT 'A1',
  niveau_max public.niveau_cecrl NOT NULL DEFAULT 'B1',
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom text NOT NULL,
  niveau public.niveau_cecrl NOT NULL DEFAULT 'A1',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, eleve_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  titre text NOT NULL,
  date_seance timestamptz NOT NULL,
  niveau_cible public.niveau_cecrl NOT NULL DEFAULT 'A2',
  objectifs text,
  duree_minutes int NOT NULL DEFAULT 90,
  lieu text,
  lien_visio text,
  statut public.session_statut NOT NULL DEFAULT 'planifiee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sequences_pedagogiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  niveau public.niveau_cecrl NOT NULL DEFAULT 'A2',
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sequences_pedagogiques ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.exercices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  point_a_maitriser_id uuid NOT NULL REFERENCES public.points_a_maitriser(id) ON DELETE RESTRICT,
  sequence_id uuid REFERENCES public.sequences_pedagogiques(id) ON DELETE SET NULL,
  competence public.competence_type NOT NULL,
  sous_competence text,
  niveau_vise public.niveau_cecrl NOT NULL DEFAULT 'A2',
  format public.exercice_format NOT NULL DEFAULT 'qcm',
  mode public.exercice_mode NOT NULL DEFAULT 'en_ligne',
  difficulte int NOT NULL DEFAULT 3 CHECK (difficulte BETWEEN 1 AND 5),
  contexte_irn text,
  collectif boolean NOT NULL DEFAULT true,
  titre text NOT NULL,
  consigne text NOT NULL,
  contenu jsonb NOT NULL DEFAULT '{}',
  is_template boolean NOT NULL DEFAULT false,
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_devoir boolean NOT NULL DEFAULT false,
  eleve_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.session_exercices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercice_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  statut public.session_exercice_statut NOT NULL DEFAULT 'planifie',
  ordre int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, exercice_id)
);
ALTER TABLE public.session_exercices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.resultats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  reponses_eleve jsonb NOT NULL DEFAULT '{}',
  correction_detaillee jsonb NOT NULL DEFAULT '{}',
  tentative int NOT NULL DEFAULT 1,
  devoir_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.resultats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tests_entree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  score_global numeric(5,2),
  score_co numeric(5,2),
  score_ce numeric(5,2),
  score_structures numeric(5,2),
  score_ee numeric(5,2),
  niveau_estime public.niveau_cecrl,
  recommandations text,
  en_cours boolean NOT NULL DEFAULT true,
  derniere_question int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.tests_entree ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_entree_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competence public.competence_type NOT NULL,
  niveau public.niveau_cecrl NOT NULL DEFAULT 'A1',
  format public.exercice_format NOT NULL DEFAULT 'qcm',
  contenu jsonb NOT NULL DEFAULT '{}',
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_entree_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.devoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  statut public.devoir_statut NOT NULL DEFAULT 'en_attente',
  raison public.devoir_raison NOT NULL DEFAULT 'remediation',
  date_echeance timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  nb_reussites_consecutives int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.devoirs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.resultats
  ADD CONSTRAINT resultats_devoir_id_fkey
  FOREIGN KEY (devoir_id) REFERENCES public.devoirs(id) ON DELETE SET NULL;

CREATE TABLE public.profils_eleves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  niveau_actuel public.niveau_cecrl NOT NULL DEFAULT 'A1',
  score_risque numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_global numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_co numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_ce numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_ee numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_eo numeric(5,2) NOT NULL DEFAULT 0,
  taux_reussite_structures numeric(5,2) NOT NULL DEFAULT 0,
  priorites_pedagogiques jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profils_eleves ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_competency_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competence public.competence_type NOT NULL,
  statut public.competence_statut NOT NULL DEFAULT 'non_evalue',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eleve_id, competence)
);
ALTER TABLE public.student_competency_status ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.alerte_type NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.alertes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.parametres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  seuil_acquis numeric(5,2) NOT NULL DEFAULT 80,
  seuil_consolidation numeric(5,2) NOT NULL DEFAULT 60,
  max_devoirs_actifs int NOT NULL DEFAULT 3,
  nb_reussites_consecutives int NOT NULL DEFAULT 2,
  delai_devoirs_jours int NOT NULL DEFAULT 7,
  alerte_absence_heures int NOT NULL DEFAULT 48,
  seuil_score_risque numeric(5,2) NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_groups_formateur ON public.groups(formateur_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_eleve ON public.group_members(eleve_id);
CREATE INDEX idx_sessions_group ON public.sessions(group_id);
CREATE INDEX idx_sessions_date ON public.sessions(date_seance);
CREATE INDEX idx_exercices_formateur ON public.exercices(formateur_id);
CREATE INDEX idx_exercices_point ON public.exercices(point_a_maitriser_id);
CREATE INDEX idx_resultats_eleve ON public.resultats(eleve_id);
CREATE INDEX idx_resultats_exercice ON public.resultats(exercice_id);
CREATE INDEX idx_devoirs_eleve ON public.devoirs(eleve_id);
CREATE INDEX idx_devoirs_formateur ON public.devoirs(formateur_id);
CREATE INDEX idx_alertes_formateur ON public.alertes(formateur_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_sous_sections_epreuve ON public.sous_sections(epreuve_id);
CREATE INDEX idx_points_sous_section ON public.points_a_maitriser(sous_section_id);
