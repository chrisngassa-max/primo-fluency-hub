export type CurriculumBatchEtat =
  | "pending"
  | "preflight_failed"
  | "running"
  | "paused"
  | "published_complete"
  | "published_partial"
  | "needs_attention"
  | "failed";

export type CurriculumJobStatut =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "quarantined";

export type CurriculumResourceStatut =
  | "planned"
  | "preflight_passed"
  | "generating"
  | "generated"
  | "deterministic_checked"
  | "ai_reviewed"
  | "publishable"
  | "published"
  | "quarantined"
  | "superseded"
  | "unpublished";

export interface TrainingPlanVersion {
  id: string;
  version: string;
  statut: "draft" | "active" | "archived";
  heures_a2: number;
  heures_b1: number;
  heures_b2: number;
}

export interface ResourceGenerationBatch {
  id: string;
  plan_version_id: string;
  configuration: Record<string, unknown>;
  cout_estime_eur: number | null;
  cout_reel_eur: number | null;
  etat: CurriculumBatchEtat;
  compteurs: Record<string, unknown>;
  rapport: Record<string, unknown>;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceGenerationJob {
  id: string;
  batch_id: string;
  session_code: string;
  resource_id: string;
  tentative: number;
  statut: CurriculumJobStatut;
  erreurs: unknown[];
  idempotency_key: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TrainingSession {
  id: string;
  plan_version_id: string;
  code: string;
  ordre: number;
  titre: string;
  palier: string;
  duree_minutes?: number;
  statut: CurriculumResourceStatut;
}

export interface SessionResource {
  id: string;
  session_id: string;
  resource_id: string;
  kind: string;
  version: number;
  chemin: string | null;
  mime: string | null;
  hash: string | null;
  statut: CurriculumResourceStatut;
  published_at: string | null;
  metadata: Record<string, unknown>;
  previous_resource_version_id: string | null;
}

export interface ValidationReport {
  id: string;
  session_resource_id: string | null;
  validateur: "deterministic" | "ai_review";
  modele: string | null;
  scores: Record<string, unknown>;
  bloquants: unknown[];
  rapport: Record<string, unknown>;
  created_at: string;
}

export interface CurriculumPublication {
  id: string;
  plan_version_id: string;
  session_resource_id: string;
  version: number;
  published_at: string;
  published_by: string;
  previous_publication_id: string | null;
}

export interface SessionManifestEntry {
  session_code: string;
  ordre: number;
  titre: string;
  palier: string;
  kind: string;
}

export interface SessionProgressRow {
  session_code: string;
  titre: string;
  palier: string;
  ordre: number;
  generated: number;
  validated: number;
  published: number;
  quarantined: number;
  total_resources: number;
  job_statut: CurriculumJobStatut | null;
  last_error: string | null;
  version_mismatch: boolean;
}

export interface CostEstimate {
  session_count: number;
  cout_estime_eur: number;
  plafond_eur: number;
  providers: Record<string, string>;
  stubbed: boolean;
}

export interface BatchStatusResponse {
  batch: ResourceGenerationBatch;
  jobs: ResourceGenerationJob[];
  session_progress: SessionProgressRow[];
  global: {
    total_sessions: number;
    generated: number;
    validated: number;
    published: number;
    quarantined: number;
    progress_pct: number;
  };
}

export interface AggregatedLearnerError {
  competence: string;
  taxonomy: string;
  count: number;
}

export interface CurriculumAdaptRequest {
  sessionId: string;
  trainingSessionId: string;
  sessionCode: string;
  palierCible?: string;
  phase?: string;
  eleveIds?: string[];
  aggregatedErrors?: AggregatedLearnerError[];
  exercicesNonTraites?: string[];
  tempsRestantMin?: number;
}

export interface CurriculumAdaptRecommendation {
  type: string;
  description: string;
  resource_id?: string;
  duree_minutes?: number;
}

export interface CurriculumAdaptDerouleAdjustment {
  phase: string;
  action: string;
  duree_delta_min?: number;
}

export interface CurriculumAdaptResult {
  analyse: string;
  recommandations: CurriculumAdaptRecommendation[];
  resource_ids: string[];
  variantes_par_niveau: Record<string, string>;
  ajustements_deroule: CurriculumAdaptDerouleAdjustment[];
  message_formateur: string;
}

export interface PublishedResourceUsed {
  id: string;
  resource_id: string;
  kind: string;
}

export interface CurriculumAdaptResponse {
  adaptation: CurriculumAdaptResult;
  published_resources_used: PublishedResourceUsed[];
  degraded_mode: boolean;
  message?: string;
  excludedIds?: string[];
  error?: string;
}

// ------------------------------------------------------------
// Documents de séance (MVP éditeur) — table session_documents,
// distincte du pipeline session_resources : brouillons formateur
// éditables en direct, jamais exposés aux élèves.
// ------------------------------------------------------------
export type SessionDocumentType =
  | "fiche_formateur"
  | "fiche_apprenant"
  | "dialogue_transcription"
  | "audio_mp3"
  | "qcm_tcf"
  | "qcm_civique"
  | "corrige_formateur"
  | "lexique"
  | "support_visuel"
  | "document_transforme"
  | "document_importe"
  | "exercice_interactif";

export type SessionDocumentStatus =
  | "brouillon"
  | "a_completer"
  | "relu"
  | "valide"
  | "remplace";

export interface SessionDocument {
  id: string;
  session_code: string;
  document_type: SessionDocumentType;
  title: string;
  level: string | null;
  competence: string[];
  status: SessionDocumentStatus;
  content_html: string | null;
  content_json: Record<string, unknown> | null;
  source_file_path: string | null;
  file_url: string | null;
  version: number;
  updated_at: string;
}

export const SESSION_DOCUMENT_TYPE_LABELS: Record<SessionDocumentType, string> = {
  fiche_formateur: "Fiche Formateur",
  fiche_apprenant: "Fiche Apprenant",
  dialogue_transcription: "Dialogue / Transcription",
  audio_mp3: "Audio (MP3)",
  qcm_tcf: "QCM TCF",
  qcm_civique: "QCM Civique",
  corrige_formateur: "Corrigé Formateur",
  lexique: "Lexique",
  support_visuel: "Support Visuel",
  document_transforme: "Document Transformé",
  document_importe: "Document Importé",
  exercice_interactif: "Exercice Interactif",
};

export const SESSION_DOCUMENT_STATUS_LABELS: Record<SessionDocumentStatus, string> = {
  brouillon: "Brouillon",
  a_completer: "Socle à compléter",
  relu: "Relu",
  valide: "Validé",
  remplace: "Remplacé",
};
