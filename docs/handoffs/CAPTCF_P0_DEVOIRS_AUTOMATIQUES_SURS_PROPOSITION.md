# Lot P0 — devoirs automatiques sûrs : implémentation locale

État courant : P0.2 aligne les gardes sur le schéma réel, sans miroir automatique. Voir [le handoff P0.2](CAPTCF_P0_2_ALIGNEMENT_SCHEMA_REEL.md). Le rapport Phase B antérieur reste un historique d’arrêt, pas une autorisation d’appliquer le SQL corrigé.

Date : 1er octobre 2026. Dépôt : `D:\SITES\CAPTCF`.
Branche source conservée : `captcf-lot-02b-assistant-help-packs`.
Branche de publication isolée : `captcf-p0-safe-automatic-homework`, depuis `origin/main` = `67c48e3e70872f895b926048067832bd767ce273` après fetch.
Base : `ea3d9a463c631ac9488335ed3fd80ce81dff2861`.
Commits antérieurs préservés : `5b15e74d` (tests rouges), `58a90942` (proposition).
Commit code : `736d8703` — `fix: secure automatic homework with explicit atomic sending`.

## État et périmètre

Implémentation et recette locales terminées après autorisation propriétaire d'une migration locale unique. Les sept tests rouges sont verts, ainsi que le test du chemin manuel. La recette P0 initiale est restée locale. La mission P0.1 autorise désormais le push de la seule branche P0 isolée et l'ouverture d'une PR ; aucune fusion, migration Supabase distante, mutation de production, déploiement de production frontend/Edge, modification de secret ou appel Gemini n'est autorisé.

La quantité générale d'exercices, le Carnet et l'assistant ne sont pas modifiés. Les MP3, ZIP, fichiers Studio, preuves locales et fichiers non suivis présents au départ sont préservés et exclus des commits.

## Comportement professeur

L'ouverture ne fait que lire les membres, exercices et résultats de séance. Elle n'envoie rien et ne modifie aucune préférence de groupe. Les contenus existants de séance sont repris explicitement, sans nouvelle génération ni adaptation pédagogique. Les titres, consignes, supports texte/image/script audio, questions, choix et réponses attendues sont visibles. Un contenu absent n'est pas remplacé par une question inventée : il reste signalé et non envoyable.

Le premier clic « Valider et envoyer » affiche la confirmation du lot. Seul « Confirmer l'envoi » appelle la RPC. Une modification de sélection, contenu ou échéance annule la confirmation. Le verrou synchrone bloque le double clic et les envois concurrents ; les générations d'ouverture/préparation permettent d'ignorer les réponses anciennes. Si le dialogue est rouvert pendant un envoi, attendre sa fin puis « Repréparer » pour reprendre. Une ancienne réponse ne ferme pas la nouvelle ouverture.

Le composant appelle exclusivement `send_automatic_homework`. Une RPC absente ou en erreur ne déclenche aucune insertion de secours. Le chemin manuel existant n'est pas réécrit ; les attributions d'exercices complets restent soumises au garde-fou serveur.

L'audio original est lié à l'identifiant de l'exercice publié et à sa famille. Une simple copie casserait sa résolution : la copie automatique est refusée et l'interface indique le chemin manuel. Le serveur vérifie la chaîne publication/famille/source/hash et les métadonnées de stockage lors d'une attribution manuelle d'audio original.

## Migration et CLI

Migration unique : `supabase/migrations/20261001074826_safe_automatic_homework.sql`.
Rollback séparé : `supabase/secours/20261001074826_safe_automatic_homework_rollback.sql`.

Les commandes demandées `npx.cmd supabase --version` et `npx.cmd supabase migration new --help` ont été tentées ; `npx.cmd` est indisponible dans cette session. La CLI locale déjà présente `.local-security-evidence/lot05a-c-phase-b/_tools/supabase.exe` a été utilisée après lecture de sa version **2.118.0** et de l'aide. Commande : `migration new safe_automatic_homework`. L'horodatage vient de la CLI, pas d'un nom fabriqué manuellement. Sa mise à jour accessoire de `supabase/.temp/cli-latest` a été restaurée à sa valeur antérieure ; aucun fichier `.temp` n'est commité.

## Contrat serveur

Toutes les nouvelles fonctions sont `SECURITY INVOKER`, avec `search_path=pg_catalog` et objets qualifiés. Aucun nouveau `SECURITY DEFINER`. Le helper de rôle et les fonctions miroir historiques inactives ne sont pas remplacés ni réactivés. Le schéma `homework_private` n'est pas exposé par PostgREST. EXECUTE est retiré à PUBLIC/anon ; la RPC n'est accordée qu'à authenticated. Les validateurs internes sont accessibles aux rôles nécessaires aux écritures existantes.

La RPC `public.send_automatic_homework(uuid, uuid, uuid, timestamptz, jsonb)` reçoit request_id, séance, groupe, échéance et entrées. L'identité vient de `auth.uid()`. Elle contrôle rôle formateur, propriété du groupe, rattachement de la séance, membres destinataires, date future, séries et contenu. Les clés d'identité injectées dans un exercice sont rejetées. Les types de la vraie table et ses contraintes s'appliquent via `jsonb_populate_record` puis des colonnes d'insertion explicites. Exercices, devoirs et reçu sont dans la même transaction. Les attributions indépendantes dans exercise_assignments ne sont pas créées par cette RPC.

Validation structurelle partagée par fixtures SQL/TypeScript :

- QCM : question, deux choix textuels distincts minimum, réponse présente dans les choix.
- Vrai/faux : question et correction textuelle reconnue.
- Appariement, texte lacunaire, transformation : contrat effectivement consommé par le lecteur actuel, une question et une réponse textuelle par item ; les structures imbriquées non consommées sont refusées.
- EE : production écrite avec consignes non vides, sans choix QCM ni correction unique imposée.
- EO : production orale avec une seule consigne, sans choix QCM ni correction unique imposée.
- CE : texte ou alias image réellement lu par le lecteur, URL HTTP(S).
- CO : script audio ou référence originale complète et non périmée ; la référence originale doit également se résoudre côté base pour une attribution directe.
- Compétence/format inconnu, objet vide, items absents ou mal typés : refus.

Cette validation ne juge pas la qualité pédagogique et ne vérifie pas par réseau qu'une URL ou un fichier de stockage reste disponible.

## Écritures directes, RLS et concurrence

Les triggers protègent `exercices`, `devoirs` et, séparément, les insertions directes dans `exercise_assignments`. Aucun lien miroir entre les deux voies n’est requis ou réinstallé. Les brouillons incomplets restent possibles ; un exercice déclaré devoir doit être exécutable. Une simple modification de statut d'un ancien devoir incomplet reste possible. La garde d'attribution indépendante tient compte de la nullabilité réelle de learner_id/group_id.

Les colonnes techniques `exercices.p0_homework_executable` et `p0_requires_executable` sur les deux tables d'attribution permettent des clés étrangères composites vers `(id, p0_homework_executable)`. Les attributions exigent true. Une édition qui rend un exercice attribué inexécutable ne peut donc pas faire passer son marqueur à false, même si l'attribution est cachée par RLS à l'auteur de l'exercice. Cela évite un nouveau DEFINER pour rechercher ces attributions.

Les contraintes référentielles, les verrous FOR KEY SHARE et les triggers participent à la même transaction. Les deux ordres modification/attribution sont testés avec deux sessions PostgreSQL réellement concurrentes. Pour un brouillon audio dont le lien de publication vient de devenir valide, une nouvelle attribution peut rafraîchir son marqueur technique sous les droits UPDATE existants du propriétaire. Aucun contenu pédagogique n'est réécrit par ce rafraîchissement.

Installation : ajout de colonnes à défaut constant, contraintes composites NOT VALID pour ne pas requalifier rétroactivement les données, aucun UPDATE/backfill métier. Les anciennes lignes conservent le marqueur de compatibilité, mais toute nouvelle attribution est revalidée. Les snapshots métier avant/après installation sont égaux (hors nouvelles colonnes techniques).

## Reçus et idempotence

`homework_private.receipts` contient uniquement propriétaire, request_id, empreinte du lot, nombres créés et date. Aucun contenu pédagogique, réponse ou identifiant d'élève. RLS forcée par propriétaire et rôle formateur ; authenticated a SELECT/INSERT seulement, pas UPDATE/DELETE. Les objets ne sont pas exposés dans le schéma API public.

Un verrou advisory de transaction sérialise les demandes de même propriétaire/request_id. Le même payload retourne le reçu sans nouvelle création ; un autre payload avec le même identifiant produit `homework_request_conflict`. Deux appels simultanés identiques ne créent qu'un lot.

P0.1 conserve désormais la reprise dans sessionStorage : un rechargement de page ou un démontage/remontage du composant dans le même onglet retrouve le request_id du même lot. La clé est isolée par utilisateur, séance, groupe et empreinte SHA-256 du payload. Les clés des objets JSON sont normalisées et les lectures de préparation sont ordonnées. L'échéance du dernier lot en attente est restaurée ; aucun contenu ni sélection nominative n'est stocké. Le professeur doit reconstruire le même lot et confirmer de nouveau : un lot différent reçoit une nouvelle empreinte et un nouvel identifiant. Chaque lot non confirmé garde sa propre reprise, même si un autre lot est tenté.

Champs locaux autorisés exclusivement : requestId, fingerprint, userId, sessionId, groupId, deadline, createdAt. Aucun contenu d'exercice, réponse, nom, email, JWT ou secret. L'écriture précède tout appel réseau ; un stockage indisponible bloque l'envoi avec une erreur visible. Une réponse serveur confirmée efface uniquement la reprise correspondante. Une erreur métier ou réseau conserve l'état et laisse corriger le lot, sans insertion directe de secours. Un autre compte ne reprend pas cet état.

Limite volontaire : sessionStorage couvre le rechargement du même onglet, pas la fermeture définitive de cet onglet, un changement de navigateur/appareil ou l'effacement du stockage. Aucun mécanisme n'envoie automatiquement au rechargement. La migration et la RPC sont strictement inchangées dans P0.1.

Rétention : reçus conservés sans purge automatique afin de maintenir la déduplication. Le rollback refuse explicitement de détruire une table de reçus non vide. Une future politique d'archivage/purge et son effet sur les replays nécessiteraient une décision distincte.

## Tests et résultats

Avant correction (`5b15e74d`) : **8 tests, 7 rouges, 1 vert**. Les rouges reproduisaient l'ouverture mutante, trois contenus invalides, l'absence de vrais contenus, l'envoi avant confirmation et la création partielle. Le test manuel était déjà vert.

Après correction : **50 tests applicatifs verts** dans deux fichiers : 15 tests du dialogue/chemin manuel et 35 tests du contrat (34 fixtures communes SQL/TypeScript et refus de copie audio original). Les tests additionnels couvrent double clic, confirmation invalidée par sélection/contenu/échéance, image visible, préparation et envoi tardifs, chevauchement, reprise du même request_id et absence d'insertion de secours.

Commande ciblée : `node node_modules/vitest/vitest.mjs run src/test/auto-homework-p0-contract.test.tsx src/test/homework-executable.test.ts`.

Tests SQL : `python supabase/tests/test_homework_p0_local.py` — **tous réussis** sur PostgreSQL 17 dans un nouveau conteneur Docker jetable, `--network none`, aucun port publié, base sur tmpfs, conteneur supprimé après test. Aucun fichier .env, jeton Supabase ou URL de base distante n'est lu. Rôles authentifiés, RLS et contraintes sont réellement exécutés ; les accès applicatifs utilisent SET LOCAL ROLE, pas le superutilisateur. Le superutilisateur ne sert qu'à construire/inspecter les fixtures isolées et au rollback de recette.

Contrôles réussis : anonyme/sans identité/élève/admin/tiers refusés, membre hors groupe, séance incorrecte, date passée, injection d'identité, 34 fixtures de format/support, écritures directes invalides, brouillons, attributions indépendantes directes, protection malgré RLS cachant une attribution, audio original publié manuel, édition cassant sa référence, panne FK au deuxième exercice annulant aussi le premier exercice/devoir/reçu, sans effet sur les attributions indépendantes, replay, conflit de payload, reçus privés, concurrence même requête et modification/attribution dans les deux ordres.

Le schéma local est un **fixture ciblé** des tables, politiques et contraintes nécessaires ; la fonction historique miroir est chargée mais aucun trigger ne l'active et source_devoir_id est absente, conformément au préflight réel. Le fixture initial supposait ces prérequis à tort ; P0.2 corrige explicitement cette hypothèse. Ce n'est pas un replay exhaustif de toutes les migrations Supabase, ni une preuve de compatibilité avec un état distant non inspecté. Preuve locale ignorée par Git : `.local-security-evidence/captcf-p0-local-ebdd8c768fd6/result.txt`.

Build : `node node_modules/vite/bin/vite.js build` — **réussi**. Avertissements sur Browserslist ancien, imports dynamiques également statiques et taille du bundle ; aucune correction hors périmètre. `git diff --check` et vérification de l'index : réussis. Pas de campagne exhaustive, déploiement ou recette avec des données réelles.

## Retour arrière

Désactiver le chemin automatique avant tout rollback ; il doit rester désactivé ensuite. Le script retire seulement les objets P0, sans DROP CASCADE ni suppression d'exercices, devoirs ou attributions.

Test réel : refus si les reçus sont non vides, avec snapshot métier inchangé. Ensuite, exclusivement dans le conteneur jetable, archivage des reçus fictifs puis vidage de cette table de recette pour tester le retrait des objets ; snapshot métier encore inchangé. Cette opération de fixture n'autorise aucune suppression de reçus réels.

## Fichiers et commits

Commit code `736d8703`, neuf fichiers :

- `src/components/AutoHomeworkPreviewDialog.tsx`
- `src/lib/homeworkExecutable.ts`
- `src/test/auto-homework-p0-contract.test.tsx`
- `src/test/homework-executable.test.ts`
- `supabase/migrations/20261001074826_safe_automatic_homework.sql`
- `supabase/secours/20261001074826_safe_automatic_homework_rollback.sql`
- `supabase/tests/homework_executable_cases.json`
- `supabase/tests/homework_p0_schema.sql`
- `supabase/tests/test_homework_p0_local.py`

Commit documentaire suivant : ce fichier uniquement. Les commits locaux sont créés sans hooks externes, après les vérifications ciblées ci-dessus. L'autorisation P0.1 de push/PR est distincte et explicite ; elle n'autorise ni fusion ni application distante de la migration.


## P0.1 — reprise et publication isolée

Correctif source : `7e24216e`, intitulé exact `fix(homework): preserve automatic send id across reload`, sans amend. Après cherry-pick sur la branche dédiée : `1b1f25d8`. Rejeu limité aux commits P0 : tests rouges `e556730a`, proposition `ba529999`, correctif `497132fd`, handoff `7be28d82`, puis reprise `1b1f25d8`. Aucun commit du Lot 2B Assistant n'est importé.

Validation de la branche isolée : **56 tests ciblés verts**, comprenant tous les 50 tests P0 et six tests supplémentaires (rechargement avec échéance restaurée/réseau perdu, nouveau contenu et confirmation, effacement après succès, compte différent, empreinte déterministe/changement de destinataires/stockage minimal, stockage indisponible sans envoi). Build Vite réussi avec les avertissements antérieurs. Diff whitespace propre. Tests PostgreSQL isolés, concurrence et rollback réussis à nouveau sur cette branche.

À la livraison P0.1, la migration et son rollback étaient identiques aux versions P0. Ils sont ensuite corrigés localement dans P0.2 après le préflight interrompu ; ils restent non appliqués à distance. Fonctions nouvelles INVOKER, auth.uid(), chemin fixe, privilèges minimaux, refus anon/PUBLIC, transaction, idempotence et absence de backfill conservés. Le workflow CI de PR exécute test/build/lint ; le workflow curriculum-worker n'est déclenché ni par le push de cette branche ni par la PR. Aucun workflow manuel n'est lancé.

Diff P0/P0.1 initial depuis origin/main (P0.2 ajoute les handoffs Phase B et P0.2) :

1. `docs/handoffs/CAPTCF_P0_DEVOIRS_AUTOMATIQUES_SURS_PROPOSITION.md`
2. `src/components/AutoHomeworkPreviewDialog.tsx`
3. `src/lib/homeworkExecutable.ts`
4. `src/lib/homeworkSendRecovery.ts`
5. `src/test/auto-homework-p0-contract.test.tsx`
6. `src/test/homework-executable.test.ts`
7. `supabase/migrations/20261001074826_safe_automatic_homework.sql`
8. `supabase/secours/20261001074826_safe_automatic_homework_rollback.sql`
9. `supabase/tests/homework_executable_cases.json`
10. `supabase/tests/homework_p0_schema.sql`
11. `supabase/tests/test_homework_p0_local.py`

Aucun fichier AssistantHelpEditor, banque d'indices, table/RPC Assistant, captcf-assistant-qa, Classium, audio, ZIP, .env, secret, .local-security-evidence ou supabase/.temp dans le diff. Les fichiers non suivis préexistants sont préservés. Publication de cette branche uniquement après ces contrôles ; état distant CI/Vercel à lire sur la PR pour le HEAD effectivement poussé. Ne pas fusionner ; migration non appliquée en production. Sans cette RPC, le dialogue échoue sans insertion de secours.
