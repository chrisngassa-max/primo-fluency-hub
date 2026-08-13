# CapTCF — Lot 2 : lecture du MP3 original côté apprenant

Branche : `feat/audio-studio-next`
Worktree : `C:\Users\Sofiane\Documents\New project\primo-audio-zai`
Base : `fa14b91` (fix(a2): reject unreliable audio timestamps)

## Objectif

Un apprenant autorisé entend **le MP3 original** importé par le formateur,
et non plus une synthèse TTS de la transcription (ou rien du tout en séance
live). La transcription reste une donnée pédagogique, jamais un substitut du
fichier audio.

## Cause racine (avant ce lot)

1. `publish-differentiation-family` ne stockait aucune référence à la source
   audio dans l'exercice publié (seulement `contenu.script_audio`, le texte).
2. Le sanitizer `session-content-sanitizer.ts` supprimait `script_audio` :
   en séance live, l'apprenant n'avait **aucun** audio.
3. Le bucket `pedagogical-sources` est privé (RLS formateur/admin) : aucun
   chemin n'existait pour qu'un apprenant y accède.

## Architecture mise en place

```
exercice → contenu.audio { source_id, source_content_hash, mime_type }   (référence stable ; NI bucket NI path)
  → resolve-exercise-audio (1 contexte exact ; verify_jwt=false car play_token public ; auth manuelle complète)
    → autorisation contextuelle renforcée (session/devoir/play/preview)
    → exercice ↔ differentiation_families.published_exercise_id ↔ source_id (cohérence)
    → triple comparaison hash : contenu.audio = family.source_content_hash = pedagogical_sources.content_hash
    → contrôles source_stale / status=analyzed / review_status∈(utilisable,valide) / source_kind=audio
    → lecture serveur pedagogical_sources (bucket/path lus serveur uniquement)
    → URL signée courte (10 min) → MP3 original
```

**Jamais** : bucket/path fourni par le client → signature directe.
**Jamais** : fallback TTS sur un original référencé défaillant (`stale`/`unavailable`).
**Jamais** : `script_audio` dans la réponse de séance (faille pédagogique : réponses lisibles dans le trafic réseau).

## Fichiers créés

- `supabase/functions/_shared/pedagogical-source-audio.ts` — résolveur (résultat discriminé, triple hash, contrôles).
- `supabase/functions/resolve-exercise-audio/index.ts` — endpoint dédié (4 modes d'autorisation, JWT strict, `Cache-Control: no-store`).
- `src/lib/exerciseAudio.ts` — service frontend (décodage des `FunctionsHttpError`, cache contextuel non persistant).
- `src/components/eleve/CoAudioPlayer.tsx` — lecteur CO partagé (machine à états d'écoutes).
- `supabase/functions/_shared/pedagogical-source-audio.test.ts` — 14 tests résolveur.
- `src/test/exerciseAudio.test.ts` — 10 tests service (décodage HTTP + cache).

## Fichiers modifiés

- `supabase/functions/_shared/family-to-exercice-adapter.ts` — param `audioRef`, `contenu.audio`.
- `supabase/functions/publish-differentiation-family/index.ts` — select source étendu (`source_kind`, `mime_type`), construction `audioRef`.
- `supabase/functions/_shared/session-content-sanitizer.ts` — `has_original_audio` (uniquement ; pas `script_audio`).
- `supabase/config.toml` — `[functions.resolve-exercise-audio] verify_jwt = false`.
- `src/lib/curriculum/learnerSession.ts` — `LearnerExerciseBlock.has_original_audio`.
- `src/contexts/AuthContext.tsx` — `clearExerciseAudioCache()` au logout.
- `src/pages/eleve/SeanceApprenant.tsx` — `CoAudioPlayer` (séance live ; ancien exercice → message explicite).
- `src/pages/eleve/DevoirPassation.tsx` — `CoAudioPlayer` (gate écoutes préservée).
- `src/pages/PlayExercise.tsx` — `CoAudioPlayer` (mode play_token public).
- `src/components/ExerciseStudentPreviewDialog.tsx` — `CoAudioPlayer` (mode preview formateur).
- `src/test/family-to-exercice-adapter.test.ts` — 3 cas audio/non-audio ajoutés.
- `supabase/functions/_shared/session-content-sanitizer.test.ts` — 5 cas `has_original_audio` + absence `script_audio`.

## Tests / build

- Suite complète : **95 fichiers / 705 tests réussis**.
- Build Vite : **réussi**.
- Tests ciblés Lot 2 : adapter (4), sanitizer (21), résolveur (14), service (10).

## Anciens exercices audio déjà publiés (avant ce lot)

Les exercices publiés **avant** ce lot n'ont pas `contenu.audio` : ils ne
bénéficient **pas** automatiquement du MP3 original.

**Décision : pas de modification rétroactive dans ce lot.** Les anciens
exercices restent dans leur comportement antérieur (TTS en devoirs/play ;
silence + message explicite en séance live). Un backfill éventuel fera
l'objet d'un ticket séparé (`docs/handoffs/captcf-lot2-backfill-anciens-exercices.md`)
après audit du nombre et de l'état des exercices concernés. Ce backfill, s'il
a lieu, devra **reconstruire `contenu.audio` exclusivement depuis
`differentiation_families.source_id` et `source_content_hash`**, jamais depuis
une donnée client, et devra être **borné et idempotent**.

La republication simple depuis la même famille **n'est pas** la voie
recommandée : le hardening existant bloque la double publication via
`published_exercise_id` (409 `FAMILY_ALREADY_PUBLISHED`).

## Limites restantes

- **Playwright/E2E** : le scaffolding existe mais reste inopérant hors
  environnement Lovable (`lovable-agent-playwright-config` absent du
  `package.json`). Le parcours E2E authentifié doit donc être rejoué
  manuellement après déploiement (séance live + devoir + cas non autorisé).
- **TTS en séance live pour les anciens exercices** : délibérément non
  restauré (la transcription ne doit pas être exposée). Message explicite
  affiché : « Audio original indisponible pour cet ancien exercice. »
- **TTL URL signée (10 min)** : en cas de session très longue, le cache
  frontend (8 min) déclenchera une re-résolution automatique ; le renouvellement
  ne consomme pas d'écoute (machine à états conservée).

## Fonctions à redéployer

Après vérification (`npx supabase functions list --project-ref gudcenhmzlcvhgbgklzw`) :
- `publish-differentiation-family` (modifiée).
- `resolve-exercise-audio` (nouvelle, `--no-verify-jwt` implicite via config.toml).
- `get-seance-content` (embarque le sanitizer modifié).
- Tout autre consommateur de `session-content-sanitizer.ts` identifié par
  `grep -r "session-content-sanitizer" supabase/functions/`.

**Pas de redéploiement en bloc** : uniquement les fonctions impactées.
