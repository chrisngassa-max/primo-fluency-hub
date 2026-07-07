# Lot 9 — Rapport de pilotage banque CapTCF (lecture seule)

**Date :** 7 juillet 2026  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`  
**Périmètre :** 621 exercices banque (`is_template = false`, `eleve_id IS NULL`, `validation_profile = legacy_bank`)  
**Source :** requêtes SQL read-only post-backfill Lot 9 (`validation_source = backfill`)  
**Références :** `validation-chain.ts` (L1–L7, profil `legacy_bank`), `docs/lot8-p0-plan.md` (cellules P0)

---

## 1. Résumé exécutif

| Indicateur | Valeur |
|------------|--------|
| **Total banque** | 621 |
| **validated_auto** | 372 (59,9 %) |
| **needs_review** | 198 (31,9 %) |
| **rejected** | 51 (8,2 %) |
| **Exercices sans thème** | 309 (49,8 %) |
| **Profil** | 100 % `legacy_bank` |

### Verdict pilotage

La chaîne de validation Lot 9 (profil `legacy_bank`, couches L1–L7) est **opérationnelle en production**. Environ **60 %** de la banque est réutilisable immédiatement en search-first (`validated_auto`). Le socle A1 reste solide ; les niveaux A2–B2 concentrent l'essentiel des risques.

**Points clés :**

1. **Réutilisation directe fiable** — Le cœur A1 CE/EO/EE (305 exercices `validated_auto` sur 374 A1) constitue le réservoir principal. Les cellules 100 % `validated_auto` (≥ 3 ex.) sont rares mais exploitables sans relecture.
2. **Dette qualité structurante** — 51 `rejected` : correction QCM/CE (36 %), incohérences format/compétence EXCL_02 (25 %), QCM structurel (24 %). Ces exercices sont **injouables ou exclus** par le moteur search-first.
3. **File de relecture** — 198 `needs_review` : majoritairement warnings L6 pédagogie (`feedback_too_long`, `consigne_too_long`) et CO sans `script_audio` (`missing_audio_script`). **53 priorité haute** (thèmes sensibles + ambiguïté correction).
4. **Trous P0 Lot 8 confirmés** — 5 cellules niveau×compétence à **0 exercice** ; B2 CE n'a qu'**1 exercice rejected** (0 `validated_auto`). Aucune couverture search-first sur les 6 cellules P0 sans génération Lot 8.

**Taux `validated_auto` par niveau :** A1 81,6 % · A2 28,8 % · B1 22,4 % · B2 25,0 %

---

## 2. Matrices de couverture

Légende cellules : `VA` = validated_auto · `NR` = needs_review · `RJ` = rejected

### 2.1 Niveau × compétence × statut

| Niveau | Compétence | VA | NR | RJ | Total | % VA |
|--------|------------|---:|---:|---:|------:|-----:|
| A1 | CE | 167 | 21 | 19 | 207 | 80,7 % |
| A1 | CO | 46 | 8 | 5 | 59 | 78,0 % |
| A1 | EE | 43 | 7 | 2 | 52 | 82,7 % |
| A1 | EO | 33 | 2 | 0 | 35 | 94,3 % |
| A1 | Structures | 16 | 3 | 2 | 21 | 76,2 % |
| A2 | CE | 33 | 63 | 13 | 109 | 30,3 % |
| A2 | CO | 5 | 29 | 4 | 38 | 13,2 % |
| A2 | EE | 5 | 10 | 0 | 15 | 33,3 % |
| A2 | EO | 6 | 2 | 0 | 8 | 75,0 % |
| A2 | Structures | — | — | — | **0** | — |
| B1 | CE | 0 | 12 | 1 | 13 | 0 % |
| B1 | CO | 2 | 16 | 0 | 18 | 11,1 % |
| B1 | EE | — | — | — | **0** | — |
| B1 | EO | 9 | 8 | 1 | 18 | 50,0 % |
| B1 | Structures | — | — | — | **0** | — |
| B2 | CE | 0 | 0 | 1 | 1 | 0 % |
| B2 | CO | 1 | 11 | 3 | 15 | 6,7 % |
| B2 | EE | — | — | — | **0** | — |
| B2 | EO | 6 | 6 | 0 | 12 | 50,0 % |
| B2 | Structures | — | — | — | **0** | — |

**Par compétence (agrégé) :**

| Compétence | VA | NR | RJ | Total |
|------------|---:|---:|---:|------:|
| CE | 200 | 96 | 34 | 330 |
| CO | 54 | 64 | 12 | 130 |
| EO | 54 | 18 | 1 | 73 |
| EE | 48 | 17 | 2 | 67 |
| Structures | 16 | 3 | 2 | 21 |

### 2.2 Niveau × thème × statut

Thèmes canoniques IRN + `(null)` pour exercices sans `theme`.

| Niveau | Thème | VA | NR | RJ | Total |
|--------|-------|---:|---:|---:|------:|
| A1 | (null) | 195 | 19 | 16 | 230 |
| A1 | prefecture | 42 | 11 | 8 | 61 |
| A1 | vie_citoyenne | 22 | 3 | 1 | 26 |
| A1 | logement | 15 | 0 | 1 | 16 |
| A1 | transport | 15 | 7 | 0 | 22 |
| A1 | travail | 10 | 1 | 2 | 13 |
| A1 | sante | 5 | 0 | 0 | 5 |
| A1 | ecole | 1 | 0 | 0 | 1 |
| A2 | (null) | 19 | 37 | 9 | 65 |
| A2 | prefecture | 5 | 45 | 3 | 53 |
| A2 | sante | 5 | 9 | 3 | 17 |
| A2 | logement | 9 | 7 | 1 | 17 |
| A2 | travail | 4 | 3 | 0 | 7 |
| A2 | vie_citoyenne | 5 | 1 | 1 | 7 |
| A2 | transport | 2 | 1 | 0 | 3 |
| A2 | ecole | 0 | 1 | 0 | 1 |
| B1 | prefecture | 0 | 23 | 0 | 23 |
| B1 | (null) | 3 | 2 | 1 | 6 |
| B1 | sante | 3 | 6 | 0 | 9 |
| B1 | logement | 3 | 2 | 0 | 5 |
| B1 | travail | 2 | 2 | 1 | 5 |
| B1 | vie_citoyenne | 0 | 1 | 0 | 1 |
| B2 | (null) | 1 | 5 | 2 | 8 |
| B2 | prefecture | 0 | 9 | 1 | 10 |
| B2 | logement | 2 | 2 | 1 | 5 |
| B2 | sante | 2 | 0 | 0 | 2 |
| B2 | transport | 1 | 0 | 0 | 1 |
| B2 | travail | 1 | 1 | 0 | 2 |

**Observation :** B1/B2 `prefecture` = **0 `validated_auto`** sur 33 exercices — file prioritaire de relecture ou régénération.

### 2.3 Compétence × format × statut

| Compétence | Format | VA | NR | RJ | Total |
|------------|--------|---:|---:|---:|------:|
| CE | qcm | 115 | 60 | 25 | 200 |
| CE | vrai_faux | 30 | 13 | 1 | 44 |
| CE | appariement | 26 | 1 | 0 | 27 |
| CE | texte_lacunaire | 20 | 22 | 0 | 42 |
| CE | transformation | 9 | 0 | 0 | 9 |
| CE | production_ecrite | 0 | 0 | 6 | 6 |
| CE | production_orale | 0 | 0 | 2 | 2 |
| CO | qcm | 53 | 44 | 7 | 104 |
| CO | vrai_faux | 1 | 19 | 3 | 23 |
| CO | texte_lacunaire | 0 | 1 | 0 | 1 |
| CO | production_ecrite | 0 | 0 | 1 | 1 |
| CO | production_orale | 0 | 0 | 1 | 1 |
| EE | production_ecrite | 39 | 14 | 0 | 53 |
| EE | qcm | 6 | 3 | 0 | 9 |
| EE | texte_lacunaire | 2 | 0 | 0 | 2 |
| EE | transformation | 1 | 0 | 0 | 1 |
| EE | vrai_faux | 0 | 0 | 1 | 1 |
| EE | appariement | 0 | 0 | 1 | 1 |
| EO | production_orale | 54 | 18 | 0 | 72 |
| EO | appariement | 0 | 0 | 1 | 1 |
| Structures | texte_lacunaire | 8 | 0 | 0 | 8 |
| Structures | transformation | 4 | 0 | 0 | 4 |
| Structures | qcm | 3 | 3 | 1 | 7 |
| Structures | appariement | 1 | 0 | 0 | 1 |
| Structures | vrai_faux | 0 | 0 | 1 | 1 |

**Formats à 0 `validated_auto` (tous rejected ou absents) :** CE×production_ecrite/orale (8 RJ), CO×production (2 RJ), combinaisons EE/EO/Structures marginales (7 RJ).

---

## 3. Exercices `rejected` (51) — par cause principale

Cause principale = premier code `error` par ordre alphabétique dans `validation_issues` (un exercice peut cumuler plusieurs erreurs).

| Code principal | Couche | n | % | Description |
|----------------|--------|--:|--:|-------------|
| `correction_not_in_text` | L7 | 18 | 35,3 % | `bonne_reponse` absente du texte support CE/QCM |
| `EXCL_02_format_competence` | L3 | 13 | 25,5 % | Format incompatible avec la compétence |
| `qcm_answer_not_in_options` | L1 | 6 | 11,8 % | Réponse correcte hors options |
| `qcm_no_options` | L1 | 6 | 11,8 % | QCM sans options valides |
| `vf_invalid_answer` | L1 | 4 | 7,8 % | Vrai/faux : réponse invalide |
| `duration_volume_mismatch` | L1 | 2 | 3,9 % | Durée incohérente avec le volume |
| `item_no_answer` | L1 | 2 | 3,9 % | Item sans réponse attendue |

**Occurrences totales par code (toutes erreurs, multi-comptage) :** `correction_not_in_text` 18 · `qcm_no_options` 17 · `qcm_answer_not_in_options` 17 · `EXCL_02_format_competence` 13 · `vf_invalid_answer` 5 · `duration_volume_mismatch` 2 · `item_no_answer` 2

### Échantillons par cause

**`correction_not_in_text` (18)** — ex. `35943339-9b4b-4c79-898a-92222ffba4bf` « Lire une carte de résident » · `0f46fda3-8187-4766-a691-c0d207df7229` « Lire une notice de santé » · `bbcbcbbf-0ce3-4922-bdbf-5026eafb7f5f` « Lire une annonce de logement »

**`EXCL_02_format_competence` (13)** — ex. `2c67bae7-2b96-4c29-a1f7-58c5935d5858` « Rédiger un courrier à la CAF… » (CE×production_ecrite) · `3175ff5e-4499-454a-99fd-28eef5cd9737` « Dialoguer avec un médecin - Production orale » · `ffffe409-af1e-42f0-bd49-d3dc5dbf6036` « S'installer dans un logement - Production orale »

**`qcm_no_options` / `qcm_answer_not_in_options` (6+6 primaires)** — ex. `2d4f5509-028d-4dad-81c4-0b53790a9240` « Comprendre l'acte de naissance » · `1c62a3f2-704c-4244-9473-b8bd51b40357` « Horaires de la mairie » · `64235e77-1d1f-4847-ac1a-e304317de09a` « Grammaire - L'interrogation Quel/Quelle »

**`vf_invalid_answer` (4)** — ex. `14ee9ec2-09ac-4afa-ad86-27cc58dd5b59` « Les consignes de la préfecture » · `2b41a0f8-1e24-4f65-bfbc-9ef73218d1c1` « Comprendre un rendez-vous à la préfecture »

**`duration_volume_mismatch` (2)** — `a933ccc2-b1f3-4545-91df-4bdc6f8b1266` « Préfecture : Comprendre les consignes orales » · `dfe1ca1e-171f-4096-9c21-731c3135b757` « Nouveau rendez-vous pour la formation »

**`item_no_answer` (2)** — `0904ec17-9b03-465a-9c3f-bd7d53dbd26b` « Lire une affiche » · `cf1c90a1-1a29-47ab-986b-6ed351b515ea` « Articles définis »

---

## 4. Exercices `needs_review` (198) — priorisation relecture humaine

Règles de priorisation (alignées `decideValidationStatus` + risque métier) :

| Priorité | Critères | n |
|----------|----------|--:|
| **Haute** | Thème sensible (`prefecture`, `vie_citoyenne`) ET (`ambiguous_correction` OU `correction_not_in_text` OU ≥ 3 warnings) | 53 |
| **Moyenne** | `ambiguous_correction`, `correction_not_in_text`, `level_doubtful`, ou ≥ 3 warnings (hors critère haute) | 105 |
| **Basse** | Warnings isolés L6 (consigne/feedback longs) ou `missing_audio_script` / `missing_ce_text` sans ambiguïté correction | 40 |

### Warnings les plus fréquents (198 exercices)

| Code | Occurrences | Couche | Impact |
|------|------------:|--------|--------|
| `feedback_too_long` | 196 | L7 | Cosmétique pédagogique A0/A1 |
| `consigne_too_long_for_directives` | 176 | L6 | Longueur consigne vs directives |
| `consigne_too_long` | 153 | L6 | Idem |
| `missing_audio_script` | 112 | L2 | CO sans script (warning legacy_bank) |
| `missing_ce_text` | 85 | L2 | CE texte court (warning si jouable) |
| `ambiguous_correction` | 37 | L7 | Plusieurs options plausibles QCM |
| `correction_not_in_text` | 19 | L7 | Warning (pas error) si QCM structurel OK |

### Concentration haute priorité (niveau × compétence)

| Priorité | Niveau | Compétence | n |
|----------|--------|------------|--:|
| Haute | A2 | CE | 18 |
| Haute | A2 | CO | 15 |
| Haute | B1 | CO | 10 |
| Haute | B1 | CE | 5 |
| Haute | B2 | CO | 3 |
| Haute | A1 | CE | 2 |

### Échantillon priorité haute (15 premiers)

| ID | Titre | Niveau | Comp. | Thème |
|----|-------|--------|-------|-------|
| `d42ffffc-2a6a-45e5-bc0c-225d6f3a5ae0` | Lire une carte de résident | A1 | CE | prefecture |
| `48c36037-aed8-4ff8-ae56-9833ff7f8c87` | Comprendre un avis d'absence | A1 | CE | prefecture |
| `33382dd4-67d1-4435-8d69-890ac3e0ced8` | Le pronom relatif « qui »… | A2 | CO | prefecture |
| `8c4a82ee-81c2-46db-af6f-415ed6d08d08` | Informations personnelles à la CAF | A2 | CO | prefecture |
| `ad0f1e82-f166-4322-a237-ec4921f1fd6a` | Rendez-vous à la préfecture | A2 | CO | prefecture |
| `12ede1af-823b-4284-a22b-777572c9e900` | Comprendre une demande administrative… | A2 | CO | prefecture |
| `556cba0c-d037-4684-8ada-a5c2e97f6e52` | Demande d'allocation familiale à la CAF | A2 | CO | prefecture |
| `c255174e-a56e-4f52-99d2-b652a5a84e50` | Appel à la préfecture pour un rendez-vous | A2 | CO | prefecture |

**Recommandation relecture :** traiter les **53 hautes** en premier (vérifier correction + contenu admin/civique), puis les **105 moyennes** (ambiguïté QCM), enfin les **40 basses** (allègement consigne/feedback ou ajout script audio).

---

## 5. Cellules fiables pour réutilisation automatique

### 5.1 Réutilisation directe (`validated_auto` uniquement)

**Seuil :** `validation_status = validated_auto` — conforme à l'index partiel `idx_exercices_validation_reuse` et à `decideValidationStatus` sans warning bloquant.

#### Cellules niveau × compétence × thème à 100 % VA (≥ 3 exercices)

| Cellule | VA | Total |
|---------|---:|------:|
| A1 × EO × (null) | 18 | 18 |
| A1 × EE × logement | 6 | 6 |
| A2 × EO × logement | 4 | 4 |
| A1 × CO × sante | 4 | 4 |
| B1 × EO × logement | 3 | 3 |
| A1 × CO × vie_citoyenne | 3 | 3 |

#### Cellules niveau × compétence robustes (≥ 50 % VA, ≥ 5 exercices)

| Cellule | VA | Total | % VA |
|---------|---:|------:|-----:|
| A1 × EO | 33 | 35 | 94,3 % |
| A1 × EE | 43 | 52 | 82,7 % |
| A1 × CE | 167 | 207 | 80,7 % |
| A1 × CO | 46 | 59 | 78,0 % |
| A1 × Structures | 16 | 21 | 76,2 % |
| A2 × EO | 6 | 8 | 75,0 % |
| B1 × EO | 9 | 18 | 50,0 % |
| B2 × EO | 6 | 12 | 50,0 % |

#### Top cellules thématiques (≥ 3 VA)

| Cellule | VA | VA+NR | Total |
|---------|---:|------:|------:|
| A1 × CE × (null) | 112 | 124 | 134 |
| A1 × CO × (null) | 27 | 30 | 33 |
| A1 × CE × prefecture | 25 | 30 | 35 |
| A1 × EE × (null) | 23 | 24 | 25 |
| A1 × Structures × (null) | 15 | 18 | 20 |
| A2 × CE × (null) | 15 | 40 | 48 |

**Note :** 145 exercices `validated_auto` ont `validation_issues = []` ; 227 ont des warnings résiduels mais statut final `validated_auto` (profil legacy assouplit certaines erreurs en warnings).

### 5.2 Réutilisation souple (`validated_auto` + `needs_review` sélectif)

**Seuil proposé pour Codex / routing L10 :**

| Niveau | Critère d'inclusion `needs_review` | Rationale |
|--------|-----------------------------------|-----------|
| **Vert** | Warnings uniquement L6 (`consigne_too_long*`, `feedback_too_long`) sans `ambiguous_correction` ni `correction_not_in_text` | Cosmétique ; exercice jouable |
| **Orange** | `missing_audio_script` ou `missing_ce_text` (warning legacy) + 1–2 warnings | Jouable mais incomplet ; relecture légère |
| **Rouge** | `ambiguous_correction`, `correction_not_in_text`, `level_doubtful`, ou ≥ 3 warnings, ou thème sensible | Exclure du pool auto (`decideValidationStatus`) |

#### Cellules 0 VA mais pool NR « vert » potentiel (≥ 3 NR, 0 RJ, sans warning correction)

| Cellule | NR | Rationale |
|---------|---:|-----------|
| A2 × EE × prefecture | 9 | Warnings L6 dominants ; production écrite jouable |
| B1 × EO × prefecture | 7 | Idem EO |
| B1 × CE × prefecture | 6 | Relecture admin avant promotion |
| B2 × EO × prefecture | 6 | Idem |

#### Cellules mixtes VA+NR à fort rendement (échantillonner NR avant élargissement)

| Cellule | VA | NR | Ratio NR à auditer |
|---------|---:|---:|-------------------|
| A2 × CE × (null) | 15 | 33 | 69 % — prioriser 10 NR sans ambiguïté |
| A2 × CE × prefecture | 5 | 20 | 80 % — sensible, audit ciblé |
| A2 × CO × (null) | 3 | 13 | 81 % — vérifier scripts audio |
| B1 × CO × prefecture | 0 | 10 | 100 % — pas de VA, audit complet |

**Estimation pool élargi :** 372 VA + ~40 NR « basse priorité » ≈ **412 exercices** (66 %) après audit léger ; +28 NR « vert » cellulaires ≈ **440** (71 %) si promotion manuelle validée.

---

## 6. Lacunes réelles post-validation (0 `validated_auto`)

### 6.1 Par niveau × compétence (cellules vides ou sans VA)

| Niveau | Compétence | Total | VA | NR | RJ | Statut |
|--------|------------|------:|---:|---:|---:|--------|
| **A2** | **Structures** | **0** | 0 | 0 | 0 | **Absent — P0 Lot 8** |
| **B1** | **EE** | **0** | 0 | 0 | 0 | **Absent — P0 Lot 8** |
| **B1** | **Structures** | **0** | 0 | 0 | 0 | **Absent — P0 Lot 8** |
| **B2** | **EE** | **0** | 0 | 0 | 0 | **Absent — P0 Lot 8** |
| **B2** | **Structures** | **0** | 0 | 0 | 0 | **Absent — P0 Lot 8** |
| B1 | CE | 13 | 0 | 12 | 1 | Présent mais 0 VA |
| B2 | CE | 1 | 0 | 0 | 1 | **P0 Lot 8** (1 ex. rejected) |

### 6.2 Référence cellules P0 Lot 8 (`lot8-p0-plan.md`)

| Cellule P0 | Cible Lot 8 | État banque | VA | Écart |
|------------|------------|-------------|---:|------|
| B2 CE | 15 (pilote +14) | 1 total (RJ) | **0** | **-15** |
| A2 Structures | 20 | 0 | **0** | **-20** |
| B1 EE | 20 | 0 | **0** | **-20** |
| B1 Structures | 15 | 0 | **0** | **-15** |
| B2 EE | 15 | 0 | **0** | **-15** |
| B2 Structures | 15 | 0 | **0** | **-15** |
| **Total P0** | **100** | **1** | **0** | **-99** |

### 6.3 Par thème (0 VA, exercices existants)

| Niveau | Thème | Total | NR | RJ |
|--------|-------|------:|---:|---:|
| B1 | prefecture | 23 | 23 | 0 |
| B2 | prefecture | 10 | 9 | 1 |
| A2 | ecole | 1 | 1 | 0 |
| B1 | vie_citoyenne | 1 | 1 | 0 |

### 6.4 Par compétence × format (0 VA, présents en banque)

Tous **rejected** sauf CO×texte_lacunaire (1 NR) :

- CE × production_ecrite (6 RJ), production_orale (2 RJ)
- CO × production_ecrite/orale (1+1 RJ)
- EE × vrai_faux, appariement (1+1 RJ)
- EO × appariement (1 RJ)
- Structures × vrai_faux (1 RJ)

### 6.5 Cellules niveau×compétence×thème sans VA (existants)

19 cellules ; les plus critiques : A2×CO×prefecture (17 ex., 0 VA), B1×CO×prefecture (10), A2×EE×prefecture (9), B1×EO×prefecture (7), B1×CE×prefecture (6), B2×EO×prefecture (6), B2×CE×(null) (1 RJ).

---

## 7. Recommandations opérationnelles

### 7.1 Utiliser directement (`validated_auto`)

| Action | Périmètre | n |
|--------|-----------|--:|
| Activer search-first sur pool VA | Index `idx_exercices_validation_reuse` | 372 |
| Prioriser A1 complet | CE, CO, EE, EO, Structures | 305 |
| Cellules 100 % VA thématiques | A1 EO, A1 EE logement, A2 EO logement, etc. | 34 |
| Formats sûrs | CE qcm/vf/appariement, EO production_orale, EE production_ecrite | ~320 |

### 7.2 Relecture humaine (`needs_review`)

| Priorité | Action | n |
|----------|--------|--:|
| P0 | A2 CE/CO prefecture + ambiguïté correction | 33 |
| P1 | B1 CO/CE prefecture (0 VA actuel) | 15 |
| P2 | Warnings `ambiguous_correction` (tous niveaux) | 37 ex. |
| P3 | NR basse priorité (consigne/feedback longs) | 40 |

**Workflow suggéré :** export CSV des 53 hautes → validation humaine → passage `approved_human` (hors scope Lot 9).

### 7.3 Corriger obligatoirement (`rejected`)

| Action | Codes cibles | n |
|--------|--------------|--:|
| Corriger ou régénérer QCM/CE | `correction_not_in_text`, `qcm_*` | 30 |
| Reclasser format/compétence | `EXCL_02_format_competence` | 13 |
| Corriger VF / items vides | `vf_invalid_answer`, `item_no_answer` | 6 |
| Ajuster durée | `duration_volume_mismatch` | 2 |

**Ne pas tenter search-first** sur ces 51 exercices — erreurs L1/L3/L7 bloquantes.

### 7.4 Générer plus tard (gaps Lot 8)

| Cellule | Δ requis | Statut post-Lot 9 |
|---------|---------:|-------------------|
| B2 CE | +14 (pilote) | 0 VA — **bloquant search-first B2 CE** |
| A2 Structures | +20 | Cellule absente |
| B1 EE | +20 | Cellule absente |
| B1 Structures | +15 | Cellule absente |
| B2 EE | +15 | Cellule absente |
| B2 Structures | +15 | Cellule absente |

**Séquence :** exécuter pilote B2 CE (Lot 8 §9) → valider `generated_strict` sur nouveaux inserts → ne pas mélanger avec corrections legacy des 51 rejected.

---

## Annexe A — Méthodologie

- **Requêtes :** Supabase MCP `execute_sql`, projet `gudcenhmzlcvhgbgklzw`, lecture seule.
- **Filtre banque :** `is_template = false AND eleve_id IS NULL AND validation_profile = 'legacy_bank'`.
- **Codes issues :** `supabase/functions/_shared/validation-chain.ts` — couches L1 (structure) à L7 (correction), profil `legacy_bank` assouplit `missing_ce_text`, `correction_not_in_text`, `missing_audio_script`.
- **Décision statut :** `decideValidationStatus()` — `rejected` si error ; `needs_review` si ambiguïté, écart niveau, thème sensible + warning, ou ≥ 3 warnings ; sinon `validated_auto`.
- **Priorisation NR :** heuristique métier (thèmes `prefecture`/`vie_citoyenne`, codes L7) — non persistée en DB.

## Annexe B — Requêtes SQL de reproduction

```sql
-- Agrégat statuts
SELECT validation_status, count(*) FROM exercices
WHERE is_template = false AND eleve_id IS NULL AND validation_profile = 'legacy_bank'
GROUP BY 1;

-- Cellules P0 Lot 8
SELECT niveau_vise, competence, count(*) AS n,
  count(*) FILTER (WHERE validation_status = 'validated_auto') AS va
FROM exercices
WHERE is_template = false AND eleve_id IS NULL
  AND ((niveau_vise = 'B2' AND competence = 'CE')
    OR (niveau_vise = 'A2' AND competence = 'Structures')
    OR (niveau_vise = 'B1' AND competence IN ('EE', 'Structures'))
    OR (niveau_vise = 'B2' AND competence IN ('EE', 'Structures')))
GROUP BY 1, 2;

-- Rejected par cause principale
WITH primary_issue AS (
  SELECT DISTINCT ON (id) id, issue->>'code' AS code
  FROM exercices, jsonb_array_elements(validation_issues) issue
  WHERE is_template = false AND eleve_id IS NULL
    AND validation_profile = 'legacy_bank' AND validation_status = 'rejected'
    AND issue->>'severity' = 'error'
  ORDER BY id, issue->>'code'
)
SELECT code, count(*) FROM primary_issue GROUP BY 1 ORDER BY 2 DESC;
```

---

*Rapport read-only Lot 9 pilotage. Aucune modification DB, aucune génération, aucune exécution Lot 8. Prêt pour handoff Codex.*
