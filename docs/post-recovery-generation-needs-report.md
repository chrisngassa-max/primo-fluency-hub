# Besoins de génération post-recovery — CO préfecture

**Généré :** 2026-07-08T01:26:00+02:00  
**Commit de référence :** d7ba6cb (migration mini-lot CO préfecture appliquée)  
**Validation :** `node --import tsx scripts/pre-session-selection-ux-validation.mjs`  
**Artefact source :** `docs/pre-session-selection-ux-validation-report.md` (2026-07-07T23:25:49Z)  
**Mode :** read-only — 0 écriture Supabase, 0 génération IA, 0 migration appliquée  
**Banque lue :** 621 exercices `legacy_bank`

---

## Verdict exécutif

Le mini-lot CO préfecture (**1 backfill + 21 promotions `approved_human`**) a **résolu intégralement** les scénarios S2 et S3. Il reste **3 scénarios** en `generation_need` pour un **gap total de 14 exercices** — tous hors périmètre CO préfecture.

| État | Scénarios | Gap total |
|------|-----------|-----------|
| Résolus (plus de gen. need) | S1, **S2**, **S3**, S5 | 0 |
| Encore en gen. need | S4, S6, S7 | **14** |

---

## 1. Scénarios résolus

### S2 — A2 / CO / préfecture / quota 5 ✅

| Métrique | Avant mini-lot | Post-recovery | Statut |
|----------|----------------|---------------|--------|
| Retenus | 4/5 | **5/5** | ✅ |
| P1 pool | 4 | **26** | ✅ |
| Gap | 1 | **0** | ✅ |
| generation_need | oui | **non** | ✅ |
| generation_reason | PARTIAL_GAP | — | — |

**Cause résolue :** backfill `theme=prefecture` sur `634e81c6` + 21 promotions NR → `approved_human` (`human_recovery`). Le pool P1 est désormais confortable (26 éligibles).

### S3 — B1 / CO / préfecture / quota 5 ✅

| Métrique | Avant mini-lot | Post-recovery | Statut |
|----------|----------------|---------------|--------|
| Retenus | 0/5 | **5/5** | ✅ |
| P1 pool | 0 | **22** | ✅ |
| Gap | 5 | **0** | ✅ |
| generation_need | oui | **non** | ✅ |
| generation_reason | ALL_REJECTED_OR_STALE | — | — |

**Cause résolue :** même recovery — problème de métadonnées/scoring/validation, **pas un trou banque pur**. Repli NR interdit pour préfecture B1 ; les promotions `approved_human` ont débloqué la cellule.

### S1 — A1 / CE / quota 5 ✅

Déjà couvert avant recovery : 5/5, `generation_need=false`. Inchangé.

### S5 — A2 / Structures / quota 5 ✅

| Métrique | Valeur | Statut |
|----------|--------|--------|
| Retenus | 5/5 | ✅ |
| P1 pool | 15 | ✅ |
| Gap | 0 | ✅ |
| generation_need | **non** | ✅ |
| cellule P0 | oui (label) | couvert par banque |

**Note :** cellule marquée P0 dans le référentiel mais **quota couvert sans génération**. 16 VA en banque, 15 éligibles P1. Aucune action Lot 8 requise pour le scénario pré-session quota 5.

---

## 2. Scénarios encore en `generation_need`

| Scénario | Retenus | Gap | Raison | defer Lot 8 P0 | Severity |
|----------|---------|-----|--------|----------------|----------|
| **S4** B2 CE | 0/5 | 5 | `P0_CELL_ZERO_VA` | oui | critical |
| **S6** B1 EE | 1/5 | 4 | `PARTIAL_GAP` | non | critical |
| **S7** B2 Structures | 0/5 | 5 | `P0_CELL_ZERO_VA` | oui | critical |

**Total gap génération réel : 14 exercices** (5 + 4 + 5).

---

## 3. Vrais trous banque

### S7 — B2 / Structures (vrai trou intégral)

| Indicateur | Valeur |
|------------|--------|
| Candidats pré-scoring | **0** |
| VA en cellule | **0** |
| P1 pool | **0** |
| NR post-filtres | 0 |

**Verdict :** aucun exercice Structures B1/B2/B3 en banque passant les filtres dimensionnels. **Génération intégrale obligatoire** — aucun mini-lot recovery possible.

### S6 — B1 / EE (trou niveau + validation partiel)

| Indicateur | Valeur |
|------------|--------|
| Candidats pré-scoring | 15 (tous **A2**, aucun B1) |
| VA en cellule | 5 |
| P1 pool | 1 |
| Retenu actuel | 1 VA A2 (`e0e77170`, score 100) |

**Verdict :** **trou niveau B1** — 0 exercice EE B1 en banque. Les 15 candidats dimensionnels sont A2. Le repli NR (max 1/5 = 30 %) ne peut pas combler un gap de 4. **Génération B1 EE requise** pour ≥4 exercices.

### S4 — B2 / CE (trou validation, pas trou dimensionnel pur)

| Indicateur | Valeur |
|------------|--------|
| Candidats pré-scoring | 12 (tous **B1**, 0 B2) |
| VA en cellule | **0** |
| NR post-filtres | 12 (11 rouge, 1 orange) |

**Verdict :** contenu **latent** en banque (12 NR B1 CE) mais **zéro VA**. Ce n'est pas un trou dimensionnel absolu — c'est un **trou de validation + désalignement niveau** (B1 vs cible B2). Sans promotion NR ou génération B2, la cellule reste bloquée P0.

---

## 4. Écarts partiels (recovery métadonnées insuffisante)

### S6 — B1 / EE — `PARTIAL_GAP`

| Levier recovery | Potentiel | Limite |
|-----------------|-----------|--------|
| Backfill niveau A2→B1 sur existants | Faible | 4 VA A2 scorent 60 (<80) — écart SCORE_03 vs SCORE_04 |
| Promotion NR tier vert (9 NR) | Max +1 retenu | Plafond repli NR 30 % du quota |
| Génération B1 EE | **+4 requis** | Seul levier pour combler gap 4 |

**Conclusion :** métadonnées seules **ne suffisent pas** — le trou niveau B1 domine.

### S4 — B2 / CE — classé P0 mais contenu latent

| Levier recovery | Potentiel | Limite |
|-----------------|-----------|--------|
| Promotion NR B1 CE (12 candidats, score 60) | Jusqu'à 5 si validés | Tous niveau B1, pas B2 ; 11/12 tier rouge |
| Reclassement niveau B1→B2 | Risqué | Contenu pédagogique B1, cible B2 |
| Génération B2 CE | **+5 requis** (quota pré-session) | Aligné plan Lot 8 pilote |

**Conclusion :** mini-lot validation NR **possible en parallèle** du pilote Lot 8 B2 CE, mais ne remplace pas la génération cible B2.

---

## 5. Corrections métadonnées encore utiles (hors gen. need immédiat)

| Périmètre | Action | Impact gen. need | Priorité |
|-----------|--------|------------------|----------|
| 3 VA CO A2 sans thème (`7132a092`, `33a9ed74`, `a4dfbdf1`) | Backfill `theme` si thème IRN identifiable | **Aucun** — S2/S3 déjà 5/5 | Basse (enrichissement pool) |
| 4 NR ambigus L7 CO préfecture (`16ea8cbd`, `73fa072e`, `5e1834e3`, `c27c0b88`) | Corrections L7 puis promotion | **Aucun** — pool déjà >20 | Moyenne (qualité banque) |
| 12 NR B1 CE (S4) | Validation + éventuel reclassement niveau | Peut réduire gap S4 partiellement | Haute (recovery avant gen.) |
| 4 VA A2 EE (S6) | Backfill niveau/thème | Réduit gap de 0–1 max (score 60) | Moyenne |
| 9 NR tier vert EE A2 (S6) | Promotion `validated_auto` | +1 retenu max (repli NR) | Moyenne |

**Aucune correction métadonnée résiduelle ne remplace la génération Lot 8 pour S7 (B2 Structures).**

---

## 6. Ce qui requiert vraiment Lot 8

| Cellule | Exercices à générer (quota pré-session) | Plan Lot 8 P0 (cible banque) | Type |
|---------|----------------------------------------|------------------------------|------|
| **B2 CE** | 5 | +14 (pilote validé) | Génération + validation `generated_strict` |
| **B1 EE** | 4 | +20 | Génération B1 (trou niveau) |
| **B2 Structures** | 5 | +15 | Génération intégrale (trou absolu) |
| **Total pré-session** | **14** | +49 (3 cellules) | — |

**Hors Lot 8 immédiat :** S2/S3 CO préfecture, S5 A2 Structures, S1 A1 CE — **aucune génération**.

---

## 7. Vérification ciblée (6 scénarios demandés)

| Scénario | Retenus | Gen. need | Verdict |
|----------|---------|-----------|---------|
| **A2 CO préfecture** (S2) | 5/5 | **non** | ✅ Résolu par mini-lot |
| **B1 CO préfecture** (S3) | 5/5 | **non** | ✅ Résolu par mini-lot |
| **A2 Structures** (S5) | 5/5 | **non** | ✅ Couvert banque (P0 label, pool=15) |
| **B2 CE** (S4) | 0/5 | **oui** | ❌ 0 VA, 12 NR B1 latents — Lot 8 P0 |
| **B1 EE** (S6) | 1/5 | **oui** | ❌ Trou niveau B1 — gen. 4 EE |
| **B2 Structures** (S7) | 0/5 | **oui** | ❌ Trou absolu — gen. 5 Structures |

---

## 8. Recommandation priorisée — prochain lot

### Option A — Lot 8 pilote B2 CE (recommandé)

**Priorité 1.** Aligné avec `docs/lot8-p0-plan.md` (décision opérationnelle : pilote B2 CE +14).

| Étape | Action | Gap couvert |
|-------|--------|-------------|
| 1 | Dry-run script pilote B2 CE (`generated_strict`) | — |
| 2 | Générer + valider 5–14 CE B2 thématisés IRN | S4 : 0→5/5 |
| 3 | En parallèle : audit recovery 12 NR B1 CE (promotion ciblée) | Réduction risque / enrichissement pool |

**Justification :** S4 est P0 bloquant (`defer_to_lot8_p0=true`), contenu latent insuffisant (0 VA), plan Lot 8 déjà cadré.

### Option B — Mini-lot recovery B1 CE (pré-gen., non bloquant seul)

Audit promotion des 12 NR B1 CE avant ou en parallèle du pilote. **Ne remplace pas** la génération B2 — reclassement B1→B2 pédagogiquement discutable.

### Option C — Lot 8 B2 Structures (après pilote B2 CE)

**Priorité 2.** Trou absolu (0 candidat). 5 exercices minimum pour quota pré-session, 15 pour cible P0 banque.

### Option D — Lot 8 B1 EE (après B2 CE ou en parallèle)

**Priorité 3.** Gap 4, trou niveau. Recovery métadonnées A2→B1 ne comble pas le gap (score + plafond NR).

### Séquence recommandée

```
1. Lot 8 pilote B2 CE (+5 min. pré-session, +14 cible P0)
2. Lot 8 B2 Structures (+5 min., +15 cible P0)
3. Lot 8 B1 EE (+4 min., +20 cible P0)
4. Mini-lot recovery NR B1 CE (optionnel, enrichissement)
5. Corrections L7 sur 4 NR ambigus CO préfecture (qualité, non bloquant)
```

---

## 9. Bilan recovery CO préfecture

| Métrique | Avant | Après |
|----------|-------|-------|
| Scénarios gen. need | 5 (S2,S3,S4,S6,S7) | **3** (S4,S6,S7) |
| Gap total gen. need | 20 | **14** |
| Exercices CO préfecture gen. need | 6 (S2:1 + S3:5) | **0** |
| Réduction gap | — | **−6 (−30 %)** |

Le mini-lot a prouvé le modèle **recovery métadonnées + validation humaine avant génération** pour les cellules à contenu latent. Les 3 scénarios restants nécessitent **génération Lot 8** (trous validation/niveau/absolus).

---

## 10. Références

- Migration appliquée : `supabase/migrations/20260708150000_bank_recovery_co_prefecture.sql`
- Rapport post-apply : `docs/bank-recovery-co-prefecture-post-apply-report.md`
- Validation UX : `docs/pre-session-selection-ux-validation-report.md`
- Diagnostic gen. need (pré-recovery) : `docs/pre-session-generation-need-diagnosis.md`
- Plan Lot 8 P0 : `docs/lot8-p0-plan.md`

---

_Rapport généré après re-calcul read-only post mini-lot CO préfecture — aucune écriture Supabase, aucune génération._
