# CAPTCF — P0.5 Phase B — arrêt avant fusion

Date : 2026-10-01 (contrôles terminés vers 21:55 UTC).
Dépôt : D:\SITES\CAPTCF.
PR : https://github.com/chrisngassa-max/primo-fluency-hub/pull/49.
HEAD contrôlé : `6a8444d23618cbf03933673a331a0d6879bc9985`.
Main observé : `67c48e3e70872f895b926048067832bd767ce273`.
Projet unique : `gudcenhmzlcvhgbgklzw`.

## Décision et état laissé

Préflight GO, migration appliquée avec succès ; STOP avant fusion car la recette navigateur complète n'est pas validée. PR toujours ouverte, non fusionnée, fusionnable, HEAD inchangé. Aucun déploiement de production déclenché. Le SHA réellement servi par captcf.fr n'a pas été vérifié à ce stade et ne doit pas être déduit du SHA Git main.

La migration reste installée. Aucun défaut serveur rencontré dans le banc final ne nécessite son rollback ; aucun rollback exécuté. Toutes les données synthétiques ont été supprimées, y compris comptes, sessions et refresh tokens. Ne pas réappliquer la migration lors d'une reprise.

Aucun changement de code produit, de SQL, de RLS, de secret ou de configuration Edge. Ce rapport est un commit documentaire local séparé, sans amend ni push.

## Préflight et application

- PR ouverte et fusionnable au HEAD imposé.
- CI https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36922925496 réussie (tests, build, lint).
- Preview READY : https://vercel.com/meme3/primo-fluency-hub/438C32rw6DJkCFriA5jZvr4SSauQ.
- Preview testée : https://primo-fluency-hub-git-captcf-p0-safe-automatic-homework-meme3.vercel.app.
- Migration, schéma privé et RPC absents avant application ; pas d'installation P0 partielle.
- Sauvegarde hors Git des catalogues, migrations, compteurs et empreintes.
- Dry-run dans un répertoire isolé : seule migration prévue `20261001074826_safe_automatic_homework.sql`. Les versions déjà distantes étaient représentées sans SQL additionnel.
- Application de cette seule migration, puis confirmation d'une seule entrée dans l'historique.
- SHA-256 migration : `bac2e727568553460431d46fa19b57eab1ca6f973e191fd0f6da69ac85f736d0`.
- SHA-256 rollback : `a05104866331560b60b8c2c65ea35811e023505f058910790e859103531c4801`.

RPC installée : `public.send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb)`.
Huit fonctions nouvelles SECURITY INVOKER, search_path fixé à pg_catalog. EXECUTE PUBLIC/anon absent ; authenticated limité à la RPC et aux helpers nécessaires, sans accès direct aux fonctions de trigger.
Aucun nouveau SECURITY DEFINER, aucun source_devoir_id, aucun miroir activé.
Comparaison des objets historiques : colonnes, contraintes, policies, grants, fonctions et triggers inchangés, hors objets P0 attendus.

Advisors : aucune alerte sécurité P0. Deux observations de performance sans correction dans ce lot : index couvrant la FK composite de devoirs et évaluation auth.uid() par ligne dans la policy receipts. Références : https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys et https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan.

## Contrôles serveur

41 cas regroupés exécutés avec succès dans le banc final (ce total ne signifie pas que toute la recette UI est validée) :

| Groupe | Nombre | Résultat |
|---|---:|---|
| Contenu et identité | 11 | Vide, QCM incomplet, CE image seule/courte, CO sans script, overflow int4, identité falsifiée refusés ; CE, CO structurée, EE, EO valides acceptés |
| Autorisation | 6 | Anonyme, élève, professeur tiers, groupe étranger, séance étrangère, élève hors groupe refusés |
| Atomicité | 4 | Idempotence, conflit de payload, rollback du second exercice invalide, zéro assignment produit par RPC |
| Exercice partagé | 7 | Lecture et attribution published ; UPDATE par autrui affecte zéro ligne ; devoir et assignments individuel/groupe acceptés ; groupe étranger et invalidation propriétaire protégés |
| Partagé non exécutable | 3 | Draft, validated et incomplet refusés |
| Invisible | 1 | Lecture zéro ligne et attribution refusée |
| Concurrence P0.4 | 7 | Attribution/édition dans les deux sens, assignment/édition, dépublication, suppression, exercices distincts, second item occupé |
| RPC concurrente | 1 | Deux appels au même request_id : un seul lot et un seul reçu |
| Remise autorisée | 1 | HTTP 200, score 100, devoir fait et resultats.devoir_id correct |

Les assertions de rôle utilisent authenticated et l'identité synthétique, sans bypass pour simuler les droits du professeur/élève. Les tests transactionnels sont annulés ; seuls les lots synthétiques nécessaires à la recette ont été conservés jusqu'au nettoyage.

Incident de méthode : le premier banc de concurrence passant par le connecteur sérialisait les requêtes ; cinq attentes de conflit ont donc échoué. Ces résultats sont invalides comme preuve de concurrence et ne sont pas comptés comme réussites. Le diagnostic a confirmé deux connexions simultanées par processus CLI indépendants, puis les sept scénarios ont réussi. La consigne d'arrêt après deux échecs identiques n'a pas été respectée dans cette première boucle ; aucun effet métier persistant n'en est issu.

Aucun SQLSTATE 40P01 dans le banc final. Le compteur global pg_stat_database.deadlocks valait 2, sans baseline exploitable ; il ne permet donc pas d'affirmer un compteur historique nul. La recherche de logs sur la fenêtre de recette n'a trouvé aucun 40P01.

## Recette navigateur et limites

Sur la preview réelle, avec professeur synthétique :
- ouverture de la préparation : aucun devoir ni reçu créé ;
- contenu CE préparé affiché ; volume ramené à un exercice ;
- destinataire devenu interdit : message français attendu, dialogue maintenu ouvert, aucune écriture ;
- rechargement, nouvelle préparation, confirmation explicite puis succès ;
- exactement un exercice, un devoir et un reçu supplémentaires, zéro exercise_assignment ;
- logs HTTP : un appel refusé puis un appel réussi, correspondant aux deux confirmations explicites, sans retry automatique observé.

Les huit messages français (conflit, destinataire, contenu, occupation/55P03, échéance, session, droits, inconnu SQL/stack) ont aussi été vérifiés dans le navigateur avec le composant réel et un client Supabase simulé localement. Chaque cas conserve le dialogue ouvert et compte un seul appel. Aucun code technique ni SQL/stack brut dans les messages affichés. Ce banc local ne constitue pas huit injections d'erreurs sur la preview distante.

Limites non validées de bout en bout :
- reprise exacte de request_id/sessionStorage après rechargement et rejeu via UI ; la tentative de lecture du stockage par l'API navigateur n'était pas supportée. L'idempotence serveur est validée mais ne remplace pas cette preuve UI ;
- attribution manuelle partagée et non-modification prouvées sous RLS côté serveur, pas par le parcours UI complet ;
- ouverture du devoir élève bloquée par « Consentement IA et voix obligatoire ». Une autorisation explicite a été demandée ; aucune acceptation n'a été effectuée avant le nettoyage ;
- suivi professeur du résultat vérifié en lecture SQL sous ses droits (une ligne liée correcte), pas dans l'écran de suivi.

Le bouton de remise de DevoirPassation appelle ensuite automatiquement `generate-post-devoir-bilan` via triggerBilanGeneration (src/pages/eleve/DevoirPassation.tsx). Cette autre Edge n'est pas autorisée. Il n'a donc pas été actionné. Aucun correctif annexe réalisé.

## Exception Edge autorisée et logs

Le propriétaire a explicitement autorisé un unique appel synthétique à l'Edge existante `submit-devoir-result`, sans modification, déploiement, secret, configuration ou Gemini.

Avant l'appel : version 19, ACTIVE, verify_jwt=true.
Un seul appel HTTP avec le JWT du compte élève temporaire : HTTP 200, score 100, ai_failed=false, devoir fait. Résultat rattaché au devoir par resultats.devoir_id ; visibilité sous les droits du professeur confirmée. Déconnexion globale après l'appel, puis suppression des sessions/comptes au nettoyage.

Aucun autre appel Edge de recette, aucun déploiement Edge. L'authentification utilise Auth.
Un journal applicatif synthétique classifyAndEmitErrors portait blocked_no_consent, sans provider/model : aucun traitement IA exécuté. Aucun appel Gemini effectué par l'agent.
Les recherches de logs n'ont trouvé aucun WORKER_ERROR ni Gemini sur la fenêtre 21:00–21:55 UTC. Cependant, la recherche ciblée des logs de submit-devoir-result n'a pas retrouvé l'invocation HTTP pourtant réussie ; la corrélation complète de cette invocation aux logs Edge reste non établie. Ne pas présenter l'absence de correspondance comme une preuve exhaustive d'absence.

## Nettoyage et invariance

Nettoyage transactionnel ciblé sur les UUID synthétiques, après vérification des quatre comptes p05-…@example.invalid :
- résultat, deux devoirs, quatre exercices, deux reçus ;
- événement live et journal IA bloqué ;
- lien séance/exercice, deux séances, memberships et deux groupes ;
- profils, rôles, sessions, refresh tokens et comptes Auth ;
- aucun consentement synthétique à conserver.

Vérification après commit : zéro reliquat sur 63 tables publiques contrôlées ; zéro compte, identité Auth, session, refresh token et reçu synthétique. Les deux serveurs locaux ont été arrêtés, les onglets de recette fermés et les credentials éphémères en mémoire abandonnés.

| Table réelle | Avant = après | Empreinte avant = après |
|---|---:|---|
| exercices | 815 | 46ede716a95c3865a55c8c7886cf447e |
| devoirs | 1856 | 1c4b1740ccf6ae3251d4c2be5cce7cfe |
| exercise_assignments | 1799 | 77840e66744280bad7027316ef7f503c |
| resultats | 1117 | ccba160478930b8fbc357daa0127aa6c |

Empreintes calculées sur les colonnes historiques, en excluant les nouvelles colonnes P0. Aucun contenu réel exporté.
Preuves locales ignorées par Git : `.local-security-evidence/p0-5-phase-b-6a8444d2/`.
Les fichiers non suivis préexistants ont été préservés. Le seul fichier temporaire suivi modifié par la CLI a été restauré.

## Reprise

Reprendre dans D:\SITES\CAPTCF avec ce rapport. Migration déjà appliquée, données temporaires déjà nettoyées, PR49 toujours au HEAD autorisé. Ne pas refaire l'implémentation ni appliquer à nouveau la migration.
Résoudre le périmètre de la recette élève et compléter les preuves UI manquantes avant toute décision de fusion ; ne pas autoriser implicitement generate-post-devoir-bilan ou Gemini.

## Clôture UI2 — 4 octobre 2026

Cette section actualise les limites de la recette élève décrites plus haut ; elle ne rejoue pas les contrôles serveur acquis. Build local a0b5ad5790437692956fd799c76de2ae2e27314e, incluant 5799cf02 (consentements) et a0b5ad57 (jointures qualifiées).

- Brouillon conservé après un vrai rechargement navigateur : PASS. Mardi coché avant/après ; deuxième question vide, poursuite normale possible ; même devoir, même tentative.
- Remise déterministe depuis le bouton normal : PASS. Résultat métier unique, score 100 %, rattaché au bon élève et à resultats.devoir_id ; devoir passé à fait.
- Une seule action UI de remise ; le nombre exact de POST et son statut HTTP ne sont pas certifiables par les logs disponibles. Ne pas confondre événements Boot/Shutdown et invocations métier.
- Suivi incomplet : exercise_attempts.answers={} et item_results.answered=0 pendant la saisie ; après remise, tentative encore in_progress, score_normalized et completed_at nuls.
- Une ligne homework_generation_queue pending liée à la recette a été identifiée et supprimée avant exécution.
- Aucun consentement enregistré pour le compte, aucun accord IA/voix créé par l’agent, aucun microphone/STT/TTS. Aucun appel Gemini effectué ou observé ; journal IA annexe classifyAndEmitErrors=blocked_no_consent, provider/model nuls ; aucun bilan ni notification. L’absence de logs exhaustifs ne certifie pas une absence globale sur tout le projet.
- Nettoyage complet : trois comptes synthétiques (les deux essais ff dd supprimés sur autorisation explicite), sessions/refresh_tokens, groupe, séance, exercice, devoir, résultat, tentative, événements, logs et file pending. Contrôle global des références UUID public vide ; Auth vide pour les comptes de test.
- Empreintes métier revenues exactement au baseline : exercices 815 / 46ede716a95c3865a55c8c7886cf447e ; devoirs 1856 / 1c4b1740ccf6ae3251d4c2be5cce7cfe ; exercise_assignments 1799 / 77840e66744280bad7027316ef7f503c ; resultats 1117 / ccba160478930b8fbc357daa0127aa6c.

Les contrôles UI principaux réussissent, mais le suivi et la file automatique nécessitent le diagnostic P0.6. Aucune fusion, nouvelle migration, modification Edge, publication ni déploiement. Preuves privées conservées hors Git dans .local-security-evidence/pr49-consent-ui-20261002/.
Préflight P0.6 : PR49 revérifiée ouverte/non fusionnée, migration 20261001074826 présente exactement une fois, fixtures ciblées absentes. Les rapports locaux non suivis préexistants restent préservés.
