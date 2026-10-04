# P0.6 — suivi des tentatives et file automatique

Diagnostic du 4 octobre 2026. **Arrêt avant correction serveur**, conformément à l'autorisation propriétaire. Aucun correctif produit appliqué. Aucun push, aucune modification de PR, migration, RLS, RPC, Edge, secret, donnée distante ou appel IA.

## Reprise et périmètre

- Racine : `D:\SITES\CAPTCF`.
- Départ vérifié : `codex/p0-5-pr49-publication`, `a0b5ad5790437692956fd799c76de2ae2e27314e`, fichiers suivis propres.
- Clôture UI2 documentée séparément : `a98cf153`, dans `CAPTCF_P0_5_PHASE_B.md`.
- Branche de diagnostic : `captcf-p0-6-attempt-sync-queue-diagnostic`.
- PR49 vérifiée ouverte/non fusionnée/fusionnable au préflight, HEAD distant `6a8444d23618cbf03933673a331a0d6879bc9985`. Branche distante non modifiée.
- Migration `20261001074826` présente une fois ; fixtures UI2 ciblées absentes. Pas de nouvelle recette ni fixture distante.
- MP3, ZIP, rapports non suivis préexistants, `.env`, `supabase/.temp` et preuves privées préservés.

## A — cause établie de la synchronisation vide

### Parcours

`DevoirPassation.tsx` conserve les réponses dans un état React, charge le brouillon au montage et sauvegarde le brouillon local. Le hook réel reçoit `exerciseId`, `learnerId`, `answers`, `items`, et `disabled = result || isDone`.

`useLiveAttemptSync.ts` programme un debounce de 800 ms et un heartbeat de 10 s. Il envoie :

- `answers`, objet à clés d'index ; `0` et `"0"` désignent la même propriété JavaScript ;
- `item_results = { items: [{ idx, answered, reponse? }], answered, total, provisional: true }` ;
- `source_app`, sans score ni transition de finalisation.

L'UPDATE cible la paire exercice/élève avec `status = in_progress`. S'il ne reçoit pas d'id, le hook tente un INSERT, **même si l'UPDATE a retourné une erreur**. Les erreurs sont seulement envoyées à `console.warn`. Le snapshot est marqué comme envoyé avant la réussite réseau. Après rechargement, le même UPDATE est tenté avec le brouillon restauré.

### Schéma et logs réellement actifs

Le trigger `guard_exercise_attempts_update` est actif BEFORE UPDATE. Sa fonction `guard_exercise_attempts_eleve_update()` contient :

```sql
NEW.source_resultat_id := OLD.source_resultat_id;
```

La colonne `exercise_attempts.source_resultat_id` **n'existe pas** dans `information_schema.columns`. La fonction peut exister malgré cette référence invalide ; le chemin exécuté lors d'un UPDATE élève échoue.

Les logs PostgreSQL UI2, fenêtre **2026-10-04 05:38–05:46 UTC**, confirment :

| SQLSTATE | Nombre | Constat |
|---|---:|---|
| 42703 | 12 | Contexte exact : affectation `NEW.source_resultat_id := OLD.source_resultat_id`, fonction `guard_exercise_attempts_eleve_update`, ligne 18 |
| 23505 | 12 | Conflits uniques dans la même fenêtre, cohérents avec le fallback INSERT |
| 42501 | 1 | Autre erreur de droits ; non attribuée à cette chaîne sans preuve supplémentaire |

Il existe un index unique partiel `(exercise_id, learner_id) WHERE status = 'in_progress'`. L'INSERT initial vide peut réussir ; les UPDATE suivants échouent, puis les INSERT de secours se heurtent à la tentative déjà présente. La chaîne exacte des deux appels est reproduite par le test du hook. Les logs agrégés seuls ne prouvent pas une correspondance un-à-un entre chaque paire d'erreurs.

Les droits `SELECT`, `INSERT`, `UPDATE` sont accordés à authenticated. Les politiques élève permettent lecture propre, insertion propre in_progress et UPDATE de sa tentative in_progress. Les deux gardes actives protègent les champs de score/finalisation ; la seconde ne bloque pas normalement `answers` en cours. Ce n'est donc pas une absence générale du droit UPDATE.

### Hypothèses examinées

Le test du hook réel confirme payload actuel, paire correcte et `answered = 1` : pas de fermeture obsolète ou confusion d'index dans ce scénario. Un témoin serveur sans erreur synchronise correctement. `disabled` intervient après le résultat ; il n'explique pas les UPDATE refusés avant remise. Un UPDATE sans ligne déclenche légitimement une création, mais l'erreur explicite observée n'est pas ce cas.

Fragilités frontend secondaires, non corrigées à ce stade : snapshot validé trop tôt, INSERT après erreur, erreurs brutes en console, timers réinitialisés lorsque `items` est recréé. La paire exercice/élève n'identifie pas un devoir particulier en cas de réattribution. Elles ne remplacent pas la cause serveur démontrée.

## B — finalisation autoritative absente

### Constats distants

- `mirror_resultat_to_attempt()` existe, mais **aucun trigger de resultats ne l'appelle**. Les triggers actifs de resultats sont la propagation sandbox et le recalcul du score de risque.
- Le miroir lit `exercise_assignments.source_devoir_id`, colonne absente, puis utilise `exercise_attempts.source_resultat_id`, également absente. Aucun index unique correspondant n'existe.
- Le miroir choisit la dernière tentative in_progress de la paire ; cela ne constitue pas un rattachement déterministe au devoir.
- Sa normalisation historique conditionnelle `score > 1 ? score / 100 : score` traite ambiguëment une note de 1 sur 100.
- Le navigateur n'a pas autorité pour finaliser : les gardes rétablissent notamment statut, scores et date de fin. Elles doivent rester protectrices.

**Ne pas réactiver ce miroir. Ne pas ajouter artificiellement les colonnes historiques pour le faire fonctionner.**

### Lecture de l'Edge : limite explicite

La liste distante confirme `submit-devoir-result` ACTIVE, version 19, `verify_jwt=true`, empreinte bundle `330bdd9133085d38cb6fc8ef56bad7e477c1ec4d0682b3d886dcce09521aaa89`.

Deux lectures du bundle via l'outil Supabase ont retourné UNAVAILABLE/ProtocolError. Son contenu actif n'est donc pas certifié. Aucun appel fonctionnel de l'Edge n'a été fait pour contourner cette limite.

Dans **le code local seulement**, `DevoirPassation` invoque `submit-devoir-result` ; l'Edge authentifie, vérifie le devoir, corrige, insère `resultats` avec `devoir_id`, puis met à jour `devoirs` par un autre appel PostgREST. Elle ne finalise pas explicitement `exercise_attempts`. Une erreur de mise à jour du devoir après insertion est journalisée sans annuler le résultat. Deux requêtes REST successives ne forment pas une transaction. UI2 a bien établi résultat unique lié et devoir fait, sans tentative finalisée.

La cause « miroir absent/incompatible » est établie. Le choix définitif d'architecture serveur reste conditionné à la récupération du bundle actif et à la validation du rattachement métier.

## C — producteurs et consommateurs de la file

Recherche locale dans frontend, hooks, fonctions, migrations, `.github` et configuration Vercel ; recherche distante des corps de fonctions référençant la table. Seule `enqueue_next_homework_series` référence directement la file dans le catalogue des fonctions SQL inspecté. Cela n'exclut pas un client externe/service_role hors dépôt ou du SQL dynamique construit sans le nom littéral.

| Élément | Déclencheur / autorité | Consentement | Données / consommateur / appel externe |
|---|---|---|---|
| `trg_enqueue_next_homework_series` → `enqueue_next_homework_series()` | AFTER UPDATE devoirs, transition vers fait, plus aucun en_attente pour élève+série ; SQL SECURITY DEFINER | Aucun contrôle à la création, aucune confirmation professeur, aucun contrôle du réglage de génération de séance | Crée pending : références élève/formateur/séance, numéro de série, raison ; consommé par worker ; aucun appel externe dans le trigger |
| Frontend / hooks | Aucun INSERT direct de file trouvé ; la remise provoque indirectement la transition du devoir | Pas de contrôle de consentement dans le déclencheur SQL | L'ouverture et la saisie ne déclenchent pas ce trigger ; la remise réussie explique la ligne UI2 |
| RPC SQL | Aucun autre producteur direct trouvé dans les corps actifs | Sans objet pour les producteurs absents | Recherche limitée aux définitions accessibles, sans appel RPC |
| `process-homework-generation-queue` déployée v13 | Consomme pending/failed éligibles, passage conditionnel processing, puis retries avec backoff | Aucun contrôle propre avant consommation ; aucune vérification d'identité dans le handler lu ; `verify_jwt=false` | Envoie références et paramètres de génération à `generate-next-homework-series` avec autorité service ; écrit done/pending/failed et alertes |
| `generate-next-homework-series` déployée v21 | Requête du worker ou autres appelants ; `verify_jwt=true` | `checkConsentBatch` avant génération : IA accordée, non révoquée ; secret de pseudonymisation requis. Ce contrôle n'est pas une confirmation d'attribution | Consulte résultats/profils/contexte, peut appeler modèle `google/gemini-2.5-flash` via client IA ; crée exercices puis devoirs. N'insère pas directement la file |
| Cron PostgreSQL | `cron.job` : **0 job**, donc 0 actif à l'inspection | Sans objet | Le commentaire « toutes les 5 minutes » ne prouve pas une planification active. Un ordonnanceur externe n'est pas exclu |
| `classifyAndEmitErrors` local | Appelé après remise, émet des événements pédagogiques ; vérifie consentement avant classification IA | Contrôle IA ; journalise blocked_no_consent | Peut appeler Claude et écrire session_live_events ; aucun INSERT de file trouvé. Ne pas attribuer la ligne UI2 à ce helper |
| Triggers distants de session_live_events | Détection d'erreurs répétées, interventions, recalibrage de niveau | Hors contrôle d'attribution de la file | Définitions inspectées : événements/profil/recalibrage, sans insertion de devoir ou de file |
| Remédiation locale dans submit-devoir-result | Score bas en bilan sans devoir, ou parcours adaptatif | À distinguer de la confirmation professeur | Peut créer directement un devoir ; n'est pas un producteur direct de la file. Son futur passage à fait pourrait déclencher le trigger. Bundle actif non certifié |
| Appels directs du générateur | `SessionPilot.tsx`, `prepareSessionKit.ts` | Contrôles propres à ces parcours non audités complètement dans ce lot | Contournent la file ; aucune exécution effectuée |

Le trigger convertit `serie NULL` en 0 et compte les devoirs par élève+série sans limiter à la séance. Un devoir écrit ordinaire peut donc amorcer la file. L'unicité partielle empêche certains doublons actifs, elle ne constitue pas une autorisation.

La file stocke des identifiants pseudonymes, états, compteurs, timestamps et un texte d'erreur libre, pas un payload de réponses. Les identifiants restent des données personnelles ; aucun export de lignes réelles dans ce rapport. Le worker peut recopier un texte d'erreur aval dans une alerte : à remplacer dans une éventuelle correction par une catégorie sûre.

## Propositions à valider — aucune implémentation serveur

### A. Corriger la garde sans élargir les droits

Proposition minimale : nouvelle migration future remplaçant uniquement le corps de `guard_exercise_attempts_eleve_update`, en retirant l'affectation de la colonne absente. Conserver le trigger, les protections existantes, propriétaire, droits et configuration. Ne pas réécrire l'ancienne migration, ne pas ajouter `source_resultat_id` pour ce correctif.

Avant application future : sauvegarder définition, propriétaire, ACL, search_path, attachement du trigger et empreinte ; refuser tout écart depuis le diagnostic. Vérifier séparément que les deux gardes restent cohérentes.

Tests SQL attendus, base locale jetable : rôle élève réel, UPDATE answers/item_results réussi ; tentative étrangère refusée ; score/statut/date/identité inchangés malgré payload malveillant ; tentative completed non modifiable ; INSERT concurrent limité à une tentative active ; schéma sans colonne historique. Test rouge préalable sur garde actuelle, vert seulement après autorisation du correctif.

Retour arrière : restaurer exactement la définition et les propriétés sauvegardées dans une transaction, sans toucher aux données ni aux politiques. Ce retour réintroduirait l'erreur connue : le signaler, ne pas le déclencher automatiquement.

Amélioration frontend ultérieure possible : arrêter sur erreur UPDATE, ne créer que sur succès sans ligne, acquitter le snapshot après réussite, journaliser uniquement opération/catégorie, garder le brouillon et permettre une reprise. Cela ne répare pas à lui seul le trigger.

### B. Finalisation transactionnelle — conception candidate, décision différée

Prérequis bloquants : récupérer le bundle actif ; définir l'identité d'une tentative lors de deux devoirs portant le même exercice ; convenir du comportement pour bilan sans devoir et anciennes tentatives orphelines. Aucun backfill automatique des tentatives existantes.

Candidat à étudier ensuite : une opération SQL privée appelée par l'Edge après correction serveur, réunissant insertion du résultat, transition du devoir et finalisation de la tentative dans **une seule transaction**. Pas de finalisation frontend, pas de simple troisième UPDATE REST après la remise, pas de réactivation du miroir historique.

Contrat proposé :

1. Edge authentifiée, identité issue du JWT vérifié, pas d'acceptation de learner_id ou score autoritatif fourni par navigateur. Calcul de correction hors transaction/verrou.
2. Rattachement explicite validé côté serveur entre devoir, élève, exercice et tentative. Une proposition de schéma possible est une liaison de tentative au devoir et de résultat à la tentative, avec contraintes et unicité adaptées ; ce choix exige une nouvelle validation. La paire globale actuelle ne suffit pas pour l'historique des réattributions.
3. Fonction privée inaccessible à PUBLIC/anon/authenticated ; seule l'Edge autorisée reçoit EXECUTE. Objets qualifiés et search_path fixe, pas d'élargissement des RLS. Revalidation de propriété et de statut dans la transaction.
4. Ordre de verrous stable devoir puis tentative, durée courte. Clé d'idempotence persistée : même remise retourne le résultat existant, contenu différent sous même clé refusé. Index unique soutenant cette règle et tests de concurrence.
5. Contrat de score corrigé le 4 octobre 2026 : aucune normalisation déduite de la valeur ou du nom `score_normalized`. La proposition initiale de convertir systématiquement 1 en 0,01 est retirée. L'unité de chaque producteur doit être attestée avant tout adaptateur ; une valeur historique sans unité reste indéterminée. Voir le contrat P0.7 ci-dessous. Poser les réponses et la correction serveur, completed_at et statut seulement à la réussite atomique. Échec de l'une des trois écritures : aucune écriture partielle.
6. Événements secondaires seulement après succès ; aucune génération ni file implicite requise pour finaliser.

Tests attendus : identité étrangère, mauvais devoir/exercice, résultat répété, concurrence de deux remises, retry après perte de réponse, échec forcé à chaque écriture, score aux bornes, remise sans tentative préalable, réattribution du même exercice, bilan sans devoir, compatibilité des gardes et de la lecture professeur. Toutes les IA mockées ; aucune recette distante sans nouvelle autorisation.

Retour arrière proposé : changement additif et compatible avec l'ancienne Edge ; conserver le bundle v19 sauvegardé avant tout futur déploiement et verify_jwt=true. En cas d'échec, rétablir le bundle approuvé puis révoquer l'accès à la nouvelle fonction. Conserver les liens/résultats déjà enregistrés ; aucune suppression de données. Retrait ultérieur des objets ajoutés uniquement après audit d'usage et validation distincte. Impossible de fournir un rollback DDL final tant que le schéma de corrélation n'est pas validé.

### C. Supprimer le déclenchement involontaire, sans casser la remise

Proposition conservatrice à approuver : suspendre l'enqueue automatique à la fin d'un devoir et empêcher la consommation des anciennes lignes sans autorisation explicite vérifiable. Ne pas effacer les lignes existantes. Réparer uniquement le producteur laisserait les anciennes lignes consommables.

Un futur parcours de génération doit séparer consentement IA, demande de préparation, prévisualisation et confirmation d'attribution. Le consentement ne vaut pas confirmation d'envoi. Vérifier l'autorité de l'appelant du worker, le lien professeur/destinataire et le consentement avant traitement et à nouveau avant tout appel IA. Consigner une autorisation/idempotence persistée, pas un booléen client. Les décisions de schéma/statuts de refus exigent une proposition complémentaire validée.

Tests attendus : ouverture/saisie/remise écrite sans consentement → aucune nouvelle ligne/aucun appel externe ; fin de série NULL ou explicite sans demande → aucune ligne ; consentement seul sans confirmation → aucune attribution ; révocation entre enqueue et consommation → aucun appel IA ; appel worker non autorisé → refus ; doublon/concurrence → aucun double traitement ; ancienne ligne pending non autorisée → pas de consommation ni retry automatique ; remise et résultat restent réussis.

Retour arrière : sauvegarder définition/attachement du trigger et bundle/configuration du worker ; restaurer seulement les objets approuvés. Ne pas réactiver en masse la consommation : inventorier les pending/failed et obtenir validation avant reprise, car restaurer l'ancien trigger rétablit le comportement involontaire.

## Vérifications locales et état d'arrêt

Test permanent : `src/test/live-attempt-p06-diagnostic.test.tsx`, hook réel avec réponses Supabase simulées d'après le catalogue et les logs. **1 test réellement rouge, 3 témoins verts**. Le rouge est volontairement conservé : aucune correction serveur autorisée n'a été implémentée. Ce n'est pas une exécution PostgreSQL ni une nouvelle preuve UI.

Commande : `node node_modules/vitest/vitest.mjs run src/test/live-attempt-p06-diagnostic.test.tsx`. Échec attendu : `{}` au lieu de `{ "0": "Mardi" }`. Payload correct et séquence UPDATE/INSERT vérifiés avant l'assertion.

Non-régression ciblée : **128/128 verts** dans `homework-consent`, `auto-homework-p0-contract`, `automatic-homework-error-message`, `homework-executable`.

Docker local ne répond pas (pipe desktop-linux absent) : aucune reproduction PostgreSQL exécutée, aucune installation/démarrage de service improvisé. Aucun test distant à sa place. Build non relancé : code produit inchangé, arrêt de diagnostic et non livraison d'un correctif vert. Les tests SQL et de concurrence du futur correctif restent à exécuter après validation.

La suite utilisateur reçue s'arrête après « Appel externe ». Le présent dossier couvre les diagnostics A/B/C connus ; il n'invente pas d'autorisation de publication ou de Phase B.

**Prochaine étape propriétaire : valider le périmètre de conception/implémentation serveur après lecture de ce dossier. Aucune migration créée, aucun trigger modifié, aucune mutation distante pendant P0.6.**

## Cadrage P0.7 — décision propriétaire du 4 octobre 2026

Ce complément remplace le périmètre d'arrêt ci-dessus pour la suite locale uniquement. Il ne constate pas une implémentation et n'autorise aucune Phase B distante. Les constats historiques P0.6 restent inchangés.

| Lot | Périmètre local retenu | Critère de sortie |
|---|---|---|
| P0.7-A | Corriger la garde exercise_attempts incompatible avec le schéma réel, sans nouvelle colonne historique, sans élargissement RLS ni finalisation navigateur | Reproduction SQL rouge puis verte avec vraie garde et rôles ; synchronisation answers/item_results, reprise, protection des scores et identité, concurrence ; rollback local vérifié |
| P0.7-C | Neutraliser l'enqueue automatique non consenti et bloquer la consommation des anciennes lignes sans autorisation vérifiable | Aucun INSERT implicite ; aucune prise en charge, attribution, retry ou requête externe pour une ancienne ligne non autorisée ; remise écrite conservée ; aucune suppression des lignes |
| P0.7-B | Conception uniquement | Bundle actif récupéré et vérifié, identité métier d'une tentative validée, unités producteurs/consommateurs établies avant décision d'implémentation |

A et C ne dépendent pas de la normalisation des scores : ils ne doivent ni recalculer ni convertir les notes. La file ne dispose pas aujourd'hui d'une preuve suffisante de confirmation : ni consentement IA seul, ni statut pending, ni ancienneté, ni raison serie_completed ne valent autorisation. En l'absence de preuve, le consommateur doit refuser sans appeler le générateur. Toute évolution de schéma ou d'Edge reste exclusivement locale ; aucun déploiement, push, fusion ou mutation distante n'est couvert par ce cadrage.

### Contrat cible de score, préalable à B

L'unité canonique choisie pour le **futur contrat de finalisation** est un pourcentage numérique dans [0,100], désigné explicitement `score_percent`. Ce nom est une notation de conception, pas une colonne ajoutée ni une modification d'API existante. Le choix n'attribue rétroactivement aucune unité aux données existantes.

- Un producteur doit déclarer une unité vérifiée et versionnée : pourcentage, ratio [0,1] ou points avec dénominateur connu. Un simple nombre sans provenance/unité est refusé par le futur contrat, sans annuler ou modifier aujourd'hui le parcours de remise existant.
- Aucune heuristique `score > 1`, `score <= 1`, aucun raisonnement à partir du seul nom `score_normalized`.
- Les adaptateurs ne pourront être implémentés qu'après preuve sur le code effectivement actif et tests du producteur. Pas de conversion de la valeur historique 1, pas de backfill automatique, pas d'écrasement d'un score ambigu.
- Conserver le caractère provisoire/définitif séparément de l'unité. Une note provisoire n'autorise pas une finalisation définitive.
- Inventorier aussi les consommateurs : affichage, seuils, risques, statistiques et synchronisation. Ils doivent interpréter la même unité déclarée. La compatibilité des colonnes historiques sera une décision explicite de B, pas un changement transversal inclus dans A/C.
- Tests futurs : valeurs 0, 1, 100 avec unité explicite ; ratio 1 explicitement identifié ; points 1 sur un maximum connu ; unité absente/inconnue, NaN, infini et hors bornes refusés ; tests des consommateurs. Les mêmes valeurs numériques de producteurs différents ne doivent jamais être assimilées sans unité.

### Premiers indices locaux d'unités incompatibles

Lecture seule du code local, sans certification des bundles distants :

- `correction-server.ts` calcule `Math.round(correctCount / countedItems * 100)` ; `submit-devoir-result` transmet ce score à resultats.
- `submit-seance-answer` affecte directement `result.score` à `score_normalized` et `result.correctCount` à `score_raw`.
- `LiveExercisesPanel` et `StudentAnswersDialog` multiplient `score_normalized` par 100 pour l'affichage, tandis que `PlayExercise` et `S01DemoPage` l'affichent directement avec un signe pourcentage.

Cette divergence suffit à bloquer une conversion générale. Ce relevé n'est pas un inventaire exhaustif, ne prouve pas l'unité de chaque ligne historique et ne justifie aucune correction automatique de données.
