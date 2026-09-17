# CAPTCF Lot 2A — Inventaire policies RLS (remote)

**Projet:** `gudcenhmzlcvhgbgklzw`  
**Généré:** 2026-09-17T21:50:32.101Z  
**Total policies:** 310 sur 119 tables (dont **113** avec rôle `{public}`)  

## Distribution des rôles policy

| Rôles | Count |
|---|---:|
| `authenticated` | 161 |
| `PUBLIC` | 113 |
| `service_role` | 36 |

## Counts par classe

| Classe | Count |
|---|---:|
| dependante_has_role | 93 |
| correcte_role_implicite_vers_explicite | 90 |
| a_conserver | 52 |
| destinee_service_role | 49 |
| trop_large_authenticated | 19 |
| conserver_sandbox_restrictive | 6 |
| hygiene_seulement | 1 |

## Note Lot 0.7

Lot 0.7 : **113** policies `{public}`. Phase A confirme **113** avec `polroles={}` ≡ `{public}` (pg_policies). Total remote **310** policies / 119 tables = 113 public + 161 authenticated + 36 service_role. Les 46 tables Lot 0.7 = tables portant au moins une policy `{public}` (pas le total tables RLS).

## Sandbox RESTRICTIVE (conserver — Lot 0.8B)

- `devoirs`.`Sandbox isolation` SELECT RESTRICTIVE
- `group_members`.`Sandbox isolation` SELECT RESTRICTIVE
- `groups`.`Sandbox isolation` SELECT RESTRICTIVE
- `profils_eleves`.`Sandbox isolation` SELECT RESTRICTIVE
- `resultats`.`Sandbox isolation` SELECT RESTRICTIVE
- `sessions`.`Sandbox isolation` SELECT RESTRICTIVE

## Trop larges (USING/CHECK true, hors service nommé)

- `checklist_states`.`Authenticated can insert checklist states` [INSERT] roles=authenticated anon_grant=none
- `cohort_enrollments`.`Authenticated can insert cohort enrollments` [INSERT] roles=authenticated anon_grant=none
- `dossiers`.`Authenticated can insert dossiers` [INSERT] roles=authenticated anon_grant=none
- `epreuves`.`Auth users read epreuves` [SELECT] roles=authenticated anon_grant=none
- `gabarits_pedagogiques`.`gabarits_select_authenticated` [SELECT] roles=authenticated anon_grant=none
- `lead_events`.`Authenticated can insert lead_events` [INSERT] roles=authenticated anon_grant=none
- `pedagogical_activities`.`pedagogical_activities_select_authenticated` [SELECT] roles=authenticated anon_grant=none
- `pedagogical_documents`.`pedagogical_documents_select_authenticated` [SELECT] roles=authenticated anon_grant=none
- `points_a_maitriser`.`Auth users read points` [SELECT] roles=authenticated anon_grant=none
- `readiness_config`.`readiness_config_read_authenticated` [SELECT] roles=authenticated anon_grant=none
- `sous_sections`.`Auth users read sous_sections` [SELECT] roles=authenticated anon_grant=none
- `sync_log`.`Auth users insert sync_log` [INSERT] roles=authenticated anon_grant=none
- `sync_log`.`Auth users read sync_log` [SELECT] roles=authenticated anon_grant=none
- `tcf_questions`.`Auth users read tcf_questions` [SELECT] roles=authenticated anon_grant=none
- `tcf_routing_rules`.`tcf_routing_rules_read_authenticated` [SELECT] roles=authenticated anon_grant=none
- `tcf_score_thresholds`.`tcf_score_thresholds_read_authenticated` [SELECT] roles=authenticated anon_grant=none
- `test_entree_items`.`Auth users read test items` [SELECT] roles=authenticated anon_grant=none
- `test_questions`.`Auth users read test_questions` [SELECT] roles=authenticated anon_grant=none
- `types_erreur`.`types_erreur_lecture_authentifiee` [SELECT] roles=authenticated anon_grant=none

## Destinées service_role

- `ai_processing_logs`.`service role deletes ai logs` [DELETE]
- `ai_processing_logs`.`service role inserts ai logs` [INSERT]
- `civic_facts`.`service_all_civic_facts` [ALL]
- `civic_questions`.`curriculum_service_all_civic_questions` [ALL]
- `cohort_resource_pins`.`curriculum_service_all_cohort_pins` [ALL]
- `correction_release_events`.`service_all_release_events` [ALL]
- `curriculum_publications`.`curriculum_service_all_publications` [ALL]
- `differentiation_families`.`service_all_differentiation_families` [ALL]
- `differentiation_family_feedback`.`service_all_differentiation_family_feedback` [ALL]
- `email_send_log`.`Service role can insert send log` [INSERT]
- `email_send_log`.`Service role can read send log` [SELECT]
- `email_send_log`.`Service role can update send log` [UPDATE]
- `email_send_state`.`Service role can manage send state` [ALL]
- `email_unsubscribe_tokens`.`Service role can insert tokens` [INSERT]
- `email_unsubscribe_tokens`.`Service role can mark tokens as used` [UPDATE]
- `email_unsubscribe_tokens`.`Service role can read tokens` [SELECT]
- `exercise_image_assets`.`curriculum_service_all_image_assets` [ALL]
- `exercise_variants`.`curriculum_service_all_variants` [ALL]
- `homework_generation_queue`.`service role manages queue` [ALL]
- `invariant_supports`.`curriculum_service_all_supports` [ALL]
- `pedagogical_source_chunk_segments`.`service_all_chunk_segments` [ALL]
- `pedagogical_source_chunks`.`service_all_pedagogical_source_chunks` [ALL]
- `pedagogical_source_transcription_segments`.`service_all_transcription_segments` [ALL]
- `pedagogical_source_transcriptions`.`service_all_pedagogical_source_transcriptions` [ALL]
- `pedagogical_sources`.`service_all_pedagogical_sources` [ALL]
- `placement_test_answers`.`placement_test_answers_service_all` [ALL]
- `placement_test_attempts`.`placement_test_attempts_service_all` [ALL]
- `placement_test_exports`.`placement_test_exports_service_all` [ALL]
- `placement_test_items`.`placement_test_items_service_all` [ALL]
- `placement_test_results`.`placement_test_results_service_all` [ALL]
- `placement_tests`.`placement_tests_service_all` [ALL]
- `readiness_config`.`readiness_config_service_write` [ALL]
- `readiness_snapshots`.`readiness_snapshots_service_all` [ALL]
- `readiness_snapshots`.`readiness_snapshots_service_insert` [INSERT]
- `resource_generation_batches`.`curriculum_service_all_batches` [ALL]
- `resource_generation_jobs`.`curriculum_service_all_jobs` [ALL]
- `session_activities`.`service_all_session_activities` [ALL]
- `session_document_links`.`curriculum_service_all_session_document_links` [ALL]
- `session_documents`.`curriculum_service_all_session_documents` [ALL]
- `session_pedagogical_sources`.`service_all_session_pedagogical_sources` [ALL]
- `session_resources`.`curriculum_service_all_resources` [ALL]
- `suppressed_emails`.`Service role can insert suppressed emails` [INSERT]
- `suppressed_emails`.`Service role can read suppressed emails` [SELECT]
- `sync_log`.`Service role manages sync_log` [ALL]
- `tcf_routing_rules`.`tcf_routing_rules_service_write` [ALL]
- `tcf_score_thresholds`.`tcf_score_thresholds_service_write` [ALL]
- `training_plan_versions`.`curriculum_service_all_plan_versions` [ALL]
- `training_sessions`.`curriculum_service_all_sessions` [ALL]
- `validation_reports`.`curriculum_service_all_validation_reports` [ALL]

## Suspectes critiques (true + GRANT anon)

_Aucune combo USING/CHECK true + GRANT anon détectée (confinement Lot 0.6)._

## Fichier machine

Voir `CAPTCF_LOT_02A_POLICIES_INVENTORY.json` (entrées complètes).
