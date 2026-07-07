# Diagnostic generation_need — PreSessionSelection

**Généré :** 2026-07-07T22:32:52.051Z
**Commit :** 6864afc
**Mode :** read-only — 0 écriture Supabase, 0 génération IA, 0 modification scoring
**Banque lue :** 621 exercices `legacy_bank`
**Seuil réutilisation :** REUSE_SCORE_MIN = 80

## Méthodologie

Pour chaque scénario `generation_need` :

1. **Pool pré-scoring** : candidats passant filtres dimensionnels (`compétence`, `niveau ±1`, `format` autorisé, `hasUsableContent`).
   - Note : le **thème n'est pas un filtre dimensionnel** dans `pre-session-selection.ts` ; il agit via le juge (`EXCL_01` / `SCORE_01`).
2. **Exclusions score bas** : VA (`validated_auto` / `approved_human`) avec score estimé < 80 ou hard-filter scoring.
3. **Classification** : vrai trou banque | score insuffisant | désalignement thème/format | statut validation.

## Synthèse exécutive (FR)

| Scénario | Verdict | Action prioritaire |
|----------|---------|-------------------|
| **S2** A2 CO préfecture | Mixte : 4 VA retenus (tous A1), ~20 A2 préfecture en NR tier rouge | Promouvoir NR A2 préfecture (score 100) **ou** générer 1 CO A2 préfecture |
| **S3** B1 CO préfecture | **Score/métadonnées**, pas trou pur | Backfill `theme=prefecture` sur VA sans thème ; corriger niveau B1 ; NR préfecture bloqués (tier rouge + thème sensible) |
| **S4** B2 CE | Trou validation : 12 NR B1, 0 VA | Génération Lot 8 P0 + créer du B2 CE validé |
| **S6** B1 EE | Mixte : 0 exercice B1 en banque, 4 VA A2 sous seuil (60) | Génération B1 EE (P0) + backfill niveau/thème sur existants |
| **S7** B2 Structures | **Vrai trou banque** (0 candidat dimensionnel) | Génération intégrale Lot 8 P0 |

### Focus S3 — B1 CO préfecture : pourquoi 8 VA exclus ?

Les 8 `validated_auto` passent les filtres dimensionnels (CO, niveau A2/B1/B2, format OK) mais **aucun n'atteint REUSE_SCORE_MIN=80** :

| ID | Niveau | Thème | Score | Cause racine |
|----|--------|-------|-------|--------------|
| `634e81c6` | **B1** | *(null)* | 60 | Sans bonus SCORE_01 (+40) — **backfill `prefecture` le ferait passer à 100** |
| `7132a092`, `33a9ed74`, `a4dfbdf1` | A2 | *(null)* | 60 | Niveau A2 (+10) + pas de thème → 60 ; tag préfecture → ~100 |
| `fa43fca5`, `7a05e456` | A2/B1 | sante | 0 | EXCL_01 rupture thématique (santé ≠ préfecture) |
| `81a82a3b` | A2 | logement | 0 | EXCL_01 rupture thématique |
| `09837c3f` | B2 | *(null)* | 0 | EXCL_09 — titre de séjour exclut B2 |

**Contenu latent non exploitable :** 31 exercices préfecture en pool pré-scoring, dont **~25 NR à score 100** — bloqués par `EXCL_NR_TIER_ROUGE` (56/56 NR tier rouge) et `EXCL_NR_THEME_SENSIBLE` (préfecture = thème sensible sans `approved_human`). Repli NR **interdit** pour préfecture B1 (`nr_fallback_allowed=false`).

**Recommandation S3 :**
1. **Métadonnées d'abord** : backfill `theme=prefecture` sur `634e81c6` (+ 3 VA A2 sans thème) — gain immédiat sans génération.
2. **Validation** : faire passer 5–10 NR préfecture B1 (score 100) en `validated_auto` ou `approved_human`.
3. **Génération** seulement si, après (1)+(2), gap résiduel > 0.

## Synthèse

| Scénario | Retenus | Gap | Raison gen. | Pool pré-score | VA banque | P1 pool | Classification |
|----------|---------|-----|-------------|----------------|-----------|---------|----------------|
| A2 / CO / prefecture / quota 5 | 4/5 | 1 | PARTIAL_GAP | 114 | 53 | 4 | Écart partiel — métadonnées thème |
| B1 / CO / prefecture / quota 5 | 0/5 | 5 | ALL_REJECTED_OR_STALE | 69 | 8 | 0 | Banque présente mais score insuffisant |
| B2 / CE / quota 5 | 0/5 | 5 | P0_CELL_ZERO_VA | 12 | 0 | 0 | Banque présente mais aucun VA |
| B1 / EE / quota 5 | 1/5 | 4 | PARTIAL_GAP | 15 | 5 | 1 | Vrai trou banque (partiel) |
| B2 / Structures / quota 5 | 0/5 | 5 | P0_CELL_ZERO_VA | 0 | 0 | 0 | Vrai trou banque |

---

## S2 — A2 / CO / prefecture / quota 5

**Résultat attendu :** 4/5 PARTIAL_GAP
**Cellule :** `A2:CO` · thème cible `prefecture`
**P0 :** non

### Métriques sélection

| Métrique | Valeur |
|----------|--------|
| retained | 4 / 5 |
| P1 pool | 4 |
| VA en banque (post-filtres dim.) | 53 |
| remaining_gap | 1 |
| generation_reason | PARTIAL_GAP |
| nr_fallback_allowed | true |

### Classification

- **Verdict :** Écart partiel — métadonnées thème (`theme_metadata_gap`)
- Pool P1=4 insuffisant ; candidats proches sans thème cible (49 sous seuil potentiellement corrigeables).

### Recommandations

- **Mixte score + validation** : seuls 4 VA passent le seuil (tous A1 préfecture, score 100) ; ~20 exercices A2 préfecture scorent 100 mais sont NR tier rouge.
- Promouvoir NR A2 préfecture vers `validated_auto` / `approved_human` (priorité sur génération).
- Sinon : génération ciblée de **1** CO A2 préfecture.

### 1. Candidats pré-scoring (114)

Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.

**Par statut validation :** validated_auto=53, approved_human=0, needs_review=53, rejected=8, other=0
**Par niveau :** B1=18, A2=37, A1=59
**Par thème canonique :** sante=12, prefecture=33, transport=13, vie_citoyenne=3, (null)=51, logement=2
**Par format :** qcm=95, vrai_faux=18, texte_lacunaire=1

| ID (8) | Titre | Niv. | Thème | Format | Statut | Score est. | Règles |
|--------|-------|------|-------|--------|--------|------------|--------|
| f96c1529 | Vocabulaire et expressions du contexte m | B1 | sante | qcm | needs_review | 0 | — |
| fa43fca5 | Rendez-vous médical : prendre une consul | A2 | sante | vrai_faux | validated_auto | 0 | — |
| fb7f5239 | Comprendre une enquête à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 136a1d26 | Annonce Gare : Train Paris-Lyon | A1 | transport | qcm | needs_review | 0 | — |
| 1c62a3f2 | Horaires de la mairie | A1 | prefecture | qcm | rejected | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 9892321c | Aller à la pharmacie | A1 | sante | qcm | validated_auto | 0 | — |
| 32d1ffdb | Comprendre les horaires de transport | A1 | transport | qcm | validated_auto | 0 | — |
| 4530184c | Rendez-vous à la préfecture | A1 | prefecture | qcm | validated_auto | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4c983a50 | Épeler son nom (CO) | A1 | vie_citoyenne | qcm | validated_auto | 0 | — |
| b3c31e26 | Écoutez les messages et identifiez les h | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5665dc85 | Annonce de la gare : Départ du train | A1 | transport | qcm | validated_auto | 0 | — |
| efd95cf3 | CO - Documents officiels | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5a76c6e0 | Problème d'orientation à la préfecture | A1 | prefecture | qcm | validated_auto | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 60ed11de | Où est la gare routière ? | A1 | transport | qcm | needs_review | 0 | — |
| fa0227c3 | Où prendre le bus numéro 7 ? | A1 | transport | qcm | needs_review | 0 | — |
| 048100b6 | Message vocal du médecin | A1 | sante | qcm | validated_auto | 0 | — |
| 14ee9ec2 | Les consignes de la préfecture | A1 | prefecture | vrai_faux | rejected | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 81a82a3b | Un message de la CAF concernant le dossi | A2 | logement | qcm | validated_auto | 0 | — |
| 85654fd7 | Comprendre les annonces de la gare | A1 | transport | qcm | validated_auto | 0 | — |
| 86130260 | Prendre rendez-vous à la mairie | A1 | prefecture | qcm | validated_auto | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 15002bf9 | Trouver la sortie du métro | A1 | transport | qcm | validated_auto | 0 | — |
| 12ede1af | Comprendre une demande administrative à  | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2b41a0f8 | Comprendre un rendez-vous à la préfectur | A2 | prefecture | vrai_faux | rejected | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e3457a11 | Les heures en gare | A1 | transport | qcm | needs_review | 0 | — |
| 75b18bcc | Où est le bureau des impôts ? | A1 | prefecture | qcm | validated_auto | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3136af07 | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| dfe1ca1e | Nouveau rendez-vous pour la formation | A2 | — | qcm | rejected | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a933ccc2 | Préfecture : Comprendre les consignes or | A2 | prefecture | qcm | rejected | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 51ca0951 | Message du médecin : instructions pour u | A2 | sante | vrai_faux | needs_review | 0 | — |
| 5448c46f | Demande de logement social à la mairie | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 06be5180 | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 16ea8cbd | Identifier les verbes du présent dans un | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a834be5d | Comprendre un contrôle d'identité (Oral) | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1b4d279d | Comprendre les documents administratifs  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| f9035bfa | CO - Comprendre une adresse | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1e3ff1eb | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2ba3c9c4 | CO - Les nombres et l'âge | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 73fa072e | Le pronom EN - Contexte alimentaire et C | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7a05e456 | Lexique médical et prise de rendez-vous  | B1 | sante | qcm | validated_auto | 0 | — |
| 1e3e0f5b | CO - Comprendre des coordonnées | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 33382dd4 | Le pronom relatif « qui » dans les conte | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3ea5f382 | Comprendre une démarche administrative à | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 50c9d01d | Conseils du médecin - Impératif | A2 | sante | texte_lacunaire | needs_review | 0 | — |
| 556cba0c | Demande d'allocation familiale à la CAF | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4e72b1c6 | Comprendre les dates de rendez-vous | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 49ba6ff0 | Comprendre les consignes chiffrées (duré | A1 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 8c4a82ee | Informations personnelles à la CAF | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| bf02a920 | Où est le cabinet du docteur ? | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 913a5b72 | Identifier les informations dans un mess | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5e1834e3 | Demande de logement social à la CAF | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 9469de1a | Démarches administratives à la préfectur | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| c27c0b88 | Expressions de l'avis et conseils à la p | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 911ba239 | Rendez-vous chez le médecin en France | B1 | sante | vrai_faux | needs_review | 0 | — |
| 8068c301 | Comprendre les moyens de transport en Fr | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 91cefa80 | Comprendre une demande administrative à  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 063eacda | Comprendre une météo - Bulletin radio | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| f373e932 | Vocabulaire des sports extrêmes - Vrai o | A2 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| cf6f5de6 | Demande de logement social et CAF | B1 | logement | qcm | needs_review | 0 | — |
| d88de779 | Rendez-vous à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a51e30f5 | Dialoguer avec un médecin : symptômes et | B1 | sante | qcm | needs_review | 0 | — |
| ad0f1e82 | Rendez-vous à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 90c05bb0 | Annonce de gare : départ | A1 | transport | qcm | validated_auto | 0 | — |
| 944ac479 | Annonce à la gare : Horaires de train | A1 | transport | qcm | validated_auto | 0 | — |
| 9f207a0a | Départ du bus | A1 | transport | qcm | needs_review | 0 | — |
| be4b6251 | Comprendre une annonce de train | A1 | transport | qcm | validated_auto | 0 | — |
| c573d926 | L'heure du rendez-vous chez le médecin | A1 | sante | qcm | validated_auto | 0 | — |
| e0c70f71 | CO - Situation familiale | A1 | vie_citoyenne | qcm | validated_auto | 0 | — |
| f5869b1a | Annonce à la gare | A1 | transport | qcm | validated_auto | 0 | — |
| 406d8725 | Comprendre des coordonnées au téléphone | A1 | — | qcm | rejected | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 37411d37 | Exercice CO Test | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| de4a816f | Comprendre la situation familiale (CO) | A1 | vie_citoyenne | qcm | validated_auto | 0 | — |
| 1eafcaf1 | CO - Genre et Identité | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| df88d044 | CO - Origine géographique | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7b57c0de | Comprendre des informations pratiques au | A1 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| d6212c9d | Comprendre les numéros de téléphone | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 31d1d1ed | Identifier les horaires et prix (au marc | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 51fd6cbd | Où sont les toilettes publiques ? | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| bd8567cc | Consignes de sécurité à la piscine | A1 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| c255174e | Appel à la préfecture pour un rendez-vou | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| c5e62f1c | Démarches administratives à la préfectur | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| d41f46b7 | Vrai ou Faux : Démarches administratives | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| de62e8d3 | Comprendre une annonce à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e64b08bc | Comprendre une demande administrative à  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 029a96b5 | Écouter des coordonnées (Consolidation) | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e50f3fbe | Comprendre des numéros de téléphone (Rem | A1 | — | qcm | rejected | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4f887926 | Comprendre un message téléphonique | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 277573d8 | Conversation téléphonique : Annulation d | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5e1854be | Comprendre les horaires de la poste | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 28271013 | Comprendre les informations dans un mess | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 844e7266 | Rendez-vous chez le médecin | A1 | sante | qcm | validated_auto | 0 | — |
| 41f4ea7b | Où sont les caisses à la Poste ? | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 68cb519c | Les horaires du marché | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 54b14806 | Les horaires du supermarché | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 192905e1 | Les numéros importants | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 98a783f1 | Message vocal : Horaires de la Poste | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2c3fe13d | Message du docteur Dupont | A1 | — | qcm | rejected | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 70ef8a05 | Comprendre un message sur le répondeur | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 398a103a | Magasin : horaires | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e0a2db96 | À la boulangerie | A1 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 820c265c | Vie quotidienne et fréquence | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| fead9085 | Vocabulaire du repas et expressions de g | A2 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4fd26792 | Prépositions et destinations en France | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 33a9ed74 | Comprendre une commande au restaurant | A2 | — | qcm | validated_auto | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7132a092 | Vocabulaire du petit-déjeuner et des rep | A2 | — | qcm | validated_auto | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2fd1f981 | Tâches ménagères - Compréhension écrite | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4b7382ac | Comprendre les horaires et activités quo | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 70ebaa61 | Règles de politesse en France - Vrai ou  | A2 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 6a43191d | Vacances et destinations - Comprendre le | A2 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a4dfbdf1 | Comprendre les nouveaux sports en France | A2 | — | qcm | validated_auto | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3d037877 | Comprendre les conditions d'accès aux ac | A2 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3e55daa0 | Choisir un type de vacances adapté à sa  | A2 | — | qcm | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a9b93ca1 | Vrai ou Faux : Procédures administrative | B1 | — | vrai_faux | needs_review | 60 | SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 634e81c6 | QCM : Démarches administratives en Franc | B1 | — | qcm | validated_auto | 60 | SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1c54c0fd | Dialogue au cabinet médical : expliquer  | B1 | sante | qcm | needs_review | 0 | — |

### 2. VA exclus par score bas (49)

| ID (8) | Titre | Niv. | Comp. | Thème | Format | Statut | Score | Raison | Détail |
|--------|-------|------|-------|-------|--------|--------|-------|--------|--------|
| fa43fca5 | Rendez-vous médical : prendre une c | A2 | CO | sante | vrai_faux | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 9892321c | Aller à la pharmacie | A1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 32d1ffdb | Comprendre les horaires de transpor | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 4c983a50 | Épeler son nom (CO) | A1 | CO | vie_citoyenne | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| b3c31e26 | Écoutez les messages et identifiez  | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 5665dc85 | Annonce de la gare : Départ du trai | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| efd95cf3 | CO - Documents officiels | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 048100b6 | Message vocal du médecin | A1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 81a82a3b | Un message de la CAF concernant le  | A2 | CO | logement | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 85654fd7 | Comprendre les annonces de la gare | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 15002bf9 | Trouver la sortie du métro | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| a834be5d | Comprendre un contrôle d'identité ( | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| f9035bfa | CO - Comprendre une adresse | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 2ba3c9c4 | CO - Les nombres et l'âge | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 7a05e456 | Lexique médical et prise de rendez- | B1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 1e3e0f5b | CO - Comprendre des coordonnées | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 4e72b1c6 | Comprendre les dates de rendez-vous | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| bf02a920 | Où est le cabinet du docteur ? | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 90c05bb0 | Annonce de gare : départ | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 944ac479 | Annonce à la gare : Horaires de tra | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| be4b6251 | Comprendre une annonce de train | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| c573d926 | L'heure du rendez-vous chez le méde | A1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| e0c70f71 | CO - Situation familiale | A1 | CO | vie_citoyenne | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| f5869b1a | Annonce à la gare | A1 | CO | transport | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 37411d37 | Exercice CO Test | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| de4a816f | Comprendre la situation familiale ( | A1 | CO | vie_citoyenne | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 1eafcaf1 | CO - Genre et Identité | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| df88d044 | CO - Origine géographique | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| d6212c9d | Comprendre les numéros de téléphone | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 31d1d1ed | Identifier les horaires et prix (au | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 51fd6cbd | Où sont les toilettes publiques ? | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 029a96b5 | Écouter des coordonnées (Consolidat | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 4f887926 | Comprendre un message téléphonique | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 277573d8 | Conversation téléphonique : Annulat | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 5e1854be | Comprendre les horaires de la poste | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 28271013 | Comprendre les informations dans un | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 844e7266 | Rendez-vous chez le médecin | A1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 41f4ea7b | Où sont les caisses à la Poste ? | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 68cb519c | Les horaires du marché | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 54b14806 | Les horaires du supermarché | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 192905e1 | Les numéros importants | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 98a783f1 | Message vocal : Horaires de la Post | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 70ef8a05 | Comprendre un message sur le répond | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 398a103a | Magasin : horaires | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| e0a2db96 | À la boulangerie | A1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 33a9ed74 | Comprendre une commande au restaura | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 7132a092 | Vocabulaire du petit-déjeuner et de | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| a4dfbdf1 | Comprendre les nouveaux sports en F | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 634e81c6 | QCM : Démarches administratives en  | B1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |

### NR post-filtres (53)

Répartition tiers : rouge=53

### Retenus

| ID (8) | Titre | Niv. | Thème | Score | Tier |
|--------|-------|------|-------|-------|------|
| 4530184c | Rendez-vous à la préfecture | A1 | prefecture | 100 | P1_validated |
| 5a76c6e0 | Problème d'orientation à la préfect | A1 | prefecture | 100 | P1_validated |
| 86130260 | Prendre rendez-vous à la mairie | A1 | prefecture | 100 | P1_validated |
| 75b18bcc | Où est le bureau des impôts ? | A1 | prefecture | 100 | P1_validated |


---

## S3 — B1 / CO / prefecture / quota 5

**Résultat attendu :** 0/5 ALL_REJECTED_OR_STALE (8 VA EXCL_SCORE_LOW)
**Cellule :** `B1:CO` · thème cible `prefecture`
**P0 :** non

### Métriques sélection

| Métrique | Valeur |
|----------|--------|
| retained | 0 / 5 |
| P1 pool | 0 |
| VA en banque (post-filtres dim.) | 8 |
| remaining_gap | 5 |
| generation_reason | ALL_REJECTED_OR_STALE |
| nr_fallback_allowed | false |

### Classification

- **Verdict :** Banque présente mais score insuffisant (`score_insufficient`)
- Les 8 VA passent les filtres dimensionnels mais tous échouent au seuil REUSE_SCORE_MIN (80).

### Recommandations

- **Priorité métadonnées/scoring** avant génération massive.
- Backfill `theme='prefecture'` sur 8 VA (bonus SCORE_01 +40 pts manquant → scores typiques ~70 sans thème).
- 3 VA avec thème différent — re-taguer ou accepter exclusion EXCL_01.
- 6 VA hors niveau exact (B1) — SCORE_03 (+20) vs SCORE_04 (+10) peut expliquer l'écart de 10 pts.
- Seuil actuel REUSE_SCORE_MIN=80 — ne pas modifier dans ce diagnostic ; envisager enrichissement métadonnées.

### 1. Candidats pré-scoring (69)

Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.

**Par statut validation :** validated_auto=8, approved_human=0, needs_review=56, rejected=5, other=0
**Par niveau :** B1=18, A2=37, B2=14
**Par thème canonique :** sante=8, prefecture=31, logement=4, (null)=25, travail=1
**Par format :** qcm=46, vrai_faux=22, texte_lacunaire=1

| ID (8) | Titre | Niv. | Thème | Format | Statut | Score est. | Règles |
|--------|-------|------|-------|--------|--------|------------|--------|
| f96c1529 | Vocabulaire et expressions du contexte m | B1 | sante | qcm | needs_review | 0 | — |
| fa43fca5 | Rendez-vous médical : prendre une consul | A2 | sante | vrai_faux | validated_auto | 0 | — |
| fb7f5239 | Comprendre une enquête à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 81a82a3b | Un message de la CAF concernant le dossi | A2 | logement | qcm | validated_auto | 0 | — |
| 12ede1af | Comprendre une demande administrative à  | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2b41a0f8 | Comprendre un rendez-vous à la préfectur | A2 | prefecture | vrai_faux | rejected | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3136af07 | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| dfe1ca1e | Nouveau rendez-vous pour la formation | A2 | — | qcm | rejected | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3ae5e71b | Contextes administratifs en France : sit | B2 | prefecture | qcm | needs_review | 0 | — |
| a933ccc2 | Préfecture : Comprendre les consignes or | A2 | prefecture | qcm | rejected | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 51ca0951 | Message du médecin : instructions pour u | A2 | sante | vrai_faux | needs_review | 0 | — |
| 5448c46f | Demande de logement social à la mairie | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 06be5180 | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 16ea8cbd | Identifier les verbes du présent dans un | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1b4d279d | Comprendre les documents administratifs  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1e3ff1eb | Comprendre une demande administrative à  | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 73fa072e | Le pronom EN - Contexte alimentaire et C | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7a05e456 | Lexique médical et prise de rendez-vous  | B1 | sante | qcm | validated_auto | 0 | — |
| 33382dd4 | Le pronom relatif « qui » dans les conte | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3ea5f382 | Comprendre une démarche administrative à | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 50c9d01d | Conseils du médecin - Impératif | A2 | sante | texte_lacunaire | needs_review | 0 | — |
| 556cba0c | Demande d'allocation familiale à la CAF | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 8c4a82ee | Informations personnelles à la CAF | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 8dc40198 | Vrai/Faux : Droits et obligations pour a | B2 | logement | vrai_faux | needs_review | 0 | — |
| 913a5b72 | Identifier les informations dans un mess | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5e1834e3 | Demande de logement social à la CAF | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 9469de1a | Démarches administratives à la préfectur | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 9567217e | Comprendre une demande administrative à  | B2 | prefecture | qcm | needs_review | 0 | — |
| a723f47f | Comprendre une demande administrative à  | B2 | prefecture | qcm | needs_review | 0 | — |
| c27c0b88 | Expressions de l'avis et conseils à la p | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 911ba239 | Rendez-vous chez le médecin en France | B1 | sante | vrai_faux | needs_review | 0 | — |
| 8068c301 | Comprendre les moyens de transport en Fr | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 91cefa80 | Comprendre une demande administrative à  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 063eacda | Comprendre une météo - Bulletin radio | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| f373e932 | Vocabulaire des sports extrêmes - Vrai o | A2 | — | vrai_faux | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| cf6f5de6 | Demande de logement social et CAF | B1 | logement | qcm | needs_review | 0 | — |
| 22b2bc30 | Comprendre les engagements du commerce é | B2 | — | qcm | needs_review | 0 | — |
| d88de779 | Rendez-vous à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a51e30f5 | Dialoguer avec un médecin : symptômes et | B1 | sante | qcm | needs_review | 0 | — |
| a980aa48 | Comprendre une demande administrative à  | B2 | prefecture | qcm | rejected | 0 | — |
| ad0f1e82 | Rendez-vous à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| b16bea72 | Compréhension écrite : Technologies et e | B2 | travail | qcm | needs_review | 0 | — |
| c255174e | Appel à la préfecture pour un rendez-vou | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| c5e62f1c | Démarches administratives à la préfectur | B1 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| d41f46b7 | Vrai ou Faux : Démarches administratives | A2 | prefecture | vrai_faux | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| de62e8d3 | Comprendre une annonce à la préfecture | A2 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e472061e | Comprendre les droits sociaux à la CAF | B2 | logement | vrai_faux | needs_review | 0 | — |
| e64b08bc | Comprendre une demande administrative à  | B1 | prefecture | qcm | needs_review | 100 | SCORE_01, SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 820c265c | Vie quotidienne et fréquence | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| fead9085 | Vocabulaire du repas et expressions de g | A2 | — | vrai_faux | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4fd26792 | Prépositions et destinations en France | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 33a9ed74 | Comprendre une commande au restaurant | A2 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7132a092 | Vocabulaire du petit-déjeuner et des rep | A2 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 2fd1f981 | Tâches ménagères - Compréhension écrite | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 4b7382ac | Comprendre les horaires et activités quo | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 70ebaa61 | Règles de politesse en France - Vrai ou  | A2 | — | vrai_faux | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 6a43191d | Vacances et destinations - Comprendre le | A2 | — | vrai_faux | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a4dfbdf1 | Comprendre les nouveaux sports en France | A2 | — | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3d037877 | Comprendre les conditions d'accès aux ac | A2 | — | vrai_faux | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 3e55daa0 | Choisir un type de vacances adapté à sa  | A2 | — | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| a9b93ca1 | Vrai ou Faux : Procédures administrative | B1 | — | vrai_faux | needs_review | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 634e81c6 | QCM : Démarches administratives en Franc | B1 | — | qcm | validated_auto | 60 | SCORE_03, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 1c54c0fd | Dialogue au cabinet médical : expliquer  | B1 | sante | qcm | needs_review | 0 | — |
| 50b4f7da | Compréhension écrite : Informations prat | B2 | — | vrai_faux | rejected | 0 | — |
| ea95f59a | Comprendre les conditions pour l'énergie | B2 | — | qcm | needs_review | 0 | — |
| a075525b | Vrai/Faux - Histoire et popularité du vé | B2 | — | vrai_faux | needs_review | 0 | — |
| 7be960c1 | Comprendre le statut de freelance en Fra | B2 | — | vrai_faux | needs_review | 0 | — |
| 09837c3f | Évolutions dans la gestion des freelance | B2 | — | qcm | validated_auto | 0 | — |
| ae9d7816 | Comprendre les informations administrati | B2 | — | qcm | needs_review | 0 | — |

### 2. VA exclus par score bas (8)

| ID (8) | Titre | Niv. | Comp. | Thème | Format | Statut | Score | Raison | Détail |
|--------|-------|------|-------|-------|--------|--------|-------|--------|--------|
| fa43fca5 | Rendez-vous médical : prendre une c | A2 | CO | sante | vrai_faux | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 81a82a3b | Un message de la CAF concernant le  | A2 | CO | logement | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 7a05e456 | Lexique médical et prise de rendez- | B1 | CO | sante | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Rupture du tronc commun thématique |
| 33a9ed74 | Comprendre une commande au restaura | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 7132a092 | Vocabulaire du petit-déjeuner et de | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| a4dfbdf1 | Comprendre les nouveaux sports en F | A2 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 634e81c6 | QCM : Démarches administratives en  | B1 | CO | — | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 09837c3f | Évolutions dans la gestion des free | B2 | CO | — | qcm | validated_auto | 0 | EXCL_SCORE_LOW | Titre de séjour ne nécessite pas B2 |

### NR post-filtres (56)

Répartition tiers : rouge=56


---

## S4 — B2 / CE / quota 5

**Résultat attendu :** 0/5 P0_CELL_ZERO_VA
**Cellule :** `B2:CE`
**P0 :** oui

### Métriques sélection

| Métrique | Valeur |
|----------|--------|
| retained | 0 / 5 |
| P1 pool | 0 |
| VA en banque (post-filtres dim.) | 0 |
| remaining_gap | 5 |
| generation_reason | P0_CELL_ZERO_VA |
| nr_fallback_allowed | false |

### Classification

- **Verdict :** Banque présente mais aucun VA (`validation_status_gap`)
- Candidats dimensionnels existent (NR/rejected) mais zéro validated_auto/approved_human — cellule P0.

### Recommandations

- Faire passer NR → validated_auto (correction issues) ou générer du neuf validé.

### 1. Candidats pré-scoring (12)

Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.

**Par statut validation :** validated_auto=0, approved_human=0, needs_review=12, rejected=0, other=0
**Par niveau :** B1=12
**Par thème canonique :** prefecture=6, sante=2, travail=2, logement=1, (null)=1
**Par format :** texte_lacunaire=5, qcm=7

| ID (8) | Titre | Niv. | Thème | Format | Statut | Score est. | Règles |
|--------|-------|------|-------|--------|--------|------------|--------|
| 287669a3 | Localiser des services administratifs | B1 | prefecture | texte_lacunaire | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 294c2fc9 | Appel au médecin - Discours rapporté | B1 | sante | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 5b456fc4 | Échanger un article à la boutique : Text | B1 | travail | texte_lacunaire | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 6ea666fe | Compréhension - L'entretien d'embauche d | B1 | travail | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 7c0b20c1 | Comprendre une demande de renseignement  | B1 | prefecture | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| b314e99b | Échange à la CAF : Exprimer une gêne et  | B1 | prefecture | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 8706c89a | Situation médicale - Complétez le dialog | B1 | sante | texte_lacunaire | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 955f5e32 | Vocabulaire administratif : démarches à  | B1 | prefecture | texte_lacunaire | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| f425f84e | Refuser un logement à l'agence immobiliè | B1 | logement | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| fc87243f | Exprimer le refus dans un contexte admin | B1 | prefecture | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| e22892b4 | Situation à la CAF : comprendre les aide | B1 | prefecture | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |
| 087e0509 | Exercice de grammaire - La négation avec | B1 | — | texte_lacunaire | needs_review | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_11, SCORE_14 |

### 2. VA exclus par score bas (0)

_Aucun VA exclu par score bas._

### NR post-filtres (12)

Répartition tiers : rouge=11, orange=1


---

## S6 — B1 / EE / quota 5

**Résultat attendu :** 1/5 PARTIAL_GAP gap 4
**Cellule :** `B1:EE`
**P0 :** oui

### Métriques sélection

| Métrique | Valeur |
|----------|--------|
| retained | 1 / 5 |
| P1 pool | 1 |
| VA en banque (post-filtres dim.) | 5 |
| remaining_gap | 4 |
| generation_reason | PARTIAL_GAP |
| nr_fallback_allowed | true |

### Classification

- **Verdict :** Vrai trou banque (partiel) (`true_bank_gap`)
- Pool P1=1 < quota ; 4 exercice(s) manquant(s) malgré candidats éligibles.

### Recommandations

- **Trou banque B1** : les 15 candidats dimensionnels sont tous niveau **A2** — aucun EE B1 en banque.
- **Score insuffisant** : 4 VA A2 à score 60 (SCORE_04 +10 vs SCORE_03 +20 manquant pour cible B1).
- 9 NR tier vert existent mais scorent aussi 60 — repli NR max 1 (30 % quota) insuffisant pour combler gap 4.
- **Génération Lot 8 P0** : créer 4–5 EE B1 ; enrichir métadonnées niveau sur existants A2 en parallèle.

### 1. Candidats pré-scoring (15)

Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.

**Par statut validation :** validated_auto=5, approved_human=0, needs_review=10, rejected=0, other=0
**Par niveau :** A2=15 *(aucun B1 — trou niveau)*
**Par thème canonique :** prefecture=9, travail=1, logement=2, ecole=1, sante=1, (null)=1
**Par format :** production_ecrite=13, qcm=2

| ID (8) | Titre | Niv. | Thème | Format | Statut | Score est. | Règles |
|--------|-------|------|-------|--------|--------|------------|--------|
| 0715eab7 | Accorder les adjectifs et noms - Context | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 08991bb6 | QCM : Reconnaître les formes de l'impéra | A2 | travail | production_ecrite | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 6044d100 | Compléter une demande à la CAF | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 679a2446 | Dialogue à la préfecture pour un titre d | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 7a341133 | Comprendre les données de logement | A2 | logement | qcm | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 3fc86172 | Exprimer son opinion à la préfecture | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 762d466c | QCM : Orthographe des mots avec préfixes | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| c17b0261 | Demande d'informations à la CAF | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| a7907e6f | Vocabulaire contextualisé - École et éga | A2 | ecole | qcm | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| bd63fc1b | Opinion et simultanéité : rendez-vous mé | A2 | sante | production_ecrite | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| bdc7fbe8 | Trouver un logement en France - Compréhe | A2 | logement | production_ecrite | validated_auto | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| ec131424 | Demande de document à la préfecture | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 2fd6e194 | Compléter les formulaires administratifs | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| 31c0a3c0 | Compléter des demandes administratives a | A2 | prefecture | production_ecrite | needs_review | 60 | SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |
| e0e77170 | Comprendre une affiche de recrutement -  | A2 | — | production_ecrite | validated_auto | 100 | SCORE_01, SCORE_04, SCORE_05, SCORE_06, SCORE_09, SCORE_10, SCORE_14 |

### 2. VA exclus par score bas (4)

| ID (8) | Titre | Niv. | Comp. | Thème | Format | Statut | Score | Raison | Détail |
|--------|-------|------|-------|-------|--------|--------|-------|--------|--------|
| 08991bb6 | QCM : Reconnaître les formes de l'i | A2 | EE | travail | production_ecrite | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| 7a341133 | Comprendre les données de logement | A2 | EE | logement | qcm | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| bd63fc1b | Opinion et simultanéité : rendez-vo | A2 | EE | sante | production_ecrite | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |
| bdc7fbe8 | Trouver un logement en France - Com | A2 | EE | logement | production_ecrite | validated_auto | 60 | EXCL_SCORE_LOW | score 60 < 80 |

### NR post-filtres (10)

Répartition tiers : vert=9, rouge=1

### Retenus

| ID (8) | Titre | Niv. | Thème | Score | Tier |
|--------|-------|------|-------|-------|------|
| e0e77170 | Comprendre une affiche de recruteme | A2 | — | 100 | P1_validated |


---

## S7 — B2 / Structures / quota 5

**Résultat attendu :** 0/5 P0_CELL_ZERO_VA
**Cellule :** `B2:Structures`
**P0 :** oui

### Métriques sélection

| Métrique | Valeur |
|----------|--------|
| retained | 0 / 5 |
| P1 pool | 0 |
| VA en banque (post-filtres dim.) | 0 |
| remaining_gap | 5 |
| generation_reason | P0_CELL_ZERO_VA |
| nr_fallback_allowed | false |

### Classification

- **Verdict :** Vrai trou banque (`true_bank_gap`)
- Aucun candidat après filtres dimensionnels (compétence, niveau ±1, format, contenu utilisable).

### Recommandations

- **Génération** : créer de nouveaux exercices pour la cellule (priorité Lot 8 si P0).

### 1. Candidats pré-scoring (0)

Après filtres : compétence, niveau ±1, format autorisé, contenu utilisable.

**Par statut validation :** validated_auto=0, approved_human=0, needs_review=0, rejected=0, other=0
**Par niveau :** 
**Par thème canonique :** 
**Par format :** 

_Aucun candidat après filtres dimensionnels._

### 2. VA exclus par score bas (0)

_Aucun VA exclu par score bas._

---

_Rapport généré par `scripts/pre-session-generation-need-diagnosis.mjs` — diagnostic read-only generation_need._