# Plan d'intégration UI — Rapport de sélection pré-séance

**Date :** 7 juillet 2026  
**Projet :** `primo-fluency-hub`  
**Statut :** PLAN UNIQUEMENT — aucun code applicatif, aucune génération IA, aucun changement Supabase  
**Références :** `docs/lot9-pre-session-selection-plan.md`, `docs/pre-session-selection-strategy.md`, `src/lib/pre-session-selection.ts`

---

## 1. Décision produit (rappel)

| Élément | Valeur |
|---------|--------|
| Route | `/formateur/seances/:id/pilote` |
| Page | `SessionPilot` |
| Outil toolbox | **Activité commune** (`id: "common"`) |
| Conteneur actuel | `PreflightExercises` |
| Emplacement rapport | **Au-dessus** de la barre « Générer un lot / Vérifier le lot » |
| Composant futur | `PreSessionSelectionReport.tsx` |
| Sections affichées | `retained`, `excluded`, `remaining_gaps`, `generation_need`, `human_review_items` |
| Boutons | **Appliquer la sélection** · **Compléter par IA** (signal-only, désactivé tant que Lot 8 `generated_strict` non validé — **aucun appel direct** à `generate-exercises`) |
| Orchestration future | `prepareSessionKit.ts` : remplacer `generateFiveExercises` par `preSessionSelectExercises` → rapport → complément validé |

---

## 2. État des lieux (inspection read-only)

### 2.1 Routage

```157:157:src/App.tsx
<Route path="seances/:id/pilote" element={<SessionPilot />} />
```

### 2.2 Chaîne de rendu UI

```
SessionPilot
  └── SessionToolbox (L1937)
        └── tool "Activité commune" (sessionTools[2], L1509–1524)
              └── PreflightExercises (L1517–1523)
```

`SessionPilot` charge les exercices de séance via React Query `["session-exercices", id]` (L225–237) et les passe à `PreflightExercises` sous la prop `exercises`.

### 2.3 Point d'insertion exact — `PreflightExercises.tsx`

Fichier cible de modification future : **`src/components/PreflightExercises.tsx`**

Structure actuelle du `CardContent` (L397–515) :

| Lignes | Bloc |
|--------|------|
| **L397–398** | `<CollapsibleContent>` → `<CardContent className="space-y-4 pt-0">` |
| **L399–424** | Barre d'actions (« Taille du lot », « Générer un lot », « Vérifier le lot ») |
| **L426–514** | Liste des exercices ou état vide |

**Emplacement cible du rapport :** insérer `<PreSessionSelectionReport … />` **entre L398 et L399**, c'est-à-dire comme **premier enfant** de `CardContent`, **immédiatement au-dessus** du `<div className="flex flex-wrap items-center gap-2 border-t pt-3">` (barre L400).

```tsx
<CardContent className="space-y-4 pt-0">
  {/* ── NOUVEAU : rapport sélection pré-séance ── */}
  <PreSessionSelectionReport … />

  {/* ── Action bar (existant) ── */}
  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
    …
    Générer un lot / Vérifier le lot
  </div>
  …
</CardContent>
```

Le `border-t` de la barre d'actions reste une séparation visuelle entre le rapport et les actions de lot.

### 2.4 Flux actuel `generateFiveExercises` — `prepareSessionKit.ts`

`prepareSessionKit` (L36–61) lance en parallèle :

1. `generatePrediagnostic`
2. **`generateFiveExercises`** ← point de remplacement futur
3. `generateHomeworkSeriesForPreviousSession`

`generateFiveExercises` (L138–270) :

| Étape | Lignes | Comportement |
|-------|--------|--------------|
| Garde anti-doublon | L152–157 | Skip si `session_exercices` déjà peuplés |
| Pont curriculum | L159–177 | `tryLinkCurriculumExercises` si `training_session_id` |
| Plan adaptatif | L195–196 | `loadPreviousHomeworkPerformance` + `buildAdaptiveExercisePlan` |
| **Génération IA directe** | L201–226 | `supabase.functions.invoke("generate-exercises", …)` en parallèle par slot |
| Insert + lien séance | L230–269 | Insert `exercices` puis `session_exercices` |

**Remplacement prévu :** avant tout appel `generate-exercises`, exécuter `preSessionSelectExercises` sur la banque, persister/exposer le rapport, lier les `retained`, puis ne compléter que `generation_need.total_gap` via un chemin validé Lot 8 (`validation_profile = generated_strict`).

### 2.5 Flux manuel parallèle — `PreflightExercises`

`handleGenerateBatch` (L157–244) appelle **directement** `generate-exercises` (L182–192) — indépendant de `prepareSessionKit`. Le rapport pré-séance doit clarifier la relation entre :

- sélection banque (search-first),
- complément IA (futur, gated),
- génération manuelle « Générer un lot » (existant, à ne pas confondre avec « Compléter par IA »).

### 2.6 Module de sélection existant

`src/lib/pre-session-selection.ts` exporte déjà :

- `preSessionSelectExercises(candidates, params) → PreSessionSelectionReport`
- Types : `PreSessionSelectionReport`, `RetainedExercise`, `ExcludedSection`, `RemainingGap`, `GenerationNeed`, `HumanReviewItem`

Logique **pure** : le caller charge le pool candidats (lecture Supabase) puis appelle la fonction.

---

## 3. Composant futur — `PreSessionSelectionReport.tsx`

### 3.1 Fichier cible

**`src/components/PreSessionSelectionReport.tsx`**

> Note : `docs/lot9-pre-session-selection-plan.md` §6.2 propose `src/components/formateur/`. La convention actuelle des composants pilot (`PreflightExercises`, `StartOfSessionBilan`) est `src/components/` — ce plan retient ce chemin.

### 3.2 Interface props proposée

```typescript
import type {
  PreSessionSelectionReport as PreSessionSelectionReportData,
  PreSessionSelectionParams,
} from "@/lib/pre-session-selection";

export interface PreSessionSelectionReportProps {
  /** Rapport produit par preSessionSelectExercises (ou agrégat multi-compétences). */
  report: PreSessionSelectionReportData | null;

  /** Paramètres de la séance utilisés pour la sélection (affichage en-tête). */
  selectionParams: PreSessionSelectionParams | PreSessionSelectionParams[];

  /** Chargement du pool banque + calcul du rapport. */
  isLoading?: boolean;

  /** Erreur lecture banque ou calcul. */
  error?: string | null;

  /** Exercices déjà liés à la séance (évite double application). */
  linkedExerciceIds: string[];

  /**
   * true si Lot 8 a validé le pipeline generated_strict pour le complément IA.
   * Tant que false : bouton « Compléter par IA » désactivé + tooltip explicatif.
   */
  lot8ComplementEnabled: boolean;

  /** IDs retenus déjà présents en session_exercices → badge « déjà appliqué ». */
  appliedExerciceIds?: string[];

  /** Callback « Appliquer la sélection » — lie retained non encore liés. */
  onApplySelection: (exerciceIds: string[]) => void | Promise<void>;

  /**
   * Callback « Compléter par IA » — signal-only dans cette phase :
   * toast / badge / événement analytics ; PAS d'invoke generate-exercises.
   */
  onRequestComplement: (report: PreSessionSelectionReportData) => void;

  /** Désactive les actions pendant une mutation (apply). */
  isApplying?: boolean;
}
```

### 3.3 Sections UI (mapping rapport → affichage)

| Section rapport | Contenu UI minimal |
|-----------------|-------------------|
| `retained` | Tableau compact : titre, compétence, tier (`P1_validated` / `P2_nr_*`), score, badge fraîcheur |
| `excluded` | Compteurs par `ExclusionCode` + échantillon `samples` (3–5 lignes) repliable |
| `remaining_gaps` | Lignes `cell_key`, `requested` / `retained_va` / `gap`, badge `severity` |
| `generation_need` | Bandeau si `required` : `total_gap`, `estimated_generation_count`, `defer_to_lot8_p0` |
| `human_review_items` | Liste priorisée (`haute` en premier), icône par `HumanReviewType` |

En-tête meta : `meta.generated_at`, pools P1/P2, `nr_fallback_allowed`.

### 3.4 Barre d'actions du composant

Placée en bas du rapport (au-dessus de la barre « Générer un lot » du parent) :

| Bouton | État | Comportement |
|--------|------|--------------|
| **Appliquer la sélection** | Actif si `retained.length > 0` et IDs non déjà liés | `onApplySelection(retained.map(r => r.exercice_id))` → insert `session_exercices` |
| **Compléter par IA** | **Désactivé** si `!lot8ComplementEnabled` ou `!generation_need.required` | `onRequestComplement(report)` — signal uniquement (toast « complément IA non disponible » ou « demande enregistrée ») |

**Interdit dans cette phase :** `supabase.functions.invoke("generate-exercises", …)` depuis ce composant ou ses handlers.

---

## 4. Sources de données requises

### 4.1 Pour calculer le rapport (côté client ou edge future)

| Source | Table / module | Champs / usage |
|--------|----------------|----------------|
| Banque exercices | `exercices` | `id, titre, competence, niveau_vise, format, theme, contenu, validation_status, validation_issues, validation_score, is_template, eleve_id` — filtre `is_template = false`, `eleve_id IS NULL` (cf. dry-run L155–162) |
| Contexte séance | `sessions` (déjà chargé SessionPilot L163–175) | `niveau_cible`, `competences_cibles`, `objectifs`, `training_session_id`, `curriculum_palier_cible`, `group_id` |
| Groupe | `sessions.group` (join) | `type_demarche` |
| Exercices déjà liés | `session_exercices` (déjà chargé) | `exercice_id` → `excludeExerciceIds` |
| Fraîcheur (optionnel phase 2) | `session_exercices` historique groupe | `recent_occurrences`, `fresh` sur candidats |
| Scoring search-first (optionnel) | `exercise-search.ts` | `search_score`, `matched_rules` pré-calculés avant `preSessionSelectExercises` |
| Plan slots | `adaptiveExercisePlan.ts` | Quotas par compétence (remplace quota fixe 5 dans prepareSessionKit) |
| Performance devoirs | `prepareSessionKit.loadPreviousHomeworkPerformance` | Influence répartition compétences (orchestration) |

### 4.2 Paramètres `PreSessionSelectionParams` dérivés de la séance

```typescript
{
  niveauVise: session.niveau_cible ?? parcoursSeance?.parcours?.niveau_cible ?? "A1",
  competence: /* un rapport par compétence cible */,
  themeId: /* curriculum / objectif si disponible */,
  quota: /* slot du plan adaptatif */,
  excludeExerciceIds: exercises.map(se => se.exercice_id),
  typeDemarche: session.group?.type_demarche ?? "titre_sejour",
}
```

### 4.3 Gate « Compléter par IA » (`lot8ComplementEnabled`)

Critère produit : **Lot 8 `generated_strict` validé** — pas de complément IA automatique tant que :

- le pipeline de validation `validation_profile = 'generated_strict'` n'est pas opérationnel pour les nouveaux inserts Lot 8 (cf. `docs/lot9-validation-calibration.md`, `docs/lot8-p0-plan.md`) ;
- ou `generation_need.defer_to_lot8_p0 === true` (cellule P0 sans VA).

Implémentation UI minimale : prop booléenne injectée par `PreflightExercises` (hardcodée `false` en phase 1, branchée sur feature flag ou métrique Lot 8 en phase 2).

### 4.4 Props additionnelles `PreflightExercises` (futur)

```typescript
interface PreflightExercisesProps {
  // … existant L38–44
  preSessionReport?: PreSessionSelectionReportData | null;
  onPreSessionReportRefresh?: () => void;
}
```

`SessionPilot` n'a pas besoin de changer immédiatement si le fetch rapport vit dans `PreflightExercises` ; optionnel : badge statut sur l'outil `common` via `preparationStatus` / warning dérivé de `human_review_items`.

---

## 5. Risques UX

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Double source de vérité** | Rapport dit 5 retenus, liste en dessous montre exercices IA déjà générés par `prepareSessionKit` legacy | Afficher bandeau si `exercises.length > 0` avant application : « Séance déjà peuplée — rapport informatif » ; désactiver « Appliquer » si tout est déjà lié |
| **Confusion Générer un lot vs Compléter par IA** | Formateur déclenche deux chemins IA | Libellés distincts ; « Compléter par IA » désactivé + tooltip Lot 8 ; conserver « Générer un lot » comme override manuel explicite |
| **Rapport vide / erreur banque** | Écran bloquant au-dessus des actions | État empty graceful ; la barre Générer/Vérifier reste utilisable |
| **NR en repli (tiers vert/orange)** | Inquiétude formateur sur qualité | Badge tier + lien vers `human_review_items` ; expliciter max 30 % quota NR |
| **Cellules P0 (B2:CE, etc.)** | Attente de 5 exercices banque, 0 retenu | Bandeau `generation_need` + `defer_to_lot8_p0` ; message P0_BLOCKING dans relecture humaine |
| **Thèmes sensibles (prefecture B1/B2)** | 0 retenu auto perçu comme bug | Section `human_review_items` mise en avant ; pas de bouton complément sans revue |
| **Apply partiel** | Certains `retained` déjà liés ailleurs | Filtrer `excludeExerciceIds` avant apply ; toast récapitulatif |
| **Latence chargement banque** | Skeleton prolongé | `isLoading` sur rapport seul ; ne pas bloquer collapse/verify |
| **Signal-only frustrant** | Clic « Compléter par IA » sans effet | Tooltip « Disponible après validation Lot 8 » ; option toast « Demande notée » pour analytics |

---

## 6. Orchestration future — `prepareSessionKit.ts`

Séquence cible (remplace L201–226) :

```
generateFiveExercises()
  │
  ├─ 1. Garde count session_exercices (inchangé L152–157)
  ├─ 2. tryLinkCurriculumExercises (inchangé L169–177) — peut coexister
  ├─ 3. Charger banque + fraîcheur
  ├─ 4. buildAdaptiveExercisePlan → pour chaque slot :
  │       report = preSessionSelectExercises(bank, params)
  ├─ 5. Lier retained → session_exercices
  ├─ 6. Agréger generation_need
  └─ 7. SI lot8ComplementEnabled ET total_gap > 0 :
         complément validé generated_strict (PAS invoke direct depuis UI)
     SINON :
         persister rapport pour affichage Preflight (signal gap)
```

Le rapport calculé en auto-prep doit être **récupérable** par l'UI (table/cache `session_blocks` warning, colonne JSON future, ou recalcul client idempotent).

---

## 7. Étapes d'implémentation minimales

| # | Étape | Fichiers | Livrable |
|---|-------|----------|----------|
| **1** | Créer `PreSessionSelectionReport.tsx` (présentation seule, mock report) | `src/components/PreSessionSelectionReport.tsx` | Sections + boutons désactivés conformes produit |
| **2** | Insérer le composant dans `PreflightExercises` au-dessus de L400 | `src/components/PreflightExercises.tsx` | Emplacement validé visuellement |
| **3** | Hook `usePreSessionSelectionReport` : fetch banque + `preSessionSelectExercises` | `src/hooks/usePreSessionSelectionReport.ts` (nouveau) | `report` réel, `isLoading`, `error` |
| **4** | Brancher props `PreflightExercises` : `linkedExerciceIds`, `lot8ComplementEnabled={false}` | `PreflightExercises.tsx` | Pas d'IA |
| **5** | Implémenter `onApplySelection` : insert `session_exercices` pour retained non liés | `PreflightExercises.tsx` ou helper `applyPreSessionSelection.ts` | Mutation + invalidate `session-exercices` |
| **6** | `onRequestComplement` : toast signal-only | `PreSessionSelectionReport.tsx` | Aucun `generate-exercises` |
| **7** | (Backend) Remplacer corps IA de `generateFiveExercises` | `src/lib/prepareSessionKit.ts` | Search-first auto-prep |
| **8** | Activer `lot8ComplementEnabled` quand Lot 8 validé | Feature flag / config | Déblocage progressif complément |

**Hors scope immédiat :** migrations Supabase, edge `generate-exercises`, modification scoring `exercise-search.ts`.

---

## 8. Critères d'acceptation UI

- [ ] Rapport visible sur `/formateur/seances/:id/pilote` → Activité commune, **au-dessus** de « Générer un lot / Vérifier le lot »
- [ ] Cinq sections affichées quand `report` non null
- [ ] « Appliquer la sélection » lie les exercices retenus sans appeler l'IA
- [ ] « Compléter par IA » jamais connecté à `generate-exercises` ; désactivé si `!lot8ComplementEnabled`
- [ ] Aucune régression sur verify/send/regenerate existants (L246–362, L426–514)
- [ ] Scénarios dry-run reproductibles : A1 CE (plein), B2 CE (P0 gap), B1 prefecture (0 VA, human review)

---

## 9. Fichiers touchés (récapitulatif)

| Fichier | Rôle | Action |
|---------|------|--------|
| `src/App.tsx` | Route pilote | Lecture seule |
| `src/pages/formateur/SessionPilot.tsx` | Toolbox + props exercises | Modification optionnelle (badge) |
| `src/components/PreflightExercises.tsx` | **Point d'insertion principal** | Modifier (L398–399) |
| `src/components/PreSessionSelectionReport.tsx` | UI rapport | **Créer** |
| `src/lib/pre-session-selection.ts` | Logique + types | Lecture seule (réutiliser types) |
| `src/lib/prepareSessionKit.ts` | Orchestration auto-prep | Modifier (phase backend) |
| `docs/pre-session-integration-ui-plan.md` | Ce document | — |
