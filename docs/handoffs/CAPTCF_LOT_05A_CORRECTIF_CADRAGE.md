# CAPTCF — Cadrage du lot correctif après Lot 5A

**Date :** 2026-09-26  
**Statut :** cadrage seul. Aucun développement tant qu’une autorisation distincte n’est pas donnée.  
**Base :** `main` après fusion de la PR #37 (`a20e49a702c3c120aef1d0c81ccecf5d7fce7bee`), commit de clôture `38024f8409cec8d2053c9b28c6f7facc7d3e64ce`.  
**Source unique déjà publiée :** `docs/fichiers oral/A2/louise_musique_et_ville.mp3` (`source_id` `4a0e8321-9ece-42d7-bf76-8825b1e65e79`).  
**Hors de ce lot :** autre MP3, migration de schéma, changement ADR/STT, bibliothèque de dialogues, backfill des anciens exercices, nouveau secret, nouveau déploiement Edge.

## Écarts constatés sur le pilote

1. Chaque appel à `generate-differentiation-family` recalcule `facts` puis `facts_hash` (`calculateFactsHash` dans `supabase/functions/generate-differentiation-family/index.ts`). Les quatre niveaux n’ont donc pas le même hash.
2. Le contrat référentiel autorise plus de six items selon la compétence. La variante B1 publiée en a sept. La validation actuelle compare au `volume_items_max` du contrat, pas à un plafond de six.
3. Le gate 5A a été tenu par le devoir `1a3ee07d-409e-4fec-af41-0f750ccc80f5`. Aucune ligne `session_exercices` de séance curriculum n’a été créée.

## Correctif borné

1. **Faits uniques.** Extraire les faits une seule fois depuis la transcription déjà revue de cette source, calculer un seul `facts_hash`, puis générer A1, A2, B1 et B2 sur cet objet. Refuser une variante dont le hash diffère.
2. **Six items.** Après génération, rejeter ou tronquer de façon explicite toute variante de cette famille au-delà de six items, avant validation humaine et avant publication. Le prompt seul ne suffit pas.
3. **Séance curriculum.** Lier les exercices publiés de cette famille à une séance de test déjà existante via `session_exercices`, sans créer d’élèves réels. Le devoir de test actuel reste en place.
4. **Retour arrière.** Tant que le correctif n’est pas activé, le comportement actuel reste celui de référence : extraction par niveau, plafond du contrat référentiel, liaison par devoir. Aucune republication et aucun nouvel appel Gemini ne partent pendant ce cadrage.

## Critère de sortie, après autorisation ultérieure

Même source Louise seulement. Quatre variantes publiées avec un `facts_hash` identique, au plus six items chacune, au moins l’exercice A2 jouable dans une séance curriculum, et le devoir pilote encore résoluble si la séance de test est retirée.
