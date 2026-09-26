# CAPTCF — LOT 5A-C — Correctif borné (phase locale)

**Date :** 2026-09-26  
**Branche :** `captcf-lot-05a-c-correctif-borne`  
**Base :** `main` `a20e49a702c3c120aef1d0c81ccecf5d7fce7bee`  
**Cadrage :** `docs/handoffs/CAPTCF_LOT_05A_CORRECTIF_CADRAGE.md`  
**Pilote :** `docs/handoffs/CAPTCF_LOT_05A_SEANCE_AUDIO_PILOTE.md`

## Verdict local

Le correctif est dans le code et couvert par les tests. Il n’est pas activé par défaut. Aucune variante Louise n’a été régénérée. Aucun autre MP3 n’a été traité.

| Contrôle | Résultat |
|---|---|
| Appels Gemini | **0** |
| Mutation Supabase | **0** |
| Migration | **0** |
| Déploiement Edge | **0** |
| Push / PR | **0** |

## Comportement

Le drapeau `correctif_05a_c` vaut `false` par défaut. C’est le retour arrière : extraction des faits à chaque niveau, plafond d’items du contrat référentiel, aucune ligne `session_exercices` nouvelle.

Quand le drapeau est `true` :

1. `selectReusableFacts` reprend le premier ensemble déjà scellé pour la source et son `content_hash`. Les quatre niveaux reçoivent le même tableau et le même `facts_hash`. Si aucun ensemble n’existe, une seule extraction reste possible. Si deux hash coexistent, la génération s’arrête sur `FACTS_HASH_DIVERGED`.
2. `applyVariantItemCap` refuse toute variante de plus de six items (`VARIANT_ITEM_CAP_EXCEEDED`) avant enregistrement du payload. La validation de slice reçoit `maxItems: 6`. La publication refuse aussi ce dépassement lorsque le payload porte `generation.lot_05a_c`.
3. `linkPublishedExerciseToSession` et `unlinkPublishedExerciseFromSession` préparent une ligne `session_exercices` (`bloc: curriculum`, `statut: planifie`, `eleve_id: null`) pour une séance déjà existante. Ils échouent si la source, les faits ou la séance manquent. Aucune table nouvelle.

## Tests

`npm test -- src/test/lot05a-c-correctif.test.ts src/test/differentiation-family-slice.test.ts src/test/fact-extraction.test.ts`  
3 fichiers, 28 tests, réussis.

`npm run build` réussi. Avertissements de taille de bundle déjà présents.

## Fonctions à déployer en Phase B

- `generate-differentiation-family`
- `publish-differentiation-family`

La liaison séance est une bibliothèque (`supabase/functions/_shared/session-exercice-link.ts`). Elle n’a pas d’Edge propre. La Phase B doit l’appeler depuis une action formateur existante, ou autoriser explicitement une fonction mince, sans migration.

## Autorisation Phase B

> J’autorise la Phase B du Lot 5A-C sur la seule source `docs/fichiers oral/A2/louise_musique_et_ville.mp3` : déployer `generate-differentiation-family` et `publish-differentiation-family`, activer `correctif_05a_c` pour cette source, réutiliser le `facts_hash` commun, refuser toute variante au-delà de six items, et rattacher les exercices publiés à une séance curriculum existante via `session_exercices`. Une seule extraction de faits est permise si aucun ensemble scellé n’existe. Aucun autre MP3, aucune migration, aucun changement ADR/STT.

Sans cette phrase : pas de déploiement, pas d’appel Gemini, pas de mutation des familles Louise déjà publiées.
