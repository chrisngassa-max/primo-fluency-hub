# Rapport de passation Codex - CapTCF A2 audio

## 1. Resume executif

Le lot de hardening A2 audio est **clos**. Correctifs fonctionnels inchanges ; preuves de reproductibilite regularisees : migration additive `SECURITY DEFINER` appliquee a distance, artefact E2E post-hardening avec `ok: true`, PR #27 alignee.

## 2. Etat

- Worktree: `C:\Users\Sofiane\Documents\New project\primo-a2-cursor`
- Branche: `cursor/a2-audio-continuation`
- PR: `#27` — https://github.com/chrisngassa-max/primo-fluency-hub/pull/27
- Projet Supabase: `gudcenhmzlcvhgbgklzw`
- HEAD: `18754d8` — `fix(a2): finalize review RPC security and closure evidence`

## 3. Validations locales

| Controle | Resultat |
|---|---|
| Tests cibles (4 fichiers) | **20 passes** |
| Suite complete | **64 fichiers / 400 tests** |
| Build Vite | **OK** |
| Test SQL RPC | **OK** (Postgres Docker `a2-audio-sql-test`, `HARNESS_SQL_TEST_OK`, ROLLBACK) |
| Migration additive locale | `20260728140000_a2_audio_review_rpc_security.sql` |

Note: `npx supabase start` echoue toujours sur `003_placement_tests.sql` (avant `profiles`). Contournement: conteneur Postgres ephemere + schema minimal.

## 4. Deploiement / migrations distantes

- Migration initiale: `a2_audio_review_fixes` (`20260728104942`)
- Follow-up deja present: `a2_audio_review_rpc_security_definer` (`20260728114445`)
- Migration additive de cloture appliquee: **`a2_audio_review_rpc_security`** (`20260728120210`)
  - `SECURITY DEFINER` + `search_path=public`
  - `REVOKE` PUBLIC/anon ; `GRANT EXECUTE` authenticated/service_role
- Fonctions ACTIVE: `analyze-pedagogical-source`, `generate-differentiation-family`, `publish-differentiation-family`

## 5. Preuves E2E (distinguer les trois niveaux)

### E2E initial du slice
Parcours MP3 authentifie (upload → hash → transcription Gemini → revue → analyse → generation A2 → validation → publication) sur fixture `a2-sample-jeu-cropolis.mp3`.

### E2E post-hardening (artefact final)
Replay final du **2026-07-28T17:00:17Z** (UTC) — artefact `tmp/a2_e2e_replay_result.json`, exit code **0** :

```json
{
  "ok": true,
  "source_imported": true,
  "source_a_remplacer": true,
  "published_source_stale": true,
  "has_stale_at": true,
  "chunks_deleted": true,
  "published_family_kept": true,
  "exercise_stale": true,
  "generate_blocked": true,
  "publish_blocked": true,
  "foreign_analyze_forbidden": true,
  "foreign_review_forbidden": true
}
```

- Exercice anonymise: `284f90b4-…82b5` (famille `bf85cad6-…74c4`, source `7a4a2a1c-…42e3`)
- Seconde revue → invalidation stale → generation bloquee `SOURCE_NOT_ANALYZED` → republication bloquee
- Controles inter-formateur: analyse HTTP 403 `SOURCE_FORBIDDEN` + RPC review `SOURCE_FORBIDDEN`

### Test d'idempotence FAMILY_ALREADY_PUBLISHED
Le HTTP **409** `FAMILY_ALREADY_PUBLISHED` (avec `exercise_id`) n'est **pas** un echec global : c'est le **garde-fou double publication** reussi. Documente separement de l'E2E post-hardening vert.

## 6. Hors commit

- `content/curriculum/v2/S01-v3/exercices-interactifs.json`
- `pr27-body.md`
- `supabase/.temp/linked-project.json`
- `tmp/*` (fixtures, harness, scripts E2E, artefact, identifiants de test)

## 7. Verdict

**GO fusion** — sous reserve que le commit de cloture soit pousse et que l'artefact E2E final reste `ok: true` avec la migration additive presente a distance.
