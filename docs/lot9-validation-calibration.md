# Lot 9 — Calibration profils validation

**Date :** 7 juillet 2026  
**Commit :** `feat(validation): profiles legacy_bank + generated_strict`

## Contexte

L'audit strict initial (sans profil) rejetait **62,5 %** de la banque (388/621), principalement à cause de `missing_ce_text` et `correction_not_in_text`, alors que `hasUsableContent` est à 100 %.

Deux profils ont été introduits dans `validation-chain.ts` :

| Profil | Usage |
|--------|-------|
| `legacy_bank` | Audit / backfill des 621 exercices existants |
| `generated_strict` | Futurs exercices IA et Lot 8 (défaut) |

## Tableau comparatif (621 exercices)

| Profil | validated_auto | needs_review | rejected |
|--------|----------------|--------------|----------|
| **Baseline strict** (audit initial) | 185 (29,8 %) | 48 (7,7 %) | 388 (62,5 %) |
| **legacy_bank** | 372 (59,9 %) | 198 (31,9 %) | **51 (8,2 %)** |
| **generated_strict** | 203 (32,7 %) | 49 (7,9 %) | 369 (59,4 %) |

> `generated_strict` diffère légèrement de la baseline (−19 rejets) grâce au correctif VF : `correction_not_in_text` ne s'applique plus au format `vrai_faux`.

## Règles par profil

### legacy_bank

- `missing_ce_text` → **warning** si `hasUsableContent` (consigne + items[])
- `correction_not_in_text` → **warning**, sauf si erreur QCM structurelle (`qcm_no_options`, `qcm_answer_not_in_options`)
- `missing_audio_script` → **warning**
- Déduplication `missing_ce_text` L1+L2 (1 issue au lieu de 2)

### generated_strict

- Comportement strict inchangé pour la génération future
- `correction_not_in_text` uniquement pour `format === 'qcm'` (pas `vrai_faux`)

## Top issues restantes — legacy_bank (51 rejected)

| Code | Exercices rejected |
|------|-------------------|
| `qcm_no_options` | 100 |
| `qcm_answer_not_in_options` | 77 |
| `correction_not_in_text` | 66 (avec erreur QCM structurelle associée) |
| `vf_invalid_answer` | 16 |
| `EXCL_02_format_competence` | 13 |
| `item_no_answer` | 2 |
| `duration_volume_mismatch` | 2 |

Les warnings dominants (`consigne_too_long*`, `feedback_too_long`, `missing_ce_text`, `correction_not_in_text`) alimentent la file `needs_review` (198 ex.).

## Recommandation GO / NO-GO migration

| Critère | Seuil plan | legacy_bank | Verdict |
|---------|------------|-------------|---------|
| G3 taux `rejected` | < 15 % | **8,2 %** | ✅ GO |
| Pool utilisable (auto + review) | — | **91,8 %** | ✅ |
| `generated_strict` pour IA | strict | 59,4 % rejected sur legacy | ✅ attendu |

**Recommandation : GO conditionnel** pour appliquer la migration draft et backfill avec `profile: legacy_bank`. Conserver `generated_strict` comme barrière Lot 8 / génération IA.

## Exécution

```bash
npx vitest run validation-chain.test.ts          # 30 tests
npm run audit:validation -- --profile legacy_bank
npm run audit:validation -- --profile generated_strict
```

Rapports archivés dans `scripts/backups/validation-audit-{profile}-{timestamp}/`.
