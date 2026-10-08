# P0 — Phase B : arrêt au préflight, aucune mutation distante

Date : 1er octobre 2026. Projet examiné exclusivement : `gudcenhmzlcvhgbgklzw`.
PR : https://github.com/chrisngassa-max/primo-fluency-hub/pull/49.
Branche : `captcf-p0-safe-automatic-homework`.
HEAD autorisé et distant vérifié : `4976c07fc8a6dab3308c5e62866da28c3ce71b61`.

## Décision

**STOP à l'étape 1, avant application de la migration.** Instruction propriétaire appliquée : « Si une incompatibilité apparaît : STOP sans appliquer ni modifier le SQL. »

Deux incompatibilités confirmées dans les catalogues distants :

1. `public.exercise_assignments.source_devoir_id` est absente (`pg_attribute`, hors colonnes supprimées). La migration autorisée utilise pourtant `NEW.source_devoir_id` et `a.source_devoir_id` dans `homework_private.guard_mirror()` (lignes 135–136). Les écritures dans `exercise_assignments` déclencheraient une fonction dépendant d'une colonne absente.
2. `public.mirror_devoir_to_assignment()` existe et sa définition contient INSERT/ON CONFLICT sur `source_devoir_id`, mais **aucun trigger sur `devoirs` n'appelle cette fonction**. La migration P0 n'installe pas ce miroir : elle suppose qu'il existe déjà. La garantie d'attribution miroir testée localement n'est donc pas satisfaite sur le schéma distant.

Le fixture PostgreSQL local crée explicitement la colonne avec unicité et FK (`supabase/tests/homework_p0_schema.sql:36`), puis crée le trigger miroir (`supabase/tests/test_homework_p0_local.py:106`). Les tests locaux réussis prouvent le comportement dans ce fixture ; ils ne prouvent pas la présence de ces prérequis en production. Le préflight vient d'établir cet écart. Aucun correctif de schéma, ajout de colonne/trigger, modification de migration ou autre migration n'a été tenté.

## Préflight Git

- PR ouverte, non fusionnée, fusionnable ; base `main`, HEAD exact autorisé.
- CI du HEAD réussie : https://github.com/chrisngassa-max/primo-fluency-hub/actions/runs/36842928735.
- Statut Vercel du HEAD réussi : https://vercel.com/meme3/primo-fluency-hub/AgiV1hdFosGeaDPRhgT4JB4xxcns.
- Liste GitHub vérifiée : exactement les 11 fichiers P0 attendus (handoff P0, dialogue, deux helpers, deux tests applicatifs, migration, rollback, fixture JSON, fixture SQL, test SQL Python).
- Aucun fichier Lot 2B Assistant, MP3/ZIP, .env, secret, preuve locale, supabase/.temp ou Classium dans ce diff.
- `git ls-remote` confirme `main = 67c48e3e70872f895b926048067832bd767ce273` et la branche P0 = HEAD autorisé. Aucun push et aucune fusion pendant cette Phase B.

## Préflight Supabase en lecture seule

Deux requêtes explicites `BEGIN READ ONLY ... COMMIT` ont interrogé les catalogues sur le seul projet autorisé. Aucun contenu d'exercice, réponse, nom, email, JWT, mot de passe ou clé n'a été lu ou enregistré.

- Migration `20261001074826` : aucune entrée distante.
- Schéma `homework_private` : absent.
- RPC `send_automatic_homework` : absente.
- Colonnes, types, valeurs par défaut et nullabilité examinés pour exercices, devoirs, exercise_assignments, groups, sessions, group_members, profiles, user_roles, pedagogical_sources et differentiation_families.
- Définitions du miroir, triggers, contraintes, politiques et grants des tables concernées conservées hors Git.
- Enum `devoir_raison` : remediation/consolidation, compatible sur ce point.
- Revue interrompue à l'incompatibilité du miroir. La compatibilité globale du reste du schéma et les droits/RLS après installation ne sont pas déclarés validés.

## Preuves hors Git

Répertoire ignoré : `.local-security-evidence/p0-phase-b-4976c07f/`.

- `preflight.json` : résultats GitHub, inventaire des colonnes, définition du miroir, triggers, contraintes, policies et grants. Données de structure uniquement.
- Copies binaires exactes du SQL autorisé et du rollback, sans modification.
- `sha256.json` : empreintes SHA-256 des copies locales.

Migration : `FB1A0AA32737130681859049E84657F87C9767F2CD997EC2EDC0FD0F98724A4F`.
Rollback : `201E49BE6071208E664232A47AEEF8A27D9039F7E1A4B73CC28EB5C20B9E51C5`.

L'arrêt précède les sauvegardes métier complètes : compteurs et empreintes des lignes existantes non prélevés, aucun snapshot de données réelles. Aucune égalité avant/après de compteurs n'est revendiquée. Aucune mutation distante n'a été exécutée. Les advisors après migration sont sans objet ; aucun advisor n'a été lancé après le STOP.

## Migration, smokes et recette

Migration non appliquée, aucun objet P0 installé, aucune nouvelle protection P0 active. SQL et rollback de la PR inchangés.

Les **17 smokes serveur sont non exécutés** à cause de l'arrêt préalable :

| N° | Contrôle | Résultat |
|---|---|---|
| 1 | Anonyme | Non exécuté |
| 2 | Élève | Non exécuté |
| 3 | Formateur tiers | Non exécuté |
| 4 | Membre hors groupe | Non exécuté |
| 5 | Séance étrangère | Non exécuté |
| 6 | Échéance passée | Non exécuté |
| 7 | Contenu vide | Non exécuté |
| 8 | QCM incomplet | Non exécuté |
| 9 | Exercice complet | Non exécuté |
| 10 | Rejeu même lot/request_id | Non exécuté |
| 11 | Payload différent sous même request_id | Non exécuté |
| 12 | Appels concurrents | Non exécuté |
| 13 | Panne au milieu et rollback total | Non exécuté |
| 14 | Écriture directe invalide | Non exécuté |
| 15 | Édition invalidante d'un exercice attribué | Non exécuté |
| 16 | Chemin manuel valide | Non exécuté |
| 17 | Statut d'un ancien devoir incomplet | Non exécuté |

Aucun appel RPC/HTTP de recette, aucun test sur données réelles, aucune recette professeur en production. Le chemin manuel n'a pas été modifié ni revalidé à distance. Aucun examen des logs de smokes à prétendre, puisque les smokes n'ont pas démarré.

## Main, Vercel et retour arrière

Main demeure `67c48e3e70872f895b926048067832bd767ce273` ; aucun SHA de fusion nouveau. Le statut Vercel associé à ce SHA est success, déploiement `BfmoNtgNFFGj1vHTYsQTrMuPas1F` : https://vercel.com/meme3/primo-fluency-hub/BfmoNtgNFFGj1vHTYsQTrMuPas1F.

Pas de nouveau déploiement, promotion ou vérification du bundle servi sur captcf.fr pendant cette Phase B interrompue. La correspondance Production/domaine n'est donc pas requalifiée ici. Base de retour frontend conservée : le même SHA `67c48e3e...`.

Rollback non utilisé et non nécessaire : aucune mutation n'a eu lieu. Aucun reçu réel ou temporaire supprimé.

## Données temporaires et suite

Zéro compte, profil, rôle, groupe, séance, exercice, devoir, attribution, reçu, session d'authentification ou refresh token temporaire créé. Aucun nettoyage nécessaire ; aucune donnée réelle modifiée par cette mission. Fichiers non suivis préexistants préservés.

Gemini : **0**. Edge nouvelle/modifiée/déployée : **0**. Secrets modifiés : **0**.

La reprise exige une décision propriétaire sur l'écart de schéma et son correctif : adapter les prérequis/la migration et les fixtures demanderait une autorisation distincte, hors SQL exact actuellement permis. Ne pas fusionner la PR #49 dans cet état. Ce handoff fait seul l'objet d'un commit documentaire local séparé, **non poussé** ; le HEAD distant de la PR reste `4976c07f`.
