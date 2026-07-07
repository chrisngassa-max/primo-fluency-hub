# Rapport UX / data validation — PreSessionSelectionReport

**Généré :** 2026-07-07T21:59:48.364Z
**Commit de référence :** 15073de (banque Supabase réelle via `fetchPreSessionBankCandidates`)
**Mode :** read-only — 0 écriture Supabase, 0 génération IA
**Banque lue (globale) :** 621 exercices `legacy_bank`

## Synthèse

| Scénario | Banque | Retenus | P1 | P2 | Gap | Gen. need | Human review | Conformité |
|----------|--------|---------|----|----|-----|-----------|--------------|------------|
| A1 / CE / quota 5 | 621 | 5/5 | 5 | 0 | 0 | non | 1 | ✅ |
| A2 / CO / prefecture / quota 5 | 621 | 4/5 | 4 | 0 | 1 | oui | 1 | ✅ |
| B1 / CO / prefecture / quota 5 | 621 | 0/5 | 0 | 0 | 5 | oui | 0 | ✅ |
| B2 / CE / quota 5 | 621 | 0/5 | 0 | 0 | 5 | oui | 2 | ✅ |
| A2 / Structures / quota 5 | 621 | 5/5 | 5 | 0 | 0 | non | 1 | ✅ |
| B1 / EE / quota 5 | 621 | 1/5 | 1 | 0 | 4 | oui | 1 | ✅ |
| B2 / Structures / quota 5 | 621 | 0/5 | 0 | 0 | 5 | oui | 1 | ✅ |

## Détail par scénario

### S1 — A1 / CE / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 5 / 5 |
| P1 count | 5 |
| P2 count used | 0 |
| P1 pool (éligibles) | 127 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | true |
| VA en banque (cellule) | 200 |
| cellule P0 | non |
| remaining_gap | 0 |
| generation_need | false |
| generation total_gap | 0 |
| generation reason | — |
| defer_to_lot8_p0 | non |
| severity | none |
| human_review_items | 1 |
| human_review types | AMBIGUOUS_CORRECTION_NEARBY |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 291
- `EXCL_SCORE_LOW` : 73
- `EXCL_NR_TIER_ROUGE` : 58
- `EXCL_VALIDATION_REJECTED` : 26
- `EXCL_NR_THEME_SENSIBLE` : 26

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S2 — A2 / CO / prefecture / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 4 / 5 |
| P1 count | 4 |
| P2 count used | 0 |
| P1 pool (éligibles) | 4 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | true |
| VA en banque (cellule) | 53 |
| cellule P0 | non |
| remaining_gap | 1 |
| generation_need | true |
| generation total_gap | 1 |
| generation reason | PARTIAL_GAP |
| defer_to_lot8_p0 | non |
| severity | partial |
| human_review_items | 1 |
| human_review types | AMBIGUOUS_CORRECTION_NEARBY |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 491
- `EXCL_SCORE_LOW` : 49
- `EXCL_NR_TIER_ROUGE` : 28
- `EXCL_NR_THEME_SENSIBLE` : 25
- `EXCL_NIVEAU` : 15

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S3 — B1 / CO / prefecture / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 0 / 5 |
| P1 count | 0 |
| P2 count used | 0 |
| P1 pool (éligibles) | 0 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | false |
| VA en banque (cellule) | 8 |
| cellule P0 | non |
| remaining_gap | 5 |
| generation_need | true |
| generation total_gap | 5 |
| generation reason | ALL_REJECTED_OR_STALE |
| defer_to_lot8_p0 | non |
| severity | partial |
| human_review_items | 0 |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 491
- `EXCL_NIVEAU` : 59
- `EXCL_NR_TIER_ROUGE` : 28
- `EXCL_NR_THEME_SENSIBLE` : 28
- `EXCL_SCORE_LOW` : 8

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S4 — B2 / CE / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 0 / 5 |
| P1 count | 0 |
| P2 count used | 0 |
| P1 pool (éligibles) | 0 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | false |
| VA en banque (cellule) | 0 |
| cellule P0 | oui |
| remaining_gap | 5 |
| generation_need | true |
| generation total_gap | 5 |
| generation reason | P0_CELL_ZERO_VA |
| defer_to_lot8_p0 | oui |
| severity | critical |
| human_review_items | 2 |
| human_review types | NR_TIER_ROUGE_SKIPPED, P0_BLOCKING |

**Exclusions principales :**
- `EXCL_NIVEAU` : 316
- `EXCL_COMPETENCE` : 291
- `EXCL_NR_THEME_SENSIBLE` : 6
- `EXCL_NR_TIER_ROUGE` : 6
- `EXCL_FORMAT` : 2

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S5 — A2 / Structures / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 5 / 5 |
| P1 count | 5 |
| P2 count used | 0 |
| P1 pool (éligibles) | 15 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | true |
| VA en banque (cellule) | 16 |
| cellule P0 | oui |
| remaining_gap | 0 |
| generation_need | false |
| generation total_gap | 0 |
| generation reason | — |
| defer_to_lot8_p0 | non |
| severity | none |
| human_review_items | 1 |
| human_review types | AMBIGUOUS_CORRECTION_NEARBY |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 600
- `EXCL_NR_TIER_ROUGE` : 3
- `EXCL_VALIDATION_REJECTED` : 2
- `EXCL_SCORE_LOW` : 1

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S6 — B1 / EE / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 1 / 5 |
| P1 count | 1 |
| P2 count used | 0 |
| P1 pool (éligibles) | 1 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | true |
| VA en banque (cellule) | 5 |
| cellule P0 | oui |
| remaining_gap | 4 |
| generation_need | true |
| generation total_gap | 4 |
| generation reason | PARTIAL_GAP |
| defer_to_lot8_p0 | non |
| severity | critical |
| human_review_items | 1 |
| human_review types | P0_BLOCKING |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 554
- `EXCL_NIVEAU` : 52
- `EXCL_NR_THEME_SENSIBLE` : 9
- `EXCL_SCORE_LOW` : 4
- `EXCL_NR_TIER_ROUGE` : 1

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

### S7 — B2 / Structures / quota 5

| Métrique | Valeur |
|----------|--------|
| total banque lue | 621 |
| retained count | 0 / 5 |
| P1 count | 0 |
| P2 count used | 0 |
| P1 pool (éligibles) | 0 |
| P2 pool vert | 0 |
| P2 pool orange | 0 |
| nr_fallback_allowed | false |
| VA en banque (cellule) | 0 |
| cellule P0 | oui |
| remaining_gap | 5 |
| generation_need | true |
| generation total_gap | 5 |
| generation reason | P0_CELL_ZERO_VA |
| defer_to_lot8_p0 | oui |
| severity | critical |
| human_review_items | 1 |
| human_review types | P0_BLOCKING |

**Exclusions principales :**
- `EXCL_COMPETENCE` : 600
- `EXCL_NIVEAU` : 21

**Conformité règles :**
- Pas de rejected dans retained : ✅
- Pas de NR rouge dans retained : ✅
- P2 ≤ 30 % du quota : ✅
- Pas de repli NR auto prefecture B1/B2 : ✅

## Conclusion globale

Tous les scénarios respectent les règles de conformité vérifiées.

---
_Rapport généré par `scripts/pre-session-selection-ux-validation.mjs` — validation read-only Lot 9._