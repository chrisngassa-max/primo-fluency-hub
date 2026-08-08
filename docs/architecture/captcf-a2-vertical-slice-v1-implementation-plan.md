# CapTCF — Plan d’implémentation V1 du Vertical Slice A2

**Date :** 2026-07-27  
**Branche de travail :** `codex/a2-vertical-slice`  
**Base :** `origin/main` (`d455144`)  
**Document d’architecture de référence :** spécification technique définitive du Vertical Slice A2.

## 1. Règles d’exécution

- Ne pas choisir ni intégrer un fournisseur STT avant le Ticket 0.
- Ne pas modifier `tcf-generate-exercise`.
- Ne pas brancher `generate-session-content` pendant ce slice.
- Conserver `referential-loader.ts` comme chargeur de données et placer la logique métier dans `_shared/differentiation/`.
- Ne jamais présenter un payload A2 partiel comme conforme à `differentiation_family_v1.schema.json`.
- Séparer les statuts de génération, de validation automatique et de revue humaine.
- Séparer les segments techniques de transcription des chunks pédagogiques.
- Préserver les changements locaux sans rapport avec le slice.

## 2. Dépendances globales

```text
Ticket 0 ───────────────→ Ticket 3
Ticket 1 ─→ Ticket 2 ──→ Ticket 3 ─→ Ticket 4 ─→ Ticket 5
Ticket 6 ─→ Ticket 7 ──→ Ticket 8 ─→ Ticket 10
Ticket 9 ───────────────────────────→ Ticket 10
Tickets 3, 5, 10 ──────────────────→ Ticket 11
Tickets 10, 11 ────────────────────→ Ticket 12
Tickets 0 à 12 ────────────────────→ Ticket 13
```

Les Tickets 1, 6, 7 et 9 sont réalisables avant la décision STT. Le Ticket 2 peut créer le modèle de données sans intégrer de fournisseur.

## 3. Backlog détaillé

### Ticket 0 — Benchmark et décision STT

**Objectif**

Choisir le fournisseur et le modèle de transcription sur des résultats mesurés, sans inférer la décision depuis la documentation commerciale.

**Tâches**

1. Constituer un corpus sous droits maîtrisés :
   - dialogue court et propre ;
   - message pratique avec heures et nombres ;
   - entretien à deux locuteurs ;
   - français non natif ;
   - audio bruité exploitable ;
   - fichier de 5 à 10 minutes.
2. Définir un format de sortie canonique indépendant du fournisseur :
   - texte complet ;
   - langue ;
   - segments ordonnés ;
   - `start_ms`/`end_ms` ;
   - locuteur facultatif ;
   - confiance facultative.
3. Évaluer Google Speech-to-Text long, une API Whisper compatible et Gemini audio natif.
4. Mesurer fidélité verbatim, nombres, négations, timestamps, locuteurs, latence, coût, limites, conservation et RGPD.
5. Produire une matrice de résultats et une décision Architecture Decision Record.
6. Définir le fournisseur de repli et les règles de conservation.

**Fichiers**

- À créer : `docs/architecture/adr/ADR-XXX-stt-provider.md`.
- À créer : fixtures de benchmark hors données personnelles, emplacement à définir après validation des droits.

**Tests**

- Comparaison manuelle avec transcriptions de référence.
- Vérification automatique du schéma canonique de sortie.

**Critères d’acceptation**

- Une décision écrite nomme le fournisseur, le modèle, les limites et le plan de repli.
- Les timestamps segmentaires sont démontrés sur le corpus.
- Les contraintes RGPD et de conservation sont documentées.

**Risques**

- Corpus non représentatif.
- Coût ou disponibilité variables.
- Diarisation surévaluée alors qu’elle n’est pas bloquante en V1.

---

### Ticket 1 — Hash canonique serveur et préconditions audio

**Objectif**

Ajouter l’intégrité de source sans perturber les ressources non audio.

**Tâches**

1. Ajouter `pedagogical_sources.content_hash`.
2. Ajouter la contrainte `sha256:<64 hex>`.
3. Créer un service serveur idempotent de calcul sur l’objet Storage effectivement stocké.
4. Refuser de remplacer un hash existant par une valeur divergente sans action explicite.
5. Exploiter `source_kind` et `mime_type` existants ; ne pas ajouter de colonne de type redondante.
6. Ajouter les types frontend après application de la migration.

**Fichiers**

- Migration audio de base.
- À créer après décision d’exécution : `supabase/functions/hash-pedagogical-source/index.ts`.
- À modifier ultérieurement : `src/lib/pedagogicalSources.ts`, types Supabase générés.

**Tests**

- Hash stable d’un même fichier.
- Hash différent après modification du contenu.
- Refus d’une ressource Storage absente.
- Non-régression PDF/image/texte.

**Critères d’acceptation**

- Le hash est calculé côté serveur.
- Une source audio ne peut pas entrer en génération sans hash.

**Risques**

- Taille mémoire si le fichier est téléchargé en une seule fois par l’Edge Function.
- Course entre fin d’upload et calcul.

---

### Ticket 2 — Persistance des transcriptions et segments

**Objectif**

Créer le modèle technique indépendant du fournisseur STT.

**Tâches**

1. Créer `pedagogical_source_transcriptions`.
2. Créer `pedagogical_source_transcription_segments`.
3. Autoriser plusieurs tentatives et une seule transcription courante par source.
4. Ajouter les contraintes d’ordre et de timestamps.
5. Ajouter les index de lecture par source/transcription.
6. Ajouter les triggers `updated_at`.
7. Ajouter les politiques RLS fondées sur le propriétaire de la source et le rôle admin.
8. Conserver séparément texte brut et texte relu.

**Fichiers**

- Migration audio de base.
- À créer ultérieurement : `src/lib/pedagogicalSourceTranscriptions.ts`.
- Types Supabase après application de migration.

**Tests**

- Contraintes `start_ms >= 0`, `end_ms > start_ms`.
- Unicité `sequence_index` dans une transcription.
- Une seule transcription `is_current`.
- RLS propriétaire, autre formateur, admin, service role.

**Critères d’acceptation**

- Une transcription et ses segments peuvent être stockés sans créer de chunks.
- Une ressource non audio ne possède aucune transcription par défaut.

**Risques**

- Politique RLS trop large si elle copie aveuglément la lecture globale actuelle des sources.

---

### Ticket 3 — Intégration du fournisseur STT

**Objectif**

Transformer un audio stocké en transcription technique conforme au format canonique.

**Tâches**

1. Implémenter un adaptateur fournisseur derrière une interface interne.
2. Enregistrer `provider`, `model_id`, langue, paramètres et identifiant externe.
3. Normaliser les segments dans les tables du Ticket 2.
4. Implémenter transitions `pending → processing → ready|error`.
5. Rendre le lancement idempotent.
6. Empêcher deux traitements concurrents.
7. Ajouter relance explicite et journal d’erreur.
8. Choisir synchrone borné ou job réel à partir des résultats du Ticket 0.

**Fichiers**

- À créer : `_shared/transcription/types.ts`.
- À créer : adaptateur du fournisseur retenu.
- À créer ou modifier : Edge Function de transcription.
- Ne pas modifier le pipeline pédagogique avant que la transcription soit `reviewed`.

**Tests**

- Adaptateur sur réponse fixture.
- Erreur réseau et réponse partielle.
- Relance idempotente.
- Concurrence.
- Audio long.

**Critères d’acceptation**

- Un MP3 réel produit des segments horodatés `ready`.
- Aucun fournisseur n’est référencé dans le domaine partagé.

**Risques**

- Timeout Edge Function.
- Réponse fournisseur instable.
- Conservation externe non conforme.

---

### Ticket 4 — Relecture et validation de transcription

**Objectif**

Permettre la correction humaine avant toute extraction de faits.

**Tâches**

1. Créer hooks/services de lecture et mise à jour.
2. Afficher lecteur audio et segments synchronisés.
3. Permettre la correction du texte complet et des segments.
4. Enregistrer `reviewed_at` et `reviewed_by`.
5. Empêcher le passage à `reviewed` sans segments valides.
6. Invalider l’analyse pédagogique existante si une correction sémantique intervient après analyse.

**Fichiers**

- À créer : `src/lib/pedagogicalSourceTranscriptions.ts`.
- À créer : composants de transcription sous `src/components/formateur/`.
- À intégrer dans la page de ressource pédagogique existante ou une route dédiée.

**Tests**

- Composants : édition, navigation timestamp, validation.
- Intégration : statut et auteur.
- Accès interdit.

**Critères d’acceptation**

- La génération A2 refuse toute transcription non relue.

**Risques**

- Correction du texte sans mise à jour cohérente des segments.

---

### Ticket 5 — Liaison segments techniques ↔ chunks pédagogiques

**Objectif**

Préserver la traçabilité sans confondre les deux granularités.

**Tâches**

1. Créer `pedagogical_source_chunk_segments`.
2. Ajouter la relation et son ordre.
3. Adapter `analyze-pedagogical-source` pour consommer les segments relus.
4. Fournir au modèle les identifiants de segments.
5. Persister uniquement des références de segments existantes.
6. Exiger au moins une provenance segmentaire pour les chunks utilisables par l’extraction de faits.

**Fichiers**

- Migration audio de base.
- `supabase/functions/analyze-pedagogical-source/index.ts`.
- `src/lib/pedagogicalSourceAnalysis.ts`.

**Tests**

- Un chunk peut référencer plusieurs segments.
- Suppression en cascade.
- Référence à un segment d’une autre source refusée par le service.

**Critères d’acceptation**

- La chaîne source → transcription → segments → chunks est navigable.

**Risques**

- Le LLM renvoie des identifiants inventés : validation obligatoire avant insertion.

---

### Ticket 6 — Schéma formel du slice A2

**Objectif**

Définir une famille partielle valide sans falsifier le contrat complet A1–B2.

**Tâches**

1. Créer `differentiation_family_slice_v1.schema.json`.
2. Fixer `schema_version = slice-1.0`.
3. Exiger `generated_levels = ["A2"]`.
4. Définir faits, provenance, contrat A2, variante, items et rapport.
5. Ajouter un exemple valide et des fixtures invalides.
6. Documenter la future promotion vers `differentiation_family_v1`.

**Fichiers**

- Schéma et exemple sous `_shared/referential/`.
- Types sous `_shared/differentiation/`.

**Tests**

- Validation d’un exemple A2.
- Rejet d’une fausse famille complète.
- Rejet d’A1/B1/B2 dans le slice.

**Critères d’acceptation**

- Aucun payload A2 partiel ne porte `schema_version = 1.0`.

**Risques**

- Divergence future avec le schéma complet : minimiser en gardant les noms communs.

---

### Ticket 7 — Référentiel CO A2 versionné

**Objectif**

Sortir les décisions pédagogiques du prompt et du code.

**Tâches**

1. Créer `co_level_contracts_v1.json`.
2. Définir uniquement A2 dans cette première version.
3. Relier les volumes/durées à `pedagogical_rules.json` sans copier silencieusement des valeurs contradictoires.
4. Ajouter le chargement typé dans `referential-loader.ts`.
5. Faire valider le contrat par un référent pédagogique.

**Fichiers**

- `_shared/referential/co_level_contracts_v1.json`.
- `_shared/referential-loader.ts`.
- `src/test/referential-loader.test.ts`.

**Tests**

- Chargement, version, compétence, niveau.
- Formats autorisés/interdits disjoints.
- Bornes d’items cohérentes.

**Critères d’acceptation**

- Le contrat A2 est chargé sans règle codée en dur dans l’orchestrateur.

**Risques**

- Valeurs pédagogiques non approuvées avant production.

---

### Ticket 8 — Noyau partagé de différenciation

**Objectif**

Créer les briques pures partagées de typage, hash et validation.

**Tâches**

1. Créer `_shared/differentiation/`.
2. Définir les types du slice.
3. Implémenter la sérialisation JSON canonique.
4. Calculer `facts_hash` sur la sémantique, hors provenance.
5. Valider références, timestamps, formats, niveau, compétence et réponses.
6. Produire un rapport avec erreurs bloquantes, avertissements et dimensions humaines.
7. Ne faire aucun appel réseau, LLM ou Supabase.

**Fichiers**

- `types.ts`, `canonical-json.ts`, `fact-hashing.ts`, `family-validation.ts`, `index.ts`.
- Tests Vitest dédiés.

**Tests**

- Un cas valide.
- Un test par code bloquant implémenté.
- Hash stable malgré l’ordre des clés.
- Hash modifié par négation/modalité, stable lors d’un changement de provenance.

**Critères d’acceptation**

- Module utilisable dans Edge Functions et dans Vitest.

**Risques**

- Confondre contrôles déterministes et jugements pédagogiques.

---

### Ticket 9 — Persistance des familles et feedback

**Objectif**

Créer l’identité courante du slice et recueillir les corrections humaines sans préjuger du futur modèle de révisions.

**Tâches**

1. Créer `differentiation_families`.
2. Séparer `generation_status`, `validation_status`, `review_status`.
3. Stocker versions de schéma/référentiel et hash source.
4. Stocker le rapport de validation séparément du payload.
5. Empêcher la double publication avec `published_exercise_id`.
6. Créer `differentiation_family_feedback`.
7. Ajouter RLS propriétaire/admin/service.

**Fichiers**

- Migration familles A2.
- Services frontend après application.

**Tests**

- Transitions de statuts.
- RLS.
- Contrainte de hash.
- Feedback ciblé sur fact/item/source_ref.

**Critères d’acceptation**

- Une famille générée mais invalide peut avoir `generated/failed/draft`.

**Risques**

- Le payload JSON reste à valider applicativement, PostgreSQL ne résout pas le JSON Schema.

---

### Ticket 10 — Orchestrateur `generate-differentiation-family`

**Objectif**

Produire un slice A2 de bout en bout depuis une ressource validée.

**Tâches**

1. Vérifier source, hash, transcription relue, chunks et niveau demandé.
2. Verrouiller logiquement l’exécution.
3. Extraire les faits via sortie structurée.
4. Rejeter toute provenance inventée.
5. Calculer `facts_hash`.
6. Charger le contrat A2.
7. Générer 4 à 6 items avec `fact_refs`.
8. Valider puis persister les trois statuts.
9. Implémenter idempotence sur source/hash/niveau/référentiel.
10. Supporter `force_regenerate` uniquement après autorisation explicite.

**Fichiers**

- Nouvelle Edge Function.
- Prompts versionnés à proximité de l’orchestrateur ou dans `_shared/`.

**Tests**

- Préconditions bloquantes.
- Réponse LLM invalide.
- Provenance orpheline.
- Idempotence et concurrence.
- Génération réussie mais validation échouée.

**Critères d’acceptation**

- Une source réelle produit une ligne persistée et un rapport déterministe.

**Risques**

- Durée de l’appel. Basculer vers une vraie queue si le budget Edge n’est pas respecté.

---

### Ticket 11 — Interface de revue et feedback structuré

**Objectif**

Permettre une évaluation pédagogique observable sans mettre en place les révisions.

**Tâches**

1. Afficher état technique, automatique et humain.
2. Afficher audio, faits, questions, réponses et rapport.
3. Naviguer vers les segments cités.
4. Ajouter feedback ciblé et suggestion.
5. Autoriser validation/rejet seulement selon les préconditions.
6. Rendre les avertissements visibles.

**Fichiers**

- Pages/composants formateur.
- Hooks/services React Query.
- Routes et navigation.

**Tests**

- Rendu des trois statuts.
- Navigation timestamp.
- Création de feedback.
- Validation interdite si `validation_status=failed`.

**Critères d’acceptation**

- Chaque correction proposée est liée à un objet stable.

**Risques**

- IDs d’items instables entre générations.

---

### Ticket 12 — Adaptateur et publication vers `exercices`

**Objectif**

Publier une variante validée dans le flux élève existant.

**Tâches**

1. Créer `familyVariantToExerciceRow`.
2. Vérifier les trois statuts et le hash actuel.
3. Projeter vers `contenu.items`.
4. Écrire la traçabilité dans `contenu.metadata`.
5. Insérer dans `exercices`.
6. Enregistrer `published_exercise_id`.
7. Empêcher la double publication.
8. Vérifier la compatibilité avec `session_exercices` et le garde de modalité.

**Fichiers**

- `_shared/family-to-exercice-adapter.ts` ou `src/lib/` selon le lieu d’appel retenu.
- Edge Function/action serveur de publication.

**Tests**

- Mapping exact.
- `hasUsableContent`.
- Modalité CO jouable.
- Double publication.
- Divergence de source.

**Critères d’acceptation**

- L’exercice apparaît et fonctionne dans le parcours élève existant.

**Risques**

- Variation historique des formes d’items de `exercices`.

---

### Ticket 13 — Expérimentation pédagogique

**Objectif**

Valider la viabilité du slice et recueillir les données nécessaires au futur système de révisions.

**Tâches**

1. Exécuter le pipeline sur au moins quatre audios contrastés.
2. Faire relire par un formateur/référent.
3. Exporter les feedbacks structurés.
4. Mesurer taux d’échec de génération et de validation.
5. Classer les corrections par type d’objet.
6. Produire la décision go/no-go pour A1/B1/B2 et pour les révisions.

**Fichiers**

- Rapport sous `docs/audits/`.

**Critères d’acceptation**

- Corrections réelles documentées.
- Aucun élargissement multi-niveaux sans validation du slice.

**Risques**

- Échantillon pédagogique insuffisant.

## 4. Ordre de commits recommandé

1. `docs: planifier le vertical slice CO A2`
2. `feat(referential): ajouter le contrat de slice et le référentiel CO A2`
3. `feat(differentiation): ajouter les types, le hash sémantique et le validateur`
4. `feat(db): ajouter les fondations de transcription audio`
5. `feat(db): ajouter la persistance des familles A2 et du feedback`
6. `test(differentiation): couvrir le contrat A2 et les invariants`
7. Après Ticket 0 : `feat(stt): intégrer le fournisseur retenu`
8. `feat(audio): ajouter la relecture et la provenance des chunks`
9. `feat(differentiation): orchestrer la génération A2`
10. `feat(formateur): ajouter la revue du slice A2`
11. `feat(exercises): publier une variante A2 validée`

Les commits 1 à 6 sont indépendants du fournisseur STT. Ne pas committer les changements utilisateur déjà présents dans un autre worktree.

## 5. Risques transverses et réponses

| Risque | Réponse |
|---|---|
| Faux contrat complet | Schéma `slice-1.0` distinct |
| Dette de timestamps | Segments canoniques dès l’ingestion |
| Monolithe référentiel | Domaine dans `_shared/differentiation/` |
| LLM juge de lui-même | Validation pure séparée |
| Jugement pédagogique automatisé à tort | `human_review_dimensions` explicites |
| Ressources non audio polluées | Aucune transcription créée par défaut |
| Hash manipulé côté client | Hash canonique côté serveur |
| Éditions humaines perdues | Feedback structuré maintenant, révisions après observation |
| Timeout présenté comme async | V1 synchrone bornée ou vraie queue après mesure |
| Duplication de génération | Idempotence et verrouillage logique |

## 6. Définition de terminé de la V1

Le Vertical Slice est terminé lorsqu’un MP3 sous droits maîtrisés peut être stocké, hashé côté serveur, transcrit en segments, relu, analysé en chunks traçables, transformé en faits sémantiques, utilisé pour produire 4 à 6 questions A2, validé automatiquement sur les invariants vérifiables, revu humainement avec feedback structuré et publié une seule fois vers un exercice jouable.

