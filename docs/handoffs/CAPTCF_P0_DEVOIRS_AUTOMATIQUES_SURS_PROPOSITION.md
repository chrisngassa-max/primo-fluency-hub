# Lot P0 — devoirs automatiques sûrs : implémentation locale

Date : 1er octobre 2026. Dépôt : `D:\SITES\CAPTCF`.
Branche conservée : `captcf-lot-02b-assistant-help-packs`.
Base : `ea3d9a463c631ac9488335ed3fd80ce81dff2861`.
Commits antérieurs préservés : `5b15e74d` (tests rouges), `58a90942` (proposition).
Commit code : `736d8703` — `fix: secure automatic homework with explicit atomic sending`.

## État et périmètre

Implémentation et recette locales terminées après autorisation propriétaire d'une migration locale unique. Les sept tests rouges sont verts, ainsi que le test du chemin manuel. Aucun changement distant : ni migration Supabase, mutation de production, push, PR, déploiement frontend/Edge, modification de secret ou appel Gemini.

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

Toutes les nouvelles fonctions sont `SECURITY INVOKER`, avec `search_path=pg_catalog` et objets qualifiés. Aucun nouveau `SECURITY DEFINER`. Le helper de rôle et le miroir déjà présents ne sont pas remplacés. Le schéma `homework_private` n'est pas exposé par PostgREST. EXECUTE est retiré à PUBLIC/anon ; la RPC n'est accordée qu'à authenticated. Les validateurs internes sont accessibles aux rôles nécessaires aux écritures existantes.

La RPC `public.send_automatic_homework(uuid, uuid, uuid, timestamptz, jsonb)` reçoit request_id, séance, groupe, échéance et entrées. L'identité vient de `auth.uid()`. Elle contrôle rôle formateur, propriété du groupe, rattachement de la séance, membres destinataires, date future, séries et contenu. Les clés d'identité injectées dans un exercice sont rejetées. Les types de la vraie table et ses contraintes s'appliquent via `jsonb_populate_record` puis des colonnes d'insertion explicites. Exercices, devoirs, miroirs et reçu sont dans la même transaction.

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

Les triggers protègent `exercices`, `devoirs` avant son miroir, et les insertions directes dans `exercise_assignments`. Les brouillons incomplets restent possibles ; un exercice déclaré devoir doit être exécutable. Une simple modification de statut d'un ancien devoir incomplet reste possible, y compris à travers le INSERT ON CONFLICT du miroir existant.

Les colonnes techniques `exercices.p0_homework_executable` et `p0_requires_executable` sur les deux tables d'attribution permettent des clés étrangères composites vers `(id, p0_homework_executable)`. Les attributions exigent true. Une édition qui rend un exercice attribué inexécutable ne peut donc pas faire passer son marqueur à false, même si l'attribution est cachée par RLS à l'auteur de l'exercice. Cela évite un nouveau DEFINER pour rechercher ces attributions.

Les contraintes référentielles, les verrous FOR KEY SHARE et les triggers participent à la même transaction. Les deux ordres modification/attribution sont testés avec deux sessions PostgreSQL réellement concurrentes. Pour un brouillon audio dont le lien de publication vient de devenir valide, une nouvelle attribution peut rafraîchir son marqueur technique sous les droits UPDATE existants du propriétaire. Aucun contenu pédagogique n'est réécrit par ce rafraîchissement.

Installation : ajout de colonnes à défaut constant, contraintes composites NOT VALID pour ne pas requalifier rétroactivement les données, aucun UPDATE/backfill métier. Les anciennes lignes conservent le marqueur de compatibilité, mais toute nouvelle attribution est revalidée. Les snapshots métier avant/après installation sont égaux (hors nouvelles colonnes techniques).

## Reçus et idempotence

`homework_private.receipts` contient uniquement propriétaire, request_id, empreinte du lot, nombres créés et date. Aucun contenu pédagogique, réponse ou identifiant d'élève. RLS forcée par propriétaire et rôle formateur ; authenticated a SELECT/INSERT seulement, pas UPDATE/DELETE. Les objets ne sont pas exposés dans le schéma API public.

Un verrou advisory de transaction sérialise les demandes de même propriétaire/request_id. Le même payload retourne le reçu sans nouvelle création ; un autre payload avec le même identifiant produit `homework_request_conflict`. Deux appels simultanés identiques ne créent qu'un lot.

Le dialogue conserve request_id après erreur réseau et après fermeture/réouverture du même composant. Une reprise du même lot utilise le même identifiant. Ce stockage est en mémoire : un rechargement complet de la page ou un démontage du composant perd cette clé. La déduplication serveur reste garantie pour tout appel présentant le même request_id ; aucune garantie de reprise automatique après rechargement n'est revendiquée.

Rétention : reçus conservés sans purge automatique afin de maintenir la déduplication. Le rollback refuse explicitement de détruire une table de reçus non vide. Une future politique d'archivage/purge et son effet sur les replays nécessiteraient une décision distincte.

## Tests et résultats

Avant correction (`5b15e74d`) : **8 tests, 7 rouges, 1 vert**. Les rouges reproduisaient l'ouverture mutante, trois contenus invalides, l'absence de vrais contenus, l'envoi avant confirmation et la création partielle. Le test manuel était déjà vert.

Après correction : **50 tests applicatifs verts** dans deux fichiers : 15 tests du dialogue/chemin manuel et 35 tests du contrat (34 fixtures communes SQL/TypeScript et refus de copie audio original). Les tests additionnels couvrent double clic, confirmation invalidée par sélection/contenu/échéance, image visible, préparation et envoi tardifs, chevauchement, reprise du même request_id et absence d'insertion de secours.

Commande ciblée : `node node_modules/vitest/vitest.mjs run src/test/auto-homework-p0-contract.test.tsx src/test/homework-executable.test.ts`.

Tests SQL : `python supabase/tests/test_homework_p0_local.py` — **tous réussis** sur PostgreSQL 17 dans un nouveau conteneur Docker jetable, `--network none`, aucun port publié, base sur tmpfs, conteneur supprimé après test. Aucun fichier .env, jeton Supabase ou URL de base distante n'est lu. Rôles authentifiés, RLS et contraintes sont réellement exécutés ; les accès applicatifs utilisent SET LOCAL ROLE, pas le superutilisateur. Le superutilisateur ne sert qu'à construire/inspecter les fixtures isolées et au rollback de recette.

Contrôles réussis : anonyme/sans identité/élève/admin/tiers refusés, membre hors groupe, séance incorrecte, date passée, injection d'identité, 34 fixtures de format/support, écritures directes invalides, brouillons, attributions miroir directes, protection malgré RLS cachant une attribution, audio original publié manuel, édition cassant sa référence, panne FK au deuxième exercice annulant aussi le premier exercice/devoir/miroir/reçu, replay, conflit de payload, reçus privés, concurrence même requête et modification/attribution dans les deux ordres.

Le schéma local est un **fixture ciblé** des tables, politiques et contraintes nécessaires ; le vrai SQL du miroir existant est chargé. Ce n'est pas un replay exhaustif de toutes les migrations Supabase, ni une preuve de compatibilité avec un état distant non inspecté. Preuve locale ignorée par Git : `.local-security-evidence/captcf-p0-local-ebdd8c768fd6/result.txt`.

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

Commit documentaire suivant : ce fichier uniquement. Les commits locaux sont créés sans hooks externes, après les vérifications ciblées ci-dessus. Aucune autorisation distante n'est déduite de cette livraison locale.
