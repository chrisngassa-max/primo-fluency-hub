# CapTCF — Lot 2A.1 — aide pédagogique sur le parcours devoir

**Date :** 2026-09-28  
**Branche :** `captcf-lot-02a1-assistant-devoir`  
**Base :** `origin/main` `3c9b5aa4524c3b5605a8a9c0a75eb53fb6cfc3c9`  
**Projet Supabase :** `gudcenhmzlcvhgbgklzw`

## Clôture Phase B Lot 2A (rappel)

- PR [#39](https://github.com/chrisngassa-max/primo-fluency-hub/pull/39) fusionnée.
- Production frontend / `main` : `3c9b5aa4524c3b5605a8a9c0a75eb53fb6cfc3c9`.
- Edge `captcf-assistant-qa` : version **7**, ACTIVE, `verify_jwt=true`.
- Recette séance : réussie (consigne, refus avant remise, explication après libération, replay/évaluation, Atelier, recommandation).
- Parcours devoir : refuse proprement l’aide (contexte non vérifiable).
- Appels Gemini : **0**. Secret IA non réactivé.
- Compte temporaire de recette banni, sessions/refresh révoqués, consentement révoqué.

## Cause exacte

Le chargeur Lot 2A cherchait `exercise_assignments.source_devoir_id` pour rattacher un devoir à une tentative.

Cette colonne **n’existe pas** dans le schéma exposé en production (`src/integrations/supabase/types.ts` : `exercise_assignments` n’a que `id`, `exercise_id`, `learner_id`, `group_id`, `assigned_by`, `context`, `due_date`, `sync_status`, `created_at`). La lecture échouait ; le chemin devoir retournait le fallback visible.

Le parcours réel de remise n’utilise pas cette colonne :

1. `DevoirPassation` appelle `submit-devoir-result` avec `devoir_id`.
2. L’Edge authentifie l’élève, vérifie `devoirs.eleve_id`, charge l’exercice, corrige, puis **insère `resultats`** (`devoir_id`, `eleve_id`, `exercice_id`).
3. L’UI relit la remise et `correction_released_at` depuis **`resultats`**.
4. Le miroir `mirror_resultat_to_attempt` peut compléter `exercise_attempts`, mais ce n’est pas la preuve de remise utilisée par l’écran devoir.

## Relation retenue

Pour le mode devoir, le serveur lit désormais **`resultats`** avec le JWT élève :

- filtres : `devoir_id` (sélecteur vérifié), `eleve_id = auth.uid()`, `exercice_id` du devoir vérifié ;
- `submitted` = existence d’une ligne `resultats` concordante ;
- `correctionReleased` = `correction_released_at` renseigné, hors évaluation.

Aucune déclaration client (mode, remise, libération) n’est une preuve.  
Le chemin séance continue d’utiliser `exercise_attempts` ancré à `session_id` (+ `attemptId` si fourni).  
`exercise_assignments` n’est plus interrogé par l’assistant.

## Correctif local

Fichiers :

- `supabase/functions/_shared/assistant-pedagogique/load.ts`
- `supabase/functions/_shared/assistant-pedagogique/fixtures.ts`
- `supabase/functions/_shared/assistant-pedagogique/pedagogique.test.ts`

## Vérification locale

- 20 tests serveur Lot 2A (dont 2 cas devoir `resultats` / absence d’`exercise_assignments`)
- 4 tests panneau
- 26 tests accueil
- Total **50/50**
- `npm.cmd run build` PASS
- `git diff --check` PASS

## Besoin de migration

**Non.** La relation `resultats.devoir_id` existe déjà et est celle du parcours de remise.

## Hors périmètre / non exécuté

Aucun push, PR, déploiement, migration, mutation Supabase, compte temporaire, modification Louise, Lot 2B, ni appel Gemini.
