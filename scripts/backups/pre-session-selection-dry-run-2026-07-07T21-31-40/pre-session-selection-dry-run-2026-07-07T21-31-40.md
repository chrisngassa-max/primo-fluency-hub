# Dry-run sélection pré-séance — Lot 9

**Généré :** 2026-07-07T21:31:40.970Z
**Mode :** dry-run (0 écriture Supabase, 0 génération IA)
**Banque lue :** 621 exercices

## Scénarios exécutés

### A1_CE — A1 CE quota 5 (scénario A)

| Métrique | Valeur |
|----------|--------|
| retained | 5 |
| gap | 0 |
| generation_need | non |
| total_gap signalé | 0 |
| nr_fallback_allowed | true |
| human_review_items | 1 |

**Retenus (échantillon)** :
- `8f4bbd3b-01e5-4913-a20f-8a118bea863c` — L'interrogation personnelle — P1_validated — score 100
- `e54114ba-790d-45f6-9bde-a84deaf4c71b` — Le portrait de Sonia — P1_validated — score 100
- `a73172a8-c1b6-45c2-aaea-3aaf76ebafad` — La liste des participants — P1_validated — score 100
- `472ee216-fe08-431f-93da-7d57a25f6eea` — Le dossier de Youssef — P1_validated — score 100
- `a4220295-a2a3-4772-8178-dda3a98ad827` — La fiche d'identité de Jean — P1_validated — score 100

**Exclusions (top)** :
- EXCL_COMPETENCE: 291
- EXCL_SCORE_LOW: 73
- EXCL_NR_TIER_ROUGE: 58
- EXCL_VALIDATION_REJECTED: 26
- EXCL_NR_THEME_SENSIBLE: 26
- EXCL_NIVEAU: 14
- EXCL_FORMAT: 6

**Relecture humaine** :
- [moyenne] AMBIGUOUS_CORRECTION_NEARBY — Cellule avec ≥ 5 NR ambigus en banque (40)

### A2_CO_PREF — A2 CO thème prefecture quota 5 (scénario B)

| Métrique | Valeur |
|----------|--------|
| retained | 4 |
| gap | 1 |
| generation_need | oui |
| total_gap signalé | 1 |
| nr_fallback_allowed | true |
| human_review_items | 1 |

**Retenus (échantillon)** :
- `4530184c-dfb6-4b5d-9b82-a837b9be2ccb` — Rendez-vous à la préfecture — P1_validated — score 100
- `5a76c6e0-2749-4be9-9c62-6589d154f509` — Problème d'orientation à la préfecture — P1_validated — score 100
- `86130260-e23d-478e-ba40-2c87b2d0ab99` — Prendre rendez-vous à la mairie — P1_validated — score 100
- `75b18bcc-2b35-4407-bf1d-c8cfba274250` — Où est le bureau des impôts ? — P1_validated — score 100

**Exclusions (top)** :
- EXCL_COMPETENCE: 491
- EXCL_SCORE_LOW: 49
- EXCL_NR_TIER_ROUGE: 28
- EXCL_NR_THEME_SENSIBLE: 25
- EXCL_NIVEAU: 15
- EXCL_VALIDATION_REJECTED: 8
- EXCL_FORMAT: 1

**Relecture humaine** :
- [moyenne] AMBIGUOUS_CORRECTION_NEARBY — Cellule avec ≥ 5 NR ambigus en banque (15)

### B2_CE — B2 CE quota 5 cellule P0 (scénario C)

| Métrique | Valeur |
|----------|--------|
| retained | 0 |
| gap | 5 |
| generation_need | oui |
| total_gap signalé | 5 |
| nr_fallback_allowed | false |
| human_review_items | 2 |

**Exclusions (top)** :
- EXCL_NIVEAU: 316
- EXCL_COMPETENCE: 291
- EXCL_NR_THEME_SENSIBLE: 6
- EXCL_NR_TIER_ROUGE: 6
- EXCL_FORMAT: 2

**Relecture humaine** :
- [haute] NR_TIER_ROUGE_SKIPPED — NR tier rouge exclus mais seuls candidats disponibles
- [haute] P0_BLOCKING — Séance cible cellule P0 Lot 8 — génération intégrale signalée

### B1_CO_PREF — B1 CO thème prefecture quota 5 (scénario D)

| Métrique | Valeur |
|----------|--------|
| retained | 0 |
| gap | 5 |
| generation_need | oui |
| total_gap signalé | 5 |
| nr_fallback_allowed | false |
| human_review_items | 0 |

**Exclusions (top)** :
- EXCL_COMPETENCE: 491
- EXCL_NIVEAU: 59
- EXCL_NR_TIER_ROUGE: 28
- EXCL_NR_THEME_SENSIBLE: 28
- EXCL_SCORE_LOW: 8
- EXCL_VALIDATION_REJECTED: 5
- EXCL_FORMAT: 2

---
_Rapport généré par scripts/pre-session-selection-dry-run.mjs — Lot 9 pré-séance dry-run._