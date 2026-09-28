# CapTCF — Lot 2A implémenté localement ; Lot 2B non autorisé

## Revue du 28 septembre 2026 — recette préparée, non exécutée

Revue ciblée sur `D:\SITES\CAPTCF`, branche `captcf-lot-02-assistant-aide-pedagogique`, HEAD `75b6e7f774a78d586b5001b24738d252228ffd9d`. Commit code `88c52658c76b7202483a49592c28320f8e7819c3`. Commit documentaire précédent `75b6e7f774a78d586b5001b24738d252228ffd9d`. MP3 Louise présent, SHA-256 `B880B3C77F980676858BA05E71E7F3D435E1D8074A633B248D9CE90503D102DB`. Aucun défaut bloquant démontré, aucun commit correctif.

### Vérifié localement

- Autorisation : `auth.uid()` via le JWT ; exercice, devoir, séance, groupe, tentative, mode et remise reconstruits côté serveur ; les textes, compteurs et statuts du navigateur ne servent pas de preuve. Le client service n’est utilisé qu’après le contrôle d’accès JWT/RLS. La réponse ne contient pas les données d’un autre élève.
- Pédagogie : pas de correction avant remise libérée ; pas d’explication en évaluation ; la justification n’est jamais un indice ; replay refusé en évaluation ; contexte insuffisant = refus visible ; seules les quatre variantes Louise au facts_hash commun passent.
- IA : `kind=pedagogique` n’appelle pas Gemini. Refus et fallback sont visibles (`provider=faq_fallback`). Cinq outils, aucun nouvel agent. `recommend_next_activity` lit une `routing_decision` existante et n’affiche que `reason_student`. `flag_help_needed` écrit `aide_demandee` sans texte libre.
- Frontend : un changement d’élève ou de sélecteurs efface l’échange et ignore une réponse tardive. Une erreur serveur affiche un refus, pas une explication inventée. Les boutons disent « Expliquer », « Reformuler », « Indice », « Demander au professeur », « Problème technique ». L’indice absent et le replay restent des réponses serveur, pas une promesse d’indice ni d’écoute garantie.
- Tests de cette revue : 18 serveur Lot 2A, 4 panneau, 26 accueil, total **48/48**. `npm.cmd run build` PASS. `git diff --check` PASS.

### Limites acceptées

Aucun indice Louise validé : message « Aucun indice validé n’est disponible pour cet exercice. ». Replay limité au lecteur existant hors évaluation (`client_existing`). Pas de compteur serveur multi-onglets. Lot 2B et les fichiers `docs/handoffs/proposals/` restent non autorisés et ne sont pas des migrations.

### Recette distante non exécutée

À n’exécuter qu’avec une autorisation distincte, sur un compte élève synthétique :

1. Déployer ensemble le frontend de cette branche et la seule Edge `captcf-assistant-qa`.
2. Garder `verify_jwt=true`. Ne pas passer `--no-verify-jwt`.
3. Smoke anonyme attendu : HTTP 401, sans `WORKER_ERROR`.
4. Compte élève synthétique, données minimales, sans exercice Louise modifié.
5. Parcours `DevoirPassation`.
6. Parcours `SeanceApprenant` ou `BilanSeance`.
7. Consigne simplifiée.
8. Indice indisponible explicite.
9. Explication refusée avant remise.
10. Explication autorisée après remise et correction libérée.
11. Replay refusé en évaluation.
12. Prochaine activité lue depuis une `routing_decision` existante.
13. Demande d’aide visible dans le Mode Atelier, sans texte libre stocké.
14. Zéro appel Gemini.
15. Nettoyage : déconnexion, sessions et refresh révoqués, consentement révoqué, compte banni.

### Publication future — préparée, non lancée

- `origin/main` après fetch : `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`.
- Rollback frontend : ce même SHA, déjà en production.
- Edge actuelle : `captcf-assistant-qa` version **6**, ACTIVE, `verify_jwt=true`.
- Version qui serait déployée : le code `88c52658c76b7202483a49592c28320f8e7819c3`, pas encore publié. Avant déploiement, télécharger la version 6 ; en cas d’erreur, la redéployer et ne pas fusionner.
- Diff proposé vers `main` : 21 fichiers (frontend ci-dessous, module `assistant-pedagogique`, `captcf-assistant-qa/index.ts`, handoffs et propositions SQL). Les SQL de `docs/handoffs/proposals/` ne doivent pas être appliqués.
- Frontend concerné : `AvatarAssistantPanel.tsx`, `usePedagogicalHelpContext.ts`, `answerContextualQuestion.ts`, `answerPedagogicalQuestion.ts`, `pedagogicalTypes.ts`, `DevoirPassation.tsx`, `SeanceApprenant.tsx`, `BilanSeance.tsx`.

Commandes futures, non exécutées ici :

```text
npx.cmd supabase functions deploy captcf-assistant-qa --project-ref gudcenhmzlcvhgbgklzw --use-api
```

Le frontend suivrait un déploiement Vercel du SHA fusionné. Le retour arrière frontend est le redéploiement de `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`. Le retour arrière Edge est le redéploiement de la source version 6 conservée avant le nouveau déploiement.

### Actions qui demandent une nouvelle autorisation

Push, PR, merge, déploiement Edge ou Vercel, recette avec compte élève, migration, mutation Supabase, changement de secret, appel Gemini, modification des exercices Louise. Le Lot 2B reste non autorisé.

## État courant — décision propriétaire Lot 2A

**Lot 2A fonctionnel en code local, tests ciblés et build réussis. Aucun déploiement.** Cette section remplace les consignes d'arrêt historiques ci-dessous pour le périmètre minimal autorisé. Le Lot 2B (compteurs protégés et évolution de base) reste non autorisé. Les limites audio/indices acceptées ne constituent plus un motif d'arrêt du Lot 2A.

- Worktree : `C:\Users\Sofiane\Documents\Codex\2026-09-17\files-pasted-by-the-user-mission\CAPTCF-ASSISTANT-PHASEB`.
- Branche : `captcf-lot-02-assistant-aide-pedagogique` ; départ vérifié `8fad621e5c051f671863105a46aa0ecc2d97a5d2`.
- Commit code : `88c52658c76b7202483a49592c28320f8e7819c3` (15 fichiers). Documentation dans un commit séparé après ce SHA.
- Production : inchangée par ce lot ; dernière validation consignée au merge PR #38 `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`, Edge `captcf-assistant-qa` v6/JWT. Pas de nouvelle vérification distante dans cette reprise. `origin/main` local reste cette référence ; le fetch précédent avait échoué sur Schannel, sans changer TLS/identifiants.

### Fonctions réalisées

Nouveau chemin `kind=pedagogique` authentifié dans l'Edge existante, avant le chemin IA ; aucun import/appel de modèle dans le module pédagogique. Le client transmet question et sélecteurs exercice/item + devoir OU séance, tentative si disponible. Les données d'identité/mode/remise/compteurs/textes client ne sont pas des preuves.

Chargement : client JWT/RLS pour devoir, séance, appartenance au groupe, test actif, tentative et routage ; client serveur pour le contenu non lisible par l'élève, après validation d'accès. Pilote limité aux quatre exercices Louise listés ci-dessous. Publication de famille, source validée, facts_hash commun et hash de contenu concordants contrôlés. L'item doit également correspondre à la variante publiée (instruction/type/choix/justification), pour ne pas servir un corrigé édité sans validation.

- Consigne réelle avec étapes simples déterministes adaptées au type, compétence réelle et objectif de séance disponible. Aucun choix/corrigé dans cette réponse.
- Explication de l'item : tentative du même élève/exercice et du même devoir (assignment) ou de la même séance, `completed` + `completed_at` + correction libérée, hors évaluation ; justification de la variante validée seulement. Les anciennes tentatives sans rattachement précis ne sont pas assimilées à une remise autorisée.
- Mode déterminé par le contexte serveur : `devoirs.contexte`, bloc de séance diffusé ou rattachement au parcours intégré ; épreuve `test_sessions` en cours prioritaire. Mode inconnu => refus. Diagnostic/test => restrictions d'évaluation.
- Recommandation : dernière `routing_decisions` du contexte, `reason_student` et devoir généré encore accessible à l'élève ; aucun calcul readiness/IPE, aucun champ interne exposé. En devoir, après remise seulement ; refus en évaluation. Destination reconstruite sur liste blanche.
- Atelier : insertion serveur construite dans `session_live_events`, événement `aide_demandee`, après revalidation de séance/appartenance/exercice ; catégorie contrôlée, résumé fixe, aucun texte libre client ni compteur inventé. En évaluation, catégorie technique uniquement. Aucun événement réel envoyé pendant les tests : store en mémoire.
- Projection externe dédiée et testée : seulement mode/compétence/niveau/type/état de remise sous forme contrôlée. Aucun UUID, nom, email, question libre, objectif libre, correction ou routage. Cette projection n'est envoyée à aucun modèle.

Frontend branché dans DevoirPassation, SeanceApprenant et BilanSeance via un hook de sélecteurs. Le panneau affiche les réponses/refus serveur, permet de choisir l'item, propose « Demander au professeur » et « Problème technique ». Une réponse arrivée après changement de contexte est ignorée ; l'échange affiché est effacé au changement de contexte/utilisateur. Sur erreur serveur, refus/fallback explicite, sans fabriquer une explication locale de l'exercice.

### Limites acceptées et limites de recette

Les cinq noms d'outils sont conservés, sans nouvel agent ni sixième outil. Aucun indice Louise validé disponible : message explicite, aucune substitution par justification, aucune écriture. Replay : refus en évaluation ; sinon annonce du max_listens avec `enforcement=client_existing`, sans URL, lancement audio ou compteur serveur. Pas de persistance d'indices, pas de protection multi-onglets, pas de modification des lecteurs existants. Pas de correction si données manquantes/non fiables. Recommandation limitée aux décisions portant un devoir généré et autorisé ; absence => refus, jamais nouvelle décision IPE.

La fonctionnalité exige le futur déploiement coordonné du frontend et de l'Edge pour être utilisable en production. Aucun smoke distant Lot 2A réalisé et aucune modification des données Louise. La validation locale n'atteste pas de nouveaux enregistrements réels disponibles, d'une correction déjà libérée pour un élève réel, ni de nouvelles politiques RLS distantes. Le chemin échoue explicitement si une lecture est refusée ou si un rattachement manque.

### Vérification réellement exécutée

- 18/18 tests serveur Lot 2A, avec variantes structurelles A1/A2/B1/B2, faux contexte, accès étranger, correction, évaluation, replay, routage, Atelier et zéro appel réseau modèle.
- 4/4 tests panneau : consigne serveur, refus/fallback, explication libérée, action d'aide humaine.
- 26/26 tests accueil existants : `accueil-navigation.test.ts` (10), `accueil-conversations-reference.test.ts` (1), `avatar-assistant-contextual.test.ts` (7), `avatar-assistant-preflight-3b3.test.ts` (8).
- Total : **48/48, 6 fichiers**. Dernière exécution après modifications finales du panneau, suivie de `npm run build` PASS. Avertissements généraux Vite/Browserslist inchangés, non corrigés.
- TypeScript ciblé sur le nouveau module serveur : PASS. `git diff --check` : PASS.
- Tests écrits avant leur implémentation respective. Premier lancement serveur bloqué avant exécution par `spawn EPERM` de la sonde optionnelle Vite `net use` : pas de prétention à une exécution rouge serveur à ce stade. Les quatre tests panneau ont ensuite été exécutés rouges (4 échecs fonctionnels), puis verts après branchement.
- Aucun changement de dépendances : `@testing-library/dom` absent, tests panneau écrits avec React DOM/act existants. Pour Vite sous cette sandbox Windows, préchargement local hors dépôt qui désactive uniquement la sonde optionnelle de lecteurs réseau `net use` ; exécution Vitest avec `--pool=threads`. Ni mocks du code métier ni modification de node_modules pour obtenir les PASS. Le préchargement est conservé dans le dossier `work/` de la conversation, pas dans le code applicatif.

Commande ciblée (avec ce préchargement local dans NODE_OPTIONS si nécessaire dans la sandbox) :

```text
npm.cmd test -- --pool=threads supabase/functions/_shared/assistant-pedagogique/pedagogique.test.ts src/test/assistant-pedagogique-panel.test.tsx supabase/functions/_shared/assistant-accueil/accueil-navigation.test.ts src/test/accueil-conversations-reference.test.ts src/test/avatar-assistant-contextual.test.ts src/test/avatar-assistant-preflight-3b3.test.ts
npm.cmd run build
```

### Fichiers du commit code

- `supabase/functions/_shared/assistant-pedagogique/` : `store.ts`, `load.ts`, `index.ts`, `fixtures.ts`, `pedagogique.test.ts`.
- `supabase/functions/captcf-assistant-qa/index.ts`.
- `src/lib/avatar/answerPedagogicalQuestion.ts`, `answerContextualQuestion.ts`, `pedagogicalTypes.ts`.
- `src/hooks/usePedagogicalHelpContext.ts` ; `src/components/eleve/AvatarAssistantPanel.tsx`.
- `src/pages/eleve/DevoirPassation.tsx`, `SeanceApprenant.tsx`, `BilanSeance.tsx`.
- `src/test/assistant-pedagogique-panel.test.tsx`.

Fixtures : les identifiants d'exercices, source, facts_hash, nombres d'items et quotas sont ceux déjà constatés dans le handoff ; textes, affectations, tentatives et apprenant sont synthétiques, explicitement marqués. Aucun indice Louise inventé. Les propositions SQL documentaires préexistantes sont conservées sous `docs/handoffs/proposals/`, hors migrations et hors code fonctionnel ; elles ne sont ni autorisées ni appliquées.

Interdictions respectées : aucun appel Gemini, aucune migration, mutation Supabase distante, publication, push, PR, déploiement ou changement de secret. Aucun exercice distant modifié. Aucun fichier métier/non suivi de `D:\sites\tcf pro` touché ; seules les métadonnées Git partagées nécessaires aux commits locaux ont été écrites avec permission. Artefact `supabase/.temp/linked-project.json` conservé et exclu des commits.

### Transmission actuelle

Reprendre CapTCF assistant élève après Lot 2A local, worktree/branche ci-dessus, commit code `88c52658c76b7202483a49592c28320f8e7819c3` puis commit documentaire séparé. Lire d'abord cette section et le handoff Phase B. Lot 2A testé 18 serveur + 4 panneau + 26 accueil, build PASS ; aucune recette/déploiement distant. Production connue au merge PR #38 `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`, Edge v6 JWT requis, Gemini OFF. Les compteurs serveur et garanties multi-onglets sont explicitement hors Lot 2A ; pas d'indice Louise, replay client_existing. Lot 2B/SQL non autorisé. Conserver les cinq outils, readiness/routing et Atelier. Pilote source/hash/IDs ci-dessous. Préserver D: et ses 124 fichiers non suivis ainsi que linked-project.json. Aucun push, PR, migration, mutation distante, secret ou déploiement sans nouvelle autorisation. Prochain objectif : revue ciblée du diff et préparation d'une recette élève avant toute demande distincte de publication ; réussite : vérifier les parcours autorisés/refusés, séparer preuves locales et recette distante restant à autoriser, conserver les tests ciblés verts. Aucun audit général ni reprise de l'étude de compteurs dans ce cadre.

## Historique — état avant autorisation du Lot 2A

27 septembre 2026. À ce stade antérieur, Lot 2 non terminé, aucun code fonctionnel ajouté. Les paragraphes d'arrêt suivants documentent le périmètre complet devenu Lot 2B ; ils ne bloquent plus le Lot 2A autorisé ci-dessus.

Phase 2 terminée : voir `CAPTCF_LOT_00_01_ASSISTANT_ACCUEIL_PHASE_B.md`. Branche locale créée : `captcf-lot-02-assistant-aide-pedagogique`, depuis `origin/main` actualisé, SHA `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`. Worktree : `C:\Users\Sofiane\Documents\Codex\2026-09-17\files-pasted-by-the-user-mission\CAPTCF-ASSISTANT-PHASEB`. Dépôt principal D: inchangé.

## Données vérifiées en lecture seule

Source Louise : `4a0e8321-9ece-42d7-bf76-8825b1e65e79`.
Les quatre familles retenues ont `review_status=published` et le hash commun :
`sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5`.

| Niveau | Exercice publié par la famille | Items | Écoutes au contrat |
| --- | --- | --- | --- |
| A1 | `62b06150-7942-4c41-bab9-fdba0a4d852c` | 4 | 3 |
| A2 | `972e14a8-9fe1-4f3d-93d1-9a8280028c91` | 6 | 2 |
| B1 | `bcbcef25-7dcf-4e35-97dd-1fb641ab9815` | 6 | 2 |
| B2 | `cb06e39a-e914-4729-8ce4-893e7f8faeaf` | 5 | 2 |

Les anciennes variantes à hash différent existent encore : ne pas les confondre avec ce pilote. Les lignes `exercices` portent encore `statut=validation_status=draft` ; la publication est attestée par la relation `differentiation_families.published_exercise_id` et son `review_status`, comme dans le résolveur audio existant. Aucun statut distant corrigé.

Payload disponible : `audio`, `items`, `metadata`, `script_audio`. Les items contiennent `id`, `type`, `instruction`, `choices`, `fact_refs`, `justification`. **Aucun hint_1/2/3 ni équivalent validé observé dans ces items.** La justification est une correction ; elle ne doit pas devenir un indice avant remise. Le JSON permet une future extension compatible pour des aides validées, sans migration de contenu. Ne pas inventer ni publier ces aides pendant cette mission.

Contrat d'écoute : `contenu.metadata.level_contract.audio_policy.max_listens`, transcription `unlockable`. La colonne `nombre_ecoutes_max` vaut null pour ces exercices : ne pas interpréter cela comme une écoute illimitée. Le mode de l'exercice `en_ligne` n'est pas une preuve du mode pédagogique entraînement/devoir/évaluation.

## Intégrations à conserver

- `session_exercices` : rattachement séance/exercice/élève, statut et diffusion. `session_document_links` + inscription utilisés pour l'autorisation audio par séance.
- `exercise_attempts` : learner_id, exercise_id, assignment_id, session_id, status, answers/item_results, completed_at, correction_released_at. La remise et la libération doivent provenir d'un chemin serveur autoritatif ; un simple champ client ne suffit pas.
- Frontend : `AidePedagogiqueContext` ne porte actuellement ni identifiant d'item/tentative ni preuve de remise. Ajouter ultérieurement un sélecteur de contexte, puis recharger les données serveur ; ne pas croire les titres/consignes envoyés par le client.
- `_shared/readiness.ts` : moteur IPE existant, ne pas le recalculer dans l'assistant. Lire les décisions propres à l'élève dans `routing_decisions`, n'exposer que leur explication élève et une destination autorisée, jamais `reason_trainer`, `rule_id`, seuils ou `context_snapshot` complet.
- Atelier existant : `session_live_events`, événement `aide_demandee`, consommé par `SuiviDirectClasse` et `FocusEleveSheet`. Réutiliser ce flux avec exercice, nombre d'indices réellement délivrés, difficulté catégorisée et demande explicite ; pas de seconde file.

## Motif précis de l'arrêt

La mission initiale impose : **« si une migration est réellement indispensable, STOP et produire seulement une proposition de migration. Ne pas l'appliquer. »**

Le replay ne peut pas être rendu non contournable en ajoutant seulement une décision au chatbot :

1. `DevoirPassation.tsx` initialise `audioPlayCount` à zéro en React et l'incrémente dans `onPlayStart` ; le compteur n'est pas serveur.
2. `CoAudioPlayer.tsx` vérifie `canStartAudioPlay` dans le navigateur. Le résolveur `resolve-exercise-audio-handler.ts` contrôle l'accès mais pas un budget d'écoutes partagé et atomique.
3. Le résolveur émet une URL signée réutilisable, mise en cache huit minutes côté client. Un refus dans le panneau Aide ne révoque pas ce chemin d'écoute.
4. Vérification RLS **limitée aux tables candidates**, pas audit global : l'élève peut mettre à jour sa tentative `in_progress` et insérer ses propres `session_live_events`. Ces JSON ne peuvent pas être utilisés comme preuve serveur du nombre d'indices ou d'écoutes consommés. Un champ prétendument réservé dans ces JSON reste falsifiable sans protection supplémentaire.
5. `ai_processing_logs` est réservé au serveur en écriture et convient aux métriques. Il n'offre pas le mécanisme de réservation atomique, d'idempotence et de liaison à la tentative nécessaire. Détourner une suite de SELECT/INSERT de logs en compteur expose aux requêtes concurrentes.

**Décision d'implémentation : un état protégé et une consommation transactionnelle sont nécessaires.** Il faut une évolution de base pour garantir la séquence d'indices et surtout les budgets d'écoute communs aux différents chemins. Le détail proposé est ci-dessous. Ne pas présenter une simulation en mémoire comme la réalisation de ce contrat.

## Proposition de migration — non créée dans migrations, non appliquée

Proposition conceptuelle à examiner avant toute autorisation de réalisation :

- Stocker un état minimal propre à une tentative autorisée, exercice et item : dernier niveau d'indice délivré, nombre d'autorisations d'écoute consommées, version de contrat/hash de source, jeton d'idempotence et horodatage. Pas de texte de conversation, nom, email, correction ni nouvelle file Atelier.
- Privilégier une extension protégée du modèle de tentative si tous les parcours ont une tentative serveur stable. Sinon, petite table dédiée d'état technique avec clé unique sur élève + contexte autorisé + exercice + item + version. Le choix final nécessite de confirmer le cycle de tentative pour les séances et devoirs ; ne pas ajouter arbitrairement deux modèles.
- RLS : lecture de son propre état au besoin, aucune écriture directe par `authenticated`/`anon`. Écriture uniquement par une fonction transactionnelle à droits stricts ; `search_path` fixé, droits publics révoqués. Identité tirée de `auth.uid()` si appelée avec JWT élève ; sinon service interne avec identité préalablement vérifiée et accès non public. Revalider appartenance, mode et contrat dans la transaction.
- Consommer atomiquement via verrou de ligne : rejeter évaluation/replay interdit, servir strictement l'indice suivant existant et validé, plafonner le devoir à 1, vérifier le budget d'écoute, rendre une répétition idempotente. Ne pas accepter du client les compteurs, le mode, la remise ou la correction.
- Brancher **toutes** les autorisations d'écoute concernées sur ce contrôle, y compris `resolve-exercise-audio` et les lecteurs existants ; ne pas laisser un accès direct parallèle au même audio contourner le contrat. Les URLs signées réutilisables exigent une conception d'accès adaptée. Une fois les octets livrés au navigateur, empêcher une copie ou une réécoute hors application n'est pas une garantie techniquement absolue : distinguer autorisations serveur et contrôle DRM inexistant.
- Ne pas modifier le calcul des scores/IPE. Conserver `aide_demandee` dans le flux Atelier actuel, avec un résumé catégorisé minimal. Durée de rétention et purge de l'état à spécifier selon la tentative, sans rétention d'échanges ordinaires.
- Reversibilité : feature OFF par défaut ; aucune donnée métier existante réécrite ; retour au refus explicite si état/contrat absent. Une future migration doit être additive et réversible après extinction des appelants, sans supprimer les tentatives existantes.

## Reprise et critères

Pas de tests rouges Lot 2 ni de build Lot 2 annoncés : arrêt avant implémentation, uniquement documentation. Les **26 tests dans 4 fichiers** et le build PASS concernent la Phase B et ont été exécutés manuellement par le propriétaire. Aucun commit code Lot 2 n'existe.

Après décision explicite sur la proposition, reprendre les 14 tests rouges de la mission, puis quelques tests du panneau. Ajouter les scénarios concurrents, deux onglets, rechargement, corps client falsifié, appel direct du résolveur, budget épuisé et idempotence. Aide validée manquante → refus/fallback explicite, jamais conversion automatique d'un corrigé en indice. Les fixtures Louise futures doivent être expurgées et distinguer données réellement lues des extensions synthétiques de test.

**Aucune migration, aucun déploiement, aucun push, aucune PR, aucune modification d'exercice distant ni appel Gemini Lot 2.**

## Complément — nouvelle mission du 27 septembre, proposition SQL uniquement

La nouvelle mission maintient le STOP si une migration est indispensable et demande le SQL proposé et son retour arrière. Documents de revue ajoutés hors de `supabase/migrations` :

- `proposals/lot2-help-state.md` : carte ciblée, cycle constaté, hypothèse de tentative stable non confirmée et limites de la proposition.
- `proposals/lot2-help-state.proposed.sql` : DDL conditionnel de stockage privé, sans accès applicatif ni RPC ; ne pas appliquer.
- `proposals/lot2-help-state.rollback.sql` : retrait des seuls objets proposés si vides ; refuse la destruction d'un état utilisé.

Constat local supplémentaire : le hook live et l'index in_progress utilisent élève/exercice sans contexte ; le miroir des résultats finalise cette tentative tandis que submit-seance-answer insère une nouvelle tentative completed. Le cycle stable doit être résolu avant l'activation des compteurs. Ni la règle de nouvelle tentative, ni le coût des segments audio, ni la rétention ne sont confirmés par la nouvelle mission.

HEAD de départ inchangé `8fad621e5c051f671863105a46aa0ecc2d97a5d2`, branche existante conservée. Fetch demandé tenté : après levée de la restriction des métadonnées Git, échec Schannel `SEC_E_NO_CREDENTIALS`. `origin/main` local au merge attendu, fraîcheur distante non confirmée. Pas de changement TLS/credentials. Aucun fichier métier de D: modifié.

Aucun test rouge, test accueil ou build exécuté dans cette reprise documentaire ; aucun code fonctionnel Lot 2 ajouté. Aucune donnée distante relue : les faits Louise restent ceux de la lecture antérieure consignée. Aucun commit supplémentaire effectué ; documents laissés pour revue. La prochaine étape est la confirmation du cycle puis la complétion de la proposition, pas l'application du DDL partiel.

## Ancien prompt — remplacé par la transmission actuelle en tête

Reprendre CapTCF dans le worktree `C:\Users\Sofiane\Documents\Codex\2026-09-17\files-pasted-by-the-user-mission\CAPTCF-ASSISTANT-PHASEB`, branche `captcf-lot-02-assistant-aide-pedagogique`. Lire ce handoff et `CAPTCF_LOT_00_01_ASSISTANT_ACCUEIL_PHASE_B.md`. Phase 2 est validée, production `captcf.fr` READY au SHA merge PR #38 `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`, Edge v6 JWT requis, Gemini OFF, smoke authentifié et nettoyage complets. Tests Phase B : 26/26 dans 4 fichiers et build PASS selon exécution propriétaire. Lot 2 est arrêté avant code : le compteur d'écoute est client, les états candidats sont modifiables par l'élève, aucun compteur transactionnel protégé n'est branché. La proposition de migration est documentaire seulement. Prochain objectif précis : examiner et arrêter une conception minimale de réservation serveur partagée avec le résolveur audio, confirmer le cycle des tentatives, puis demander l'autorisation spécifique nécessaire avant toute évolution de base. Ne pas appliquer de migration ni commencer une implémentation qui prétend garantir le replay sans ce prérequis. Garder exactement les cinq outils autorisés, réutiliser Atelier/readiness/routing, pilote Louise A1/A2/B1/B2 au facts_hash commun indiqué ci-dessus. Préserver intégralement `D:\sites\tcf pro` et ses fichiers non suivis. Aucun push, PR, déploiement, modification de secret ou d'exercice distant. Après levée explicite du blocage : tests rouges des 14 exigences, implémentation locale, tests ciblés/build, commits code puis docs séparés.
