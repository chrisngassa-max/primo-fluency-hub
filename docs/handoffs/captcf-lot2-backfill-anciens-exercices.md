# Ticket — Backfill idempotent de `contenu.audio` pour les exercices audio publiés avant le Lot 2

**Statut :** à planifier (ne pas exécuter sans audit préalable).
**Chantier :** distinct du Lot 2 (branch/PR séparée).
**Lien :** `docs/handoffs/captcf-lot2-audio-original-apprenant.md`

## Contexte

Le Lot 2 (`feat/audio-studio-next`) fait en sorte que les **nouvelles**
publications embarquent `contenu.audio` (référence stable `{ source_id,
source_content_hash, mime_type }`), ce qui permet à l'apprenant d'entendre le
MP3 original via `resolve-exercise-audio`.

Les exercices audio CO publiés **avant** ce lot n'ont pas `contenu.audio` :
ils restent dans l'ancien comportement (TTS en devoirs/play ; message
explicite + silence en séance live). Ce n'est pas un bug, c'est l'état
documenté. Ce ticket vise à les rattacher rétroactivement à leur source audio
**si et seulement si** cela est sûr.

## Pourquoi pas une simple republication ?

La republication depuis la même famille est bloquée par le hardening existant :
`differentiation_families.published_exercise_id` est unique et la fonction
`publish-differentiation-family` renvoie 409 `FAMILY_ALREADY_PUBLISHED`. On ne
peut donc pas « republier pour rien » afin d'ajouter `contenu.audio`.

## Approche exigée (backfill serveur borné et idempotent)

Le backfill, s'il a lieu, **doit** :

1. **Reconstruire `contenu.audio` exclusivement depuis la base**, jamais depuis
   une donnée client :
   ```text
   exercices.id
   = differentiation_families.published_exercise_id
   = (familles review_status = 'published')
   → differentiation_families.source_id
   → differentiation_families.source_content_hash
   → pedagogical_sources (pour mime_type + vérification source_kind = 'audio')
   ```
2. **Idempotent** : `contenu.audio` n'est ajouté que s'il est absent ;
   ré-exécuter le backfill ne modifie rien.
3. **Borné** : ne traiter que les exercices CO publiés depuis une famille,
   dont la source est encore `source_kind = 'audio'`, `status = 'analyzed'`,
   `review_status ∈ (utilisable, valide)`, et `content_hash` concordant avec
   `family.source_content_hash` (triple cohérence, comme le résolveur).
4. **Audit préalable obligatoire** : compter les exercices concernés, vérifier
   leur état, valider qu'aucun n'est `source_stale`. Ne pas lancer le backfill
   tant que cet audit n'est pas publié.
5. **Ne jamais écraser** un `contenu.audio` déjà présent (même s'il semble
   incorrect — la correction se fait par republication après génération d'une
   nouvelle famille).
6. **Transactionnel + journalisé** : chaque exercice modifié est tracé.

## Étapes préalables (à faire avant tout backfill)

- [ ] Audit : `SELECT count(*) FROM exercices e JOIN differentiation_families f
      ON f.published_exercise_id = e.id WHERE e.competence = 'CO' AND
      (e.contenu->'audio') IS NULL;`
- [ ] Vérifier l'état `source_stale` de chaque candidat.
- [ ] Décider (documenté) : backfill partiel (exercices sains uniquement) ou
      total (avec retrait des exercices stale).
- [ ] PR séparée, migration SQL `UPDATE ... SET contenu = ...` bornée.

## Risques

- Rattacher un exercice à une source qui a depuis été corrigée
  (`source_stale`) donnerait à l'apprenant un audio obsolète : le filtre
  `source_stale` et la triple cohérence hash sont obligatoires.
- Un exercice publié depuis une source supprimée (`ON DELETE CASCADE`) n'a
  plus de famille/source : à exclure.
