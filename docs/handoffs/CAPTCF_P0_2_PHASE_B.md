# CapTCF P0.2 — Phase B arrêtée avant application

Date : 2026-10-01. Projet unique : `gudcenhmzlcvhgbgklzw`.

## Décision

STOP au préflight : incompatibilité supplémentaire entre le contrat P0 et un trigger réellement actif. Aucune migration appliquée, aucun SQL modifié, aucune mutation Supabase, aucune fusion ou publication. L'autorisation impose « Si une nouvelle incompatibilité apparaît : STOP sans appliquer ni modifier le SQL ».

## Préflight réalisé et limite

- PR #49 ouverte, non fusionnée, fusionnable ; HEAD exact `30c74d5a2ef75b9346dee0b57be0f10081e79b4b`, code P0.2 `dea20421`.
- CI GitHub run `36862561858` : completed/success. Preview Vercel : success, déploiement `3aWghzj2GnnHN9MojHwRXqUH18ta`.
- Diff GitHub : exactement les 13 fichiers P0 attendus. Aucun Lot 2B, MP3, ZIP, secret, .env, preuve locale ou supabase/.temp ajouté.
- Migration `20261001074826` : zéro enregistrement. Schéma `homework_private` et RPC `send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb)` absents.
- `exercise_assignments.source_devoir_id` absente ; aucun trigger des deux fonctions miroir historiques. Fonctions présentes, non modifiées.
- FK `resultats.devoir_id` vers `devoirs.id` présente, ON DELETE SET NULL.
- Catalogues des colonnes/types/defaults, contraintes et RLS des tables principales consultés. Définitions des triggers existants et du helper `has_role` examinées.
- La compatibilité intégrale n'est PAS validée : arrêt sur le blocage ci-dessous. Inventaire exhaustif des grants/enums, comparaison intégrale des catalogues précédents, sauvegarde des compteurs/empreintes métier, advisors et plan d'identifiants temporaires non finalisés. Aucune étape suivante ne peut être considérée comme approuvée.

## Incompatibilité reproduite sans écriture

Le trigger `trg_enforce_exercise_modality` est actif BEFORE INSERT / UPDATE des champs pédagogiques de `public.exercices`. Il appelle `public.enforce_exercise_modality()`, qui appelle `public.exercise_modality_issues(...)` et lève SQLSTATE `23514` si une anomalie est retournée.

Pour CE, cette fonction exige un support textuel d'au moins 20 caractères ; elle ne reconnaît pas les champs image comme support de lecture. Or `src/lib/homeworkExecutable.ts` et `homework_private.executable` dans la migration acceptent une image HTTP(S) seule ou tout texte non vide. La fixture `CE image` est explicitement valide dans `supabase/tests/homework_executable_cases.json`. Le fixture SQL ciblé n'installe pas ce trigger existant.

Deux SELECT en transaction READ ONLY, avec uniquement des littéraux synthétiques, ont appelé la fonction distante existante :

1. CE / qcm, image `https://example.invalid/p0.png`, question et deux choix avec réponse valide, sans texte ;
2. CE / qcm, texte `Bonjour.`, question et deux choix avec réponse valide.

Dans les deux cas : `CE : ajoutez le texte support visible par l'élève.`

Ce sont des sondes de préflight, pas des smokes de la RPC absente. Le refus d'INSERT est déduit de la définition du trigger actif ; aucun INSERT distant n'a été tenté. La RPC insère un nouvel exercice : elle subirait donc ce refus après une prévisualisation P0 considérée valide. L'atomicité éviterait les écritures partielles mais ne résout pas cette divergence fonctionnelle.

La suite devra faire l'objet d'un correctif local autorisé : intégrer les contraintes actives aux fixtures, arrêter le contrat CE retenu, aligner prévisualisation et validation serveur puis retester. Aucun correctif SQL n'est effectué pendant cette Phase B. Ne pas supprimer ou désactiver le trigger existant pour contourner le contrôle.

## Architecture conservée

RPC prévue : exercices + devoirs + reçu atomiques ; remises par `resultats.devoir_id`. `exercise_assignments` reste un parcours indépendant. Aucune attribution indépendante créée par la RPC. Aucune colonne source_devoir_id ajoutée, aucun miroir réactivé, fonctions historiques intactes.

## Preuves locales

Exclusivement sous `.local-security-evidence/p0-2-phase-b-30c74d5a/`, ignoré par Git : `preflight.json`, `final-readonly.json`, copies exactes `migration.sql` et `rollback.sql`. Catalogues et littéraux synthétiques uniquement ; aucun contenu élève, secret, JWT ou mot de passe sauvegardé.

- Migration SHA-256 : `4178BE3D7186F8D99AF1C116122261294973F46B0740BC58CE20D606E3CB21EE`.
- Rollback SHA-256 : `625F747E61B559086ABAF907EE74FE395F9BFE4B321189B0E2B55B835DE291CB`.

## Résultats des contrôles serveur demandés

Les 23 contrôles sont **non exécutés**, car l'arrêt précède installation et création de données temporaires :

| Nº | Contrôle | État |
|---|---|---|
| 1–6 | Anonyme, élève, tiers, hors groupe, séance étrangère, date passée | Non exécutés |
| 7–9 | Vide, QCM incomplet, complet | Non exécutés sur la RPC |
| 10–12 | Rejeu identique, conflit, concurrence | Non exécutés |
| 13–14 | Atomicité deuxième exercice, compteurs exacts et zéro attribution | Non exécutés |
| 15–17 | Attributions indépendante invalide, individuelle valide, groupe valide | Non exécutés |
| 18–20 | Édition invalidante, changement destinataire/groupe, échéance historique | Non exécutés |
| 21 | Chemin manuel valide | Non retesté en production |
| 22 | Résultat synthétique lié au devoir | Non exécuté |
| 23 | Ancien devoir incomplet non réécrit par installation | Installation non effectuée |

Les tests locaux P0.2 précédents ne sont pas présentés comme validation de ce trigger réel. Aucun test applicatif/build relancé pour ce seul rapport ; aucun code modifié. Pas de recette professeur, de dossier réel ouvert ou de contrôle logs post-installation puisqu'il n'y a pas d'installation.

## Git, Vercel, nettoyage et rollback

Main distant confirmé : `67c48e3e70872f895b926048067832bd767ce273`. Statut Vercel associé : success, `BfmoNtgNFFGj1vHTYsQTrMuPas1F`. L'association actuelle de captcf.fr au déploiement n'a pas été revérifiée ; aucune nouvelle production ni aucun SHA de fusion.

PR #49 conservée ouverte à `30c74d5a`. Aucun push supplémentaire. Ce rapport constitue un commit documentaire local séparé, sans amend des commits antérieurs.

Aucun compte, groupe, séance, exercice, devoir, attribution, résultat ou reçu temporaire créé : aucun reliquat produit par cette intervention et aucun nettoyage nécessaire. Aucune ligne réelle mutée par cette intervention ; égalité de compteurs avant/après non mesurée. Rollback non utilisé, migration toujours absente. Fonctions miroir et chemin manuel non modifiés.

Gemini : **0**. Edge appelée/créée/modifiée/déployée : **0**. Mutation Supabase : **0**.
