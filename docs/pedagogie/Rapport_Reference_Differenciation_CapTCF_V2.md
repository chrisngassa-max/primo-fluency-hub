# Rapport de référence — Différenciation pédagogique CapTCF

**Version 2 corrigée — 11 juillet 2026**
**Statut : document de cadrage, non validé pour une implémentation complète**

## 0. Légende des affirmations

- **FAIT CONFIRMÉ** : directement établi par un fichier, un test ou une source officielle.
- **CONVERGENCE DU CORPUS** : principe retrouvé dans plusieurs sources pédagogiques consultées.
- **INFÉRENCE** : conclusion raisonnable tirée des preuves, à confirmer.
- **RECOMMANDATION** : décision proposée pour CapTCF.
- **NON VÉRIFIABLE** : information nécessitant le runtime, la base distante ou une observation terrain.

## 1. Résumé exécutif

**FAIT CONFIRMÉ — Verdict.** CapTCF possède des briques de différenciation, mais celles-ci ne constituent pas encore un contrat central consommé de bout en bout. Trois systèmes coexistent : curriculum statique, génération dynamique de variantes et pont de publication vers `exercices`. Le système dynamique contient la doctrine la plus proche du besoin (« ne crée pas une activité différente : différencie le chemin d’accès »), mais aucun consommateur applicatif confirmé de `session_exercise_variants` n’a été trouvé. Le flux statique effectivement publié dispose de variantes A1–B2, mais le pont ne consomme pas les règles centrales de différenciation.

**FAIT CONFIRMÉ — Défaut visible.** S01 annonce 60 minutes d’atelier différencié mais ne contient que deux questions par niveau. B1 et B2 ne disposent d’aucune aide. La validation déclare pourtant la séance publiable et plusieurs revues portent le modèle `fake-content-model`.

**FAIT CONFIRMÉ — Progrès récent.** Le pont de publication n’impose plus `CE` à toutes les variantes : la compétence est désormais dérivée du format dominant, et ses tests sont inclus dans Vitest. Cette correction demeure un secours technique ; le futur contrat doit porter une compétence explicite.

**CONVERGENCE DU CORPUS.** La différenciation conserve une ambition commune et organise des chemins variés selon les besoins. Elle agit sur contenus, processus, productions, temps et accompagnement, sans réduire l’apprenant à un niveau global ni rompre son appartenance au collectif.

**RECOMMANDATION — Centre du moteur.** La source de vérité doit être une famille d’exercices versionnée : une compétence, une tâche noyau, un document source, un ensemble de faits scellés et quatre contrats A1/A2/B1/B2. A2 est le pivot par défaut, pas une obligation.

### Priorités

1. **P0** — Formaliser le contrat de famille et le statut du support.
2. **P0** — Construire la matrice déterministe des douze transformations et la validation des invariants.
3. **P0** — Neutraliser les revues factices dans la décision `publishable`.
4. **P1** — Faire consommer le même référentiel par le statique, le dynamique et le pont.
5. **P1** — Calibrer les niveaux et durées avant tout blocage pédagogique.

## 2. Définition opérationnelle

### 2.1 Variation

**RECOMMANDATION.** La variation est l’axe vertical d’une famille. Tous les niveaux travaillent la même compétence, la même sous-compétence, la même situation et la même tâche noyau. Changent : accès, étayage, opérations cognitives, autonomie, format et critères.

Une famille CE reste CE de A1 à B2. Une production EE issue du même support est un **prolongement lié**, jamais une variante interne.

### 2.2 Différenciation

**CONVERGENCE DU CORPUS.** À l’échelle de la séance, des groupes de besoins peuvent travailler simultanément des compétences ou processus différents. Cette différenciation horizontale doit rester temporaire, explicable et suivie d’une mise en commun.

### 2.3 Individualisation et remédiation

**RECOMMANDATION.** L’individualisation n’est pas interdite : elle peut être utile ponctuellement. Elle devient problématique lorsqu’elle isole durablement l’apprenant. La remédiation conserve l’objectif, modifie le chemin et s’appuie sur une erreur ou un besoin identifié.

## 3. Principes pédagogiques retenus

| Principe | Statut | Traduction moteur |
|---|---|---|
| Objectif commun, chemins différents | CONVERGENCE DU CORPUS | Famille et invariants obligatoires |
| Profil par compétence | CONVERGENCE DU CORPUS | CO, CE, EE, EO séparées ; niveau global non décisionnel |
| Groupes de besoins évolutifs | CONVERGENCE DU CORPUS | Routage temporaire et révisable |
| Non-infantilisation | CONVERGENCE DU CORPUS | Simplifier la langue et l’accès, pas la situation adulte |
| Erreur formative | CONVERGENCE DU CORPUS | Feedback et orientation, jamais sanction |
| Formateur souverain | CONVERGENCE DU CORPUS | Affectation explicable et modifiable |
| Exactitude civique | FAIT CONFIRMÉ | Base officielle structurée, provenance et date d’effet |
| IA sous contrat | RECOMMANDATION | L’IA exécute une transformation décidée, elle ne décide pas seule |

## 4. Modèle central de famille

### 4.1 Identité

Une famille possède :

- `family_id` stable ;
- `source_level` ;
- compétence et sous-compétence uniques ;
- objectif ;
- tâche noyau ;
- `source_document_id` ;
- faits structurés et `facts_hash` ;
- quatre contrats A1/A2/B1/B2 ;
- prolongements éventuels, portant une autre compétence et un autre identifiant.

### 4.2 Statut du support

**RECOMMANDATION — Document source immuable.** Le document original est conservé sans modification, avec provenance, version et empreinte.

**Transformations autorisées :** annotation, segmentation, surlignage, glossaire, lecture audio, dévoilement progressif et sélection d’extraits contigus, à condition de conserver l’information nécessaire.

**Réécriture didactisée :** autorisée seulement comme artefact dérivé. Elle doit préserver tous les faits, les relations entre faits, la structure informationnelle utile et la tâche noyau. Elle porte son propre hash et une référence au document source.

**Contrôles :**

- comparaison du `facts_hash` ;
- validation de la couverture des faits requis ;
- contrôle de divergence textuelle à titre secondaire ;
- rejet si une relation factuelle est inversée ou supprimée ;
- revue humaine pour un nouveau gabarit de réécriture.

## 5. Séparation des quatre axes

| Axe | Exemple | Ne doit pas être confondu avec |
|---|---|---|
| Niveau CECRL | CE A2, EE A1 | Niveau global de l’apprenant |
| Exigence linguistique du titre | A2 CSP, exigences applicables selon procédure | Difficulté d’une question civique |
| Mention de l’examen civique | CSP, carte de résident, naturalisation | Niveau CECRL automatique |
| Difficulté civique | connaissance explicite, mise en situation, implicite juridique | Complexité linguistique du texte |

**FAIT CONFIRMÉ.** Depuis le 1er janvier 2026, le niveau B2 oral et écrit s’applique aux demandes de naturalisation concernées. L’examen civique est distinct de cette exigence linguistique. Sources : décret n° 2025-648 du 15 juillet 2025 et arrêté du 10 octobre 2025.

## 6. Matrice complète des douze transformations

| Transformation | Opération | Support et consigne | Étayage / autonomie | Production dans la même compétence |
|---|---|---|---|---|
| A1→A2 | Consolider | Retirer le surlignage systématique ; réunir les segments | Lexique ciblé ; autonomie moyenne | Reformuler et organiser les informations |
| A1→B1 | Approfondir | Support source visible ; ajouter relations et implicite modéré | Critères et guide de relecture | Expliquer, comparer, justifier |
| A1→B2 | Étendre | Conditions, exceptions ou points de vue déjà présents dans la source | Critères seuls | Analyser, synthétiser, nuancer |
| A2→A1 | Étayer | Segmenter ; expliciter une action à la fois ; rendre les indices accessibles | Lexique, exemple, amorce | Repérer, associer, compléter |
| A2→B1 | Approfondir | Demander inférence, comparaison ou justification | Réduire les aides | Relier les informations et justifier |
| A2→B2 | Étendre | Exploiter implications, registre, exceptions et points de vue | Autonomie forte | Évaluer, nuancer, synthétiser |
| B1→A1 | Reconstruire l’accès | Sélectionner les passages nécessaires sans changer les faits | Étapes, lexique, modèle | Repérage explicite de la tâche noyau |
| B1→A2 | Simplifier | Réduire densité et implicite ; conserver la structure utile | Aide légère | Compréhension globale et reformulation |
| B1→B2 | Étendre | Ajouter une demande de nuance, pas un nouveau fait | Critères seuls | Analyse du point de vue ou des conséquences |
| B2→A1 | Reconstruire fortement | Extraire/segmenter le chemin minimal vers la même cible | Guidage fort, multimodalité | Repérer les faits indispensables |
| B2→A2 | Rendre accessible | Réduire la charge syntaxique dans un dérivé contrôlé | Lexique ciblé | Expliquer simplement les informations clés |
| B2→B1 | Cadrer | Conserver support et tâche ; réduire le nombre d’opérations simultanées | Plan ou questions-guides | Justification structurée sans exigence de nuance complète |

**RECOMMANDATION.** Une transformation est impossible si le support ne contient pas les informations permettant l’opération demandée. Le moteur renvoie alors `DIFF_TRANSFORMATION_NOT_SUPPORTED`, au lieu d’inventer.

## 7. Contrats par compétence et niveau

### 7.1 CE — Compréhension écrite

| Niveau | Opérations | Support | Aides | Preuve de réussite |
|---|---|---|---|---|
| A1 | repérer, identifier, associer | court ou segmenté ; indices explicites | lexique, pictogramme, surlignage | informations explicites correctement localisées |
| A2 | comprendre globalement, reformuler | document pratique accessible | glossaire ciblé | informations essentielles organisées |
| B1 | inférer, comparer, justifier | document dense, implicite modéré | critères, relecture | relations et intention expliquées |
| B2 | analyser, synthétiser, nuancer | conditions, exceptions, points de vue | aides à la demande | argumentation ou implications comprises avec précision |

### 7.2 CO — Compréhension orale

| Niveau | Opérations | Paramètres | Aides | Preuve de réussite |
|---|---|---|---|---|
| A1 | identifier qui/où/quand/combien | audio bref, débit clair | 2–3 écoutes, images, transcription déverrouillable | informations explicites repérées |
| A2 | restituer l’essentiel | débit naturel contrôlé | 2 écoutes, lexique préalable | message global et détails utiles compris |
| B1 | inférer intention et relation | débit naturel, implicite modéré | 1–2 écoutes, critères | intention et enchaînement expliqués |
| B2 | synthétiser et évaluer | points de vue, sous-entendus | une écoute principale, reprise ciblée | nuance, registre et position distingués |

### 7.3 EE — Expression écrite

| Niveau | Opérations | Étayage | Production | Critères |
|---|---|---|---|---|
| A1 | compléter, produire phrases fonctionnelles | banque de mots, modèle, canevas | message bref | intelligibilité et informations essentielles |
| A2 | raconter, décrire, demander | structure proposée, connecteurs usuels | message organisé | adéquation, cohérence simple, lexique pertinent |
| B1 | expliquer, justifier, développer | plan possible, grille | texte structuré | cohérence, justification, correction suffisante |
| B2 | argumenter, nuancer, adapter registre | critères seuls | texte autonome | précision, nuance, cohésion, efficacité pragmatique |

### 7.4 EO — Expression orale

| Niveau | Opérations | Étayage | Production | Critères |
|---|---|---|---|---|
| A1 | se présenter, répondre simplement | mots-clés, modèle, répétitions | prise de parole courte | intelligibilité et informations clés |
| A2 | décrire, raconter, expliquer simplement | plan bref, préparation | discours court suivi | clarté, enchaînement, interaction simple |
| B1 | donner avis, justifier, réagir | critères et préparation limitée | discours développé | cohérence, interaction, justification |
| B2 | défendre, nuancer, reformuler | critères seuls | interaction autonome | spontanéité, registre, précision, contre-argument |

### 7.5 Structures

| Niveau | Opérations | Tâche contextualisée | Critères |
|---|---|---|---|
| A1 | repérer, choisir | forme fréquente dans le support | reconnaissance et réemploi guidé |
| A2 | compléter, transformer | phrase liée à la situation | correction et sens global |
| B1 | choisir et justifier | alternative morphosyntaxique | adéquation au sens et cohérence |
| B2 | moduler et expliquer l’effet | registre, nuance, reformulation | précision et effet discursif |

## 8. Distracteurs

**RECOMMANDATION.** Les distracteurs proviennent uniquement :

- d’une mauvaise lecture plausible du support ;
- d’une confusion entre deux informations présentes ;
- d’une règle proche mais inapplicable ;
- d’une généralisation abusive ;
- d’une erreur de temporalité, destinataire ou procédure.

Ils ne doivent jamais supposer une croyance liée à la nationalité, la culture ou le pays d’origine.

## 9. Base factuelle officielle

**RECOMMANDATION.** Les faits civiques et administratifs vivent dans une base structurée, indépendante du LLM :

```json
{
  "fact_id": "CIV_EXAM_DURATION_2026",
  "statement": "L'examen civique dure 45 minutes.",
  "jurisdiction": "FR",
  "scope": ["CSP", "CR", "NATURALISATION"],
  "source_url": "https://www.legifrance.gouv.fr/...",
  "source_type": "official_regulation",
  "effective_from": "2026-01-01",
  "effective_to": null,
  "verified_at": "2026-07-11",
  "content_hash": "sha256:...",
  "status": "active"
}
```

Le RAG retrouve les entrées pertinentes mais ne garantit pas leur vérité. Le générateur ne peut utiliser qu’un fait actif, dans son périmètre et à sa date d’effet. Une seconde passe par le même LLM ne constitue pas une validation indépendante.

## 10. Rôle de l’IA

### Autorisé

- réaliser une transformation source→cible déjà décidée ;
- proposer consigne, aides, étapes, questions et feedback ;
- expliquer les règles appliquées ;
- signaler qu’une transformation est impossible.

### Interdit

- choisir seule le niveau ou la compétence ;
- changer les faits, la situation ou la tâche noyau ;
- inventer une règle officielle ;
- transformer une variante CE en EE/EO ;
- déclarer sa propre production validée ;
- qualifier une simulation civique d’officielle.

## 11. Contrat JSON complet

```json
{
  "schema_version": "1.0",
  "family_id": "S01-CE-ACCUEIL-01",
  "version": 1,
  "status": "draft",
  "competence": "CE",
  "subcompetence": "reperage_reformulation",
  "objective": "Comprendre l'organisation du parcours",
  "core_task": "Extraire puis relier les informations essentielles",
  "source_level": "A2",
  "source_document": {
    "source_document_id": "S01-support-accueil",
    "uri": "content/curriculum/v2/S01/...",
    "content_hash": "sha256:...",
    "immutable": true,
    "provenance": {"type": "curriculum", "version": 1}
  },
  "facts": {
    "required": [
      {"fact_id": "duration", "value": "80 heures"},
      {"fact_id": "sessions", "value": 25},
      {"fact_id": "evaluations", "value": ["E1", "E2"]}
    ],
    "facts_hash": "sha256:..."
  },
  "variants": {
    "A1": {"target_level": "A1", "transformation_id": "A2_TO_A1", "support_mode": "annotated", "exercise": {}, "scaffolding": {}, "success_criteria": []},
    "A2": {"target_level": "A2", "transformation_id": "IDENTITY", "support_mode": "source", "exercise": {}, "scaffolding": {}, "success_criteria": []},
    "B1": {"target_level": "B1", "transformation_id": "A2_TO_B1", "support_mode": "source", "exercise": {}, "scaffolding": {}, "success_criteria": []},
    "B2": {"target_level": "B2", "transformation_id": "A2_TO_B2", "support_mode": "source", "exercise": {}, "scaffolding": {}, "success_criteria": []}
  },
  "extensions": [
    {"extension_id": "S01-EE-ACCUEIL-01", "competence": "EE", "linked_family_id": "S01-CE-ACCUEIL-01"}
  ],
  "generation": {"model_id": "...", "prompt_version": "...", "generated_at": "..."},
  "validation_report": {
    "status": "warning",
    "rules": [
      {"rule_id": "DIFF_COMPETENCE_PRESERVED", "status": "pass", "evidence": ["family.competence=CE", "variants.B1.competence=CE"]},
      {"rule_id": "DIFF_DURATION_CALIBRATED", "status": "warning", "errors": ["duration_model_not_calibrated"]}
    ],
    "errors": [],
    "warnings": ["DIFF_DURATION_UNCALIBRATED"]
  }
}
```

## 12. Validation

| Couche | Règle | Statut initial |
|---|---|---|
| Schéma | champs, types, enums | Bloquant |
| Identité | famille, parent, niveaux | Bloquant |
| Compétence | identique dans les quatre variantes | Bloquant |
| Faits | hash et couverture | Bloquant |
| Support | mode autorisé et divergence | Bloquant si fait altéré |
| Transformation | règle source→cible déclarée | Bloquant |
| Niveau | opérations, aides, autonomie | Avertissement puis blocage |
| Accessibilité | littératie, modalité | Avertissement |
| Temps | couverture et estimation | Informatif avant calibration |
| Revue | humaine ou service réel identifié | Bloquant publication |

## 13. Analyse technique des trois systèmes

### 13.1 Curriculum statique

**FAIT CONFIRMÉ.** S01 publie des variantes A1/A2/B1/B2 depuis `content/curriculum/v2/S01`. L’atelier déclare 60 minutes (`deroule-180min.json:19`). Chaque niveau contient deux questions ; B1 et B2 ont `aides: []`.

**FAIT CONFIRMÉ.** `validation-report.json:4` déclare `publishable: true`. Plusieurs entrées utilisent `fake-content-model` (`:40`, `:168`, `:262`, `:602`, `:696`). La durée et la cohérence d’une famille ne sont pas bloquantes.

### 13.2 Moteur dynamique

**FAIT CONFIRMÉ.** `generate-session-content/index.ts` conserve un tronc commun et demande de « différencier le chemin d’accès » (`:603`). Il génère le même nombre de variantes que d’exercices (`:597`), les stocke dans `session_exercise_variants` (`:721`) puis appelle `publish_session_variants_run` (`:725`).

**FAIT CONFIRMÉ.** Le référentiel limite les clusters à trois et regroupe B1/B2 dans le cluster haut (`cluster_variant_rules.json:3`, `:23`). A2 n’est pas formalisé comme pivot ; les niveaux sont traduits en bas/standard/haut.

**FAIT CONFIRMÉ.** La recherche dans `src` ne trouve aucun lecteur métier de `session_exercise_variants`, en dehors des types générés. Le moteur est donc partiellement non consommé dans le code applicatif identifiable.

**NON VÉRIFIABLE.** Son usage exact en production nécessite la base distante et une trace runtime.

### 13.3 Pont vers `exercices`

**FAIT CONFIRMÉ.** Le pont lit les variantes statiques et produit des lignes `exercices`. Il ne consomme ni `cluster_variant_rules.json` ni les directives pédagogiques. Il transporte donc les variantes existantes mais ne garantit pas qu’elles forment une famille conforme.

**FAIT CONFIRMÉ — État actuel.** La compétence auparavant figée à `CE` est maintenant dérivée par `competenceForFormat` (`publish-bridge-lib.mjs:42`, `:88`). Les tests du pont sont désormais inclus dans Vitest (`vitest.config.ts:15`).

**RECOMMANDATION.** Le champ explicite du contrat doit devenir prioritaire ; la dérivation par format reste un fallback contrôlé.

## 14. Exemple corrigé — famille CE S01

**Source officielle/interne du support :** `content/curriculum/v2/S01`, dialogue d’accueil publié par CapTCF. Il ne s’agit pas d’une règle fiscale ni d’une question officielle d’examen civique.

**Invariants :** Awa, Mme Rossi, parcours de 80 heures, 25 séances, E1 et E2, cinq thèmes civiques. Compétence : CE. Tâche : comprendre et relier l’organisation du parcours.

- **A1 CE** : transcription segmentée et annotée ; associer chiffres et éléments, puis identifier le rôle d’E1/E2 à partir de formulations explicites.
- **A2 CE** : support source accessible ; extraire puis reformuler durée, séances et évaluations.
- **B1 CE** : même support ; comparer E1/E2 et justifier leur complémentarité à partir des informations présentes.
- **B2 CE** : même support ; analyser les choix d’organisation et nuancer leurs avantages/limites uniquement à partir des faits et contraintes explicitement fournis.

**Prolongement séparé :** `S01-EE-ACCUEIL-01` peut demander un courriel argumenté, mais il porte `competence: EE` et un autre `family_id` lié.

## 15. Codes d’erreur

- `DIFF_SCHEMA_INVALID`
- `DIFF_COMPETENCE_CHANGED`
- `DIFF_OBJECTIVE_CHANGED`
- `DIFF_CORE_TASK_CHANGED`
- `DIFF_FACTS_CHANGED`
- `DIFF_FACTS_MISSING`
- `DIFF_SUPPORT_DIVERGED`
- `DIFF_TRANSFORMATION_NOT_SUPPORTED`
- `DIFF_TRANSFORMATION_UNDECLARED`
- `DIFF_LEVEL_CONTRACT_MISMATCH`
- `DIFF_SCAFFOLDING_MISSING`
- `DIFF_A1_INFANTILIZING`
- `DIFF_B2_ONLY_MORE_ITEMS`
- `DIFF_EXTENSION_INSIDE_FAMILY`
- `DIFF_DURATION_UNCALIBRATED`
- `DIFF_FAKE_REVIEW_NOT_ADMISSIBLE`
- `DIFF_FACT_SOURCE_EXPIRED`
- `DIFF_FACT_SOURCE_UNVERIFIED`

## 16. Recommandations priorisées

### P0

- Définir schéma, hash des faits et matrice source→cible.
- Empêcher une variation de changer de compétence.
- Exclure `fake-content-model` du calcul de publication.
- Versionner la base officielle de faits.

### P1

- Faire charger le référentiel par les trois systèmes.
- Convertir S01 en famille de référence testée.
- Ajouter validation structurée et preuves.
- Formaliser quatre contrats, indépendamment des regroupements de classe.

### P2

- Calibrer durée, difficulté et aides sur des observations.
- Ajouter routage explicable et correction formateur.
- Étudier l’état nécessaire à l’adaptation live.

## 17. Annexes

### A. Inventaire des sources réellement consultées

| Source | Type | Usage |
|---|---|---|
| Référentiel moteur CapTCF V1 | Document interne | doctrine, matrice, validation |
| CapTCF Référence pédagogique V4 | Document interne sourcé | cadres théoriques et séance |
| CapTCF Fiche séance différenciée V2 | Document interne | métadonnées, phases, orientation |
| Audit différenciation 2026-05-29 | Audit technique | moteur dynamique et remédiation |
| Rapport d’audit consolidé | Audit | systèmes, durée, publication |
| S01 curriculum | Code/contenu | cas réel |
| `cluster_variant_rules.json` | Code | clusters et invariants |
| `generate-session-content/index.ts` | Code | génération dynamique |
| `publish-bridge-lib.mjs` | Code | pont vers exercices |
| Décret n° 2025-648 | Source officielle | B2 naturalisation |
| Arrêté du 10 octobre 2025 | Source officielle | examen civique |

### B. Tableau affirmation/preuve

| Affirmation | Statut | Preuve |
|---|---|---|
| Trois systèmes coexistent | FAIT CONFIRMÉ | curriculum, fonction dynamique, pont |
| B1/B2 sont regroupés | FAIT CONFIRMÉ | `cluster_variant_rules.json:23` |
| A2 n’est pas pivot typé | FAIT CONFIRMÉ | absence de `source_level/pivot_level` dans les contrats actuels |
| Pont non relié aux règles centrales | FAIT CONFIRMÉ | imports et flux du pont |
| 60 minutes sont déclaratives | FAIT CONFIRMÉ | déroulé et absence de validation temporelle |
| Durée réelle terrain | NON VÉRIFIABLE | observation nécessaire |
| Moteur dynamique utilisé en production | NON VÉRIFIABLE | trace runtime requise |

### C. Décisions ouvertes

1. Quelle granularité pour le hash factuel et les relations entre faits ?
2. Quelles réécritures didactisées sont admises par type de support ?
3. Qui valide les nouveaux gabarits de transformation ?
4. Comment gérer un exercice réellement bi-compétence ?
5. Quel canal est canonique à terme : curriculum, familles en base ou artefacts versionnés ?
6. Quel seuil de divergence textuelle est pertinent par modalité ?
7. Comment calibrer durée et difficulté sans pénaliser les productions complexes ?

### D. Correspondance entre la V4 pédagogique et le contrat machine V1

**STATUT DE LA SOURCE.** La V4 est le référentiel pédagogique interne principal de CapTCF. Elle synthétise un corpus académique, mais les sources originales devront être relues lorsqu'une attribution théorique fonde une règle bloquante.

#### D.1 Famille d'exercice et séquence thématique

- Une **famille d'exercice** conserve un document source, une compétence, une sous-compétence, une tâche noyau et des faits structurés. Les quatre niveaux constituent des variations de cette famille.
- Une **séquence thématique** peut réunir plusieurs familles différentes : SMS A1, convocation A2, page administrative B1 et texte argumentatif B2. Ces familles partagent un thème et un objectif général, mais ne sont pas quatre variantes du même exercice.

Cette distinction résout la tension entre le modèle V4, qui propose des supports gradués par palier, et le contrat d'invariance du moteur.

#### D.2 Structure collective en cinq phases

| Phase | Fonction | Contrôle attendu |
|---|---|---|
| 1. Ouverture commune | Construire le sens et activer les connaissances | Phase collective présente et non vide |
| 2. Variation | Même compétence, familles ou variantes graduées | Objectif commun et contrats de niveau explicites |
| 3. Groupes de besoins | Travailler une fragilité prioritaire | Besoin expliqué, groupe temporaire, activité compatible |
| 4. Mise en commun | Reconstruire le collectif et partager les stratégies | Trace des apports et correction commune |
| 5. Prolongement | Consolider, remédier ou étendre | Exercice lié, compétence explicitement déclarée |

Cette structure concerne la séance. Elle ne doit pas être confondue avec le contrat interne d'une famille.

#### D.3 Routage : analyse individuelle, réponse collective lorsque possible

Le routage recommandé suit la chaîne :

`profil individuel → besoin prioritaire → groupe de besoin temporaire → famille/variante adaptée → mise en commun`

La compétence la plus faible ne gagne pas automatiquement. La décision combine objectif de séance, compétence travaillée, trajectoire récente, priorité administrative, disponibilité d'un groupe cohérent et décision du formateur.

Les seuils 60/80 restent configurables. Ils représentent l'intention actuelle du modèle interne, pas une vérité pédagogique universelle.

#### D.4 Métadonnées normalisées

Les métadonnées documentaires de la V4 sont réparties en blocs versionnables :

| Bloc | Champs principaux |
|---|---|
| Identité | `family_id`, version, niveau source, niveau cible |
| Pédagogie | compétence, sous-compétence, objectif, tâche noyau |
| Support | document source, mode de dérivation, empreintes, faits |
| Modalité | format, ouvert/fermé, étapes, production attendue |
| Étayage | guidage, aides, exemple, transcription, feedback |
| Temps | durée informative, écoutes, essais, calibration |
| Orientation | besoin, règle appliquée, justification affichée |
| Validation | résultats par règle, erreurs, avertissements, preuves |
| Traçabilité | modèle, prompt, auteur, revue et dates |

#### D.5 Paramètres audio explicites

Pour la CO, la présence d'un support audio ne suffit pas. Le contrat porte séparément : nombre maximal d'écoutes, transcription (`none`, `available`, `unlockable`, `always`), durée cible et conditions de reprise. Ces champs figurent dans `audio_policy` du schéma V1.

#### D.6 Explication à l'apprenant et contrôle formateur

Toute affectation doit produire une justification non stigmatisante, par exemple : « Cette activité vous aide à repérer les informations essentielles d'un message administratif. » La justification ne doit pas exposer « votre niveau est faible » ni une donnée de profil sensible.

Le formateur peut modifier l'affectation. Sa correction doit être enregistrée comme signal de calibration, sans modifier rétroactivement les faits pédagogiques de la famille.

#### D.7 Artéfacts machine V1

Le rapport est accompagné de trois artéfacts non encore branchés au runtime :

- `differentiation_family_v1.schema.json` : schéma complet d'une famille ;
- `differentiation_transformation_rules_v1.json` : douze transformations et niveaux de validation ;
- `differentiation_family_v1.example.json` : exemple S01 entièrement en CE avec prolongement EE séparé.

Ils constituent des candidats de spécification. Leur présence ne vaut ni validation pédagogique ni autorisation de migration.

## 18. Conclusion et conditions préalables

**FAIT CONFIRMÉ.** La différenciation existe aujourd’hui comme intention, comme prompt dynamique et comme variantes statiques. Elle n’est pas encore un contrat central garanti dans le flux publié.

**RECOMMANDATION.** Ne pas commencer l’implémentation complète tant que les conditions suivantes ne sont pas satisfaites :

1. validation pédagogique du présent modèle de famille ;
2. validation des vingt contrats compétence×niveau ;
3. choix du statut exact des supports dérivés ;
4. schéma JSON et enums stabilisés ;
5. jeu de familles de référence validé par des formateurs ;
6. tests déterministes des douze transformations ;
7. neutralisation des revues factices ;
8. preuve du flux réellement consommé en production ;
9. décision sur le système canonique ;
10. calibration terrain avant blocage temporel ;
11. gouvernance et actualisation de la base officielle ;
12. règles de revue humaine, versionnement et retour arrière.

Une fois ces préalables validés, un lot limité au schéma, au loader et aux tests pourra être autorisé. La migration complète du moteur, le routage live et les blocages de publication restent hors périmètre à ce stade.
