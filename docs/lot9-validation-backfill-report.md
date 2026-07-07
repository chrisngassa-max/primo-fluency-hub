# Lot 9 — Rapport backfill validation (GO / NO-GO)

**Date :** 7 juillet 2026  
**Script :** `scripts/backfill-exercices-validation.mjs`  
**Migration :** `supabase/migrations/20260708120000_exercices_validation_fields.sql` (ROLLBACK par défaut)  
**Profil backfill :** `legacy_bank` uniquement

## Résumé exécutif

| Verdict | **GO conditionnel** |
|---------|---------------------|
| Migration SQL | Prête, **non appliquée** |
| Backfill dry-run | ✅ Comptages conformes calibration |
| Backfill `--apply` | ⛔ **Bloqué** tant que migration non COMMIT |

## Dry-run (7 juillet 2026, 20:35 UTC)

```bash
npm run backfill:validation
```

| Métrique | Attendu (calibration) | Dry-run | Écart |
|----------|----------------------|---------|-------|
| `bank_total` | 621 | **621** | 0 |
| `validated_auto` | 372 (59,9 %) | **372** | 0 |
| `needs_review` | 198 (31,9 %) | **198** | 0 |
| `rejected` | 51 (8,2 %) | **51** | 0 |

Manifest archivé : `scripts/backups/validation-backfill-legacy_bank-2026-07-07T20-35-59/`

## Critères GO / NO-GO

| Critère | Seuil | Résultat | Verdict |
|---------|-------|----------|---------|
| G1 Comptage banque | 621 | 621 | ✅ |
| G2 Alignement calibration | 372 / 198 / 51 | 372 / 198 / 51 | ✅ |
| G3 Taux `rejected` | < 15 % | **8,2 %** | ✅ |
| G4 Pool utilisable (auto + review) | > 85 % | **91,8 %** | ✅ |
| G5 Profil backfill | `legacy_bank` seul | enforced (erreur si `generated_strict`) | ✅ |
| G6 Champs protégés | jamais modifiés | contenu, consigne, niveau_vise, competence, format, theme | ✅ |
| G7 Migration appliquée | requise avant `--apply` | **Non** | ⏸️ en attente |

## Livrables phase prep

| Fichier | Statut |
|---------|--------|
| `DRAFT_20260708100000_exercices_validation_fields.sql` | Revu — `validation_profile` ajouté |
| `20260708120000_exercices_validation_fields.sql` | Créé — ROLLBACK par défaut |
| `scripts/backfill-exercices-validation.mjs` | Créé — dry-run défaut |
| `package.json` → `backfill:validation` | Ajouté |
| Ce rapport | GO conditionnel |

## Colonnes persistées par `--apply`

- `validation_status`
- `validation_score` (nullable — L10 différé)
- `validation_issues` (jsonb)
- `validation_checked_at`
- `validation_profile` (`legacy_bank`)
- `validation_source` (`backfill`)

## Séquence recommandée (post-GO)

1. **Appliquer migration** — remplacer `ROLLBACK` par `COMMIT` dans `20260708120000_exercices_validation_fields.sql`, puis `supabase db push` (ou MCP execute_sql)
2. **Vérifier** — `SELECT count(*) FROM exercices WHERE validation_status = 'draft' AND is_template = false AND eleve_id IS NULL` → 621
3. **Backfill apply** — `node --import tsx scripts/backfill-exercices-validation.mjs --apply`
4. **Contrôle post-apply** — distribution 372 / 198 / 51, 0 ligne avec `validation_profile != 'legacy_bank'`

## Décision

**GO conditionnel** pour appliquer la migration et exécuter le backfill `--apply`.

Conditions :
- Conserver `generated_strict` comme barrière Lot 8 / génération IA
- Ne pas lancer `--apply` avant COMMIT migration
- Rejeter manuellement ou corriger les 51 exercices `rejected` en phase ultérieure (hors scope Lot 9 prep)

## Commandes de référence

```bash
# Dry-run (défaut — 0 écriture)
npm run backfill:validation

# Audit comparatif (lecture seule)
npm run audit:validation -- --profile legacy_bank

# Tests unitaires
npx vitest run validation-chain.test.ts

# Apply (INTERDIT en phase prep — après migration uniquement)
# node --import tsx scripts/backfill-exercices-validation.mjs --apply
```
