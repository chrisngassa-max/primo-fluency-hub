# Rapport de passation Codex - CapTCF A2 audio

## 1. Resume executif

Le vertical slice CapTCF A2 audio est fonctionnel de bout en bout. Le lot de hardening A2 audio (5 correctifs + reserves de revue) a ete finalise, teste localement (Vitest + build + SQL Postgres) et prepare pour fusion de la PR `#27`.

## 2. Etat du chantier

- Worktree: `C:\Users\Sofiane\Documents\New project\primo-a2-cursor`
- Branche: `cursor/a2-audio-continuation`
- PR: `#27`
- Handoff anglais: `docs/handoffs/captcf-a2-audio-status-and-next-steps.md`
- Commit hardening: `1be5e53` (+ commit de cloture SQL/rapport si present)

## 3. Corrections de cloture appliquees

1. **Typage JSONB homogene** pour `published_source_stale_at` (plus de melange `timestamptz` / `text`) ; ancienne date stale non ecrasee par `null`.
2. **Test SQL transactionnel complete** : parcours succes + cas segment manquant / duplique / etranger / vide ; assertions stale exercice via `contenu.metadata.source_stale`.
3. **Provenance multi-chunks/multi-segments** : liaison couvrante (pas produit cartesien) ; code `DIFF_FACT_PROVENANCE_MISMATCH` conserve.
4. **Selection point de maitrise CO/A2** : niveaux `A0..C2` + normalisation `Pre-A1`/`Pré-A1` ; selection deterministe documentee comme rattachement generique.
5. **Publications obsoletes** : pas de suppression ; exercice marque `contenu.metadata.source_stale` / `source_stale_at` via `published_exercise_id`.

## 4. Resultats de validation locale (session de cloture)

| Controle | Resultat |
|---|---|
| Tests cibles (4 fichiers) | **20 passes** |
| Suite complete | **64 fichiers / 400 tests passes** (ref. anterieure 392) |
| Build Vite production | **OK** |
| Test SQL RPC | **OK** — Postgres 15 Docker (`CREATE FUNCTION` + assertions + `ROLLBACK`, notice `HARNESS_SQL_TEST_OK`, exit 0) |

Note: `npx supabase start` local echoue encore sur une migration ancienne (`003_placement_tests.sql` avant `profiles` — erreur `LegacyMigrationApplyError`). Le test SQL a ete execute et prouve via conteneur Postgres ephemere + schema minimal equivalent (pas une simple relecture du SQL). Artefacts harness sous `tmp/` non commités.

## 5. Controles serveur confirmes (non affaiblis)

- `analyze-pedagogical-source` : auth + formateur/admin + propriete (`SOURCE_FORBIDDEN`)
- `generate-differentiation-family` : audio + analyzed + utilisable/valide + transcription reviewed + hash + propriete
- `publish-differentiation-family` : famille validee + source prete + hash + transcription relue + point CO/A2 + double publication bloquee

## 6. Fichiers hors commit (volontaire)

- `content/curriculum/v2/S01-v3/exercices-interactifs.json`
- `pr27-body.md`
- `supabase/.temp/linked-project.json`
- artefacts tmp de harness SQL (`tmp/a2_audio_sql_*`)

## 7. Deploiement / E2E

A completer apres push : migration distante, redeploiement des 3 Edge Functions, replay MP3 authentifie. Verdict `GO fusion` uniquement si ces etapes reussissent.
