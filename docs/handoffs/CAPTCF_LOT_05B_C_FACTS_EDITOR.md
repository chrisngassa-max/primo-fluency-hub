# Lot 5B-C — Éditeur sécurisé des faits

## État actuel — correctif PT409, 30 septembre 2026

Cette section remplace toutes les anciennes autorisations et tous les états de livraison ci-dessous. Le propriétaire autorise le correctif en avant, le push sur PR #48, son application après CI verte, le seul redéploiement generate-differentiation-family, le smoke temporaire, puis la fusion si tous les contrôles passent. Les faits Éclipse, leur confirmation et tout appel Gemini restent interdits.

Correctif `736703fd` : migration CLI `20260930182414_fix_facts_revision_conflict_status.sql`, adaptation minimale de l'Edge et tests. Cause confirmée : le conflit métier levait40001 ; il lève maintenantPT409, traduit en HTTP409 sans retry. La migration20260930072021 n'est pas modifiée. Signature, autorisations, hash et logique transactionnelle sont conservés.

CI du code verte. Migration corrective appliquée seule ; Edge v29 ACTIVE avec verify_jwt=true. Smoke complet réussi dès la première tentative : conflit RPC120ms / Edge493ms, un appel par conflit, sauvegarde200, concurrence200/409, aucune écriture sur refus. Les quatre occurrences de conflit attendues apparaissent dans les logs, sans boucle ni WORKER_ERROR. Nettoyage complet confirmé, Éclipse et les données existantes inchangées, Gemini0. Fusion/Production restent à vérifier après le commit documentaire et sa CI.

Le [rapport Phase B](CAPTCF_LOT_05B_C_PHASE_B.md) détaille la preuve rouge/verte, les mesures avant/après, le nombre d'appels, les sauvegardes et le rollback correctif. Rollback distant non utilisé ; rollback local testé. Ne pas utiliser le rollback global de l'infrastructure décrit dans l'historique pour annuler ce seul correctif.

---

## Historique antérieur — états et autorisations remplacés

## État vérifié — 30 septembre 2026, reprise après preuves SQL

**Autorisation actuelle : push de `captcf-lot-05b-c-facts-editor` vers `chrisngassa-max/primo-fluency-hub` et ouverture d'une PR vers main, puis attente CI et preview Vercel uniquement.** Le propriétaire a levé explicitement le blocage de destination décrit ci-dessous. Cette reprise n'autorise ni fusion, ni migration distante, ni déploiement Edge, ni correction/confirmation des faits, ni génération/Gemini. Elle remplace la portée Phase B des notes antérieures. Les 24 fichiers de la PR sont limités au lot ; les non-suivis privés sont exclus. Le MP3 curriculum et `supabase/.temp/cli-latest` déjà suivis dans main ont des blobs identiques dans HEAD, sans modification dans le lot.

**Dernier état de livraison : push bloqué par la revue automatique.** Les commits demandés sont créés : SQL `40eb98f8`, UI/Edge `fb0034ea`, documentation `7fc3715b`. Merge de `origin/main` ensuite : `2f37b5b4f025fca2d521c3d158fdd241d97da952`, sans changement d'arbre ni conflit. La branche compte 24 fichiers dans la PR projetée, incluant les propositions SQL historiques déjà commitées. La commande `git push -u origin captcf-lot-05b-c-facts-editor` a été rejetée avant exécution : la revue automatique exige l'autorisation explicite d'exporter code/historique vers `https://github.com/chrisngassa-max/primo-fluency-hub`. Demande ciblée transmise au propriétaire ; aucun contournement, push, PR, migration distante ou déploiement. Le reste des contrôles indépendants est terminé. Le HEAD pourra avancer pour consigner ce blocage documentaire.

Cette section fait autorité sur les historiques ci-dessous. L'autorisation Phase B (migration, Edge, frontend et correction via Studio) est acquise. Arrêt impératif avant confirmation/scellement, toute génération ou appel Gemini, validation/publication d'exercice, séance, devoir ou élève.

### Préflight et préservation

- Branche `captcf-lot-05b-c-facts-editor`, HEAD initial `72df56e2d52181627b0d6328d7c9327241310c6e` vérifiés. Travail existant repris ; aucun reset/amend. Aucun AGENTS.md trouvé dans le dépôt ou ses parents D:/ et D:/SITES.
- Écriture réelle du dépôt vérifiée par les scripts de tests, Git par indexation et commits. Docker client/serveur 29.8.1, contexte desktop-linux, vérifiés. Permissions ciblées nécessaires pour Docker, Git et réseau ; aucune modification ACL, Full access ou sandbox.
- Tous les non-suivis historiques désignés par le propriétaire restent hors index et intacts. Classium non consulté.
- Lecture distante : main GitHub `60c688338f6d9c22731f2383455119ffcee74096`, Edge `generate-differentiation-family` ACTIVE v27 avec JWT true. Migration/RPC de révision absentes avant livraison. Source Éclipse sans confirmation ; A2 version 1, 18 faits, 6 items, draft, hash refusé inchangé.

### Contrat UI / Edge / SQL

Édition sujet/prédicat/objet et attribution ; provenance conservée côté serveur et affichée en lecture seule ; questions A2 visibles par fait ; retrait refusé pour les références d'items et de faits conservés ; comparaison avant/après ; annulation locale ; sauvegarde distincte de la confirmation. Les préconditions hash/version/source.updated_at sont capturées à l'ouverture. Un conflit conserve les saisies. Le cache de confirmation est invalidé avant rafraîchissement ; le reçu bloque la confirmation tant que les faits/version ne sont pas rafraîchis.

L'action `revise_facts` utilise le client JWT après `auth.getUser()`, avant tout client administrateur ou chemin modèle. Liste blanche stricte, aucun rôle/acteur/hash final client. La RPC vérifie auth.uid(), rôle formateur, propriété, A2 generated/draft/non publiée et absence d'autre famille active. Verrou source puis familles, reconstruction depuis provenance serveur, hash SQL, invalidation confirmation et validation technique dans une transaction ; items conservés pour relecture.

La canonicalisation SQL reproduit la projection existante `fact-hashing.ts` / `canonical-json.ts`, avec domaine borné explicite et refus hors domaine. La correction d'alias `a.fact_value` est conservée. Parité prouvée sur deux vecteurs TypeScript/SQL (ordre, accents, guillemets, retour ligne, emoji). SECURITY DEFINER limitée à la RPC, owner postgres et search_path pg_catalog ; EXECUTE authenticated seulement, contrôle UID/propriété interne, aucune confiance en user_metadata. Aucun grant table ajouté.

### Réconciliation et concurrence corrigée

Les dépendances de v27 ont été comparées au checkout : lot05a-c, types, family-validation, index et autres dépendances identiques hors fins de ligne/BOM/espaces finaux ; seules les extensions de l'entrypoint appartiennent au lot. Réutilisation du hash et du mode borné existants conservée. Le test obsolète est remplacé par le contrat réel : `REVISED_FACTS_BOUNDED_MODE_REQUIRED` sans booléen strict correctif_05a_c=true ; null avec ce booléen et une confirmation correspondant au hash ; refus sans confirmation ou en force-regenerate.

Le contrôle Edge initial seul laissait une fenêtre entre lecture de confirmation et insertion de génération. La garde SQL `guard_studio_facts_generation` verrouille désormais la même source que la révision, relit confirmation/révisions et vérifie le hash attendu et le booléen borné transmis dans le payload provisoire d'admission. Si la révision gagne, l'insertion non confirmée/obsolète échoue avant Gemini ; si l'insertion gagne, la RPC refuse la révision car les faits sont réutilisés. Une archive du porteur de faits révisés est refusée, y compris via une requête force devenue obsolète. Les verrous sont limités aux transactions DB, aucun appel modèle sous verrou.

### Preuves de validation du code courant

- 8 fichiers ciblés demandés : **104 tests passés**, dernier run 30/09 à 10:59 heure locale. Pas de suite exhaustive locale.
- Build Vite réussi (3771 modules). `npm.cmd` absent du PATH : exécution du même script avec `node node_modules/vite/bin/vite.js build`. Avertissements existants : Browserslist, bundle volumineux, imports dynamiques.
- Lint ciblé passé ; `git diff --check` et `git diff --cached --check` passés après nettoyage des lignes finales.
- PostgreSQL 17 local isolé : migration, rôles anon/authenticated/service_role, refus d'identité/provenance/hash falsifiés, parité, atomicité et rollback passent. Admission positive sur confirmation correspondante et mode borné ; refus hash obsolète, chaîne "true", absence de confirmation et archivage de révision.
- Cinq scénarios à deux connexions : sauvegarde/sauvegarde ; révision puis génération ; génération puis révision ; révision puis confirmation ; confirmation puis révision. Attente du verrou observée et erreur attendue vérifiée pour chaque scénario.
- Rapport : `.local-security-evidence/captcf-facts-test-71eac8e3d3c9/resultat.txt`. Conteneur temporaire supprimé. Runner reproductible `supabase/tests/Test-CapTCF-Facts.ps1`, sans réseau runtime, port publié ou montage hôte. Rôles/RLS réels, claims JWT simulés : **pas une validation Supabase complète ni une recette HTTP/JWT**.
- Preuve antérieure fournie par le propriétaire également lue : `captcf-facts-test-ca6259512cf1/resultat.txt`. Elle ne remplace pas le run étendu ci-dessus.

### Livraison et limites à cette étape

Commits locaux : SQL/tests/rollback `40eb98f8` ; UI/Edge/tests `fb0034ea` ; documentation séparée. Publication prévue via branche/PR, CI et preview puis fusion, jamais push direct main. La CI du dépôt exécute sa suite complète, son build et son lint : contrôle obligatoire du circuit de publication, distinct des tests locaux ciblés.

Aucune migration, Edge ni frontend déployés à la rédaction de cette section. Session Studio formateur authentifiée disponible. Corrections pédagogiques non effectuées : vérifier transcription corrigée, références et audio avant saisie UI. Aucune écoute indépendante encore attestée. Aucun appel Gemini, confirmation, génération, validation/publication d'exercice ou mutation de faits distante.

Advisors de sécurité préexistants inspectés : search_path de fonctions hors lot, fonctions definer existantes, RLS sans policy, protection des mots de passe compromis. Pas d'élargissement de périmètre. La RPC intentionnellement accessible à authenticated reste protégée par rôle/propriété ; [documentation de l'avertissement definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Rollback : désactiver d'abord l'UI/action Edge, contrôler les dépendances puis appliquer `supabase/secours/20260930072021_revise_differentiation_facts_rollback.sql`. Aucun fait métier restauré automatiquement et aucun ancien hash confirmé.

---
## Historique — arrêt avant autorisation de la migration

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
