# Inventaire de la banque d'exercices — 2026-07-12

> **Lecture seule.** Requêtes exécutées via `supabase db query --linked` sur le projet lié
> (`gudcenhmzlcvhgbgklzw`), aucune écriture, aucune clé affichée ni journalisée.
> Champ d'application : `public.exercices`, filtré `is_template = false AND eleve_id IS NULL`
> (« banque partagée », par opposition aux exercices individuels d'un élève ou aux templates),
> sauf mention contraire.

## 0. Contexte global

| Indicateur | Valeur |
|---|---|
| Total `exercices` (toutes lignes) | 729 |
| Banque partagée (`is_template=false AND eleve_id IS NULL`) | 627 |
| Individuels élève (`eleve_id` renseigné) | 84 |
| Templates | 18 |
| Générés par IA | 692 |
| Compétences distinctes | 5 (CO, CE, EE, EO, Structures) |
| Niveaux distincts | 4 (A1, A2, B1, B2) |
| **Statuts distincts** | **1 — tout est `draft`** |
| Plus ancien | 2026-03-18 |
| Plus récent | 2026-07-10 |

**Fait à retenir avant toute lecture des matrices ci-dessous** : la colonne `statut` (enum
`draft/to_review/validated/published/rejected/archived`, migration `20260414211154`) n'a **jamais**
été utilisée en pratique — les 627 lignes de la banque partagée sont **toutes** à `draft`. Aucune
ligne n'est `validated`/`published`/`rejected`. Le cycle de vie de statut existe dans le schéma mais
n'est piloté par aucun code applicatif identifié. Conséquence directe : dans les matrices ci-dessous,
les colonnes « publié » et « bloqué (par statut) » valent structurellement 0 partout — ce n'est pas
une anomalie de la requête, c'est l'état réel de la donnée.

## 1. Matrice compétence × niveau × format × statut

Tout est `statut = draft` ; la matrice ci-dessous fusionne donc le statut (implicite) et se
concentre sur compétence/niveau/format, avec le total par cellule.

| Compétence | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| **CO** | qcm 58, vrai_faux 1 (59) | qcm 25, vrai_faux 11, prod._orale 1, lacunaire 1 (38) | qcm 13, vrai_faux 6 (19) | qcm 9, vrai_faux 5, prod._ecrite 1 (15) |
| **CE** | qcm 128, vrai_faux 29, appariement 24, lacunaire 17, transfo. 8, prod._orale 1 (207) | qcm 64, vrai_faux 15, lacunaire 20, prod._ecrite 5, appariement 3, prod._orale 1, transfo. 1 (109) | qcm 7, lacunaire 5, prod._ecrite 1 (13) | qcm 3, lacunaire 1, vrai_faux 1, prod._ecrite 1 (6) |
| **EE** | prod._ecrite 40, qcm 7, lacunaire 2, appariement 1, vrai_faux 1, transfo. 1 (52) | prod._ecrite 13, qcm 2 (15) | **0** | **0** |
| **EO** | prod._orale 35 (35) | prod._orale 8 (8) | prod._orale 17, appariement 1 (18) | prod._orale 12 (12) |
| **Structures** | qcm 7, lacunaire 8, transfo. 4, appariement 1, vrai_faux 1 (21) | **0** | **0** | **0** |

**Manque critique #1** : `EE` n'a **aucun** exercice à B1/B2. `Structures` n'a **aucun** exercice
au-delà de A1. Un parcours complet A1→B2 sur ces deux compétences n'existe nulle part dans la banque
aujourd'hui — toute génération à ces niveaux passera à 100 % par la génération IA, jamais par la
réutilisation.

## 2. Matrice compétence × niveau × type de différenciation

| Compétence | Niveau | Type de différenciation | Total |
|---|---|---|---|
| CO | A2 | consolidation | 2 |
| *(toutes les autres combinaisons)* | — | **(vide)** | 725 |

**Manque critique #2** : la colonne `type_differenciation` (existe comme vraie colonne SQL, pas
seulement en JSONB) n'est renseignée que sur **2 lignes sur 627** (0,3 %). Le tag de différenciation
(`demarrage/remediation/consolidation/approfondissement/bonus` vu dans le schéma d'outil
`generate-exercises`) n'est quasiment jamais écrit en pratique — soit le champ n'est pas branché
côté écriture, soit il n'a été exercé que ponctuellement.

## 3. Matrice thème × compétence × niveau

Top thèmes par volume (76 combinaisons au total ; thème vide très majoritaire) :

| Thème | Combinaisons compétence/niveau les plus fournies | Total sur ce thème |
|---|---|---|
| **(vide)** | CE/A1 (134), CE/A2 (48), CO/A1 (33), EE/A1 (25), Structures/A1 (20), EO/A1 (18)… | ~330 |
| **prefecture** | CE/A1 (35), CE/A2 (25), CO/A2 (17), EE/A1 (17), CO/B1 (11)… | ~150 |
| **sante** | CE/A2 (12), CO/B1 (5), CO/A1 (4)… | ~30 |
| **transport** | CO/A1 (13), CE/A1 (9)… | ~25 |
| **logement** | CE/A1 (10), CE/A2 (9)… | ~40 |
| **vie_citoyenne** | EO/A1 (13), CE/A1 (9)… | ~35 |
| **travail** | CE/A1 (9)… | ~25 |
| **ecole** | 2 lignes seulement | 2 |
| **banque** | 0 ligne | 0 |

**Manque critique #3** : ~45 % de la banque n'a **aucun thème renseigné** (`theme IS NULL`). Le
moteur search-first (`exercise-search.ts`) neutralise le bonus/l'exclusion thématique quand un seul
côté est renseigné — donc ces exercices restent réutilisables, mais ne sont jamais préférés pour un
thème ciblé. Les thèmes `ecole` et `banque` (2 des 8 valeurs canoniques de `exercices.theme`) sont
quasiment ou totalement absents.

## 4. Exercices réutilisables avec score qualité ≥ 80

**Clarification importante** : deux notions de « score » coexistent dans le code et ne doivent pas
être confondues.

- `exercices.validation_score` — colonne **stockée**, issue d'une revue pédagogique (0-100). C'est
  la seule mesurable de façon statique, table par table.
- Le score search-first (`scoreExerciseCandidate`/`scoreCandidateWithTheme`, seuil `REUSE_SCORE_MIN=80`
  dans `exercise-search.ts`) — **calculé à la volée** à chaque appel de `generate-exercises`, en
  fonction du thème/niveau/compétence **de la requête courante**. Il n'existe pas de « score unique »
  par exercice indépendamment du contexte de recherche ; il ne peut donc pas être tabulé statiquement
  ici sans figer arbitrairement un contexte de requête.

Sur `validation_score` (le seul mesurable statiquement) :

| Compétence | Niveau | Total | `validation_score ≥ 80` | Sans score | Score moyen |
|---|---|---|---|---|---|
| CE | B2 | 6 | **5** | 1 | 85.0 |
| *(toutes les autres 13 combinaisons)* | — | 621 | **0** | 621 | — |

**Manque critique #4** : sur 627 exercices de la banque partagée, **5 seulement** (0,8 %, tous CE/B2)
ont un `validation_score` renseigné et ≥ 80. Les 5 portent `source = 'search_first_p0'` — un lot de
test/seed manifestement lié au chantier search-first lui-même, pas un usage réel généralisé. Autrement
dit, la colonne `validation_score` existe mais n'est alimentée par (quasiment) aucun flux de
production actuel.

## 5. Exercices vus récemment (non frais) vs. frais (fenêtre 30 jours)

| Compétence | Niveau | Total | Vus récemment (non frais) | Frais (jamais vu en 30j) |
|---|---|---|---|---|
| *(les 14 combinaisons compétence/niveau)* | — | 627 | **0** | **627 (100 %)** |

**Manque critique #5** : **aucun** exercice de la banque n'a été servi (via `devoirs` ou `resultats`)
dans les 30 derniers jours. Soit le volume réel d'activité élève est très faible en ce moment, soit
le mécanisme de fraîcheur n'a simplement pas encore été mis à l'épreuve à l'échelle. À vérifier avec
le formateur : ce chiffre est cohérent avec l'activité pédagogique réelle attendue sur la période, ou
signale-t-il une rupture de flux (devoirs non envoyés, séances non tenues) ?

## 6. Exercices sans corrigé exploitable

| Compétence | Format | Niveau | Total | Sans corrigé |
|---|---|---|---|---|
| Structures | vrai_faux | A1 | 1 | 1 |
| CE | qcm | A1 | 128 | 1 |

**Bonne nouvelle** : seulement **2 exercices sur 627** (0,3 %) manquent d'un corrigé exploitable
(item sans `bonne_reponse`, ou liste d'items vide). Ce n'est pas un point de blocage à l'échelle.

## 7. Exercices sans durée renseignée

| Compétence | Niveau | Total | Sans durée |
|---|---|---|---|
| CE | B2 | 6 | 1 |
| *(toutes les autres 13 combinaisons)* | — | 621 | **621 (100 %)** |

**Manque critique #6** : **622 exercices sur 627 (99,2 %)** n'ont ni `duree_limite_secondes` en
colonne, ni `contenu.metadata.time_limit_seconds`/`contenu.time_limit_seconds` en JSONB. Le
chronométrage informatif/bloquant demandé par la mission repose entièrement sur ce champ côté
`DevoirPassation.tsx` (`timeLimit = ex?.duree_limite_secondes || metadata?.time_limit_seconds || contenu?.time_limit_seconds || 0`)
— sans lui, `timeLimit` vaut 0 et **aucun chronomètre ne s'affiche** pour l'immense majorité de la
banque existante. `computeExerciseDuration` (utilisé dans `generate-exercises`) calcule bien une
durée à la génération, mais cette écriture est manifestement récente : elle ne couvre que les
exercices les plus récents (le lot `search_first_p0`), pas l'historique.

## 8. Exercices sans métadonnées de famille (`family_id`)

| Source | Total | Sans `family_id` |
|---|---|---|
| *(vide)* | 596 | 596 |
| `pdf_import` | 3 | 3 |
| `url_import` | 1 | 1 |
| `curriculum_v2` | 8 | 3 (5 CE/B2 en ont un) |
| `search_first_p0` | 5 | 5 |

**Manque critique #7** : sur 627 exercices, **seuls 5 exercices `curriculum_v2`** portent
`contenu.metadata.family_id` (les variantes CE/B2 les plus récentes de S01). C'est cohérent avec
l'audit de code (§2 de l'audit précédent) : le contrat de famille de différenciation est un concept
très récent, quasiment pas encore présent dans la donnée réelle — 0,8 % de la banque.

## 9. Exercices sans source/provenance

| Compétence | Niveau | Total | Sans `source` |
|---|---|---|---|
| CE | B2 | 6 | 0 |
| *(toutes les autres combinaisons)* | — | 621 | **~596 (95 %)** |

**Manque critique #8** : `source` est vide pour **596 exercices sur 627 (95 %)**. Impossible de
tracer si ces exercices viennent d'une génération IA ponctuelle, d'un import, ou d'une saisie
manuelle. Seuls `pdf_import` (3), `url_import` (1), `curriculum_v2` (8) et `search_first_p0` (5)
déclarent une provenance explicite.

## 10. Formats présents en base mais non rendus côté frontend

| Format | Total | Hors de la liste des 7 valeurs connues |
|---|---|---|
| qcm | 389 | 0 |
| production_orale | 94 | 0 |
| vrai_faux | 74 | 0 |
| production_ecrite | 62 | 0 |
| texte_lacunaire | 62 | 0 |
| appariement | 34 | 0 |
| transformation | 14 | 0 |

**Résultat rassurant** : **aucun format orphelin**. La somme (729) correspond exactement au total de
la table — `exercices.format` étant un ENUM Postgres strict aux 7 valeurs, il ne peut structurellement
pas contenir une valeur non gérée par le renderer générique de `DevoirPassation.tsx`. Le risque de
« format non restituable » identifié dans l'audit précédent concerne les **types de question
curriculum en amont du pont** (qcm_multiple, ordonnancement, classement, audio_qcm, dictee — voir
`publish-bridge-lib.mjs`), pas les lignes déjà publiées dans `exercices` : ce risque est donc bloqué
en amont (P0 de cette session), jamais après coup sur des données déjà en base.

## 11. Consommateurs de `exercices.statut` — pourquoi les 627 `draft` sont visibles ou non

> Analyse de code fichier par fichier (aucune exécution, aucune écriture). **Correction importante
> par rapport à une première passe rapide** : il existe une colonne homonyme mais **distincte**,
> `validation_status` (migration `20260708120000_exercices_validation_fields.sql`), qui elle **est**
> activement filtrée dans deux des sept flux. Les deux colonnes ne doivent pas être confondues.

| Flux | Filtre sur `statut` ? | Filtre sur `validation_status` ? | Preuve |
|---|---|---|---|
| **Search-first** (`exercise-search.ts`, `findReusableExercises`) | Non | Non | `exercise-search.ts:396-405` — filtre `competence`/`is_template`/`eleve_id`/`niveau_vise` uniquement ; zéro occurrence du mot « statut » dans tout le fichier (grep confirmé). |
| **Bibliothèque formateur** (`ExerciseLibraryTab.tsx` → `exerciseLinks.ts`) | Non (`ExercicesPage.tsx:278-303` : filtre `formateur_id`/`is_live_ready`, `statut` seulement affiché en badge `:1195`) | **Oui** | `exerciseLinks.ts:38-39` : `DEFAULT_VALIDATION_STATUSES = ["validated_auto","approved_human"]`, `.in("validation_status", statuses)`. |
| **Sélection pré-séance** (`pre-session-selection-data.ts`) | Non | **Oui** (liste plus large) | `pre-session-selection-data.ts:157-174` : `.in("validation_status", [...])` incluant aussi `needs_review`/`rejected`. |
| **Devoirs auto-générés** (`generate-daily-homework`, `generate-next-homework-series`, `AutoHomeworkPreviewDialog.tsx`) | Non — et n'écrit jamais `statut` non plus | Non | `generate-daily-homework/index.ts:575-592`, `generate-next-homework-series/index.ts:636-654`, `AutoHomeworkPreviewDialog.tsx:307-324` : `INSERT` sans clé `statut` → défaut `'draft'` hérité. |
| **Pilotage live** (`SessionPilot.tsx`, `LivePilotingSection.tsx`, `LiveExercisesPanel.tsx`) | Non | Non | `SessionPilot.tsx:227-231,257-260,839-843,1069,1265-1272` ; `LivePilotingSection.tsx:329-347` ; `LiveExercisesPanel.tsx:115,143` — aucune condition sur l'une ou l'autre colonne. |
| **Écran apprenant** (`DevoirPassation.tsx`, `play-exercise` edge function) | Non | Non | `DevoirPassation.tsx:195-200` (chargement par `id` de devoir) ; `play-exercise/index.ts:32-38` : gating sur `play_token` + `is_live_ready`, explicitement pas sur le statut. |
| **Pont de publication curriculum** (`publish-bridge.mjs`/`publish-bridge-lib.mjs`) | N'écrit jamais `statut` sur `exercices` | N'écrit jamais | `upsertExercice` (`publish-bridge.mjs:199-232`) et `buildVariantExerciceDraft`/`buildCivicExerciceDraft` (`publish-bridge-lib.mjs`) ne posent aucune des deux colonnes → défaut `'draft'` hérité indéfiniment. |

**Distribution réelle de `validation_status` sur les 627 exercices** (requête complémentaire) :

| `validation_status` | Total | Visible en bibliothèque ? | Visible en pré-séance ? |
|---|---|---|---|
| `validated_auto` | 377 | ✅ | ✅ |
| `needs_review` | 177 | ❌ | ✅ |
| `rejected` | 51 | ❌ | ✅ |
| `approved_human` | 21 | ✅ | ✅ |
| `draft` (valeur résiduelle sur cette colonne aussi) | 1 | ❌ | ✅ |

**Conclusion corrigée** : `exercices.statut` n'est filtré par **aucun** des 7 flux — écrit une fois au
défaut `'draft'`, jamais relu, jamais mis à jour après coup (recherché dans tout `src/` et
`supabase/functions/` : aucun `.update({ statut: ... })` sur `exercices`). C'est bien un champ
vestigial. **Mais** la colonne `validation_status` (différente) est un vrai filtre actif dans 2 flux
sur 7 : la **bibliothèque formateur** n'affiche que 398/627 exercices (63 % — `validated_auto` +
`approved_human`), excluant 229 exercices (`needs_review` + `rejected` + le seul `draft` résiduel) ;
la **sélection pré-séance** est presque totalement ouverte (626/627, tout sauf ce même `draft`
résiduel). Search-first, devoirs auto-générés, pilotage live et écran apprenant ne filtrent ni l'une
ni l'autre colonne — ils voient les 627 sans exception.

**Point d'attention RLS distinct, découvert en creusant** (base de données, pas application) : une
policy `auth_read_validated_exercices` (migration `20260414211154`, `statut IN ('validated',
'published')`) existe toujours en base. Le commentaire de la migration `20260709120000_
session_document_links.sql` documente que cette policy, seule, renvoyait 0 résultat pour tout
formateur non-propriétaire puisque toute la banque est à `statut='draft'` — ce qui a motivé l'ajout
d'une policy plus large (`staff_read_bank_exercices`) volontairement indifférente au `statut` pour
compenser. C'est une confirmation supplémentaire, au niveau base de données cette fois, que `statut`
ne gate plus rien en pratique côté formateur/admin — mais ça reste un point à vérifier si un futur
rôle ou une future policy RLS venait à réactiver cette contrainte sans le vouloir.

**Pour l'aperçu formateur obligatoire (mission §5)** : si ce mécanisme doit distinguer « testé et
validé » de « brouillon », il devra soit réutiliser `validation_status` (déjà un vrai gate dans 2
flux sur 7, mais pas dans search-first/devoirs/live/élève), soit brancher un nouveau filtre dans les
5 flux qui n'en ont aucun aujourd'hui — `statut` seul ne suffira pas, il faudra choisir
explicitement laquelle des deux colonnes porte la sémantique voulue plutôt que d'en ajouter une
troisième.

## 12. Rapport de préparation (dry-run, aucune écriture)

> Calculé localement le 2026-07-12 sur un dump en lecture seule des 627 exercices de la banque
> partagée, via le vrai moteur `computeExerciseDuration`
> (`supabase/functions/_shared/exercise-duration.ts`, importé tel quel — pas réimplémenté).
> **Aucune ligne n'a été modifiée en base.** Script : `scripts/curriculum/analyze-exercise-bank.mts`.

| Catégorie | Nombre | % |
|---|---|---|
| Réutilisable immédiatement | 7 | 1.1% |
| Réparable automatiquement | 618 | 98.6% |
| Nécessite une revue humaine | 2 | 0.3% |

**Réutilisable immédiatement** (7) — contenu exploitable, corrigé complet, durée déjà présente :

| Compétence / Niveau | Nombre |
|---|---|
| CE / B2 | 5 |
| CO / A2 | 2 |

**Réparable automatiquement** (618, 98,6 % de la banque) — contenu et corrigé valides, seule la
durée manque. `computeExerciseDuration` peut la calculer de façon déterministe (nombre d'items,
longueur du texte/script audio, compétence) — **backfill possible sans relecture humaine, mais non
effectué** (aucune autorisation donnée) :

| Compétence / Niveau | Nombre | Compétence / Niveau | Nombre |
|---|---|---|---|
| CE / A1 | 206 | CO / B1 | 19 |
| CE / A2 | 109 | EO / B1 | 18 |
| CO / A1 | 59 | EE / A2 | 15 |
| EE / A1 | 52 | CO / B2 | 15 |
| CO / A2 | 36 | CE / B1 | 13 |
| EO / A1 | 35 | EO / B2 | 12 |
| Structures / A1 | 20 | EO / A2 | 8 |
| | | CE / B2 | 1 |

Échantillon de durées qui seraient calculées (aucune écriture) :

| id (tronqué) | compétence | format | durée calculée |
|---|---|---|---|
| f6b769fd… | CE | qcm | 150s |
| fb7f5239… | CO | qcm | 195s |
| 002136d5… | CE | qcm | 431s |
| f96c1529… | CO | qcm | 195s |
| fa43fca5… | CO | vrai_faux | 195s |

**Nécessite une revue humaine** (2, 0,3 %) — cohérent avec le §6 (« sans corrigé ») : ce sont
exactement les 2 mêmes exercices (`Structures/A1` ×1, `CE/A1` ×1), problème qu'aucun script ne peut
corriger sans jugement pédagogique.

**Limite méthodologique assumée** : le « score de réutilisation » calculable statiquement est
`validation_score` (6 lignes seulement, §4) — le score search-first réel dépend du contexte de
requête (thème/niveau/compétence ciblés) et ne peut pas être précalculé hors contexte, voir §4.

## Synthèse — manques critiques à combler avant généralisation

1. **EE** : zéro contenu B1/B2. **Structures** : zéro contenu au-delà de A1.
2. `type_differenciation` quasi jamais renseigné (0,3 %) — le tag de différenciation n'est pas
   réellement exploité dans le flux actuel malgré son existence en colonne.
3. ~45 % de la banque sans thème — neutre pour la réutilisation mais jamais priorisé thématiquement.
4. `validation_score` renseigné sur 0,8 % de la banque seulement (5 lignes, toutes issues d'un lot de
   test P0) — ne peut pas servir de filtre qualité à l'échelle aujourd'hui.
5. **99,2 % de la banque sans durée** — bloque le chronométrage demandé (§ CHRONOMÉTRAGE de la
   mission) pour la quasi-totalité du contenu existant tant qu'aucune campagne de rattrapage
   (backfill) n'est faite.
6. `family_id` présent sur 0,8 % de la banque — le contrat de différenciation par famille reste un
   concept de niche dans la donnée réelle, pas encore un standard.
7. `source` vide sur 95 % de la banque — traçabilité de provenance très partielle.
8. Aucun format orphelin — le risque de rendu cassé est structurellement neutralisé par l'ENUM
   Postgres et bloqué en amont par le P0 de cette session pour tout nouveau contenu curriculum.
9. `statut` toujours `draft` — le cycle de vie brouillon → relu → validé → publié n'est piloté par
   aucun code identifié ; à concevoir/brancher si l'aperçu formateur obligatoire (mission §5) doit
   s'appuyer dessus pour distinguer un exercice « testé et validé » d'un simple brouillon.
10. 0 occurrence « vue récemment » sur toute la banque (fenêtre 30 jours) — à faire confirmer par le
    formateur : reflet réel d'une activité faible, ou signal d'un flux devoirs/résultats interrompu.
