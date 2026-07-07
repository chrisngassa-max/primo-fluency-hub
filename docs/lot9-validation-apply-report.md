# Lot 9 — Rapport application validation (GO / NO-GO)

**Date :** 7 juillet 2026  
**Commit base :** `a07cb21`  
**Migration :** `supabase/migrations/20260708120000_exercices_validation_fields.sql`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**Profil backfill :** `legacy_bank` uniquement

## Résumé exécutif

| Verdict | **GO** |
|---------|--------|
| Migration SQL | ✅ Appliquée (COMMIT) |
| Backfill dry-run | ✅ Comptages identiques calibration |
| Backfill `--apply` | ✅ 621/621 lignes, 0 échec |
| Contrôles SQL post-apply | ✅ Tous conformes |

## 1. Revue migration (pré-apply)

Fichier `20260708120000_exercices_validation_fields.sql` vérifié :

| Élément | Détail |
|---------|--------|
| Colonnes | `validation_status`, `validation_score`, `validation_issues`, `validation_checked_at`, `validation_profile`, `validation_source`, `reviewed_by`, `reviewed_at` |
| CHECK `validation_status` | `draft`, `validated_auto`, `needs_review`, `rejected`, `approved_human` |
| CHECK `validation_score` | NULL ou 0–100 |
| CHECK `validation_profile` | NULL, `legacy_bank`, `generated_strict` |
| CHECK `validation_source` | NULL, `pipeline_auto`, `import`, `backfill`, `human`, `regeneration` |
| Index | `idx_exercices_validation_reuse` (partiel search-first) |
| Changements non prévus | Aucun |

Modification : `ROLLBACK` → `COMMIT` (ligne 63).

## 2. Application migration

**Méthode :** Supabase MCP `apply_migration`  
**Nom :** `exercices_validation_fields`  
**Résultat :** `success: true`

## 3. Backfill dry-run (post-migration)

```bash
npm run backfill:validation
```

| Métrique | Attendu | Dry-run | Écart |
|----------|---------|---------|-------|
| `bank_total` | 621 | **621** | 0 |
| `validated_auto` | 372 | **372** | 0 |
| `needs_review` | 198 | **198** | 0 |
| `rejected` | 51 | **51** | 0 |

Manifest : `scripts/backups/validation-backfill-legacy_bank-2026-07-07T20-42-31/`

**Décision :** comptages identiques → poursuite `--apply`.

## 4. Backfill apply

```bash
node --import tsx scripts/backfill-exercices-validation.mjs --apply
```

| Métrique | Valeur |
|----------|--------|
| `bank_total` | 621 |
| `validated_auto` | 372 |
| `needs_review` | 198 |
| `rejected` | 51 |
| Lignes mises à jour | **621** |
| Échecs | **0** |

Manifest : `scripts/backups/validation-backfill-legacy_bank-2026-07-07T20-42-50/`

## 5. Contrôles SQL post-apply (lecture seule)

### Agrégat banque legacy

| Métrique | Attendu | Résultat |
|----------|---------|----------|
| `bank_total` | 621 | **621** |
| `validation_profile = legacy_bank` | 621 | **621** |
| `validation_profile = generated_strict` | 0 | **0** |
| `validated_auto` | 372 | **372** |
| `needs_review` | 198 | **198** |
| `rejected` | 51 | **51** |
| `validation_issues IS NOT NULL` | 621 | **621** |
| `validation_checked_at IS NOT NULL` | 621 | **621** |
| `validation_source = backfill` | 621 | **621** |
| `draft` restants | 0 | **0** |

### Distribution par statut / profil

| validation_status | validation_profile | n |
|-------------------|-------------------|---|
| validated_auto | legacy_bank | 372 |
| needs_review | legacy_bank | 198 |
| rejected | legacy_bank | 51 |

## 6. Contraintes respectées

| Contrainte | Statut |
|------------|--------|
| `legacy_bank` uniquement (621 exercices banque) | ✅ |
| Jamais `generated_strict` sur backfill | ✅ (0 ligne) |
| Champs protégés non modifiés | ✅ (contenu, consigne, niveau_vise, competence, format, theme) |
| Pas de génération d'exercices | ✅ |
| Pas de Lot 8 / pedagogical_activities | ✅ |

## 7. Décision finale

**GO** — Lot 9 persistence validation appliqué avec succès en production.

Prochaines étapes suggérées (hors scope) :
- Revue manuelle des 51 exercices `rejected`
- Lot L10 : scoring search-first (`validation_score`)
- Activation index `idx_exercices_validation_reuse` pour routing
