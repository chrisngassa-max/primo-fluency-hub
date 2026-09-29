# Lot 5B-C — Éditeur de faits : préalable transactionnel

Date : 29 septembre 2026. **Arrêt conditionnel demandé avant création d'une migration. Éditeur non implémenté.**

## Base et périmètre

- Branche : `captcf-lot-05b-c-facts-editor`, base `5d63f8713ffeff8d59945283a9c46c6072cb333e`.
- Les commits documentaires locaux légitimes sont conservés ; aucun amend, reset, rebase ni fetch. La référence locale origin/main est ancienne ; elle ne sert pas à déclarer le checkout synchronisé avec main.
- Les six groupes de fichiers non suivis signalés par le propriétaire sont intacts, hors index. Aucun fichier applicatif, Edge ou migration modifié.
- Source `abddcf10-a426-4701-88eb-aaf05d9fc707`, famille A2 `a529ba06-2bf1-40e9-b7da-62bbb0142f91` : aucune mutation. Le hash refusé reste interdit à la confirmation. Aucun import, transcription, analyse, génération, validation ou publication.

## Cartographie et décision

`StudioAudioFactsStep.tsx` affiche les faits et enregistre la confirmation dans `pedagogical_sources.metadata.studio_facts_confirmation`. `studioAudioWorkflow.ts` compare son hash à celui des faits pour autoriser les niveaux suivants. `StudioAudioWizardPage.tsx` conserve aussi un état de familles qu'une future sauvegarde devra rafraîchir, avec la source.

Les faits sont dans `differentiation_families.payload.facts.required`, leur empreinte dans `payload.facts.facts_hash`, la version dans `payload.version`. Les familles et sources ont chacune un `updated_at`. La confirmation est donc sur une autre ligne/table que les faits.

Les JSON existants suffisent : **aucune nouvelle table nécessaire**. En revanche, l'accès existant par supabase-js/PostgREST ne comporte pas d'opération transactionnelle réunissant révision de famille, vérification de concurrence et invalidation de confirmation. Deux requêtes indépendantes, même avec comparaison du hash de famille, laisseraient un état intermédiaire ou une confirmation concurrente obsolète. Une transaction via nouvelle connexion PostgreSQL directe exigerait une autre infrastructure et des secrets de connexion ; ce n'est pas une alternative minimale déjà disponible.

Conclusion dans cette architecture : fonction SQL transactionnelle et garde de confirmation nécessaires, donc migration nécessaire. Application de la clause STOP de la mission : seulement proposition SQL hors `supabase/migrations`, retour arrière et documentation ; aucun code partiellement activable.

## Proposition, non validée par exécution

- [SQL proposé](facts-editor-proposal.sql) : `commit_studio_facts_revision`, garde d'écriture des faits, garde de confirmation périmée.
- [Retour arrière proposé](facts-editor-rollback-proposal.sql) : suppression explicite des seuls objets proposés, sans CASCADE ni réécriture des données.
- Les deux fichiers terminent volontairement par `ROLLBACK`. **Ne pas les exécuter sur le projet distant.** Leur syntaxe et leurs propriétés transactionnelles restent à éprouver dans une base locale isolée avant toute migration.

L'opération future `action: "revise_facts"` doit être ajoutée à l'Edge existante, avant tout chemin Gemini. Elle n'est pas ajoutée dans ce lot. Elle authentifiera le JWT réel, imposera formateur et propriétaire, reconstruira les faits depuis ceux du serveur et une liste blanche d'éditions, puis calculera le hash avec `calculateFactsHash` et la canonicalisation existante. Aucun hash de remplacement client ne sera accepté. Le hash attendu client servira uniquement de précondition de concurrence.

La fonction SQL proposée est SECURITY INVOKER, search_path fixe, exécutable seulement par service_role ; PUBLIC, anon et authenticated n'ont pas EXECUTE. L'UID acteur doit provenir de `auth.getUser()` dans l'Edge, jamais du corps client. service_role reste un appelant de confiance : SQL ne recalcule pas l'empreinte et ne constitue pas un second algorithme de hash. Les règles RLS existantes restent en place ; les triggers proposés complètent les autorisations actuellement trop larges sur payload/metadata. Aucun secret n'est inclus.

L'ordre de verrouillage proposé est source puis familles triées par ID. Hash, version et deux updated_at attendus sont contrôlés sous verrou ; un échec annule toute l'opération. Seule la famille A2 générée, draft, non publiée et non confirmée peut être révisée ; les autres familles actives font refuser l'opération. Le hash actuellement confirmé ne peut pas être édité ; une confirmation déjà obsolète est retirée lors d'une sauvegarde acceptée. Les faits et le nouveau hash changent ensemble ; la famille reste draft, à revoir, validation technique remise à pending. Les réponses A2 ne sont jamais corrigées automatiquement.

La garde de confirmation doit rejeter une confirmation concurrente portant sur un ancien hash. Les futures gardes A1/B1/B2 doivent être vérifiées **côté serveur aussi**, pas seulement dans l'interface. La proposition SQL seule ne les installe pas et ne suffit pas à livrer l'éditeur. Les autres chemins d'écriture privilégiée, les insertions de variantes et les interactions avec les triggers existants nécessitent une recette de concurrence dédiée. Les droits directs sur les autres champs de payload ne sont pas entièrement redessinés ici.

Le fichier Edge local lu ne reflète pas tous les changements Lot 5A-C présents dans la version déployée v27 : avant toute future livraison, réconcilier cette différence sans écraser le contrat borné/shared-facts en production. Ne pas déployer le fichier local actuel tel quel.

## Références A2 et retraits

| Question | Faits référencés |
| --- | --- |
| 1 | fact_01 |
| 2 | fact_02 |
| 3 | fact_03 |
| 4 | fact_05, fact_07 |
| 5 | fact_12, fact_10, fact_11 |
| 6 | fact_17 |

Retrait refusé pour ces références. Les faits sans question ne sont pas supprimés automatiquement : les liens entre faits comptent aussi. Par exemple fact_14 dépend de fact_13, fact_15 de fact_16 ; leur cible ne peut pas disparaître seule. Les IDs conservés et tous les champs de provenance restent immuables ; seuls subject/predicate/object et speaker/viewpoint sont proposés comme éditables. L'interface future devra afficher les questions, la provenance, avant/après, annulation, refus accessibles au clavier et boutons distincts enregistrer/confirmer.

## Tests à écrire avant implémentation, non exécutés

1. Formateur propriétaire autorisé ; autre formateur, élève et anonyme refusés.
2. Source/famille incohérentes, publiée, confirmée ou déjà réutilisée refusées.
3. Hash/version/updated_at obsolètes : conflit sans écriture.
4. Hash de remplacement client refusé ; hash nouveau calculé par le module canonique existant.
5. Deux sauvegardes concurrentes : un seul succès ; sauvegarde contre confirmation dans les deux ordres ; aucun état partiel après erreur.
6. IDs conservés ; IDs inconnus/vides/dupliqués refusés ; provenance falsifiée refusée.
7. Retrait référencé par item ou fait refusé ; retrait réellement non référencé accepté.
8. Confirmation obsolète invalidée ; aucune confirmation automatique ; A1/B1/B2 bloqués jusqu'à nouvelle confirmation explicite, au client et au serveur.
9. Aucun appel Gemini, publication ou modification de réponse lors d'une sauvegarde.
10. Comparaison avant/après, annulation locale, rafraîchissement source/familles, messages de conflit et références accessibles.
11. Grants/RLS : appels directs anon/authenticated refusés ; modifications directes du hash/version refusées ; concurrence avec insertions de variantes et triggers existants.

L'arrêt avant implémentation signifie : **aucun test rouge/vert ni build exécuté**, aucune garantie annoncée comme testée. Seul `git diff --check` est applicable aux livrables documentaires. Les tests ciblés éditeur, contrat, hash/scellement et Studio/génération, puis build, restent obligatoires après autorisation de reprendre.

## Suite et retour arrière

Diff de cette étape : deux propositions SQL et deux handoffs uniquement. Aucun diff applicatif prêt à publier en Phase B. Pas de commit code/tests, puisqu'aucun code n'est implémenté ; les propositions et handoffs constituent un commit documentaire local si les permissions le permettent.

Autorisation suivante nécessaire : valider le principe transactionnel et autoriser la création d'une migration locale, ses tests sur une base isolée, puis l'implémentation coordonnée Edge/UI avec tests rouges d'abord. Cette autorisation ne doit pas être confondue avec une application distante, un déploiement ou une correction de la source Éclipse, qui restent à autoriser séparément après revue.

Retour arrière futur : désactiver d'abord le point d'entrée UI et l'action Edge, puis retirer uniquement les objets nommés dans la proposition de rollback après contrôle des dépendances. Les faits sauvegardés ne seraient pas restaurés automatiquement ; ne jamais rétablir ni confirmer le hash refusé. Aujourd'hui aucun objet distant n'a été créé, donc aucun rollback distant à effectuer.

Gemini : **0** ; mutations distantes : **0** ; migration créée/appliquée : **non/non** ; Edge étendue : **non** ; push/PR/déploiement : **aucun**. Dérive connue +39,415 s inchangée, sans découpage audio.
