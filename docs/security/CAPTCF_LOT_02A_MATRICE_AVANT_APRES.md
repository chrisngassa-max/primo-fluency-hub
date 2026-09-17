# CAPTCF Lot 2A — Matrice avant / après (proposée, non appliquée)

**Projet:** `gudcenhmzlcvhgbgklzw`  
**Statut:** Phase A diagnostic only — aucune mutation distante.

## has_role

| Acteur | Avant (remote vérifié) | Après sous-lot A1 (proposé) | Après sous-lot A2 Edge (proposé) |
|---|---|---|---|
| Signature SQL | `has_role(uid, target_role)` SECURITY DEFINER | idem (idempotent) | idem |
| Migration git | encore `_user_id,_role` (latent) | alignée `uid,target_role` via proposed | source of truth sync |
| Edge canoniques (`uid/target_role`) | OK | OK | OK |
| Edge legacy (`_user_id/_role`) | **cassés** (RPC named mismatch) → 403 faux négatif probable | toujours cassés si non redéployés | **corrigés** |
| Policies SQL positionnelles | OK | OK | OK |
| `auth.uid()` NULL | false | false | false |
| anon EXECUTE | accordé | à revoir (hygiène) | décision séparée |

### Appels Edge classés (Phase A)

| Style | Fichiers | Verdict |
|---|---|---|
| canonical `uid/target_role` | hash/transcribe/generate/publish/analyze-pedagogical-source ; resolve-exercise-audio-handler | OK remote |
| legacy `_user_id/_role` | curriculum-adapt ; curriculum-batch ; approve-student ; create-student ; reset-student-password ; update-student-credentials | **cassés actifs** |
| ambigu / mixte | — | 0 |
| latent | migration `20260317202908` si réappliquée | **latent** (casserait les Edge canoniques) |

## Policies `{public}` (113)

| Classe | Count | Avant | Après sous-lot proposé | Accès légitimes à risque |
|---|---:|---|---|---|
| correcte_role_implicite_vers_explicite | 90 | TO public + condition scoped | B1 → `TO authenticated` | aucun si GRANT anon=0 ; service_role bypass RLS |
| destinee_service_role | 13 | TO public + intent service | B2 → `TO service_role` | clients authenticated qui s’appuyaient sur la policy (ne devraient pas) |
| dependante_has_role | 3 | profiles + has_role sur public | B3 → `TO authenticated` | idem B1 |
| hygiene_seulement | 1 | public | B4 → `TO authenticated` | faible |
| conserver_sandbox_restrictive | 6 | RESTRICTIVE + public | **conserver** (Lot 0.8B) | ne pas DROP / ne pas convertir PERMISSIVE |
| trop_large_authenticated | 19 | déjà `TO authenticated` + true | **hors B1–B4** (revue métier séparée) | lecture/insert catalogue large |
| a_conserver (autres rôles) | 52 | authenticated / déjà OK | aucun changement 2A | — |

## Rôles × tables (échantillon critique)

| Table | anon | authenticated | service_role | Notes |
|---|---|---|---|---|
| profiles | no GRANT | scoped + has_role | bypass | B3 hygiène TO |
| devoirs / groups / sessions / … | no GRANT | métier + Sandbox RESTRICTIVE | bypass | Sandbox inchangé |
| placement_test_* | confiné Lot 0.5/0.6 | policies service_all | bypass | hors 2A urgence |
| catalogues (epreuves, …) | no GRANT | SELECT true | bypass | trop_large — revue ultérieure |

## Combinaison PERMISSIVE / RESTRICTIVE

Sur tables Sandbox : policies métier PERMISSIVE OR-combinées **puis** filtre RESTRICTIVE AND.  
Expression `(sandbox_session_id IS NULL) OR can_access_sandbox(...)` en RESTRICTIVE = **correcte** (Lot 0.8B).  
Ne jamais la convertir en PERMISSIVE.
