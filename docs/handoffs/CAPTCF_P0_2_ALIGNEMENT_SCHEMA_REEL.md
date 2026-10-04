# P0.2 — alignement sur le schéma réel des devoirs

Date : 1er octobre 2026. Branche : `captcf-p0-safe-automatic-homework`. PR : #49.
Départ distant : `4976c07f`. Arrêt Phase B : `70c096f7`, conservé sans amend.
Commit code P0.2 : `dea20421` (`fix(homework): align P0 guards with independent assignments`).

## Décision d'architecture

Les devoirs automatiques créent **exercices + devoirs + reçu**, dans la même transaction. Ils ne créent pas d'`exercise_assignments`. Les résultats des devoirs sont rattachés par `resultats.devoir_id`. Le chemin manuel des devoirs conserve cette même architecture.

`exercise_assignments` est une voie d'attribution indépendante, notamment utilisée par `PlayExercise`. Elle reste protégée contre les exercices inexécutables par un garde-fou propre, sans lien artificiel avec `devoirs`.

**`source_devoir_id` ajoutée : non. Aucun trigger miroir réinstallé.** Les fonctions historiques ne sont ni supprimées ni remplacées ; leur nettoyage serait une autre décision.

## Preuves du schéma distant, lecture seule

Une requête `BEGIN READ ONLY ... COMMIT` sur le seul projet `gudcenhmzlcvhgbgklzw` a revérifié :

- migration `20261001074826` absente ; schéma `homework_private` absent ;
- `exercise_assignments` : neuf colonnes réelles (`id`, `exercise_id`, `learner_id`, `group_id`, `assigned_by`, `context`, `due_date`, `sync_status`, `created_at`) ; aucune `source_devoir_id` ;
- `resultats.devoir_id` référence `devoirs(id)` avec ON DELETE SET NULL ;
- `exercise_attempts.assignment_id` référence `exercise_assignments(id)` ;
- aucune activation de `mirror_devoir_to_assignment` sur devoirs, ni de `mirror_resultat_to_attempt` sur resultats ;
- les deux fonctions existent encore et mentionnent la colonne absente. Les triggers réellement présents concernent notamment sandbox, garde des mises à jour et recalcul de risque.

Aucune ligne métier ou donnée personnelle n'a été lue. Aucun appel de fonction de génération, correction ou remise n'a été exécuté à distance.

## Cartographie des parcours

| Parcours | Écritures / lectures vérifiées dans le code | Conclusion |
|---|---|---|
| Préparation et attribution automatique | `AutoHomeworkPreviewDialog` appelle `send_automatic_homework` ; la RPC insère exercices/devoirs/reçu | Pas d'attribution intermédiaire à créer |
| Attribution manuelle de devoir | `src/components/EndOfSessionSection.tsx:179` insère dans `devoirs` | Conservation du chemin existant |
| Liste et passation élève | `src/pages/eleve/Devoirs.tsx:26` lit devoirs, ligne 45 lit resultats ; `DevoirPassation.tsx:201` et `:216` font les mêmes rattachements | L'écran de devoir ne dépend pas d'un miroir d'attribution |
| Remise et statut | `supabase/functions/submit-devoir-result/index.ts:185` construit le résultat, `:201` insère `resultats`, `:248` met à jour devoirs | `resultats.devoir_id` est le rattachement de remise |
| Suivi formateur | `src/pages/formateur/DevoirsFormateur.tsx:65` lit devoirs, `:82` lit resultats par devoir_id | Résultats consultables sans exercise_assignments |
| Attribution indépendante | `src/pages/formateur/ExercicesPage.tsx:346` insère exercise_assignments, avec group_id possible et learner_id NULL | Garder les nullabilités et vérifier aussi le changement de groupe |
| Lecture par lien d'exercice | `src/pages/PlayExercise.tsx:189` cherche une assignment par exercice/élève ; envoi à auto-correct-exercise | Parcours distinct de DevoirPassation |
| Tentative indépendante | `supabase/functions/auto-correct-exercise/index.ts:94` vérifie assignment_id ; `:191` insère exercise_attempts avec ce lien facultatif | Pas de source_devoir_id nécessaire |
| Avancement live de devoir | `DevoirPassation.tsx:460` appelle useLiveAttemptSync ; `src/hooks/useLiveAttemptSync.ts:98` insère une tentative par exercice/élève, sans assignment_id | L'avancement peut exister sans miroir d'attribution |

**Statut du miroir : reliquat historique inactif dans le schéma observé**, sans appel applicatif trouvé à `mirror_devoir_to_assignment`. L'ancien SQL de synchronisation d'avril 2026 ne prouve pas qu'il soit actif aujourd'hui.

Limite relevée : des commentaires du hook live supposent encore une finalisation par `mirror_resultat_to_attempt`, alors que son trigger est absent. Ce décalage préexistant n'est pas une preuve métier justifiant de réinstaller le miroir ; aucune correction de suivi live ou d'Edge n'est incluse dans P0.2.

## Correctif local

Migration existante, jamais appliquée : `20261001074826_safe_automatic_homework.sql`. Pas de nouvelle migration.

- Retrait de la branche INSERT/ON CONFLICT qui référençait `source_devoir_id`.
- Renommage de `homework_private.guard_mirror` en `guard_independent_assignment` et du trigger en `p0_guard_independent_assignment` pour décrire leur rôle réel.
- Comparaison des identités par `IS NOT DISTINCT FROM` : learner_id/group_id peuvent être NULL dans le vrai schéma. Un changement de groupe ou de destinataire impose une nouvelle validation ; une simple modification d'échéance historique ne redistribue pas l'exercice.
- Contraintes composites et verrous conservés sur les deux voies. Un exercice déjà attribué ne peut pas devenir inexécutable, même lorsque l'attribution est masquée par RLS.
- RPC, validation des formats, autorisation, ACL, search_path, idempotence, reçus, frontend et reprise P0.1 inchangés.
- Rollback ajusté aux deux noms renommés. Il ne touche pas aux anciennes fonctions miroir ni à leurs dépendances ; il refuse toujours une suppression des reçus non vides et n'utilise pas DROP CASCADE.

## Rouge puis vert

Avant modification de la migration, le fixture a été corrigé pour supprimer la colonne imaginaire et ne plus installer de trigger miroir. Une insertion valide dans exercise_assignments, sous rôle authenticated/formateur, a alors échoué réellement dans PostgreSQL :

```text
ERROR: record "new" has no field "source_devoir_id"
CONTEXT: SQL expression "TG_OP='INSERT' AND NEW.source_devoir_id IS NOT NULL"
PL/pgSQL function homework_private.guard_mirror() line 6 at IF
```

Après correctif : cette insertion réussit. Le fixture conserve la fonction historique non raccordée, comme à distance. La forme complète des neuf colonnes exercise_assignments est reproduite ; les colonnes/types/défauts P0 d'exercices/devoirs sont alignés, notamment niveau_vise text et échéance par défaut. Les autres tables restent un fixture ciblé, pas une restauration exhaustive du projet Supabase.

Résultats verts :

- installation sans réécriture des contenus/devoirs/attributions historiques ;
- refus anon, identité absente, rôle inadéquat, tiers, membre hors groupe, séance/date invalides, identité injectée ;
- 34 fixtures de formats/supports, brouillons préservés, audio publié manuel ;
- attribution indépendante individuelle et de groupe (learner_id NULL) acceptée ; nouvelle attribution incomplète et édition invalidante refusées ;
- anciennes modifications de statut de devoir et d'échéance d'attribution préservées ; modification du destinataire revalidée ;
- panne FK au deuxième exercice : aucun exercice/devoir/reçu conservé, attributions indépendantes inchangées ;
- réussite/rejeu/conflit de payload : un seul lot, **zéro attribution indépendante ajoutée** ;
- deux appels simultanés avec le même request_id : delta exact exercices +1, devoirs +1, assignments +0, reçus +1 ;
- quatre courses réelles : modification/attribution dans les deux ordres, sur devoirs puis sur attributions indépendantes de groupe ;
- rollback refusé avec reçus, puis rollback sur fixtures après archivage des seuls reçus fictifs : contenu métier identique, fonction historique inchangée, toujours aucune colonne ni trigger miroir ajouté ;
- **56 tests applicatifs verts**, comprenant toute la reprise P0.1 ; build Vite réussi ; git diff --check propre. Avertissements Vite antérieurs seulement.

Commandes : `python supabase/tests/test_homework_p0_local.py`, `node node_modules/vitest/vitest.mjs run src/test/auto-homework-p0-contract.test.tsx src/test/homework-executable.test.ts`, `node node_modules/vite/bin/vite.js build`.

Tests SQL dans un nouveau conteneur PostgreSQL 17 jetable, sans réseau ni ports, supprimé en fin de test. Preuves locales ignorées : `.local-security-evidence/p0-2-real-schema/red.txt` et `sql-green.txt`.

## Publication et limites

Commit code séparé puis commit documentaire, sans amend. `70c096f7` est conservé comme compte rendu historique de l'arrêt, et inclus dans le push autorisé des nouveaux commits. La description de PR est mise à jour pour retirer l'hypothèse de miroir automatique. Aucune modification Assistant, Carnet, Classium, secret, audio, package ou Edge.

La PR #49 doit rester ouverte et non fusionnée. La migration corrigée reste **non appliquée**. Le futur préflight Phase B devra comparer le nouvel état distant et le nouveau SQL avant toute nouvelle autorisation d'application. Les tests locaux ne constituent pas une recette de production.

Supabase : **lecture seule**. Mutation distante de données/schéma : **0**. Fusion/production : **0**. Edge : **0**. Gemini : **0**.
