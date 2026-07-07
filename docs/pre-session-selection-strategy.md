# Stratégie de sélection pré-séance — Décisions utilisateur

**Date :** 7 juillet 2026  
**Projet :** `primo-fluency-hub`  
**Statut :** DOCUMENTATION UNIQUEMENT — aucun code, aucune migration, aucune génération, aucun changement Supabase  
**Références :** `docs/lot9-pre-session-selection-plan.md`, `docs/lot9-banque-pilotage-report.md`, `docs/lot8-p0-plan.md`

---

## 1. Objet et périmètre

Ce document consolide **toutes les décisions utilisateur** pour la sélection automatique pré-séance (Lot 9). Il sert de référence unique avant la phase d'implémentation.

| Inclus | Exclu |
|--------|-------|
| Règles de sélection P1 / P2 / exclusions | Code, migrations, génération IA |
| Seuils calibrés sur pilotage banque | Modification de la banque |
| Structure du rapport pré-séance | Changements Supabase |
| Critères GO / NO-GO implémentation | Exécution Lot 8 P0 |

**Objectif :** interroger la banque validée avant toute génération IA, produire un rapport transparent pour le formateur, et signaler les lacunes sans les exécuter.

---

## 2. Décisions de sélection — validation_status

### 2.1 P1 — Pool principal (priorité absolue)

| Décision | Détail |
|----------|--------|
| Statuts inclus | `validated_auto`, `approved_human` |
| Priorité | **Absolue** — toujours interrogé en premier |
| Index DB | **`idx_exercices_validation_reuse`** — la requête P1 **doit** s'appuyer sur cet index |
| Volume pilotage | 372 exercices VA (59,9 % de la banque) |

**Règle :** aucun exercice P2 (`needs_review`) ne peut être retenu tant que le quota n'est pas couvert par P1 + scoring + fraîcheur.

### 2.2 P2 — Repli `needs_review` (conditionnel)

| Décision | Détail |
|----------|--------|
| Déclenchement | **Uniquement** si le volume P1 est insuffisant (`retained_p1 < count`) |
| Plafond | **Maximum 30 %** du quota final par séance (ex. quota 5 → max 1 NR auto) |
| Tiers autorisés | **Vert** et **Orange** uniquement |
| Tiers interdits | **Rouge** — jamais auto-sélectionné |
| Requête | Requête complémentaire **explicite**, hors index P1 |

#### Classification des tiers NR

| Tier | Critères (`validation_issues`) | Auto-sélectionnable ? |
|------|-------------------------------|----------------------|
| **Vert** | Warnings L6 seuls (`consigne_too_long*`, `feedback_too_long`) sans `ambiguous_correction` ni `correction_not_in_text` | **Oui** — priorité repli |
| **Orange** | `missing_audio_script`, `missing_ce_text` + ≤ 2 warnings, sans ambiguïté correction | **Oui** — si tier Vert épuisé |
| **Rouge** | `ambiguous_correction`, `correction_not_in_text`, `level_doubtful`, ≥ 3 warnings, ou thème sensible + warning correction | **Non** — signal relecture humaine |

#### Règles de repli additionnelles

| Règle | Comportement |
|-------|--------------|
| Cellule P0 sans VA | Pas de repli NR → signaler génération directe |
| Thème `prefecture` B1/B2 | **Jamais** de repli NR automatique (0 VA, 33 ex. NR sensibles) |
| NR retenus en repli | Flaggés `source: "banque_needs_review"`, `selection_tier: P2_nr_vert` ou `P2_nr_orange` |

### 2.3 P3 — Exclusions systématiques

| Catégorie | Statuts / critères | Code rapport |
|-----------|-------------------|--------------|
| Rejetés validation | `rejected` (51 ex.) | `EXCL_VALIDATION_REJECTED` |
| Brouillons | `draft` (non backfillé) | `EXCL_VALIDATION_DRAFT` |
| NR tier Rouge | Ambiguïté correction, level_doubtful, ≥ 3 warnings | `EXCL_NR_TIER_ROUGE` |
| Ambiguïté correction critique | `ambiguous_correction`, `correction_not_in_text` (warning bloquant) | `EXCL_NR_TIER_ROUGE` |
| Thèmes admin sensibles non approuvés | `prefecture`, `vie_citoyenne` en NR sans promotion `approved_human` | `EXCL_NR_THEME_SENSIBLE` |

**Principe :** ces exercices ne sont **jamais** auto-sélectionnés ; ils alimentent `excluded` et/ou `human_review_items`.

---

## 3. Filtres dimensionnels

Pipeline appliqué **après** le filtre `validation_status`, dans l'ordre :

```
compétence (strict) → niveau ±1 → format → thème → hasUsableContent → scoring → fraîcheur → top-N
```

| Dimension | Comportement | Référence |
|-----------|--------------|-----------|
| **niveau_vise** | Fenêtre **±1** via `niveauWindow()` ; tri préfère match exact | `exercise-search.ts` |
| **competence** | Égalité stricte sur la compétence du slot | Requête SQL |
| **theme** | **Soft match** : bonus/exclusion via `scoreCandidateWithTheme` ; candidats sans thème **non exclus** (neutralité SCORE_01) | `exercise-search.ts` |
| **format** | Filtre dur si contrainte explicite ; sinon `matrix.formats_autorises` via EXCL_02 | `FORMATS_BY_COMPETENCE` |
| **search-first score** | Seuil minimum **≥ 80** (`REUSE_SCORE_MIN`) | `exercise-search.ts` |
| **fraîcheur** | Anti-répétition : fenêtre **30 jours** (`FRESHNESS_WINDOW_DAYS`) ; exercices vus récemment exclus | `exercise-search.ts` |
| **anti-répétition** | Exclure `excludeExerciceIds` (déjà liés à la séance) | `EXCL_ALREADY_LINKED` |

**Décision clé :** le scoring search-first existant **n'est pas modifié** ; seul un filtre `validation_status` optionnel est ajouté en amont.

---

## 4. Rapport pré-séance (`PreSessionSelectionReport`)

Objet JSON émis avant diffusion ; affiché dans Session Pilot / Preflight. La génération IA n'est **pas** exécutée par ce module.

### 4.1 Sections obligatoires

| Section | Rôle |
|---------|------|
| **`retained`** | Exercices retenus, ordonnés par compétence puis score décroissant |
| **`excluded`** | Compteurs agrégés + échantillon détaillé (max 20 lignes par raison) |
| **`remaining_gaps`** | Lacunes par cellule `(niveau_vise, competence)` |
| **`generation_need`** | Signal uniquement — besoin IA éventuel, **sans exécution** |
| **`human_review_items`** | File relecture formateur avant diffusion |

### 4.2 `retained` — champs par exercice

| Champ | Description |
|-------|-------------|
| `exercice_id`, `titre` | Identité |
| `competence`, `niveau_vise`, `format`, `theme` | Dimensions |
| `validation_status` | `validated_auto` \| `approved_human` \| `needs_review` |
| `selection_tier` | `P1_validated` \| `P2_nr_vert` \| `P2_nr_orange` |
| `score` | Score search-first (0–100) |
| `fresh` | Booléen fraîcheur |
| `matched_rules` | Règles scoring matchées |

### 4.3 `excluded` — raisons documentées

| Raison | Code |
|--------|------|
| Statut rejected | `EXCL_VALIDATION_REJECTED` |
| Statut draft | `EXCL_VALIDATION_DRAFT` |
| Score < 80 | `EXCL_SCORE_LOW` |
| Règle scoring EXCL_* | `EXCL_SCORING_*` |
| Format incompatible | `EXCL_FORMAT` |
| Non frais (30 j) | `EXCL_STALE` |
| NR tier rouge | `EXCL_NR_TIER_ROUGE` |
| Thème sensible NR | `EXCL_NR_THEME_SENSIBLE` |
| Déjà en séance | `EXCL_ALREADY_LINKED` |

### 4.4 `remaining_gaps` — lacunes par cellule

| Champ | Description |
|-------|-------------|
| `cell_key` | Ex. `A2:CE`, `B1:EE` |
| `requested` | Quota demandé |
| `retained_va` | Nombre VA retenus |
| `retained_nr` | Nombre NR retenus (repli) |
| `gap` | `requested - retained_va - retained_nr` |
| `is_p0_cell` | Cellule Lot 8 P0 |
| `va_in_bank` | Stock VA disponible (info) |
| `severity` | `none` \| `partial` \| `critical` |

**Severities :**

- `none` — gap = 0
- `partial` — gap > 0, cellule non P0, VA > 0 en banque
- `critical` — cellule P0 ou 0 VA en banque (ex. B1 EE, B2 CE, B1 prefecture)

### 4.5 `generation_need` — signal uniquement

```json
{
  "required": true,
  "total_gap": 3,
  "slots": [{ "competence": "CE", "niveau_vise": "B2", "gap": 2, "reason": "P0_CELL_ZERO_VA" }],
  "estimated_generation_count": 3,
  "defer_to_lot8_p0": true
}
```

| Code `reason` | Condition |
|---------------|-----------|
| `P0_CELL_ZERO_VA` | Cellule Lot 8 sans VA |
| `PARTIAL_GAP` | Retained < quota, VA existants ailleurs |
| `THEME_ZERO_VA` | Thème ciblé 0 VA (prefecture B1/B2) |
| `FORMAT_ZERO_VA` | Format demandé 0 VA |
| `ALL_REJECTED_OR_STALE` | Candidats présents mais tous exclus |

**Décision :** `generation_need` **signale** le besoin ; l'exécution reste dans `generate-exercises`.

### 4.6 `human_review_items` — file relecture

| Type | Critère | Priorité |
|------|---------|----------|
| `NR_REPLI_USED` | Exercice NR retenu en repli | moyenne |
| `NR_TIER_ROUGE_SKIPPED` | NR rouges exclus mais seuls disponibles | haute |
| `SENSITIVE_THEME_GAP` | prefecture/vie_citoyenne sans VA | haute |
| `AMBIGUOUS_CORRECTION_NEARBY` | Cellule avec ≥ 5 NR ambigus en banque | moyenne |
| `P0_BLOCKING` | Séance cible compétence P0 | haute |

Chaque item : `{ type, exercice_id?, cell_key, message, priority }`.

---

## 5. Seuils de génération (signalement)

Ces seuils alimentent `generation_need` ; ils ne déclenchent **pas** la génération depuis la sélection pré-séance.

### 5.1 Seuil minimum VA par niveau (cellule niveau × compétence)

| Niveau | Min VA requis pour 1 séance (5 ex.) sans génération | Justification pilotage |
|--------|-----------------------------------------------------|------------------------|
| **A1** | **3 VA** | 305 VA A1 ; taux 81,6 % |
| **A2** | **5 VA** | Taux 28,8 % ; A2 CO = 5 VA |
| **B1** | **8 VA** (0 si cellule P0) | Taux 22,4 % ; B1 CE = 0 VA |
| **B2** | **8 VA** (0 si cellule P0) | Taux 25,0 % ; B2 CE = 0 VA (P0) |

**Règle :** si `va_eligible_scored < min_va_per_cell` → `generation_need.required = true`.

**Cellules P0 Lot 8** (seuil VA = 0 par définition ; génération intégrale du quota) :

| Cellule | État banque |
|---------|-------------|
| B2 CE | 1 ex. rejected, 0 VA |
| A2 Structures | Absente |
| B1 EE | Absente |
| B1 Structures | Absente |
| B2 EE | Absente |
| B2 Structures | Absente |

### 5.2 Seuils par compétence (pool global VA scorés ≥ 80)

| Compétence | Min VA scorés | Stock pilotage |
|------------|--------------:|---------------:|
| CE | **15** | 200 |
| CO | **8** | 54 |
| EO | **8** | 54 |
| EE | **8** | 48 |
| Structures | **5** | 16 |

### 5.3 Seuils par thème (si séance thémée)

| Thème | Min VA scorés | Comportement B1/B2 |
|-------|--------------:|-------------------|
| **prefecture** | **5** | **Bloquant B1/B2** — 0 VA confirmé → génération intégrale, pas de repli NR auto |
| vie_citoyenne | 3 | Génération B1+ |
| logement | 3 | Search-first OK A1/A2 |
| sante | 3 | Search-first OK |
| travail | 3 | Search-first OK |
| transport | 2 | Search-first OK |
| ecole | 2 | Génération A2+ |
| (null) | N/A | 309 ex. sans thème ; neutralité scoring |

### 5.4 Matrice de décision génération (synthèse)

```
SI cellule ∈ P0 Lot 8 ET va_eligible = 0
  → generation_need = intégral (quota complet)

SINON SI theme = prefecture ET niveau ∈ {B1, B2}
  → generation_need = intégral (0 VA confirmé)

SINON SI gap > 0 après sélection P1 + repli NR (≤ 30 %)
  → generation_need = gap (complément)

SINON
  → generation_need = none
```

### 5.5 Décision finale par slot

| Résultat sélection | Action pré-séance | Signal génération |
|--------------------|-------------------|-------------------|
| `retained ≥ count` | Lier exercices à `session_exercices` | Non |
| `0 < retained < count` | Lier retained ; gap = `count - retained` | Complément |
| `retained = 0`, NR vert/orange dispo, cellule non P0 | Repli NR jusqu'à plafond 30 % | Complément majoritaire |
| `retained = 0`, cellule P0 ou prefecture B1/B2 | Aucune liaison auto | Intégral |

---

## 6. Règles de repli — récapitulatif

| # | Règle |
|---|-------|
| 1 | P1 (`validated_auto`, `approved_human`) toujours en premier, via `idx_exercices_validation_reuse` |
| 2 | P2 (`needs_review`) **seulement** si P1 insuffisant |
| 3 | Plafond P2 : **30 %** du quota final |
| 4 | P2 limité aux tiers **Vert** et **Orange** |
| 5 | Tier **Rouge** jamais auto-sélectionné |
| 6 | **Jamais** de repli NR auto sur **prefecture B1/B2** |
| 7 | Cellule P0 sans VA → pas de repli NR, génération signalée |
| 8 | `rejected` et `draft` exclus systématiquement |
| 9 | Thèmes admin sensibles non approuvés exclus du repli auto |

---

## 7. Intégration future (plan d'accroche)

Aucun code dans ce livrable. Points d'intégration identifiés :

### 7.1 Fichiers à créer

| Fichier | Rôle |
|---------|------|
| `supabase/functions/_shared/pre-session-selection.ts` | Cœur logique : filtres validation, tiers NR, assembly rapport |
| `supabase/functions/_shared/pre-session-selection.test.ts` | Tests unitaires (tiers NR, seuils P0, rapport) |
| `src/lib/preSessionSelectionReport.ts` | Types TS partagés front + helpers affichage |
| `src/components/formateur/PreSessionSelectionReport.tsx` | UI rapport dans Preflight |

### 7.2 Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/functions/_shared/exercise-search.ts` | Paramètre optionnel `validationStatuses?: string[]` sur requête banque ; défaut `['validated_auto','approved_human']` |
| `supabase/functions/generate-exercises/index.ts` | Accepter `preSelectionReport` ; ne générer que `generation_need.total_gap` |
| `src/lib/prepareSessionKit.ts` | Remplacer appel direct IA par `preSessionSelect` puis complément |
| `src/components/PreflightExercises.tsx` | Afficher rapport ; bouton « Appliquer sélection » |
| `src/pages/formateur/SessionPilot.tsx` | Props session ; badge statut pré-séance |
| `supabase/functions/_shared/validation-chain.ts` | Exporter `classifyNrTier(issues, theme)` pour tiers Vert/Orange/Rouge |

### 7.3 Flux cible

```
Session créée / Preflight « Préparer »
    │
    ▼
preSessionSelectExercises()
    │  ├─ lecture session + groupe
    │  ├─ plan adaptatif (buildAdaptiveExercisePlan)
    │  ├─ par slot : findReusableExercises (P1 VA via idx_exercices_validation_reuse)
    │  ├─ repli NR si gap (classifyNrTier via validation-chain.ts)
    │  └─ assemble PreSessionSelectionReport
    │
    ├─ retained > 0 → link session_exercices
    ├─ generation_need → invoke generate-exercises (complément seulement)
    └─ rapport → PreSessionSelectionReport.tsx + log JSON
```

### 7.4 Séquence d'implémentation recommandée

| Phase | Livrable |
|-------|----------|
| 1 | Module `pre-session-selection.ts` + tests (logique pure) |
| 2 | Extension `findReusableExercises` — filtre `validation_status` |
| 3 | Edge function wrapper ou appel depuis `generate-exercises` |
| 4 | Intégration `prepareSessionKit` (search-first avant IA) |
| 5 | UI rapport Preflight + Session Pilot |
| 6 | Tests e2e : A1 (full VA), B2 CE (P0), B1 prefecture (0 VA) |

---

## 8. Critères GO / NO-GO — phase implémentation

### 8.1 Critères GO (tous requis)

| # | Critère | Scénario de validation |
|---|---------|------------------------|
| G1 | Séance A1 CE : ≥ 4/5 exercices banque VA sans génération | Scénario A |
| G2 | Séance B2 CE : rapport `critical` + `generation_need` intégral, **0 NR auto** | Scénario C |
| G3 | Séance B1 prefecture : 0 retenu auto, `human_review_items` peuplé | Scénario D |
| G4 | Aucun `rejected` dans `retained` | Tous scénarios |
| G5 | Repli NR ≤ 30 % quota et tier rouge **jamais** auto | Scénario B |
| G6 | Requête P1 utilise `idx_exercices_validation_reuse` | Revue code |
| G7 | Non-régression tests `exercise-search.test.ts` | CI |
| G8 | Rapport pré-séance complet (5 sections) émis avant diffusion | Revue UI |

### 8.2 Critères NO-GO (bloquants)

| # | Condition NO-GO |
|---|-----------------|
| N1 | Un `rejected` ou `draft` apparaît dans `retained` |
| N2 | Repli NR > 30 % du quota ou tier Rouge auto-sélectionné |
| N3 | Repli NR automatique sur prefecture B1/B2 |
| N4 | Génération IA exécutée depuis le module de sélection (hors `generate-exercises`) |
| N5 | Modification du scoring search-first (REUSE_SCORE_MIN, règles EXCL_*) |
| N6 | Migration ou modification Supabase dans le cadre Lot 9 pré-séance |
| N7 | `generation_need` exécuté au lieu d'être signalé uniquement |
| N8 | Absence de `human_review_items` quand NR repli ou thème sensible sans VA |

### 8.3 Scénarios d'acceptation

| ID | Entrée | Attendu |
|----|--------|---------|
| **A** | A1, CE, quota 5, sans thème | 5 retained P1, 0 generation_need, 0 human_review NR |
| **B** | A2, CO, theme prefecture, quota 5 | 1–2 retained VA max ; gap ≥ 3 ; SENSITIVE_THEME_GAP ; generation_need PARTIAL_GAP |
| **C** | B2, CE, quota 5 | 0 retained ; generation_need intégral P0_CELL_ZERO_VA ; defer_to_lot8_p0 true |
| **D** | B1, CO, quota 5 | 0–2 retained ; generation_need ; NR prefecture exclus auto |

---

## 9. Tableau récapitulatif des décisions utilisateur

| # | Décision | Justification pilotage |
|---|----------|------------------------|
| 1 | P1 = `validated_auto` + `approved_human`, priorité absolue, index `idx_exercices_validation_reuse` | 372 VA exploitables |
| 2 | P2 = `needs_review` seulement si P1 insuffisant, max 30 % quota, tiers Vert/Orange | 198 NR dont 53 hautes priorité |
| 3 | Jamais NR Rouge ; jamais repli NR auto prefecture B1/B2 | 0 VA, 33 ex. NR admin sensibles |
| 4 | Exclusions : rejected, draft, NR rouge, ambiguïté correction, thèmes admin non approuvés | 51 rejected injouables |
| 5 | Filtres : niveau ±1, compétence strict, thème soft, format compatible, score ≥ 80, fraîcheur 30 j | Alignement exercise-search.ts |
| 6 | Rapport : retained, excluded, remaining_gaps, generation_need (signal), human_review_items | Transparence formateur |
| 7 | Seuils génération : A1 3, A2 5, B1/B2 8 VA ; CE 15, CO/EO/EE 8, Structures 5 ; prefecture 5 (bloquant B1/B2) | Calibration lot9-banque-pilotage-report |
| 8 | Scoring search-first inchangé ; filtre validation_status seulement | Décision Lot 8 |
| 9 | Génération IA reste dans `generate-exercises` | Séparation sélection / exécution |
| 10 | Aucune action DB dans ce lot | Contrainte utilisateur |

---

## Annexe — Données pilotage (base des seuils)

| Indicateur | Valeur |
|------------|--------|
| Total banque | 621 |
| validated_auto | 372 (59,9 %) |
| needs_review | 198 (31,9 %) |
| rejected | 51 (8,2 %) |
| Sans thème | 309 (49,8 %) |
| Taux VA A1 / A2 / B1 / B2 | 81,6 % / 28,8 % / 22,4 % / 25,0 % |
| B1/B2 prefecture VA | 0 sur 33 ex. |
| Cellules P0 (0 VA) | 6 |

---

*Document de stratégie Lot 9 pré-séance. Décisions utilisateur consolidées. Aucun code, aucune génération, aucune modification banque ou Supabase. Prêt pour handoff implémentation.*
