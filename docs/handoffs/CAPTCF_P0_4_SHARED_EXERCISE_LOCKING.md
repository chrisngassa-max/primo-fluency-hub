# CapTCF P0.4 — attribution d’exercices partagés et verrouillage RLS

Date : 2026-10-01. Branche locale dédiée : `captcf-p0-4-shared-exercise-locking`, issue de l’historique P0.3 complet et du rapport d’arrêt `e501cf8a`. Aucun amend, push, changement de PR, migration distante ou déploiement.

## Cause et comportement attendu

Les gardes P0.3 lisaient exercices avec `FOR KEY SHARE`. Sous RLS, cette lecture verrouillée applique aussi les restrictions d’édition : un exercice publié par B est visible en SELECT à A mais absent du SELECT verrouillé. La conséquence était un faux `homework_inexecutable` sur les devoirs et attributions indépendantes partagés.

Le test rouge `d3c52759` démontre la lecture et l’absence de droit UPDATE pour A, puis les insertions réussies avant P0 et refusées avec P0.3. Le test final conserve explicitement SELECT simple = 1 et SELECT FOR KEY SHARE = 0 : la correction ne donne donc aucun droit supplémentaire d’édition. Le rapport d’arrêt reste dans l’historique.

Un professeur peut attribuer son exercice valide ou un exercice partagé **published**, à son élève ou son groupe. Il ne peut pas modifier l’exercice d’autrui. Un exercice partagé draft/validated, invisible ou incomplet est refusé. Les modifications d’échéance/statut historiques sans changement de cible conservent leur exemption de revalidation du contenu.

## Mécanisme retenu

Nouveau helper privé `homework_private.lock_exercises(uuid[])`, SECURITY INVOKER, search_path=pg_catalog :

- clé 64 bits déterministe `hashtextextended('captcf:p0:exercise:' || exercise_id, 0)` ;
- identifiants non NULL, distincts et triés ; ancien et nouvel identifiant pris ensemble lors d’un changement de référence ;
- acquisition par `pg_try_advisory_xact_lock`, conservée jusqu’au COMMIT/ROLLBACK ;
- aucun verrou de ligne explicite sur l’exercice dans les gardes d’attribution ; lecture ordinaire soumise à SELECT RLS après acquisition ;
- même verrou dans les gardes de devoirs et exercise_assignments, et dans le garde d’exercice pour INSERT, UPDATE **et DELETE**, y compris statut et changements de visibilité ;
- contrôle du contenu et des supports conservé, avec les contraintes FK composites P0 comme seconde protection contre l’invalidation d’un exercice déjà attribué.

L’acquisition est **non bloquante**. Un chevauchement sur le même exercice peut refuser une transaction entière : SQLSTATE `55P03`, détail stable `homework_exercise_busy`, message professeur « Cet exercice est en cours de modification ou d’attribution. Réessayez après la fin de cette opération. » Aucun retry automatique, boucle ou commande technique proposée. Une nouvelle action explicite après la fin du conflit est possible. Deux exercices différents ne partagent pas de verrou, sauf collision de hash conservatrice.

Ce choix ne promet pas que deux attributions strictement simultanées du même exercice réussiront toutes deux au premier essai. Une réussite et un refus temporaire sans effet partiel sont attendus. Le rejeu de la RPC automatique conserve séparément son verrou de request_id et son reçu : les deux appels identiques y produisent toujours un seul lot.

## Ordre des verrous et solutions écartées

Ordre applicatif : ancien/nouvel exercise_id triés → acquisition consultative sans attente → SELECT RLS → validation → écriture et vérifications FK. Les verrous consultatifs déjà acquis par la transaction sont réentrants. Sur un lot multi-lignes, une acquisition supplémentaire qui rencontre une autre transaction échoue au lieu d’attendre : aucun cycle d’attente consultatif n’est ajouté par P0.

On ne prétend pas imposer cet ordre avant tous les verrous internes PostgreSQL : UPDATE/DELETE peuvent prendre une ligne avant le BEFORE ROW trigger. C’est précisément pourquoi le helper ne doit pas attendre. Le test adversarial détient d’abord FOR UPDATE côté propriétaire ; une attribution prend ensuite le verrou consultatif et attend son FK ; le propriétaire tente alors une édition. Son try-lock échoue, libère sa transaction et laisse l’attribution terminer. Résultat : pas de deadlock, aucun contenu invalidé.

Solutions écartées :

- conserver FOR KEY SHARE : reproduit le refus RLS ;
- élargir UPDATE ou passer en SECURITY DEFINER/service_role : contraire à l’autorisation ;
- retirer simplement le verrou : laisserait notamment les changements de statut/visibilité sans coordination avec le SELECT ;
- attendre systématiquement sur un verrou consultatif dans un trigger de ligne : ordre potentiellement inversé avec les verrous de ligne/FK ;
- verrou global de table ou de tous les exercices : bloquerait inutilement les exercices indépendants.

Références techniques : [verrous PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html), [RLS PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html). Ces documents ont été consultés ; aucun service distant CapTCF n’a été interrogé pendant P0.4.

## Garanties RLS et périmètre des destinataires

Aucune politique RLS publique modifiée par la migration. Aucune nouvelle fonction SECURITY DEFINER. Les opérations applicatives des tests tournent sous authenticated avec des identités synthétiques ; aucun passage par service_role pour contourner les politiques. Les droits du helper privé suivent ceux des validateurs privés existants, avec PUBLIC/anon révoqués ; ce n’est pas une RPC publique.

Les gardes vérifient explicitement que le groupe/séance appartient au professeur et que le destinataire est membre d’un de ses groupes (du groupe/séance ciblé lorsqu’il est fourni). Ce contrôle est nécessaire pour satisfaire le refus du professeur tiers demandé : les RLS existantes d’attribution vérifient formateur_id/assigned_by, pas à elles seules la propriété du groupe. Il n’accorde aucun droit nouveau et s’applique aussi aux changements de cible. Une attribution indépendante sans élève ni groupe est refusée.

Le fixture ajoute la politique de lecture de banque staff déjà présente dans le catalogue sauvegardé en P0.3, avec `is_template`. Il s’agit de reproduire un droit SELECT existant, pas d’ajouter ce droit en production. Cela permet de vérifier qu’un draft lisible dans la banque ne devient pas attribuable par un non-propriétaire.

| Situation | Lecture possible | Attribution | Édition par le professeur attributaire |
|---|---|---|---|
| Son exercice complet, même draft | Oui | Oui, destinataire autorisé | Selon RLS propriétaire ; invalidation attribuée refusée |
| Exercice d’autrui published, complet | Oui | Devoir, attribution individuelle et groupe NULL learner autorisés | Non |
| Exercice d’autrui draft ou validated | Parfois, selon SELECT RLS | Non | Non |
| Exercice invisible | Non | Non | Non |
| Exercice partagé incomplet | Peut être lisible | Non | Non |
| Exercice valide, groupe d’un autre professeur | Oui éventuellement | Non | Aucun droit supplémentaire |

## Tests et preuves

Preuves ignorées par Git : `.local-security-evidence/p0-4/red.txt`, `shared-green.txt`, `sql-regression.txt`, `app-tests.txt`, `build.txt`. PostgreSQL 17 jetable, réseau none, aucun port exposé ; conteneurs supprimés dans finally. La disponibilité initiale est désormais vérifiée sur le loopback **du conteneur** pour éviter de confondre le serveur temporaire d’initdb avec le serveur final.

| Test de concurrence / transaction | Résultat |
|---|---|
| Devoir partagé puis édition propriétaire | Refus temporaire pendant le conflit ; invalidation ensuite refusée par FK |
| Édition propriétaire puis devoir partagé | Refus temporaire pendant le conflit ; attribution ensuite refusée sur contenu invalide |
| Attribution indépendante puis édition | Même protection |
| Édition puis attribution indépendante | Même protection |
| Deux attributions du même exercice | Une opération occupée, aucun effet partiel ; nouvelle action après fin acceptée |
| Deux exercices différents | Deux réussites en parallèle |
| Même request_id | Un lot, reçu stable, rejeu idempotent ; payload différent refusé |
| Erreur sur deuxième exercice de la RPC | Zéro exercice/devoir/reçu du lot conservé |
| Conflit sur deuxième attribution d’un lot | Première attribution aussi annulée |
| Suppression puis attribution | Refus ; aucune référence orpheline |
| Attribution puis suppression | Sérialisation FK puis cascade normale, aucune référence orpheline |
| Dépublication / invisibilité, deux ordres | Refus pendant conflit ou après perte d’éligibilité ; aucune lecture contournée |
| Verrou de ligne propriétaire avant verrou consultatif | Refus métier stable, pas de deadlock |
| UPDATE d’attribution puis édition propriétaire | Même coordination ; groupe étranger refusé |

`pg_stat_database.deadlocks = 0` dans le banc partagé. Les contrôles supplémentaires comprennent droits UPDATE inchangés, propriétaire autorisé, exercice invisible/draft/incomplet refusé, refus du professeur tiers et destinataire hors groupe. Aucun retry massif ; les appels post-commit sont des actions explicites du scénario de test.

Non-régression : **73 tests applicatifs verts**, dont dialogue, reprise P0.1 et manuel ; **49 fixtures de modalités SQL** ; droits/RLS, installation sans réécriture, idempotence, quatre courses propriétaires, rollback et invariance des politiques/triggers/fonctions historiques. Build Vite réussi, avec avertissements de découpage/imports existants. `git diff --check` réussi. Aucun changement frontend, Carnet, Assistant ou quantité d’exercices.

## Migration, rollback et limites

La seule migration existante `20261001074826_safe_automatic_homework.sql` est corrigée localement. Aucun autre fichier de migration ajouté. Le rollback supprime en plus le nouveau helper privé, après les fonctions qui l’appellent. Il conserve son refus lorsque des reçus existent, n’utilise aucun DROP CASCADE et préserve les lignes métier ainsi que les objets historiques. Ni source_devoir_id ni miroir ajouté/réactivé.

La validation après verrou demande des lectures fraîches : le helper accepte READ COMMITTED (et READ UNCOMMITTED, équivalent dans PostgreSQL) et refuse explicitement REPEATABLE READ/SERIALIZABLE par `homework_isolation_unsupported`, au lieu d’accepter un ancien snapshot. Test de refus inclus. C’est une restriction documentée du candidat ; aucun changement de configuration distante effectué.

Les garanties testées concernent les chemins et ordres ci-dessus ; ce rapport ne prétend pas éliminer tous les deadlocks possibles de transactions SQL arbitraires ou de verrous pris manuellement hors P0. Les collisions de hash ne peuvent qu’entraîner un refus conservateur supplémentaire. Les droits de groupe/membre sont revérifiés à l’attribution, sans modifier leurs mécanismes de concurrence historiques. Les références audio restent soumises aux règles P0.3 et à leur publication effective.

Commits locaux séparés : tests rouges `d3c52759`, correctif SQL/fixtures `b1954794`, puis documentation. Le rapport `e501cf8a` est préservé. Le HEAD documentaire est rendu dans le bilan final.

**Arrêt obligatoire respecté :** aucun push, aucune modification de PR #49, aucune fusion, aucune requête Supabase distante, aucune application de migration, aucun déploiement, aucune modification de secret, aucun appel Edge ou Gemini. Les fichiers non suivis préexistants sont préservés. Publication uniquement après autorisation explicite du propriétaire.
