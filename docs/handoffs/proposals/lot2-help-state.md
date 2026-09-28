# Lot 2 — proposition SQL conditionnelle, non appliquée

27 septembre 2026. Arrêt prescrit par la section 6 de la nouvelle mission : « si une migration est indispensable : STOP, produire seulement le SQL proposé et son retour arrière, sans appliquer. » Aucun code fonctionnel, test rouge ou migration créé. Cette proposition ne rend pas le Lot 2 opérationnel.

## État et preuves

Vérifié localement : branche `captcf-lot-02-assistant-aide-pedagogique`, HEAD `8fad621e5c051f671863105a46aa0ecc2d97a5d2`. Branche préexistante conservée avec son historique. La référence locale `origin/main` pointe sur `0ce79a36c0613e369d54a6a4db9422e87b3c4fa5`. Fetch tenté, d'abord bloqué par les permissions des métadonnées Git partagées, puis, après permission, par Schannel `SEC_E_NO_CREDENTIALS`. Fraîcheur distante non confirmée ; aucun changement de configuration Git/TLS.

Production READY, Edge v6/JWT, smoke et nettoyage : faits consignés dans le handoff Phase B, non revérifiés à distance ici. Tests 26/26, quatre fichiers, build PASS : compte rendu du propriétaire pour Phase B, pas une exécution Lot 2. Aucune lecture Supabase distante dans cette reprise.

## Carte courte

- Contenu Louise, selon lecture distante antérieure consignée : `exercices.contenu.items` contient instruction, choix, références de faits et justification ; `script_audio`, `audio` et `metadata` sont disponibles. La justification est une correction, jamais un indice de substitution. Aucun indice validé observé. Publication attestée par la famille publiée, malgré le statut draft de l'exercice.
- Source : `4a0e8321-9ece-42d7-bf76-8825b1e65e79` ; hash `sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5`. A1 : `62b06150-7942-4c41-bab9-fdba0a4d852c`, quatre items/trois écoutes ; A2 : `972e14a8-9fe1-4f3d-93d1-9a8280028c91`, six/deux ; B1 : `bcbcef25-7dcf-4e35-97dd-1fb641ab9815`, six/deux ; B2 : `cb06e39a-e914-4729-8ce4-893e7f8faeaf`, cinq/deux.
- Quota : `contenu.metadata.level_contract.audio_policy.max_listens`, pas `nombre_ecoutes_max=null`. Le résolveur contrôle le droit d'accès et renvoie une URL ; le lecteur DevoirPassation compte les lectures en React. Les chemins doivent partager la même réservation serveur.
- Frontend : DevoirPassation connaît l'exercice du devoir ; BilanSeance l'exercice courant. `AidePedagogiqueContext` porte titres/consigne/compétence, sans identifiant d'item/tentative ni preuve de remise. `AvatarAssistantPanel` appelle `answerContextualQuestion` ; `edgeAssistantProvider` transmet le contexte préparé. Il faut un sélecteur de contexte interne puis une reconstruction serveur, pas faire confiance aux textes client.
- Mode : matrice existante dans `assistant-accueil/contract-v1.ts` et garde `modeProven` dans `orchestrate.ts`. `en_ligne` ne prouve pas entraînement/devoir/évaluation. Le rattachement serveur au devoir ou à la séance et sa règle pédagogique doivent fournir cette preuve ; règle absente => refus.
- Recommandation : conserver `_shared/readiness.ts`, moteur IPE pur, et lire la décision existante dans `routing_decisions` pour l'élève autorisé. L'assistant n'a pas encore le branchement Lot 2 ; ne pas exposer seuils, reason_trainer ou snapshots internes.
- Atelier : conserver `session_live_events`/`aide_demandee`, consommés par SuiviDirectClasse et FocusEleveSheet et leur priorité existante. Le futur signal utilisera le nombre d'indices serveur et une catégorie minimale ; aucune nouvelle file.

## Cycle : constat et hypothèse à confirmer

`src/hooks/useLiveAttemptSync.ts` cherche une tentative in_progress par élève/exercice, sans assignment_id/session_id, puis insère si absente. L'index partiel de la migration du 21 avril porte également sur élève/exercice. `mirror_resultat_to_attempt` (22 avril) finalise cette ligne pour un résultat, ou en crée une. `submit-devoir-result` accepte un devoir en_attente, écrit le résultat puis son statut dans des opérations séparées ; le champ tentative du résultat vaut actuellement 1. `submit-seance-answer` insère une nouvelle ligne completed. Une même identité stable du démarrage à la remise n'est donc pas assurée pour tous les parcours.

Hypothèse proposée, NON confirmée par la nouvelle mission : ouvrir/reprendre côté serveur une tentative par élève + contexte pédagogique exact + exercice ; conserver son id et ses compteurs lors d'un rechargement, d'une reconnexion ou d'un second onglet ; finaliser ce même id de façon idempotente. Une nouvelle tentative/budget exige une décision serveur explicite du parcours ou du formateur. Un changement de version ne doit jamais créer automatiquement un budget neuf.

Le SQL joint choisit conditionnellement l'extension technique de `exercise_attempts`, sans créer une seconde notion métier de tentative. Il n'est applicable qu'après résolution de ce cycle. Il ne modifie pas arbitrairement l'index ancien ni les chemins de soumission : leur compatibilité avec le suivi live doit être étudiée dans la proposition complète avant autorisation.

## Portée exacte du SQL

`lot2-help-state.proposed.sql` décrit trois relations privées : état/version d'une tentative, compteurs par ressource et reçus d'idempotence. Les indices sont propres à l'item ; les écoutes sont communes à l'audio dans la tentative. Le hash est une valeur scellée, pas un composant de clé permettant de réinitialiser le budget. Aucun texte de conversation, indice, réponse, correction ou URL signée stocké. Aucun accès applicatif accordé.

Il s'agit du DDL de stockage proposé, PAS d'une migration complète prête à déployer. Absents volontairement tant que le cycle reste indécis : création/reprise autoritative de tentative, RPC de consommation, transition de remise, purge et accès audio. Aucun appelant ne peut utiliser ce schéma tel quel.

Contrat requis pour la future transaction, à écrire et tester après décision :

1. Authentifier, résoudre l'identité côté serveur, revalider appartenance/contexte, mode et source scellée. Ne jamais accepter mode, quota, compteurs, correction ou preuve de remise du client.
2. Verrouiller la tentative et son état dans un ordre commun avec la remise ; vérifier fermeture/version et droit actuel. Créer les lignes de ressource sous ce même verrou. Un manque de données refuse l'aide.
3. Pour un jeton déjà traité : comparer l'empreinte calculée côté serveur et retourner la même décision si les droits restent valides ; autre action sous le même jeton => conflit. Ne pas délivrer automatiquement un nouveau flux audio sur répétition d'un ancien reçu.
4. Indice : chercher strictement le prochain indice existant et validé, limiter à 1 en devoir/3 en entraînement/0 en évaluation, puis incrémenter et enregistrer le reçu dans la même transaction. Indice absent ou révélateur => refus sans consommation. Le SQL ne prétend pas déterminer la qualité pédagogique d'un texte.
5. Audio : première lecture comprise dans le quota ; replay interdit en évaluation, première lecture uniquement selon contrat prouvé. Segment et lecture entière utilisent le même budget ; hypothèse de coût d'une autorisation par démarrage à confirmer. Réserver atomiquement avant de livrer l'accès. Ne pas faire confiance à un événement onPlay du navigateur.
6. Remise : fermer cette tentative sous le même verrou ; correction disponible uniquement après remise et autorisation de libération, jamais en évaluation. Résultat/IPE inchangés.

Une RPC future à privilèges élevés exigera droits EXECUTE explicitement restreints, search_path fixe et noms qualifiés. Référence de revue : https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY. La consultation de l'index changelog Supabase via web a échoué (type text/markdown non pris en charge) ; la vérification des docs pertinentes reste à refaire avant implémentation.

## Audio, rétention et retour arrière

Une URL signée réutilisable/cachée ne suffit pas à imposer le quota : prévoir un accès serveur lié à l'autorisation avec durée et reprise réseau bornées, couvrant tous les lecteurs et le résolveur. Une répétition HTTP n'est pas une nouvelle écoute ; les requêtes Range d'une même lecture ne doivent pas consommer plusieurs fois. Après livraison des octets au navigateur, aucune garantie DRM ou anti-copie absolue. Le transport précis et sa gestion des pannes restent à concevoir. Pas de remboursement décidé par le client.

Rétention non arrêtée : conserver reçus et compteurs tant que la tentative peut être reprise ; ne pas purger un état puis le recréer avec budget neuf. Après clôture, purge coordonnée selon durée à valider, dans l'ordre reçus/ressources/état. La tentative fermée doit rester non réouvrable par défaut.

`lot2-help-state.rollback.sql` retire uniquement ces objets si vides et sans dépendance. Il refuse de détruire un état utilisé. Après usage : éteindre les appelants et faire autoriser conservation/purge séparément ; aucun CASCADE ni suppression de tentative. Feature Lot 2 OFF jusqu'à validation complète.

## Reprise

Avant autorisation de migration : confirmer le cycle de reprise/renouvellement, le coût des segments et la rétention ; compléter les transitions serveur et le transport audio dans la proposition. Ensuite seulement demander une autorisation précise. Les 14 tests rouges, les tests panneau, les scénarios concurrents/idempotents, les 26 tests accueil et le build restent à exécuter au stade d'implémentation. Aucun résultat PASS Lot 2 annoncé, aucun SHA code créé.

Conserver exactement les cinq outils du contrat ; banque-first ; aucun indice Louise inventé ou publié ; source scellée ; cinq outils seulement ; Atelier/readiness/routing existants. Préserver `D:\sites\tcf pro` et ses 124 fichiers non suivis ainsi que `supabase/.temp/linked-project.json`. Gemini OFF ; aucune migration appliquée, mutation Supabase, publication, PR, push ou déploiement. Aucun secret modifié.
