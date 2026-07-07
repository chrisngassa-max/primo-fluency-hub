# Rapport mini-lot récupération banque — préfecture CO

**Généré :** 2026-07-07T22:58:44.052Z
**Commit :** 9630f48
**Mode :** read-only — 0 écriture Supabase, 0 backfill appliqué, 0 génération
**Banque lue :** 621 exercices
**Seuil réutilisation :** REUSE_SCORE_MIN = 80

## Synthèse exécutive (FR)

| Lot | Candidats | Action |
|-----|-----------|--------|
| Backfill `theme=prefecture` | 1 VA | Métadonnées seules — gain scoring immédiat |
| Promotion `approved_human` | 21 NR recommandés | Débloquer repli sensible préfecture B1/A2 |

**Verdict lot :** GO — Lot métadonnées + validation préfecture CO justifié avant toute génération B1/A2.

## 1. Candidats backfill `theme=prefecture`

Critères : CO, niveau A2/B1, `validated_auto`, score 60 vs scénario préfecture, thème absent, texte administratif (mots-clés préfecture/mairie/OFII/dossier…).

| ID | Titre | Niv. | Thème actuel | Justification | Score actuel | Score après backfill (B1) | Score après backfill (A2) |
|----|-------|------|--------------|---------------|--------------|---------------------------|---------------------------|
| `634e81c6` | QCM : Démarches administratives en France | B1 | — | Mots-clés : prefecture, recepisse, récépissé, dossier… | 60 | 100 | 100 |

## 2. Candidats promotion `approved_human` (NR préfecture A2/B1, score 100)

Critères : `needs_review`, thème canonique `prefecture`, niveau A2 ou B1, CO, score ≥ 80 vs scénario cible.

| ID | Titre | Niv. | Comp. | Tier NR | Issues principales | Priorité | Recommandation | Score B1 | Score A2 |
|----|-------|------|-------|---------|-------------------|----------|----------------|----------|----------|
| `16ea8cbd` | Identifier les verbes du présent dans un | A2 | CO | rouge | missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); feedback_too_long(warning/L6_pedagogie); ambiguous_correction(warning/L7_correction) | P0 | **needs_review** | 100 | 100 |
| `73fa072e` | Le pronom EN - Contexte alimentaire et C | A2 | CO | rouge | missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); ambiguous_correction(warning/L7_correction) | P0 | **needs_review** | 100 | 100 |
| `5e1834e3` | Demande de logement social à la CAF | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); ambiguous_correction(warning/L7_correction); ambiguous_correction(warning/L7_correction) | P0 | **needs_review** | 100 | 100 |
| `c27c0b88` | Expressions de l'avis et conseils à la p | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); ambiguous_correction(warning/L7_correction) | P0 | **needs_review** | 100 | 100 |
| `fb7f5239` | Comprendre une enquête à la préfecture | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `12ede1af` | Comprendre une demande administrative à  | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `3136af07` | Comprendre une demande administrative à  | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `5448c46f` | Demande de logement social à la mairie | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `06be5180` | Comprendre une demande administrative à  | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `1b4d279d` | Comprendre les documents administratifs  | B1 | CO | rouge | missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `1e3ff1eb` | Comprendre une demande administrative à  | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `33382dd4` | Le pronom relatif « qui » dans les conte | A2 | CO | rouge | missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `3ea5f382` | Comprendre une démarche administrative à | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `556cba0c` | Demande d'allocation familiale à la CAF | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `8c4a82ee` | Informations personnelles à la CAF | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `913a5b72` | Identifier les informations dans un mess | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `9469de1a` | Démarches administratives à la préfectur | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `91cefa80` | Comprendre une demande administrative à  | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `d88de779` | Rendez-vous à la préfecture | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `ad0f1e82` | Rendez-vous à la préfecture | A2 | CO | rouge | missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `c255174e` | Appel à la préfecture pour un rendez-vou | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `c5e62f1c` | Démarches administratives à la préfectur | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `d41f46b7` | Vrai ou Faux : Démarches administratives | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `de62e8d3` | Comprendre une annonce à la préfecture | A2 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |
| `e64b08bc` | Comprendre une demande administrative à  | B1 | CO | rouge | consigne_too_long(warning/L1_structure); missing_audio_script(warning/L1_structure); missing_audio_script(warning/L2_usable_content); consigne_too_long_for_directives(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie); feedback_too_long(warning/L6_pedagogie) | P1 | **approved_human** | 100 | 100 |

## 3. Impact attendu sur scénarios pré-session

### S2 — A2 / CO / prefecture / quota 5

| Étape | Retenus | Gap | P1 pool |
|-------|---------|-----|---------|
| Baseline (actuel) | 4/5 | 1 | 4 |
| Après backfill seul | 5/5 | 0 | 5 |
| Après backfill + promotions recommandées | 5/5 | 0 | 26 |

- **Génération résiduelle :** Aucune — quota couvert après recovery.

### S3 — B1 / CO / prefecture / quota 5

| Étape | Retenus | Gap | P1 pool |
|-------|---------|-----|---------|
| Baseline (actuel) | 0/5 | 5 | 0 |
| Après backfill seul | 1/5 | 4 | 1 |
| Après backfill + promotions recommandées | 5/5 | 0 | 22 |

- **Génération résiduelle :** Aucune — quota couvert après recovery.

## 4. Génération encore nécessaire après recovery

- **S3 B1 CO préfecture** : Aucune — quota couvert après recovery.
- **S2 A2 CO préfecture** : Aucune — quota couvert après recovery.
- **S4 B2 CE** : 5 exercices — 0 VA, génération Lot 8 P0 (hors mini-lot)
- **S7 B2 Structures** : 5 exercices — 0 candidat dimensionnel, génération intégrale (hors mini-lot)
- **S6 B1 EE** : 4 exercices — trou niveau B1 + score A2, génération P0 (hors mini-lot)

*(Hors périmètre mini-lot : B2 CE, B2 Structures, B1 EE — vrais trous banque / validation P0.)*

## 5. GO / NO-GO — lot correction métadonnées / validation

### Verdict : **GO**

Le mini-lot adresse un **problème de métadonnées/scoring**, pas un trou banque pur : 1 VA bloqués à score 60 par absence de thème, 25 NR préfecture A2/B1 déjà à score 100 mais exclus (tier rouge + thème sensible).

Après backfill seul : S3 B1 passe de 0/5 à 1/5 retenus (P1=1).

Après backfill + 21 promotions `approved_human` : S3 5/5, S2 5/5.

Les deux scénarios CO préfecture A2/B1 seraient couverts sans génération.

### Critères

- [x] Candidats backfill VA identifiés et justifiés — 1 exercice(s) VA CO A2/B1 sans thème, score 60, texte administratif
- [x] Pool NR préfecture A2/B1 score 100 disponible — 25 NR éligibles (21 promotion approved_human recommandée)
- [x] Backfill thème améliore le scoring B1 CO préfecture — P1 pool B1 : 0 → 1 après backfill
- [x] Recovery réduit le gap B1 sous seuil génération massive — Gap B1 : 5 → 0 après backfill + promotions
- [x] Stratégie A2 CO préfecture adressée (promotion NR ou génération ciblée) — Quota A2 couvert après recovery

### Plan d'exécution recommandé (sans exécution dans ce rapport)

1. Backfill `theme='prefecture'` (dry-run validé par ce rapport) (1 exercice(s))
2. Revue humaine NR → `approved_human` (priorité P0/P1) (21 exercice(s))
3. Revue NR → `needs_review` (corrections L7/L6 avant promotion) (4 exercice(s))
4. Génération ciblée post-recovery (si gap résiduel > 0) (0 exercice(s))

---

_Rapport généré par `scripts/pre-session-bank-recovery-audit.mjs` — audit read-only mini-lot récupération banque._