# CapTCF — Lot 2 : cartographie et arrêt avant implémentation

27 septembre 2026. **Lot 2 non terminé. Aucun code fonctionnel Lot 2 ajouté.**

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

## Prompt prêt à transmettre

Reprendre CapTCF dans le worktree `C:\Users\Sofiane\Documents\Codex\2026-09-17\files-pasted-by-the-user-mission\CAPTCF-ASSISTANT-PHASEB`, branche `captcf-lot-02-assistant-aide-pedagogique`. Lire ce handoff et `CAPTCF_LOT_00_01_ASSISTANT_ACCUEIL_PHASE_B.md`. Phase 2 est validée, production `captcf.fr` READY au SHA merge PR #38 `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`, Edge v6 JWT requis, Gemini OFF, smoke authentifié et nettoyage complets. Tests Phase B : 26/26 dans 4 fichiers et build PASS selon exécution propriétaire. Lot 2 est arrêté avant code : le compteur d'écoute est client, les états candidats sont modifiables par l'élève, aucun compteur transactionnel protégé n'est branché. La proposition de migration est documentaire seulement. Prochain objectif précis : examiner et arrêter une conception minimale de réservation serveur partagée avec le résolveur audio, confirmer le cycle des tentatives, puis demander l'autorisation spécifique nécessaire avant toute évolution de base. Ne pas appliquer de migration ni commencer une implémentation qui prétend garantir le replay sans ce prérequis. Garder exactement les cinq outils autorisés, réutiliser Atelier/readiness/routing, pilote Louise A1/A2/B1/B2 au facts_hash commun indiqué ci-dessus. Préserver intégralement `D:\sites\tcf pro` et ses fichiers non suivis. Aucun push, PR, déploiement, modification de secret ou d'exercice distant. Après levée explicite du blocage : tests rouges des 14 exigences, implémentation locale, tests ciblés/build, commits code puis docs séparés.
