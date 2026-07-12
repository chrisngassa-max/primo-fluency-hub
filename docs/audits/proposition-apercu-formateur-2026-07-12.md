# Proposition — Aperçu formateur isolé (avant toute migration)

> **Aucune migration n'a été créée.** Ce document propose deux options avec avantages/risques, comme
> demandé, pour décision avant tout travail de schéma. Contexte technique vérifié dans le code réel
> (pas d'hypothèse) : `exercise_attempts` (migration `20260414211154`) n'a aujourd'hui aucune colonne
> de type « contexte » — seulement `source_app text DEFAULT 'connect'`. `resultats` n'a pas non plus
> de colonne de ce type. Aucune des deux tables ne distingue une tentative élève d'une tentative
> formateur.

## Rappel de l'exigence

Le formateur doit pouvoir : répondre, lancer le chronomètre, écouter les audios, enregistrer une
réponse EO, voir la transcription, soumettre, consulter le corrigé, recommencer — **sans qu'aucune
donnée** n'alimente `resultats` élèves, ne modifie `profils_eleves`, ne crée de `session_live_events`,
ne génère de devoir, ni n'apparaisse dans le reporting de progression.

## Option A — Mode local/sandbox (aucune écriture)

**Principe** : l'aperçu formateur s'exécute **entièrement côté client**, en réutilisant les mêmes
fonctions de correction déjà présentes dans le repo (`src/lib/correctionExercice.ts` pour les formats
autocorrigés : qcm, vrai_faux, appariement, texte_lacunaire, transformation). Le formateur répond,
le composant appelle `corrigerExercice(...)` en mémoire, affiche le résultat — **rien ne part vers
Supabase**, ni `exercise_attempts`, ni `resultats`.

**Avantages**
- Garantie structurelle (pas seulement une exclusion de reporting a posteriori) : si rien n'est écrit,
  rien ne peut fuiter vers `resultats`/`profils_eleves`/`session_live_events`/`devoirs`. Zéro risque de
  bug d'exclusion incomplet.
- Aucune migration nécessaire.
- Instantané (pas d'aller-retour réseau pour la correction des formats autocorrigés).
- Réutilise `correctionExercice.ts` tel quel (déjà présent, déjà testé implicitement côté élève) —
  aucun nouveau moteur de correction à écrire.

**Risques / limites**
- Le chronomètre peut être simulé (composant `Timer` déjà utilisé côté `LivePilotingSection.tsx`),
  mais il n'est alors qu'une démonstration visuelle, pas un test du chronomètre *tel qu'il se
  comportera vraiment* pour l'élève (`DevoirPassation.tsx` utilise sa propre logique de timer liée à
  `duree_limite_secondes`/auto-submit — un test 100 % local ne passe pas par ce code réel).
- **Ne couvre pas l'audio** : écouter un `script_audio` (TTS) fonctionne très bien en local (le
  `TTSAudioPlayer` est un composant client pur), mais enregistrer une réponse EO puis voir sa
  transcription nécessite un aller-retour réel vers Google STT (`transcribe-audio`/
  `tcf-process-audio`) — cela ne peut pas rester 100 % local sans mocker la transcription, ce qui rend
  le test peu fiable pour justement ce qu'on veut vérifier (la qualité de la transcription).
- Ne teste pas `tcf-evaluate-answer` (évaluation IA des productions écrites/orales) en conditions
  réelles, seulement la correction déterministe (qcm/vrai_faux/etc.).

## Option B — `exercise_attempts.context` avec exclusions explicites

**Principe** : ajouter une colonne `context` (`learner` par défaut, ou `trainer_preview`, ou
`sandbox`) sur `exercise_attempts` (colonne proche de l'existant `source_app`, même table). Une
tentative formateur écrit normalement dans `exercise_attempts` (pour pouvoir appeler réellement
`transcribe-audio`, `tcf-process-audio`, `tcf-evaluate-answer`), **mais jamais dans `resultats`** —
la fonction `submit-devoir-result` (ou une variante dédiée) refuse d'insérer dans `resultats` quand
`context != 'learner'`. Toutes les policies RLS, triggers (`classifyAndEmitErrors`,
`mirror_resultat_to_attempt`, `detect_erreur_repetee`) et le reporting (`profils_eleves`,
`session_live_events`, génération de devoirs) doivent explicitement `WHERE context = 'learner'` ou
équivalent.

**Avantages**
- Permet de tester le **vrai** pipeline audio bout-en-bout : enregistrement réel → `transcribe-audio`
  (Google STT réel) → affichage de la vraie transcription → `tcf-evaluate-answer` (Gemini réel, avec
  les vrais `criteres_oraux`) → corrigé/modèle oral réel. C'est la seule option qui teste ce que
  l'élève va vraiment vivre pour l'EO.
- Le vrai chronomètre de `DevoirPassation.tsx` peut être exercé tel quel (même composant, juste
  alimenté par une tentative marquée `trainer_preview`).
- Traçabilité : le formateur peut consulter l'historique de ses propres tests (utile pour comparer
  plusieurs essais avant de publier un clone).

**Risques**
- **Surface de risque bien plus large** : chaque nouveau point d'écriture ou de lecture touchant
  `exercise_attempts`/`resultats` doit désormais penser à exclure `trainer_preview` — un oubli futur
  (nouveau composant, nouvelle fonction, nouvelle vue analytics) peut réintroduire une fuite. Nécessite
  une migration, des policies RLS à écrire/tester, et une discipline de revue de code durable, pas
  un simple mécanisme ponctuel.
- Coût : chaque test formateur consomme réellement des appels Google STT/TTS et Gemini (facturés),
  contrairement à l'Option A qui est gratuite pour les formats autocorrigés.
- Plus lent (aller-retour réseau réel) pour tester un simple QCM, alors que l'Option A suffirait
  largement pour ce cas.

## Préférence proposée (reprend celle du formateur, avec justification technique)

**Par défaut, Option A** pour tous les formats autocorrigés (qcm, vrai_faux, appariement,
texte_lacunaire, transformation) et pour la lecture audio TTS d'un support CO (`TTSAudioPlayer` est
déjà un composant purement client, pas besoin d'écrire quoi que ce soit pour l'écouter). **Option B
uniquement pour EO** (enregistrement + STT + évaluation IA), et éventuellement pour `production_ecrite`
si le formateur veut vérifier une vraie réponse de `tcf-evaluate-answer` avant publication — ces deux
cas sont les seuls qui nécessitent réellement un aller-retour serveur pour être testés fidèlement.

Concrètement, cela veut dire que l'« aperçu formateur » n'est **pas un mode unique** mais un
composant qui bascule intelligemment :
- format autocorrigé → Option A (aucune écriture, correction locale via `correctionExercice.ts`) ;
- `production_orale` (ou tout format nécessitant STT/TTS réel) → Option B (écriture
  `exercise_attempts` taguée `trainer_preview`, jamais `resultats`).

## Migration qu'impliquerait l'Option B (proposée, non appliquée)

```sql
-- PROPOSITION — NE PAS APPLIQUER SANS VALIDATION EXPLICITE
ALTER TABLE exercise_attempts
  ADD COLUMN context text NOT NULL DEFAULT 'learner'
  CHECK (context IN ('learner', 'trainer_preview', 'sandbox'));

-- Policies RLS à revoir (exemples, à affiner) :
--   - lecture reporting/profils : WHERE context = 'learner'
--   - triggers d'émission (classifyAndEmitErrors, detect_erreur_repetee,
--     mirror_resultat_to_attempt) : ne doivent jamais s'exécuter pour
--     context != 'learner'
```

Points à trancher avant d'écrire cette migration pour de vrai (à confirmer par le formateur) :
1. Confirme-t-on le déclenchement hybride (Option A pour l'autocorrigé, Option B seulement pour
   EO/production_ecrite), ou préfères-tu une seule option pour tout, plus simple à raisonner mais
   moins fidèle (A) ou plus coûteuse/risquée (B) ?
2. Si Option B validée : purge automatique des lignes `trainer_preview` après N jours (éviter
   l'accumulation d'`exercise_attempts` de test), ou conservation indéfinie pour traçabilité ?
3. `resultats` doit-il rester totalement fermé à `trainer_preview` (recommandé, comme demandé), ou
   le formateur veut-il un jour un historique de ses propres scores de test — auquel cas il faudrait
   une table séparée plutôt que de complexifier `resultats` avec une exclusion permanente ?
