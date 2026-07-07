## Décision et statut

| Élément | Valeur |
|---------|--------|
| **Statut** | Plan validé comme **cadrage** — pas comme autorisation d'exécution |
| **Décision opérationnelle** | Démarrer par un **pilote B2 CE +14 uniquement** |
| **Ce commit** | Documentation uniquement — aucun script, aucune génération IA, aucune insertion Supabase |
| **Prochaine étape** | Implémenter un script pilote B2 CE en **dry-run uniquement** (commit séparé) |

---

# Plan Lot 8 P0 — Remplissage ciblé de la banque search-first

**Projet :** `primo-fluency-hub`  
**Statut :** PLAN UNIQUEMENT — aucune insertion, aucune écriture DB  
**Date :** 7 juillet 2026  
**Périmètre strict respecté :** pas de `pedagogical_activities`, pas de modification de `exercise-search.ts`/scoring, pas A0/Pré-A1, pas de backfill global `theme NULL`, pas de correction des 12 incohérences format/compétence, pas d'insertion massive unique.

---

## 1. Contexte et objectif

La banque post-normalisation compte **621 exercices** (`is_template = false`, `eleve_id IS NULL`), tous conformes à `hasUsableContent()`.

Le moteur search-first (`supabase/functions/_shared/exercise-search.ts`) ne peut réutiliser un exercice que s'il existe dans la banque avec un score ≥ 80. Six cellules **niveau × compétence** sont quasi vides et bloquent la couverture P0 :

| Cellule | Actuel → Cible | Nouveaux max |
|---------|----------------|--------------|
| B2 CE | 1 → 15 | +14 |
| A2 Structures | 0 → 20 | +20 |
| B1 EE | 0 → 20 | +20 |
| B1 Structures | 0 → 15 | +15 |
| B2 EE | 0 → 15 | +15 |
| B2 Structures | 0 → 15 | +15 |
| **Total** | | **+99** |

**Objectif Lot 8 P0 :** insérer jusqu'à 99 exercices jouables, thématisés IRN, format/compétence cohérents, idempotents, validés avant écriture — **sans toucher au scoring**.

**Stratégie pilote (décision opérationnelle) :** seule la cellule **B2 CE (+14)** est exécutable en premier. Les cinq autres cellules restent documentées dans ce plan mais **bloquées** jusqu'à validation post-insert du pilote B2 CE.

---

## 2. État des lieux — scripts et pipelines existants

### 2.1 Edge Functions (génération IA)

| Script | Rôle | Réutilisable pour P0 ? |
|--------|------|------------------------|
| `generate-exercises` | Search-first + génération IA, QA, `validateAndFix`, schéma `contenu.items` canonique | **Oui — référence principale** (schéma + validateur) |
| `smart-exercise-generator` | Import URL / thème / reconfiguration, `validateAndFix` | Partiel — modes import hors scope |
| `tcf-generate-exercise` | RAG banque + schéma JSON **différent** (`epreuve`, `choix`, `support`…) | **Non direct** — nécessiterait un adaptateur |
| `claude-generate-exercise` | Variante Claude | Optionnel, non prioritaire |
| `regenerate-exercise-item` | Régénération item unitaire | Utile en correction post-génération |

### 2.2 Scripts batch / maintenance

| Script | Pattern réutilisable |
|--------|---------------------|
| `scripts/backfill-exercices-metadata.mjs` | `--dry-run` / `--apply`, manifest JSON de backup, idempotence |
| `scripts/curriculum/lib/publish-bridge.mjs` | Résolution `formateur_id` / `point_a_maitriser_id`, upsert par `metadata_code` |
| `scripts/curriculum/lib/publish-bridge-lib.mjs` | Forme `contenu.items` (QCM, VF), mapping format |
| `scripts/lib/captcf-validation.mjs` | Validation séances CapTCF (hors scope exercices unitaires) |
| `scripts/curriculum/*` | Pipeline curriculum v2 — **hors scope** (pas de pont curriculum ici) |

### 2.3 Validateurs applicatifs

- `supabase/functions/_shared/exercise-validator.ts` — validation déterministe (CE → `texte` obligatoire, QCM → options, `hasUsableContent` implicite)
- `supabase/functions/_shared/exercise-duration.ts` — `duree_limite_secondes` cohérente
- `src/test/exercise-search.test.ts` — tests `hasUsableContent`, EXCL_02 format/compétence

---

## 3. Contraintes techniques de référence (lecture seule)

### 3.1 `FORMATS_BY_COMPETENCE` (exercise-search.ts, non modifiable)

```36:42:supabase/functions/_shared/exercise-search.ts
const FORMATS_BY_COMPETENCE: Record<string, string[]> = {
  CO: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"],
  CE: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"],
  EE: ["production_ecrite", "texte_lacunaire", "transformation", "qcm"],
  EO: ["production_orale", "qcm"],
  Structures: ["texte_lacunaire", "qcm", "transformation", "appariement", "vrai_faux"],
};
```

### 3.2 Thèmes canoniques (`chk_exercices_theme_v4`)

Valeurs autorisées (CHECK DB + `CANONICAL_THEMES` dans exercise-search.ts) :

`logement` | `sante` | `travail` | `transport` | `banque` | `prefecture` | `ecole` | `vie_citoyenne`

**Règle Lot 8 :** chaque nouvel exercice P0 doit avoir `theme` **renseigné explicitement** à la création (pas de backfill global différé).

### 3.3 Schéma `exercices` — champs critiques à l'insert

| Champ | Obligatoire | Source / défaut proposé |
|-------|-------------|-------------------------|
| `formateur_id` | **OUI** (FK `profiles`) | `SF_P0_FORMATEUR_ID` ou 1er admin (`publish-bridge` pattern) |
| `point_a_maitriser_id` | **OUI** (FK) | `SF_P0_POINT_ID` ou 1er `points_a_maitriser` |
| `titre`, `consigne` | **OUI** | Génération |
| `competence` | **OUI** | Cellule cible |
| `niveau_vise` | **OUI** (défaut `A2`) | Cellule cible |
| `format` | **OUI** (défaut `qcm`) | Distribution par cellule |
| `contenu` | **OUI** (jsonb) | Voir §6 |
| `metadata_code` | Recommandé | `sf-p0:{cell}:{seq}` |
| `theme`, `contexte_irn` | Recommandé | Thème IRN = `contexte_irn` |
| `source` | Recommandé | `search_first_p0` |
| `is_ai_generated` | — | `true` |
| `is_template`, `is_devoir` | — | `false` |
| `difficulte` | — | A2→3, B1→4, B2→5 |
| `duree_limite_secondes` | — | `computeExerciseDuration()` |
| `objectif_tcf` | — | Par compétence (§6) |
| `niveau_guidage` | — | `semi_guide` (A2/B1), `autonome` (B2) |

Trigger `sync_exercise_structured_metadata` : extrait `metadata.code`, `time_limit_seconds`, etc. depuis `contenu.metadata`.

### 3.4 `hasUsableContent` (miroir SQL + JS)

- `consigne` non vide
- Si `format ∈ {production_ecrite, production_orale}` → OK sans items
- Sinon → `contenu.items` array non vide

---

## 4. Approche d'insertion contrôlée

### 4.1 Nouveau script proposé

```
scripts/
  fill-search-first-p0.mjs          # CLI orchestrateur
  lib/
    sf-p0-cells.mjs                 # Définitions 6 cellules (cibles, distributions)
    sf-p0-schema.mjs                # Validation Zod des drafts
    sf-p0-validate.mjs              # Port mjs de validateExercise + hasUsableContent
    sf-p0-generator.mjs             # Appel IA (generate-exercises ou callAI direct)
    sf-p0-resolve-context.mjs       # formateur_id / point_id (copie publish-bridge)
```

**Inspiration directe :** `backfill-exercices-metadata.mjs` (dry-run/manifest) + `publish-bridge.mjs` (upsert idempotent).

**Pilote :** le script initial ne doit exposer que `--cell "B2:CE"` en mode `--dry-run`. Les autres cellules restent définies dans `sf-p0-cells.mjs` mais **non invoquables** tant que le pilote B2 CE n'est pas validé post-insert.

### 4.2 CLI proposée

```bash
# Dry-run obligatoire — écrit uniquement le manifest JSON
node scripts/fill-search-first-p0.mjs --dry-run --cell "B2:CE"

# Génération partielle (lot de 5 max par défaut)
node scripts/fill-search-first-p0.mjs --dry-run --cell "B2:CE" --batch-size 5

# Application après validation humaine (pilote B2 CE uniquement, approbation séparée)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  SF_P0_FORMATEUR_ID=... SF_P0_POINT_ID=... \
  node scripts/fill-search-first-p0.mjs --apply --cell "B2:CE"

# Autres cellules — BLOQUÉES jusqu'à validation post-insert B2 CE
# node scripts/fill-search-first-p0.mjs --dry-run --cell "A2:Structures"  # NON EXÉCUTABLE
```

**Flags :**

| Flag | Description |
|------|-------------|
| `--dry-run` | Génère + valide, écrit manifest, **0 insert** |
| `--apply` | Insert/update après relecture manifest ou regen |
| `--cell "NIVEAU:COMP"` | Une cellule (ex. `B1:EE`) |
| `--batch-size N` | Max N exercices par exécution (défaut 5, max 20) |
| `--from-manifest path` | Réappliquer un manifest validé sans regen IA |
| `--skip-ai` | Templates déterministes (repli QA uniquement) |

### 4.3 Manifest dry-run

```
scripts/backups/sf-p0-manifest-{timestamp}.json
```

Structure :

```json
{
  "lot": "8-p0",
  "generated_at": "2026-07-07T...",
  "cell": "B2:CE",
  "dry_run": true,
  "entries": [
    {
      "metadata_code": "sf-p0:B2:CE:001",
      "draft": { "...": "row exercices prêt à insérer" },
      "validation": { "zod": true, "hasUsableContent": true, "validateExercise": { "ok": true, "issues": [] } },
      "estimated_cost_usd": 0.02
    }
  ],
  "summary": { "planned": 14, "valid": 14, "invalid": 0 }
}
```

### 4.4 Pipeline de validation (avant insert)

1. **Zod** (`sf-p0-schema.mjs`) — enums DB, CHECK theme, champs requis
2. **`hasUsableContent`** — port exact de exercise-search.ts
3. **`validateExercise`** — port de exercise-validator.ts (erreurs bloquantes)
4. **Cohérence format/compétence** — `format IN FORMATS_BY_COMPETENCE[competence]`
5. **CE** — `contenu.texte` ≥ 20 caractères
6. **EE production_ecrite** — `limite_mots_max ≤ 90` (EXCL_03 scoring)
7. **Déduplication** — `SELECT` sur `metadata_code`; refus si existe
8. **Revue humaine** — lecture manifest avant `--apply`

### 4.5 Idempotence

**Pattern `metadata_code` :**

```
sf-p0:{niveau}:{competence}:{seq}
```

Exemples :
- `sf-p0:B2:CE:001` … `sf-p0:B2:CE:014`
- `sf-p0:A2:Structures:001` … `sf-p0:A2:Structures:020`

**Upsert logique** (comme `publish-bridge.mjs`) :
- Si `metadata_code` existe → `UPDATE` (seulement si `source = 'search_first_p0'`)
- Sinon → `INSERT`

**Migration recommandée (Lot 8b, séparée) :**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercices_sf_p0_metadata_code
  ON public.exercices (metadata_code)
  WHERE metadata_code LIKE 'sf-p0:%';
```

### 4.6 Stratégie de génération IA

**Option A (recommandée) :** appeler `generate-exercises` avec body ciblé (`competence`, `niveauVise`, `count`, `themeId`) — réutilise QA + validateur existants.

**Option B :** `callAI` direct avec le tool schema de `generate-exercises/index.ts` (lignes 28–109) — plus de contrôle batch, même coût.

**Exécution par vagues :**
1. Une cellule à la fois
2. `--batch-size 5` avec pause 2 s entre appels
3. Jamais les 99 d'un coup

**Coût estimé pilote B2 CE :** 14 exercices × ~0,02–0,05 USD ≈ **0,30–0,70 USD**. Coût total Lot 8 (99 exercices) ≈ **2–5 USD**. Budget plafond recommandé : **10 USD** avec arrêt automatique.

### 4.7 Ordre d'exécution proposé

| Phase | Cellule | Statut | Raison |
|-------|---------|--------|--------|
| **1 (pilote)** | B2 CE (+14) | **Exécutable** | Gap le plus petit, valide le pipeline |
| 2 | A2 Structures (+20) | Bloqué | Après validation post-insert B2 CE |
| 3 | B1 Structures (+15) | Bloqué | |
| 4 | B1 EE (+20) | Bloqué | Production écrite — QA plus stricte |
| 5 | B2 Structures (+15) | Bloqué | |
| 6 | B2 EE (+15) | Bloqué | Niveau le plus exigeant |

---

## 5. Matrice avant / après

### 5.1 Cellules P0

| Cellule | Avant | Cible | Après (max) | Δ | Statut exécution |
|---------|-------|-------|-------------|---|------------------|
| B2 CE | 1 | 15 | 15 | +14 | **Pilote actif** |
| A2 Structures | 0 | 20 | 20 | +20 | Documenté, bloqué |
| B1 EE | 0 | 20 | 20 | +20 | Documenté, bloqué |
| B1 Structures | 0 | 15 | 15 | +15 | Documenté, bloqué |
| B2 EE | 0 | 15 | 15 | +15 | Documenté, bloqué |
| B2 Structures | 0 | 15 | 15 | +15 | Documenté, bloqué |
| **Sous-total P0** | **1** | **100** | **100** | **+99** | |

### 5.2 Banque globale

| Métrique | Avant | Après pilote B2 CE | Après Lot 8 complet (max) |
|----------|-------|--------------------|---------------------------|
| Total banque | 621 | 635 | **720** |
| `hasUsableContent` OK | 621 (100 %) | 635 (100 % requis) | 720 (100 % requis) |
| Cellules P0 à 0 | 5 | 5 | 0 |
| Exercices `sf-p0:*` | 0 | ≤ 14 | ≤ 99 |

---

## 6. Spécifications par cellule

### 6.1 B2 CE — +14 exercices *(pilote — seule cellule exécutable)*

**Formats autorisés :** `qcm`, `vrai_faux`, `texte_lacunaire`, `appariement`, `transformation`

**Distribution suggérée :** 8 qcm · 4 vrai_faux · 2 texte_lacunaire

**Thèmes IRN prioritaires :** `prefecture`, `vie_citoyenne`, `travail`, `logement` (naturalisation B2)

**Types de consignes :**
- Compréhension d'information explicite / implicite dans un document administratif ou presse civique
- Inférence d'intention de l'auteur, nuance argumentative
- Vocabulaire institutionnel (CAF, OFII, droits et devoirs)

**Structure `contenu` attendue :**

```json
{
  "texte": "Courrier ou article de presse B2 (150–250 mots), contexte IRN explicite.",
  "items": [
    {
      "question": "Quelle est l'idée principale du 2e paragraphe ?",
      "options": ["A", "B", "C", "D"],
      "bonne_reponse": "B",
      "explication": "Justification courte."
    }
  ],
  "metadata": {
    "code": "CE3",
    "objectif_tcf": "comprendre_info_implicite",
    "time_limit_seconds": 120
  }
}
```

**3 titres exemple :**
1. « Courrier préfectoral : comprendre la décision »
2. « Article presse — cohésion sociale et laïcité »
3. « Notice CAF : droits et démarches »

**Paramètres :** `difficulte: 5`, `niveau_guidage: autonome`, `objectif_tcf: comprendre_info_implicite`

---

### 6.2 A2 Structures — +20 exercices *(documenté — non exécutable)*

**Formats autorisés :** `texte_lacunaire`, `qcm`, `transformation`, `appariement`, `vrai_faux`

**Distribution suggérée :** 8 texte_lacunaire · 6 qcm · 4 transformation · 2 appariement

**Thèmes IRN prioritaires :** `transport`, `sante`, `ecole`, `logement` (grammaire ancrée situation)

**Types de consignes :**
- Présent / passé composé / futur proche en contexte
- Articles, prépositions de lieu, négation
- Accords sujet-verbe simples
- Vocabulaire de fréquence administrative quotidienne

**Structure `contenu` :**

```json
{
  "items": [
    {
      "question": "Complétez : Hier, je ___ (aller) à la préfecture.",
      "bonne_reponse": "suis allé",
      "explication": "Passé composé avec être."
    }
  ],
  "metadata": {
    "code": "ST2",
    "objectif_tcf": "maitriser_temps_de_base",
    "pilier": "conjugaison"
  }
}
```

**3 titres exemple :**
1. « Passé composé — démarche à la mairie »
2. « Articles et prépositions — chez le médecin »
3. « Futur proche — rendez-vous transport »

**Paramètres :** `difficulte: 3`, `niveau_guidage: semi_guide`, `sous_competence: conjugaison` ou `grammaire`

---

### 6.3 B1 EE — +20 exercices *(documenté — non exécutable)*

**Formats autorisés :** `production_ecrite`, `texte_lacunaire`, `transformation`, `qcm`

**Distribution suggérée :** 14 production_ecrite · 4 texte_lacunaire · 2 qcm

**Thèmes IRN prioritaires :** `travail`, `prefecture`, `logement`, `sante`

**Types de consignes :**
- Message court (40–60 mots) : excuse, demande, réclamation
- Description structurée (60–80 mots) : logement, emploi
- Formulaire commenté / courrier simple
- **Max 90 mots** (contrainte EXCL_03)

**Structure `contenu` (production_ecrite) :**

```json
{
  "type_reponse": "ecrit",
  "items": [
    {
      "question": "Rédigez un message à votre propriétaire pour signaler une fuite (60 mots max).",
      "bonne_reponse": ""
    }
  ],
  "criteres_evaluation": {
    "adequation_tache": "Le message répond à la situation.",
    "coherence_cohesion": "Organisation claire (salutation, corps, formule).",
    "competence_linguistique": "Accords et connecteurs de base."
  },
  "mots_cles_attendus": ["fuite", "réparation", "appartement"],
  "limite_mots_max": 60,
  "metadata": {
    "code": "EE2",
    "objectif_tcf": "produire_texte_court",
    "time_limit_seconds": 480
  }
}
```

**3 titres exemple :**
1. « Message au propriétaire — dégât des eaux »
2. « Lettre à la CAF — changement de situation »
3. « E-mail employeur — justifier une absence »

**Paramètres :** `difficulte: 4`, `niveau_guidage: semi_guide`, `duree_limite_secondes: 480`

---

### 6.4 B1 Structures — +15 exercices *(documenté — non exécutable)*

**Formats autorisés :** `texte_lacunaire`, `qcm`, `transformation`, `appariement`, `vrai_faux`

**Distribution suggérée :** 6 texte_lacunaire · 5 qcm · 3 transformation · 1 appariement

**Thèmes IRN prioritaires :** `travail`, `prefecture`, `banque`, `transport`

**Types de consignes :**
- Imparfait / passé composé (alternance)
- Pronoms COD/COI, relatifs `qui/que`
- Conditionnel de politesse (formules figées)
- Connecteurs logiques (`parce que`, `donc`, `mais`)

**Structure `contenu` (transformation) :**

```json
{
  "items": [
    {
      "question": "Mettez à la forme polie : « Tu peux m'aider ? »",
      "bonne_reponse": "Pourriez-vous m'aider ?",
      "explication": "Conditionnel de politesse."
    }
  ]
}
```

**3 titres exemple :**
1. « Conditionnel de politesse — guichet préfecture »
2. « Passé composé / imparfait — récit professionnel »
3. « Connecteurs logiques — lettre administrative »

---

### 6.5 B2 EE — +15 exercices *(documenté — non exécutable)*

**Formats autorisés :** `production_ecrite`, `texte_lacunaire`, `transformation`, `qcm`

**Distribution suggérée :** 12 production_ecrite · 2 transformation · 1 qcm

**Thèmes IRN prioritaires :** `vie_citoyenne`, `prefecture`, `travail`, `logement` (naturalisation)

**Types de consignes :**
- Argumentation courte (80–90 mots) : opinion + exemple
- Prise de position nuancée (laïcité, vivre-ensemble)
- Synthèse de document fictif
- Registre formel soutenu

**Structure `contenu` :**

```json
{
  "type_reponse": "ecrit",
  "items": [
    {
      "question": "Rédigez un texte argumenté (90 mots max) sur l'importance de la laïcité à l'école.",
      "bonne_reponse": ""
    }
  ],
  "criteres_evaluation": {
    "adequation_tache": "Prise de position claire.",
    "coherence_cohesion": "Connecteurs argumentatifs.",
    "competence_linguistique": "Registre et syntaxe B2."
  },
  "limite_mots_max": 90,
  "metadata": {
    "code": "EE3",
    "objectif_tcf": "argumenter_court",
    "time_limit_seconds": 600
  }
}
```

**3 titres exemple :**
1. « Argumentation — laïcité et école publique »
2. « Opinion nuancée — logement social »
3. « Synthèse — droits et devoirs du citoyen »

---

### 6.6 B2 Structures — +15 exercices *(documenté — non exécutable)*

**Formats autorisés :** `texte_lacunaire`, `qcm`, `transformation`, `appariement`, `vrai_faux`

**Distribution suggérée :** 6 texte_lacunaire · 4 transformation · 3 qcm · 2 appariement

**Thèmes IRN prioritaires :** `vie_citoyenne`, `prefecture`, `travail`, `ecole`

**Types de consignes :**
- Subordonnées relatives complexes
- Concordance des temps (discours rapporté simplifié)
- Voix passive, nominalisation
- Vocabulaire civique et institutionnel avancé

**Structure `contenu` (appariement) :**

```json
{
  "items": [
    {
      "question": "Associez chaque terme à sa définition.",
      "options": ["Laïcité", "Fraternité", "Séparation des pouvoirs", "Liberté d'expression"],
      "bonne_reponse": "Laïcité",
      "explication": "Définition du principe de neutralité."
    }
  ]
}
```

**3 titres exemple :**
1. « Subordonnées — institutions de la République »
2. « Concordance des temps — récit administratif »
3. « Lexique civique B2 — appariement »

---

## 7. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **`formateur_id` invalide** | Insert FK échoue | `SF_P0_FORMATEUR_ID` obligatoire en `--apply` ; fallback admin comme `publish-bridge` |
| **`point_a_maitriser_id` générique** | Exercice mal rattaché au référentiel | Mapper par compétence/niveau si table enrichie ; sinon point par défaut documenté |
| **Coût IA imprévu** | Dépassement budget | `--batch-size`, plafond dans manifest, `--dry-run` d'abord |
| **Doublons sémantiques** | Banque redondante, scoring faible | `metadata_code` unique + vérif titre/consigne similaire (Levenshtein optionnel) |
| **QA IA insuffisante** | Exercices injouables | Triple validation (Zod + validateExercise + hasUsableContent) |
| **CE sans `texte`** | EXCL_02 / validateur bloque | Règle CE stricte dans générateur |
| **EE > 90 mots** | EXCL_03 au scoring | `limite_mots_max` ≤ 90 systématique |
| **Thème absent** | Perte bonus SCORE_01 | `theme` obligatoire à l'insert, pas de backfill Lot 8 |
| **Conflit `metadata_code`** | Écrasement involontaire | Upsert limité à `source = 'search_first_p0'` |
| **12 incohérences existantes** | Confusion qualité | **Hors scope** — ne pas mélanger avec P0 |
| **Extension prématurée aux autres cellules** | Pipeline non validé, coût gaspillé | Pilote B2 CE obligatoire ; §6.2–6.6 documentés mais bloqués |

---

## 8. Requêtes SQL de validation pré/post

### 8.1 Inventaire cellules P0 (AVANT et APRÈS)

```sql
SELECT
  niveau_vise,
  competence,
  count(*) AS n
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL
  AND (
    (niveau_vise = 'B2' AND competence = 'CE')
    OR (niveau_vise = 'A2' AND competence = 'Structures')
    OR (niveau_vise = 'B1' AND competence IN ('EE', 'Structures'))
    OR (niveau_vise = 'B2' AND competence IN ('EE', 'Structures'))
  )
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 8.2 Matrice complète banque

```sql
SELECT niveau_vise, competence, count(*) AS n
FROM public.exercices
WHERE is_template = false AND eleve_id IS NULL
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 8.3 Taux `hasUsableContent` (miroir migration 20260707130000)

```sql
SELECT
  count(*) FILTER (
    WHERE NOT (
      consigne IS NOT NULL AND btrim(consigne) <> ''
      AND (
        format IN ('production_ecrite', 'production_orale')
        OR (
          jsonb_typeof(contenu) = 'object'
          AND jsonb_typeof(contenu -> 'items') = 'array'
          AND jsonb_array_length(contenu -> 'items') > 0
        )
      )
    )
  ) AS failing,
  count(*) AS bank_total
FROM public.exercices
WHERE is_template = false AND eleve_id IS NULL;
```

### 8.4 Exercices Lot 8 insérés

```sql
SELECT metadata_code, niveau_vise, competence, format, theme, titre
FROM public.exercices
WHERE metadata_code LIKE 'sf-p0:%'
ORDER BY metadata_code;
```

### 8.5 Cohérence format/compétence (nouveaux uniquement)

```sql
SELECT id, metadata_code, competence, format
FROM public.exercices
WHERE metadata_code LIKE 'sf-p0:%'
  AND (
    (competence = 'CE' AND format NOT IN ('qcm','vrai_faux','texte_lacunaire','appariement','transformation'))
    OR (competence = 'EE' AND format NOT IN ('production_ecrite','texte_lacunaire','transformation','qcm'))
    OR (competence = 'Structures' AND format NOT IN ('texte_lacunaire','qcm','transformation','appariement','vrai_faux'))
  );
-- Attendu : 0 lignes
```

### 8.6 Thème renseigné sur P0

```sql
SELECT count(*) FILTER (WHERE theme IS NULL) AS sans_theme,
       count(*) AS total_p0
FROM public.exercices
WHERE metadata_code LIKE 'sf-p0:%';
-- Attendu : sans_theme = 0
```

### 8.7 Doublons `metadata_code`

```sql
SELECT metadata_code, count(*)
FROM public.exercices
WHERE metadata_code LIKE 'sf-p0:%'
GROUP BY 1
HAVING count(*) > 1;
-- Attendu : vide
```

### 8.8 Simulation search-first (manuelle post-insert)

Tester via l'app ou un script qui appelle `findReusableExercises` pour chaque cellule avec `niveauVise` + `competence` + `themeId` et vérifier `reusable.length ≥ 1`.

**Pilote B2 CE :** après insert, vérifier spécifiquement `niveauVise = 'B2'`, `competence = 'CE'`, avec au moins un thème IRN prioritaire (`prefecture`, `vie_citoyenne`, `travail`, `logement`).

---

## 9. Critères GO / NO-GO (stratégie pilote)

> **Première étape obligatoire :** seul le manifest dry-run **B2 CE** (14 entrées) est requis pour autoriser l'implémentation du script pilote. Les autres cellules (A2 Structures, B1 EE, B1 Structures, B2 EE, B2 Structures) restent documentées en §6 mais **non exécutables** tant que la validation post-insert du pilote B2 CE n'est pas passée.

### 9.1 GO pilote B2 CE (dry-run) — autorise l'implémentation du script

Conditions requises pour passer à l'implémentation `fill-search-first-p0.mjs` en mode `--dry-run` :

- [ ] Manifest `--dry-run --cell "B2:CE"` produit avec **exactement 14 entrées** (`sf-p0:B2:CE:001` … `014`)
- [ ] **100 %** des 14 entrées : Zod OK + `validateExercise.ok` + `hasUsableContent` OK
- [ ] Aucune entrée avec format hors `FORMATS_BY_COMPETENCE['CE']`
- [ ] Tous les CE : `contenu.texte` présent (≥ 20 caractères)
- [ ] Distribution conforme au §6.1 : 8 qcm · 4 vrai_faux · 2 texte_lacunaire
- [ ] Thèmes IRN parmi `prefecture`, `vie_citoyenne`, `travail`, `logement` — aucun `theme` NULL
- [ ] Aucun doublon `metadata_code` dans le manifest
- [ ] Requête SQL §8.1 exécutée **AVANT** (baseline B2 CE = 1 confirmée)
- [ ] Revue pédagogique du manifest B2 CE par le formateur référent

**Résultat :** GO → implémenter le script pilote (commit séparé, dry-run uniquement).

### 9.2 GO insertion B2 CE — autorise `--apply` (approbation séparée)

Conditions requises **après** revue du manifest dry-run B2 CE, pour une exécution `--apply` distincte :

- [ ] GO pilote B2 CE (dry-run) validé (§9.1)
- [ ] `SF_P0_FORMATEUR_ID` et `SF_P0_POINT_ID` configurés et testés (insert test 1 ligne rollback)
- [ ] Backup banque exporté (`SELECT *` banque ou snapshot Supabase)
- [ ] Budget IA pilote approuvé (≤ 1 USD pour 14 exercices)
- [ ] Index unique `sf-p0:%` déployé (ou upsert applicatif vérifié)
- [ ] Approbation explicite séparée pour l'insertion (pas couverte par ce commit documentation)

**Résultat :** GO → `--apply --cell "B2:CE"` par vagues de 5–14.

### 9.3 GO autres cellules — bloqué jusqu'à validation post-insert B2 CE

Les cellules suivantes restent **documentées mais non exécutables** :

| Cellule | Entrées | Bloqué jusqu'à |
|---------|---------|----------------|
| A2 Structures | +20 | Validation post-insert B2 CE |
| B1 EE | +20 | Validation post-insert B2 CE |
| B1 Structures | +15 | Validation post-insert B2 CE |
| B2 EE | +15 | Validation post-insert B2 CE |
| B2 Structures | +15 | Validation post-insert B2 CE |

**Conditions de déblocage (GO autres cellules) :**

- [ ] Insert B2 CE terminé : 14 lignes `sf-p0:B2:CE:*` en base
- [ ] Requêtes SQL §8.1, §8.3, §8.5, §8.6, §8.7 passées sur le pilote
- [ ] `hasUsableContent` = 100 % sur les 14 nouveaux exercices
- [ ] Test search-first manuel (§8.8) : `findReusableExercises` retourne ≥ 1 exercice B2 CE par thème testé
- [ ] Aucune régression signalée sur la banque existante (621 → 635)
- [ ] Manifest dry-run par cellule suivante produit et relu (même pipeline que §9.1, adapté à la cellule)
- [ ] Budget IA complémentaire approuvé (≤ 10 USD total Lot 8)

**Résultat :** GO → extension cellule par cellule selon §4.7 phases 2–6.

### 9.4 NO-GO — arrêt immédiat

- Taux d'échec validation > 10 % sur le dry-run B2 CE
- Manifest B2 CE ≠ 14 entrées ou séquence `metadata_code` incomplète
- Insert test FK échoue (`formateur_id` / `point_a_maitriser_id`)
- Manifest contient des doublons `metadata_code`
- Génération IA produit systématiquement des CE sans `texte`
- Dépassement budget IA sans validation
- Tentative d'exécuter une cellule autre que B2 CE avant validation post-insert pilote
- Tentative d'insérer les 99 en une seule commande (interdit par le plan)
- Tentative de `--apply` sans GO insertion B2 CE explicite (§9.2)

---

## 10. Prochaines étapes

1. **Ce commit** — persistance du plan dans `docs/lot8-p0-plan.md` (documentation uniquement)
2. **Commit séparé** — implémenter `scripts/fill-search-first-p0.mjs` pilote B2 CE, **dry-run uniquement**
3. Exécuter `--dry-run --cell "B2:CE"`, produire manifest 14 entrées
4. Revue pédagogique du manifest → critères §9.1
5. **Approbation séparée** → `--apply --cell "B2:CE"` (critères §9.2)
6. Requêtes SQL post-insert pilote + test search-first §8.8
7. Si validation OK → déblocage progressif des autres cellules (§9.3, §4.7 phases 2–6)

---

## Annexe — Références code

| Élément | Fichier |
|---------|---------|
| Formats par compétence | `supabase/functions/_shared/exercise-search.ts` L36–42 |
| `hasUsableContent` | `exercise-search.ts` L70–77 |
| Thèmes canoniques | `exercise-search.ts` L118–127 ; migration `chk_exercices_theme_v4` |
| Validation exercice | `supabase/functions/_shared/exercise-validator.ts` |
| Upsert idempotent | `scripts/curriculum/lib/publish-bridge.mjs` L82–115 |
| Pattern dry-run | `scripts/backfill-exercices-metadata.mjs` |
| Schéma tool IA | `supabase/functions/generate-exercises/index.ts` L28–109 |
| Forme `contenu.items` | `scripts/curriculum/lib/publish-bridge-lib.mjs` L48–65 |
| SQL hasUsableContent | `supabase/migrations/20260707130000_normalize_exercices_contenu_string_to_object.sql` |

---

*Document de cadrage Lot 8 P0. Aucune insertion, aucun script, aucune génération IA dans ce commit. Pilote B2 CE +14 en dry-run = prochaine étape (commit séparé).*
