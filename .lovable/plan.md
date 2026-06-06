# Préparation automatique des séances

Dès qu'une séance est créée (via formulaire, curriculum ou duplication), le système prépare automatiquement trois livrables, visibles sur l'écran « Piloter la séance ».

## 1. Rétrospective de la séance précédente (vue formateur)

**Source** : devoirs et résultats de la dernière séance terminée du même groupe.

**Contenu affiché dans un panneau en haut de SessionPilot** :
- Taux de réussite global du groupe sur les devoirs précédents (% moyen)
- Liste élève par élève : nom + score moyen + badge (✅ acquis / 🟧 fragile / 🔴 en difficulté)
- Top 3 des items majoritairement échoués (question + % d'échec + compétence)
- Bouton « Voir le détail » → ouvre la page bilan complète existante

**Stockage** : nouvelle table `session_retrospectives` (session_id, group_stats jsonb, eleve_stats jsonb, items_echoues jsonb).

## 2. Prédiagnostic élèves (combiné thème + compétences)

**Génération IA** via une nouvelle fonction qui réutilise la logique de `generate-diagnostic-test` :
- 6 à 8 questions ciblant à la fois le **thème** de la séance (extrait du titre/objectifs) et les **compétences cibles** déclarées
- Format QCM 4 choix conforme TCF IRN
- Niveau aligné sur `niveau_cible` de la séance

**Stockage** : enregistré dans la table existante `bilan_tests` avec `statut = 'pret'`, prêt à être envoyé en début de séance par le formateur depuis SessionPilot.

**UX SessionPilot** : carte « Prédiagnostic prêt » avec bouton « Envoyer aux élèves » + aperçu des questions.

## 3. Cinq exercices auto-générés (pool commun)

**Génération IA** via `generate-exercises` (déjà existant) :
- 5 exercices répartis sur les compétences cibles de la séance
- Difficulté alignée sur le niveau cible
- Thème = titre/objectifs de la séance

**Stockage** : insérés dans `exercices` (formateur_id, is_ai_generated=true) + liés via `session_exercices` avec un flag `auto_generated=true`.

**UX SessionPilot** : ils apparaissent dans la liste d'exercices existante, marqués d'un badge « ✨ Auto », le formateur les lance/assigne quand il veut pendant la séance.

## Détails techniques

**Nouvelle edge function** `prepare-session-kit` :
- Input : `{ session_id }`
- Étapes (en parallèle quand possible) :
  1. Calcule la rétrospective (requêtes SQL sur devoirs/resultats de la séance N-1 du groupe)
  2. Appelle Lovable AI Gateway pour générer le prédiagnostic → insert `bilan_tests`
  3. Appelle Lovable AI Gateway pour générer 5 exercices → insert `exercices` + `session_exercices`
  4. Insert `session_retrospectives`
- Si pas de séance précédente → skip rétrospective (panneau vide avec message)

**Migration SQL** :
- `CREATE TABLE session_retrospectives` + grants + RLS (formateur du groupe)
- `ALTER TABLE session_exercices ADD COLUMN auto_generated boolean DEFAULT false`

**Déclenchement côté client** : après chaque `insert sessions` réussi dans `Seances.tsx` (3 endroits : handleCreate, handleCreateFromCurriculum, handleDuplicate), `supabase.functions.invoke('prepare-session-kit', { body: { session_id } })` en fire-and-forget avec toast « Préparation en cours… ».

**SessionPilot** : ajouter en tête une section « Préparation auto » avec 3 sous-blocs (Rétrospective / Prédiagnostic / Exercices prêts), avec skeleton tant que le kit n'est pas prêt et bouton « Régénérer » manuel.

## Hors scope (à confirmer plus tard)

- Notifications email automatiques aux élèves
- Régénération automatique si la séance est modifiée après création
- Différenciation par niveau d'élève sur les 5 exercices (actuellement pool commun selon votre choix)
